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
