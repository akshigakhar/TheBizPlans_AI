export function projectFinancials({ price = 85, units = 120, growth = 0.04, directCost = 0.28, expenses = 6200, payroll = 7800, openingCash = 45000 } = {}) {
  let cash = openingCash;
  return Array.from({ length: 36 }, (_, index) => {
    const revenue = price * units * Math.pow(1 + growth, index);
    const cost = revenue * directCost;
    const grossProfit = revenue - cost;
    const ebitda = grossProfit - expenses - payroll;
    const tax = Math.max(0, ebitda * 0.12);
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
