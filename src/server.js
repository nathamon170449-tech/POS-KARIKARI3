/**
 * เซิร์ฟเวอร์หลัก: ระบบ POS + บัญชี + อ่านสลิป สำหรับ SME ไทย
 * รันด้วยคำสั่ง: npm start (พอร์ตเริ่มต้น 3000)
 */
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const {
  calculateFifoCogs,
  calculateFinancialRatios,
  isDuplicateSlip,
  parseThaiSlipMiniQR
} = require('./utils/financial_ratios');

const app = express();
const PORT = process.env.PORT || 3000;

// โฟลเดอร์เก็บรูปสลิปแบบส่วนตัว (อยู่นอก public folder ห้ามเข้าถึงโดยไม่ล็อกอิน)
const PRIVATE_SLIP_DIR = path.join(__dirname, '..', 'private_uploads', 'slips');
fs.mkdirSync(PRIVATE_SLIP_DIR, { recursive: true });

// ตั้งค่าฐานข้อมูล SQLite
const dbPath = path.join(__dirname, '..', 'db', 'siam_sme_pos.sqlite');
const db = new Database(dbPath);
const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
db.exec(schemaSql);

// สร้างบัญชีเริ่มต้นหากยังไม่มี (รหัสผ่านถูก Hash ด้วย bcrypt cost=12 และบังคับเปลี่ยนเมื่อล็อกอินครั้งแรก)
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('Naito');
if (!adminExists) {
  const initialAdminPass = process.env.INITIAL_ADMIN_PASSWORD || '170449Poo';
  const hash = bcrypt.hashSync(initialAdminPass, 12);
  db.prepare(`
    INSERT INTO users (username, full_name, role, password_hash, must_change_password, is_active)
    VALUES ('Naito', 'Naito (ผู้ดูแลระบบ / Admin)', 'ADMIN', ?, 0, 1)
  `).run(hash);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-with-strong-random-env-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));

// จำกัดชนิดและขนาดไฟล์สลิปที่อัปโหลด (เฉพาะ JPG, PNG, WEBP ขนาดไม่เกิน 5 MB)
const uploadSlip = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRIVATE_SLIP_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `slip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP ขนาดไม่เกิน 5MB เท่านั้น'));
    }
    cb(null, true);
  }
});

function logAudit(user, actionType, targetEntity, detail, ip = '') {
  db.prepare(`
    INSERT INTO audit_logs (actor_id, actor_name, actor_role, action_type, target_entity, detail, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user?.id || null, user?.fullName || 'SYSTEM', user?.role || 'SYSTEM', actionType, targetEntity, detail, ip);
}

// 1. API เข้าสู่ระบบ พร้อมจำกัดจำนวนครั้งที่ล็อกอินผิด (5 ครั้ง ล็อก 15 นาที)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ' });
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(429).json({
      error: `บัญชีถูกล็อกชั่วคราวเนื่องจากใส่รหัสผิดเกินกำหนด กรุณารอถึง ${user.locked_until}`
    });
  }

  const match = bcrypt.compareSync(String(password || ''), user.password_hash);
  if (!match) {
    const attempts = user.failed_attempts + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockUntil, user.id);
    logAudit({ id: user.id, fullName: user.full_name, role: user.role }, 'LOGIN_FAILED', 'users', `ใส่รหัสผิดครั้งที่ ${attempts}`, req.ip);
    return res.status(401).json({
      error: attempts >= 5
        ? 'คุณใส่รหัสผ่านผิดครบ 5 ครั้ง บัญชีถูกล็อกชั่วคราว 15 นาที'
        : `รหัสผ่านไม่ถูกต้อง (เหลือโอกาสอีก ${5 - attempts} ครั้ง)`
    });
  }

  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
  req.session.user = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password)
  };
  logAudit(req.session.user, 'LOGIN_SUCCESS', 'users', 'เข้าสู่ระบบสำเร็จ', req.ip);
  res.json({ user: req.session.user });
});

// 2. API ดึงรูปสลิปแบบส่วนตัว (ต้องล็อกอินก่อนเท่านั้น ห้ามเปิดเป็น Public URL)
app.get('/api/slips/:id/image', requireAuth, (req, res) => {
  const slip = db.prepare('SELECT private_file_path FROM slips WHERE id = ?').get(req.params.id);
  if (!slip) return res.status(404).json({ error: 'ไม่พบรูปสลิป' });
  const safePath = path.resolve(PRIVATE_SLIP_DIR, path.basename(slip.private_file_path));
  if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'ไม่พบไฟล์รูปสลิปในระบบ' });
  res.sendFile(safePath);
});

// 3. API คำนวณอัตราส่วนทางการเงิน (เฉพาะ Admin เท่านั้น)
app.get('/api/admin/financial-ratios', requireAdmin, (req, res) => {
  const monthKey = req.query.month || '2569-11';
  const salesAgg = db.prepare(`
    SELECT COALESCE(SUM(grand_total - vat_amount), 0) AS revenue,
           COALESCE(SUM(total_cogs), 0) AS cogs
    FROM sales
  `).get();
  const expenseAgg = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS expenses
    FROM slips
    WHERE record_type = 'EXPENSE_SLIP' AND category != 'ค่าสินค้า'
  `).get();
  const invAgg = db.prepare(`
    SELECT COALESCE(SUM(qty_remaining * unit_cost), 0) AS inv_value
    FROM cost_lots
  `).get();
  const bsRow = db.prepare('SELECT * FROM monthly_balance_sheets WHERE month_key = ?').get(monthKey);

  const result = calculateFinancialRatios({
    revenue: salesAgg.revenue,
    cogs: salesAgg.cogs,
    operatingExpenses: expenseAgg.expenses,
    inventoryValue: invAgg.inv_value,
    periodDays: 30,
    balanceSheet: bsRow ? {
      isSubmitted: Boolean(bsRow.is_submitted),
      cashAndBank: bsRow.cash_and_bank,
      accountsReceivable: bsRow.accounts_receivable,
      otherCurrentAssets: bsRow.other_current_assets,
      fixedAssets: bsRow.fixed_assets,
      accountsPayable: bsRow.accounts_payable,
      shortTermDebt: bsRow.short_term_debt,
      longTermDebt: bsRow.long_term_debt,
      ownerEquity: bsRow.owner_equity,
      interestExpense: bsRow.interest_expense
    } : null
  });

  res.json(result);
});

app.use(express.static(path.join(__dirname, '..', 'public')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Siam Smart POS SME Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
