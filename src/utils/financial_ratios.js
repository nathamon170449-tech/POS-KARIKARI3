function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function calculateFifoCogs(lots, qtyToSell) {
  let remainingToFulfill = qtyToSell;
  let totalCogs = 0;
  const updatedLots = lots.map(l => ({ ...l }));
  const deductions = [];

  for (const lot of updatedLots) {
    if (remainingToFulfill <= 0) break;
    if (lot.qtyRemaining <= 0) continue;

    const takeQty = Math.min(lot.qtyRemaining, remainingToFulfill);
    const lotCost = takeQty * lot.unitCost;
    totalCogs += lotCost;
    lot.qtyRemaining -= takeQty;
    remainingToFulfill -= takeQty;
    deductions.push({ lotId: lot.id, qtyTaken: takeQty, unitCost: lot.unitCost, cost: round2(lotCost) });
  }

  if (remainingToFulfill > 0) {
    throw new Error(`สต็อกไม่เพียงพอ ขาดอีก ${remainingToFulfill} ชิ้น`);
  }

  return {
    totalCogs: round2(totalCogs),
    averageUnitCost: round2(totalCogs / qtyToSell),
    updatedLots,
    deductions
  };
}

function calculateFinancialRatios(params) {
  const {
    revenue = 0,
    cogs = 0,
    operatingExpenses = 0,
    inventoryValue = 0,
    beginningInventoryValue = null,
    periodDays = 30,
    balanceSheet = null
  } = params;

  const grossProfit = round2(revenue - cogs);
  const ebit = round2(grossProfit - operatingExpenses);
  const hasBalanceSheet = Boolean(balanceSheet && balanceSheet.isSubmitted);
  const interestExpense = hasBalanceSheet && typeof balanceSheet.interestExpense === 'number'
    ? balanceSheet.interestExpense
    : 0;
  const netProfit = round2(ebit - interestExpense);

  const avgInventory = beginningInventoryValue !== null
    ? (beginningInventoryValue + inventoryValue) / 2
    : inventoryValue;

  const grossMargin = revenue > 0
    ? { value: round2((grossProfit / revenue) * 100), unit: '%', status: 'OK' }
    : { value: null, unit: '%', status: 'ยังคำนวณไม่ได้ (ไม่มีรายได้)' };

  const netMargin = revenue > 0
    ? { value: round2((netProfit / revenue) * 100), unit: '%', status: 'OK' }
    : { value: null, unit: '%', status: 'ยังคำนวณไม่ได้ (ไม่มีรายได้)' };

  const inventoryTurnover = avgInventory > 0
    ? { value: round2(cogs / avgInventory), unit: 'รอบ', status: 'OK' }
    : { value: null, unit: 'รอบ', status: 'ยังคำนวณไม่ได้ (ไม่มีสต็อกเฉลี่ย)' };

  const daysInventory = (inventoryTurnover.status === 'OK' && inventoryTurnover.value > 0)
    ? { value: round2(periodDays / inventoryTurnover.value), unit: 'วัน', status: 'OK' }
    : { value: null, unit: 'วัน', status: 'ยังคำนวณไม่ได้ (ไม่มีการหมุนเวียนสต็อก)' };

  if (!hasBalanceSheet) {
    const missingMsg = 'ยังคำนวณไม่ได้ (ต้องกรอกงบดุลรายเดือน)';
    return {
      summary: { revenue: round2(revenue), cogs: round2(cogs), grossProfit, operatingExpenses: round2(operatingExpenses), ebit, interestExpense: 0, netProfit },
      ratios: {
        grossMargin,
        netMargin,
        roa: { value: null, unit: '%', status: missingMsg, requiresBalanceSheet: true },
        roe: { value: null, unit: '%', status: missingMsg, requiresBalanceSheet: true },
        currentRatio: { value: null, unit: 'เท่า', status: missingMsg, requiresBalanceSheet: true },
        quickRatio: { value: null, unit: 'เท่า', status: missingMsg, requiresBalanceSheet: true },
        inventoryTurnover,
        daysInventory,
        arTurnover: { value: null, unit: 'รอบ', status: missingMsg, requiresBalanceSheet: true },
        apTurnover: { value: null, unit: 'รอบ', status: missingMsg, requiresBalanceSheet: true },
        debtToEquity: { value: null, unit: 'เท่า', status: missingMsg, requiresBalanceSheet: true },
        interestCoverage: { value: null, unit: 'เท่า', status: missingMsg, requiresBalanceSheet: true }
      }
    };
  }

  const cashAndBank = Number(balanceSheet.cashAndBank || 0);
  const ar = Number(balanceSheet.accountsReceivable || 0);
  const otherCA = Number(balanceSheet.otherCurrentAssets || 0);
  const fixedAssets = Number(balanceSheet.fixedAssets || 0);
  const ap = Number(balanceSheet.accountsPayable || 0);
  const shortDebt = Number(balanceSheet.shortTermDebt || 0);
  const longDebt = Number(balanceSheet.longTermDebt || 0);
  const equity = Number(balanceSheet.ownerEquity || 0);

  const totalCurrentAssets = round2(cashAndBank + ar + inventoryValue + otherCA);
  const totalAssets = round2(totalCurrentAssets + fixedAssets);
  const totalCurrentLiabilities = round2(ap + shortDebt);
  const totalLiabilities = round2(totalCurrentLiabilities + longDebt);

  const roa = totalAssets > 0
    ? { value: round2((netProfit / totalAssets) * 100), unit: '%', status: 'OK', requiresBalanceSheet: true }
    : { value: null, unit: '%', status: 'ยังคำนวณไม่ได้ (สินทรัพย์รวมเป็น 0)', requiresBalanceSheet: true };

  const roe = equity > 0
    ? { value: round2((netProfit / equity) * 100), unit: '%', status: 'OK', requiresBalanceSheet: true }
    : { value: null, unit: '%', status: 'ยังคำนวณไม่ได้ (ส่วนของเจ้าของเป็น 0)', requiresBalanceSheet: true };

  const currentRatio = totalCurrentLiabilities > 0
    ? { value: round2(totalCurrentAssets / totalCurrentLiabilities), unit: 'เท่า', status: 'OK', requiresBalanceSheet: true }
    : { value: null, unit: 'เท่า', status: 'ยังคำนวณไม่ได้ (ไม่มีหนี้สินหมุนเวียน)', requiresBalanceSheet: true };

  const quickRatio = totalCurrentLiabilities > 0
    ? { value: round2((cashAndBank + ar) / totalCurrentLiabilities), unit: 'เท่า', status: 'OK', requiresBalanceSheet: true }
    : { value: null, unit: 'เท่า', status: 'ยังคำนวณไม่ได้ (ไม่มีหนี้สินหมุนเวียน)', requiresBalanceSheet: true };

  const arTurnover = ar > 0
    ? { value: round2(revenue / ar), unit: 'รอบ', status: 'OK', requiresBalanceSheet: true }
    : { value: null, unit: 'รอบ', status: 'ยังคำนวณไม่ได้ (ไม่มีลูกหนี้การค้า)', requiresBalanceSheet: true };

  const apTurnover = ap > 0
    ? { value: round2(cogs / ap), unit: 'รอบ', status: 'OK', requiresBalanceSheet: true }
    : { value: null, unit: 'รอบ', status: 'ยังคำนวณไม่ได้ (ไม่มีเจ้าหนี้การค้า)', requiresBalanceSheet: true };

  const debtToEquity = equity > 0
    ? { value: round2(totalLiabilities / equity), unit: 'เท่า', status: 'OK', requiresBalanceSheet: true }
    : { value: null, unit: 'เท่า', status: 'ยังคำนวณไม่ได้ (ส่วนของเจ้าของเป็น 0)', requiresBalanceSheet: true };

  const interestCoverage = interestExpense > 0
    ? { value: round2(ebit / interestExpense), unit: 'เท่า', status: 'OK', requiresBalanceSheet: true }
    : { value: null, unit: 'เท่า', status: 'ยังคำนวณไม่ได้ (ไม่มีดอกเบี้ยจ่ายในเดือนนี้)', requiresBalanceSheet: true };

  return {
    summary: {
      revenue: round2(revenue),
      cogs: round2(cogs),
      grossProfit,
      operatingExpenses: round2(operatingExpenses),
      ebit,
      interestExpense: round2(interestExpense),
      netProfit,
      totalCurrentAssets,
      totalAssets,
      totalCurrentLiabilities,
      totalLiabilities,
      ownerEquity: round2(equity)
    },
    ratios: {
      grossMargin,
      netMargin,
      roa,
      roe,
      currentRatio,
      quickRatio,
      inventoryTurnover,
      daysInventory,
      arTurnover,
      apTurnover,
      debtToEquity,
      interestCoverage
    }
  };
}

