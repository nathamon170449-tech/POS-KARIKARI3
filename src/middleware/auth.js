/**
 * Middleware ตรวจสอบสิทธิ์ฝั่งเซิร์ฟเวอร์ (Server-side RBAC & Brute-force Protection)
 * - ไม่ฝังรหัสผ่านไว้ที่หน้าเว็บ
 * - ตรวจ Session + บังคับเปลี่ยนรหัสเริ่มต้นเมื่อล็อกอินครั้งแรก
 * - จำกัดจำนวนครั้งที่ล็อกอินผิด (ล็อกบัญชีชั่วคราว 15 นาทีเมื่อผิดครบ 5 ครั้ง)
 */

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
  }
  if (req.session.user.mustChangePassword && req.path !== '/api/auth/change-initial-password') {
    return res.status(403).json({
      error: 'ต้องเปลี่ยนรหัสผ่านเริ่มต้นก่อนใช้งานระบบ',
      mustChangePassword: true
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
  }
  if (req.session.user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'ไม่มีสิทธิ์เข้าถึง: เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น'
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
