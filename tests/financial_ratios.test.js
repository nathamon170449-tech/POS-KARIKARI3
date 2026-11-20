const assert = require('assert');
const {
  calculateFifoCogs,
  calculateFinancialRatios,
  isDuplicateSlip,
  parseThaiSlipMiniQR
} = require('../src/utils/financial_ratios');

console.log('================================================================');
console.log('เริ่มการรัน Unit Tests: ระบบ POS + บัญชี + อัตราส่วนการเงิน SME ไทย');
console.log('================================================================\n');

// Test 1: FIFO COGS
{
  const lots = [
    { id: 1, qtyRemaining: 10, unitCost: 30 },
    { id: 2, qtyRemaining: 15, unitCost: 36 }
  ];
  const res = calculateFifoCogs(lots, 15);
  assert.strictEqual(res.totalCogs, 480);
  assert.strictEqual(res.averageUnitCost, 32);
  assert.strictEqual(res.updatedLots[0].qtyRemaining, 0);
  assert.strictEqual(res.updatedLots[1].qtyRemaining, 10);
  console.log('[PASS] Test 1: คำนวณต้นทุนขาย (COGS) ตามล็อตย้อนหลัง (FIFO) ถูกต้อง (10x30 + 5x36 = 480 บาท)');
}

// Test 2: Missing Balance Sheet -> "ยังคำนวณไม่ได้"
{
  const resultNoBS = calculateFinancialRatios({
    revenue: 100000,
    cogs: 60000,
    operatingExpenses: 15000,
    inventoryValue: 20000,
    beginningInventoryValue: 20000,
    periodDays: 30,
    balanceSheet: null
  });

  assert.strictEqual(resultNoBS.ratios.grossMargin.value, 40);
  assert.strictEqual(resultNoBS.ratios.netMargin.value, 25);
  assert.strictEqual(resultNoBS.ratios.inventoryTurnover.value, 3);
  assert.strictEqual(resultNoBS.ratios.daysInventory.value, 10);
  assert.strictEqual(resultNoBS.ratios.roa.value, null);
  assert(resultNoBS.ratios.roa.status.includes('ยังคำนวณไม่ได้'));
  assert(resultNoBS.ratios.currentRatio.status.includes('ยังคำนวณไม่ได้'));
  assert(resultNoBS.ratios.debtToEquity.status.includes('ยังคำนวณไม่ได้'));
  console.log('[PASS] Test 2: ป้องกันการเดาตัวเลขเมื่อยังไม่กรอกงบดุล แสดง "ยังคำนวณไม่ได้" ครบทุกตัว');
}

// Test 3: All 12 Financial Ratios with hand-verifiable numbers
{
  const res = calculateFinancialRatios({
    revenue: 100000,
    cogs: 60000,
    operatingExpenses: 15000,
    inventoryValue: 20000,
    beginningInventoryValue: 20000,
    periodDays: 30,
    balanceSheet: {
      isSubmitted: true,
      cashAndBank: 50000,
      accountsReceivable: 10000,
      otherCurrentAssets: 0,
      fixedAssets: 40000,
      accountsPayable: 15000,
      shortTermDebt: 25000,
      longTermDebt: 0,
      ownerEquity: 80000,
      interestExpense: 1000
    }
  });

  assert.strictEqual(res.ratios.grossMargin.value, 40.00);
  assert.strictEqual(res.ratios.netMargin.value, 24.00);
  assert.strictEqual(res.ratios.roa.value, 20.00);
  assert.strictEqual(res.ratios.roe.value, 30.00);
  assert.strictEqual(res.ratios.currentRatio.value, 2.00);
  assert.strictEqual(res.ratios.quickRatio.value, 1.50);
  assert.strictEqual(res.ratios.inventoryTurnover.value, 3.00);
  assert.strictEqual(res.ratios.daysInventory.value, 10.00);
  assert.strictEqual(res.ratios.arTurnover.value, 10.00);
  assert.strictEqual(res.ratios.apTurnover.value, 4.00);
  assert.strictEqual(res.ratios.debtToEquity.value, 0.50);
  assert.strictEqual(res.ratios.interestCoverage.value, 25.00);
  console.log('[PASS] Test 3: ตรวจสอบสูตรอัตราส่วนทางการเงินครบทั้ง 12 ตัว ตรงกับผลคำนวณมือ 100%');
}

// Test 4: Duplicate Slip & EMVCo Mini-QR parser
{
  const savedSlips = [
    { transRef: '014256911200001234', amount: 450.00, transTime: '10:30' }
  ];
  const dupCandidate = { transRef: '014256911200001234', amount: 450.00, transTime: '10:30' };
  const newCandidate = { transRef: '014256911200009999', amount: 450.00, transTime: '10:35' };

  assert.strictEqual(isDuplicateSlip(savedSlips, dupCandidate), true);
  assert.strictEqual(isDuplicateSlip(savedSlips, newCandidate), false);

  const qrDecoded = parseThaiSlipMiniQR('0041000600000101030040220010256911201422889115102TH91049C30');
  assert.strictEqual(qrDecoded.bankCode, '004');
  assert.strictEqual(qrDecoded.transRef, '01025691120142288911');
  console.log('[PASS] Test 4: ระบบกันสลิปซ้ำและการถอดรหัส EMVCo Mini-QR สลิปธนาคารไทยทำงานถูกต้อง');
}

console.log('\n================================================================');
console.log('สรุปผล: Unit Tests ทั้งหมด 4 ชุด (18 กรณีทดสอบย่อย) ผ่าน 100%');
console.log('================================================================');
