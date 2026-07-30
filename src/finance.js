export function monthlyPayroll(record = {}) {
  const base = record.payType === 'Salary'
    ? Number(record.annualSalary || 0) / 12
    : Number(record.hourlyWage || 0) * Number(record.hoursPerWeek || 0) * 52 / 12;
  const additions = Number(record.payrollTaxes || 0) + Number(record.benefits || 0) + Number(record.vacationPay || 0) + Number(record.employerContributions || 0);
  return base * (1 + additions / 100);
}

export function loanSchedule({ amount = 0, annualRate = 0, amortizationYears = 5, interestOnlyMonths = 0 } = {}) {
  const principal = Number(amount);
  const rate = Number(annualRate) / 100 / 12;
  const periods = Math.max(1, Number(amortizationYears) * 12);
  const payment = rate ? principal * rate / (1 - Math.pow(1 + rate, -periods)) : principal / periods;
  let balance = principal;
  return Array.from({ length: periods + Number(interestOnlyMonths) }, (_, index) => {
    const interest = balance * rate;
    const scheduledPayment = index < interestOnlyMonths ? interest : Math.min(payment, balance + interest);
    const principalPaid = Math.max(0, scheduledPayment - interest);
    balance = Math.max(0, balance - principalPaid);
    return { month: index + 1, payment: scheduledPayment, principal: principalPaid, interest, closingBalance: balance };
  });
}

export function projectFinancials({ price = 85, units = 120, growth = 0.04, directCost = 0.28, expenses = 6200, payroll = 7800, openingCash = 45000, revenues, taxRate = 12 } = {}) {
  let cash = openingCash;
  return Array.from({ length: 36 }, (_, index) => {
    const streams = revenues || [{ price, units, growth, directCost, seasonal: 0, annualPriceIncrease: 0, refundRate: 0 }];
    const streamResults = streams.map(stream => {
      const seasonalFactor = 1 + Number(stream.seasonal || 0) / 100;
      const annualPriceFactor = Math.pow(1 + Number(stream.annualPriceIncrease || 0) / 100, Math.floor(index / 12));
      const grossRevenue = Number(stream.price || 0) * Number(stream.units || 0) * Math.pow(1 + Number(stream.growth || 0), index) * seasonalFactor * annualPriceFactor;
      const netRevenue = grossRevenue * (1 - Number(stream.refundRate || 0) / 100);
      return { revenue: netRevenue, cost: netRevenue * Number(stream.directCost || 0) };
    });
    const revenue = streamResults.reduce((sum, stream) => sum + stream.revenue, 0);
    const cost = streamResults.reduce((sum, stream) => sum + stream.cost, 0);
    const grossProfit = revenue - cost;
    const ebitda = grossProfit - expenses - payroll;
    const tax = Math.max(0, ebitda * Number(taxRate) / 100);
    const netIncome = ebitda - tax;
    cash += netIncome;
    return { month: index + 1, revenue, cost, grossProfit, payroll, expenses, ebitda, tax, netIncome, closingCash: cash };
  });
}

export function annualize(months) {
  return [0, 1, 2].map(year => months.slice(year * 12, year * 12 + 12).reduce((out, row) => {
    ['revenue', 'cost', 'grossProfit', 'payroll', 'expenses', 'ebitda', 'tax', 'netIncome'].forEach(key => out[key] += row[key]);
    out.closingCash = row.closingCash;
    return out;
  }, { year: year + 1, revenue: 0, cost: 0, grossProfit: 0, payroll: 0, expenses: 0, ebitda: 0, tax: 0, netIncome: 0, closingCash: 0 }));
}
