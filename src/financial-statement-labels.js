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
  const normalizedName = String(expenseName).replace(/^(?:startup\s+cost\s*(?:[-:\u2013\u2014]\s*)?)+/i, '').trim();
  return `Startup Cost - ${financialLineItemLabel(normalizedName)}`;
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
