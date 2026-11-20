/**
 * สคริปต์สำรองฐานข้อมูลอัตโนมัติ (Database Backup Script)
 * รันด้วยคำสั่ง: npm run backup
 */
const fs = require('fs');
const path = require('path');

const srcDb = path.join(__dirname, '..', 'db', 'siam_sme_pos.sqlite');
const backupDir = path.join(__dirname, '..', 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destDb = path.join(backupDir, `siam_sme_pos_backup_${stamp}.sqlite`);

if (fs.existsSync(srcDb)) {
  fs.copyFileSync(srcDb, destDb);
  console.log(`สำรองฐานข้อมูลสำเร็จ: ${destDb}`);
} else {
  console.log('ยังไม่มีไฟล์ฐานข้อมูลให้สำรอง กรุณารันระบบอย่างน้อย 1 ครั้งก่อน');
}
