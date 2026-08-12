const number = value => Number(value || 0);

export function monthlyPayroll(record = {}) {
  const base = record.payType === 'Salary'
    ? number(record.annualSalary) / 12
    : number(record.hourlyWage) * number(record.hoursPerWeek) * 52 / 12;
  const additions = number(record.payrollTaxes) + number(record.benefits) + number(record.vacationPay) + number(record.employerContributions);
  return base * (1 + additions / 100);
}

export function loanSchedule({ amount = 0, annualRate = 0, amortizationYears = 5, interestOnlyMonths = 0 } = {}) {
  const principal = number(amount);
  const rate = number(annualRate) / 100 / 12;
  const periods = Math.max(1, number(amortizationYears) * 12);
  const payment = rate ? principal * rate / (1 - Math.pow(1 + rate, -periods)) : principal / periods;
  let balance = principal;
  return Array.from({ length: periods + number(interestOnlyMonths) }, (_, index) => {
    const interest = balance * rate;
    const scheduledPayment = index < interestOnlyMonths ? interest : Math.min(payment, balance + interest);
    const principalPaid = Math.max(0, scheduledPayment - interest);
    balance = Math.max(0, balance - principalPaid);
    return { month: index + 1, payment: scheduledPayment, principal: principalPaid, interest, closingBalance: balance };
  });
}

export function projectFinancials({ price = 85, units = 120, growth = 0.04, directCost = 0.28, expenses = 6200, payroll = 7800, openingCash = 45000, revenues, taxRate = 12, loan = {}, depreciableAssets = 0, depreciationYears = 5, ownerDraws = 0, receivableDays = 0, payableDays = 0, inventory = 0 } = {}) {
  const streams = revenues || [{ name: 'Revenue', price, units, growth, directCost, seasonal: 0, annualPriceIncrease: 0, refundRate: 0 }];
  const debt = loanSchedule(loan);
  const monthlyDepreciation = number(depreciableAssets) / Math.max(1, number(depreciationYears) * 12);
  let cash = number(openingCash) + number(loan.amount);
  let previousReceivables = 0;
  let previousPayables = 0;

  return Array.from({ length: 36 }, (_, index) => {
    // Expense assumptions may vary by month (for example quarterly or
    // revenue-based operating expenses), while legacy callers may pass one
    // recurring scalar value.
    const monthlyExpenses = number(Array.isArray(expenses) ? expenses[index] : expenses);
    const streamResults = streams.map((stream, streamIndex) => {
      const seasonalFactor = 1 + number(stream.seasonal) / 100;
      const annualPriceFactor = Math.pow(1 + number(stream.annualPriceIncrease) / 100, Math.floor(index / 12));
      const grossRevenue = number(stream.price) * number(stream.units) * Math.pow(1 + number(stream.growth), index) * seasonalFactor * annualPriceFactor;
      const revenue = grossRevenue * (1 - number(stream.refundRate) / 100);
      return { name: stream.name || `Revenue stream ${streamIndex + 1}`, revenue, cost: revenue * number(stream.directCost) };
    });
    const revenue = streamResults.reduce((sum, stream) => sum + stream.revenue, 0);
    const cost = streamResults.reduce((sum, stream) => sum + stream.cost, 0);
    const grossProfit = revenue - cost;
    const ebitda = grossProfit - monthlyExpenses - number(payroll);
    const depreciation = Math.min(monthlyDepreciation, Math.max(0, number(depreciableAssets) - monthlyDepreciation * index));
    const debtRow = debt[index] || { payment: 0, principal: 0, interest: 0, closingBalance: 0 };
    const taxableIncome = ebitda - depreciation - debtRow.interest;
    const tax = Math.max(0, taxableIncome * number(taxRate) / 100);
    const netIncome = taxableIncome - tax;
    const receivables = revenue * number(receivableDays) / 30;
    const payables = cost * number(payableDays) / 30;
    const workingCapitalChange = (receivables - previousReceivables) - (payables - previousPayables);
    const operatingCashFlow = netIncome + depreciation - workingCapitalChange;
    const financingCashFlow = -debtRow.principal - number(ownerDraws);
    const cashFlow = operatingCashFlow + financingCashFlow;
    cash += cashFlow;
    previousReceivables = receivables;
    previousPayables = payables;
    return { month: index + 1, streams: streamResults, revenue, cost, grossProfit, payroll: number(payroll), expenses: monthlyExpenses, ebitda, depreciation, interest: debtRow.interest, tax, netIncome, operatingCashFlow, principalPayment: debtRow.principal, ownerDraws: number(ownerDraws), cashFlow, closingCash: cash, receivables, inventory: number(inventory), payables, loanBalance: debtRow.closingBalance, fixedAssets: Math.max(0, number(depreciableAssets) - depreciation * (index + 1)), totalAssets: cash + receivables + number(inventory) + Math.max(0, number(depreciableAssets) - depreciation * (index + 1)), currentLiabilities: payables, equity: cash + receivables + number(inventory) + Math.max(0, number(depreciableAssets) - depreciation * (index + 1)) - payables - debtRow.closingBalance };
  });
}

