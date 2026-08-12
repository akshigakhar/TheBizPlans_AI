# Financial module contracts before the central engine

This inventory records the completed calculation modules as inspected before the central projection engine was introduced. Persisted/user-entered assumptions remain separate from every calculated projection.

## Legacy aggregate (`src/finance.js`)

- `monthlyPayroll(record)` accepts a loosely shaped salary/hourly record and returns one monthly number.
- `loanSchedule({ amount, annualRate, amortizationYears, interestOnlyMonths })` returns rows containing `month`, `payment`, `principal`, `interest`, and `closingBalance`.
- `projectFinancials(...)` accepts a legacy, untyped mixture of revenue, expense, payroll, loan, tax, depreciation, drawings, and working-capital fields. It always returns 36 monthly rows with stream revenue/costs, profit fields, cash flow, working capital, debt, assets, liabilities, and equity.
- `annualize(months)` returns three annual summaries; `financialAnalysis(months)` returns ratios, break-even measures, debt coverage, working-capital requirement, loan balance, and cash runway.

## Payroll (`src/payroll.ts`)

- Input: `StaffingPosition[]`, plus projection length and bonus month. Each assumption includes compensation method and rates, employee count, active months, annual raise, employer burden, benefits, and bonus.
- Output: `PayrollProjection`, containing detailed `MonthlyPayrollOutput[]`, `AnnualPayrollSummary[]`, three named annual totals, and yearly headcount.
- `normalizeStaffingPosition` and `validateStaffingPosition` form the input boundary; calculated amounts are explicitly excluded from persisted positions.

## Operating expenses (`src/operating-expenses.ts`)

- Input: `OperatingExpense[]`, projection length, total monthly revenue, and optional revenue-stream forecasts. Assumptions support fixed or revenue-based expenses, frequency, active months, annual increases, categories, and selected revenue streams.
- Output: `OperatingExpenseProjection`, containing total monthly amounts, detailed expense/month rows, per-expense results, fixed/revenue-based splits, annual and category summaries, and projection totals.
- `normalizeOperatingExpense` and `validateOperatingExpense` form the input boundary.

## Loans (`src/loans.ts`)

- Input: `Loan[]` plus projection length. Assumptions include principal, rate, amortization and term, start month, interest-only period, balloon, financing fee, and existing/proposed status.
- Output: `DebtServiceProjection`, containing individual `LoanCalculation` schedules, aggregate monthly `LoanScheduleRow[]`, debt-service arrays and annual summaries, proceeds, and ending balance.
- Each schedule row exposes opening/closing balance, scheduled payment, interest, principal, fee, and balloon payment. `normalizeLoan` and `validateLoan` form the input boundary.

## Central normalized contract

`FinancialAssumptions` in `src/financial-engine.ts` is now the sole aggregate input. It composes the established payroll, operating-expense, and loan assumption types and adds typed revenue, direct-cost, project-cost, funding, tax, depreciation, and working-capital assumptions. `FinancialProjection` is a distinct output object with one result for every projection month. The engine neither mutates nor augments its assumption object.