function isDuplicateSlip(existingSlips, candidate) {
  return existingSlips.some(s =>
    String(s.transRef).trim().toLowerCase() === String(candidate.transRef).trim().toLowerCase() &&
    Math.abs(Number(s.amount) - Number(candidate.amount)) < 0.005 &&
    String(s.transTime).trim() === String(candidate.transTime).trim()
  );
}

function parseThaiSlipMiniQR(payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('00')) {
    return null;
  }
  const bankMap = {
    '002': 'ธนาคารกรุงเทพ (BBL)',
    '004': 'ธนาคารกสิกรไทย (KBANK)',
    '006': 'ธนาคารกรุงไทย (KTB)',
    '011': 'ธนาคารทหารไทยธนชาต (ttb)',
    '014': 'ธนาคารไทยพาณิชย์ (SCB)',
    '025': 'ธนาคารกรุงศรีอยุธยา (BAY)',
    '030': 'ธนาคารออมสิน (GSB)'
  };
  const bankMatch = payload.match(/0103(\d{3})02(\d{2})([A-Za-z0-9]+)/);
  if (!bankMatch) return null;
  const bankCode = bankMatch[1];
  const refLen = parseInt(bankMatch[2], 10);
  const rawAfter = bankMatch[3];
  const transRef = rawAfter.substring(0, refLen);
  return {
    bankCode,
    bankName: bankMap[bankCode] || `ธนาคารรหัส ${bankCode}`,
    transRef
  };
}

module.exports = {
  calculateFifoCogs,
  calculateFinancialRatios,
  isDuplicateSlip,
  parseThaiSlipMiniQR
};
