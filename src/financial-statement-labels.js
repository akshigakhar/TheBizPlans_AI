export function financialLineItemLabel(name) {
  return String(name)
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .map(word => word.length > 1 && word === word.toUpperCase()
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function startupExpenseLabel(expenseName) {
  return `Startup Cost - ${financialLineItemLabel(expenseName)}`;
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
    revenue: [...revenue].map(([id, label]) => [financialLineItemLabel(label), `revenue:${id}`, 'line-item']),
    recurringExpenses: [...recurringExpenses].map(([id, label]) => [financialLineItemLabel(label), `expense:${id}`, 'line-item']),
    startupExpenses: [...startupExpenses].map(([id, label]) => [startupExpenseLabel(label), `startup:${id}`, 'line-item startup-line']),
  };
}