export function annualize(months) {
  const flowKeys = ['revenue', 'cost', 'grossProfit', 'payroll', 'expenses', 'ebitda', 'depreciation', 'interest', 'tax', 'netIncome', 'operatingCashFlow', 'principalPayment', 'ownerDraws', 'cashFlow'];
  const closingKeys = ['closingCash', 'receivables', 'inventory', 'payables', 'loanBalance', 'fixedAssets', 'totalAssets', 'currentLiabilities', 'equity'];
  return [0, 1, 2].map(year => {
    const rows = months.slice(year * 12, year * 12 + 12);
    const out = { year: year + 1, streams: {} };
    flowKeys.forEach(key => { out[key] = rows.reduce((sum, row) => sum + number(row[key]), 0); });
    closingKeys.forEach(key => { out[key] = number(rows.at(-1)?.[key]); });
    rows.forEach(row => row.streams?.forEach(stream => { out.streams[stream.name] = (out.streams[stream.name] || 0) + stream.revenue; }));
    return out;
  });
}

export function financialAnalysis(months) {
  const first = months[0] || {};
  const last = months.at(-1) || {};
  const totalRevenue = months.reduce((sum, row) => sum + number(row.revenue), 0);
  const totalGrossProfit = months.reduce((sum, row) => sum + number(row.grossProfit), 0);
  const totalEbitda = months.reduce((sum, row) => sum + number(row.ebitda), 0);
  const totalNetIncome = months.reduce((sum, row) => sum + number(row.netIncome), 0);
  const fixedCosts = number(first.payroll) + number(first.expenses);
  const contributionMargin = number(first.revenue) ? number(first.grossProfit) / number(first.revenue) : 0;
  const annualDebtService = months.slice(0, 12).reduce((sum, row) => sum + number(row.interest) + number(row.principalPayment), 0);
  const negative = months.findIndex(row => row.closingCash < 0);
  return {
    grossMargin: totalRevenue ? totalGrossProfit / totalRevenue : 0,
    ebitdaMargin: totalRevenue ? totalEbitda / totalRevenue : 0,
    netMargin: totalRevenue ? totalNetIncome / totalRevenue : 0,
    breakEvenSales: contributionMargin ? fixedCosts / contributionMargin : 0,
    breakEvenMonth: (months.find(row => row.ebitda >= 0) || {}).month || null,
    debtServiceCoverageRatio: annualDebtService ? months.slice(0, 12).reduce((sum, row) => sum + number(row.ebitda), 0) / annualDebtService : null,
    currentRatio: number(last.currentLiabilities) ? (number(last.closingCash) + number(last.receivables) + number(last.inventory)) / number(last.currentLiabilities) : null,
    workingCapitalRequirement: Math.max(0, number(last.receivables) + number(last.inventory) - number(last.payables)),
    loanBalance: number(last.loanBalance),
    cashRunway: negative === -1 ? 36 : negative,
  };
}
