-- โครงสร้างฐานข้อมูล SQLite สำหรับระบบ POS + บัญชี SME ไทย
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'STAFF')),
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  cost_price REAL NOT NULL CHECK(cost_price >= 0),
  selling_price REAL NOT NULL CHECK(selling_price >= 0),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'ชิ้น',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cost_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  qty_received INTEGER NOT NULL CHECK(qty_received > 0),
  qty_remaining INTEGER NOT NULL CHECK(qty_remaining >= 0),
  unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
  note TEXT
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK(movement_type IN ('IN', 'SALE', 'ADJUST')),
  qty_change INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  reason TEXT NOT NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no TEXT UNIQUE NOT NULL,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  vat_enabled INTEGER NOT NULL DEFAULT 1,
  vat_amount REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL,
  total_cogs REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'TRANSFER', 'QR')),
  cash_received REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL CHECK(qty > 0),
  selling_price REAL NOT NULL,
  unit_cost_at_sale REAL NOT NULL,
  line_total REAL NOT NULL,
  line_cogs REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS slips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_type TEXT NOT NULL CHECK(record_type IN ('INCOME_SLIP', 'EXPENSE_SLIP')),
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  trans_ref TEXT NOT NULL,
  trans_date_be TEXT NOT NULL,
  trans_time TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  sender_name TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('ยอดขายหน้าร้าน', 'ค่าสินค้า', 'ค่าเช่า', 'ค่าน้ำไฟ', 'เงินเดือน', 'อื่นๆ')),
  linked_sale_id INTEGER NULL REFERENCES sales(id),
  private_file_path TEXT NOT NULL,
  qr_payload TEXT NULL,
  verified_by INTEGER NOT NULL REFERENCES users(id),
  verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trans_ref, amount, trans_time)
);

CREATE TABLE IF NOT EXISTS monthly_balance_sheets (
  month_key TEXT PRIMARY KEY,
  cash_and_bank REAL NULL,
  accounts_receivable REAL NULL,
  other_current_assets REAL NULL,
  fixed_assets REAL NULL,
  accounts_payable REAL NULL,
  short_term_debt REAL NULL,
  long_term_debt REAL NULL,
  owner_equity REAL NULL,
  interest_expense REAL NULL,
  is_submitted INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER NULL REFERENCES users(id),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NULL REFERENCES users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  detail TEXT NOT NULL,
  ip_address TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
