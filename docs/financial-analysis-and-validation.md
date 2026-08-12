# Financial analysis and validation

`calculateFinancialAnalysis` consumes the finalized `FinancialProjection` produced by the central engine. It does not recalculate an alternate projection and does not use AI.

## Formulas

- Revenue growth = `(current annual revenue - prior annual revenue) / prior annual revenue`. Year 1 and years following zero revenue return `null`.
- Gross, EBITDA, and net margins = the respective annual result divided by annual revenue; zero revenue safely returns zero.
- Contribution margin = projection gross profit / projection revenue.
- Break-even monthly revenue = average monthly operating expenses / contribution margin. Annual break-even is the monthly amount multiplied by 12. A non-positive contribution margin returns `null`.
- Estimated break-even month is the first month whose revenue reaches monthly break-even and whose EBITDA is non-negative.
- **DSCR = EBITDA / scheduled principal and interest payments.** Financing fees are excluded. Zero debt service returns a `null` value and an explanation, never `Infinity` or `NaN`.
- Current ratio = current assets / current liabilities. Zero current liabilities return a `null` value and an explanation.
- Working capital = current assets - current liabilities.
- Minimum cash is the lowest finalized monthly closing cash balance; maximum funding shortfall is its negative amount, floored at zero.
- Closing debt is the final monthly engine balance. Cash runway is the number of completed non-negative months before the first negative closing balance; if cash never becomes negative, an explanation says runway extends beyond the projection.

## Validation behavior

Validation returns three explicit categories: `error`, `important warning`, and `advisory`. `canGenerate` is false whenever an error exists. `requiresAcknowledgement` is true whenever an important warning exists. Advisories never block progress.

The validator examines both raw assumptions (for invalid or missing entries that the engine safely normalizes) and finalized outputs (for cash, profitability, debt service, and balance-sheet integrity). Ownership percentages are supplied through `ValidationOptions` because ownership is outside the financial-engine assumptions contract.
