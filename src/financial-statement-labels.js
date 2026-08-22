export function startupExpenseLabel(expenseName) {
  const normalizedName = String(expenseName)
    .trim()
    .split(/\s+/)
    .map(word => word.length > 1 && word === word.toUpperCase()
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return `Startup Cost - ${normalizedName}`;
}

export function incomeStatementDetailRows(monthly) {
  const revenue = new Map();
  const recurringExpenses = new Map();
  const startupExpenses = new Map();

  monthly.forEach(month => {
    month.revenueByStream.forEach(row => revenue.set(row.id, row.name));
    month.operatingExpensesByLine.forEach(row => recurringExpenses.set(row.id, row.name));
    month.expensedStartupCostsByLine
      .filter(row => Number(row.amount) !== 0)
      .forEach(row => startupExpenses.set(row.id, row.name));
  });

  return {
    revenue: [...revenue].map(([id, label]) => [label, `revenue:${id}`, 'detail']),
    recurringExpenses: [...recurringExpenses].map(([id, label]) => [label, `expense:${id}`, 'expense-group']),
    startupExpenses: [...startupExpenses].map(([id, label]) => [startupExpenseLabel(label), `startup:${id}`, 'expense-group']),
  };
}
