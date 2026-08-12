# Central financial projection engine

## Repository review

Before implementation, the repository contained independent operating-expense (`src/operating-expenses.ts`), staffing (`src/payroll.ts`), and debt-service (`src/loans.ts`) calculators. Revenue and direct-cost assumptions were represented by the legacy aggregate and the original central engine. Startup costs used `startup`, `project`, and `capital_expenditure`; funding supported owner and other contributions. Loans distinguish proposed principal from existing opening balances. Projection months are one-based, percentages are stored as whole percentages, currency is a plan-level ISO-style string, and loan outputs round contractual cash amounts to cents while other modules retain precision until presentation.

The existing in-memory UI has no database query layer or calculated-results table. It starts projections from a plan date, uses a plan currency, and already accepts opening cash, explicit tax rates, working-capital timing, and straight-line depreciable assets. No database persistence was added by this task.

## Contract and orchestration

`FinancialProjectionAssumptions` is the normalized input. `buildFinancialProjectionAssumptions` converts an already-loaded persisted plan aggregate into that contract. The pure engine performs no database, network, or AI work.

Every projection month is one-based and includes its calendar label, projection year, and days in month. The orchestration order is: months; revenue; direct costs; gross profit; operating expenses; staffing; EBITDA; startup uses; debt schedules; funding; depreciation; EBIT; interest; earnings before tax; explicit tax; working capital; operating, investing, and financing cash flow; cash roll-forward; annual summaries; totals; deterministic validation.

The output exposes `months` (and the backwards-compatible `monthly` alias), `annual`, `totals`, `validation`, and version/hash metadata. `FINANCIAL_MODEL_VERSION` is defined once. Calculations are generated on demand and are not persisted.

## Accounting conventions

- Gross profit = revenue − cost of sales; EBITDA = gross profit − operating expenses − staffing.
- EBIT = EBITDA − depreciation − amortization; EBT = EBIT − loan-schedule interest; net income = EBT − explicit income tax.
- Without working-capital inputs, revenue is collected and recognized costs are paid in the same month. No receivable, payable, or inventory days are invented.
- Interest is an operating cash outflow. Principal and loan proceeds are financing cash flows. Capital purchases, deposits, and opening inventory are investing/asset cash outflows. Expensed startup costs are operating cash outflows but remain outside EBITDA under the existing statement convention.
- Net cash movement is operating + investing + financing cash flow. Closing cash is opening cash + movement; it is never clamped. Funding shortfall is the positive inverse of the minimum negative closing balance.
- `capital_expenditure`/`capital_asset` costs are capital purchases; `operating_expense`, `startup`, `project`, and legacy `other` are expensed startup uses; `opening_inventory` and `deposit_or_prepaid` remain separately identified asset uses. No new unclassified record is guessed by the adapter.
- Owner and investor contributions are equity financing, never revenue. Existing loans create opening debt and no proceeds. Detailed proposed loans are authoritative for proceeds; high-level proposed-loan funding remains sources-and-uses data only and is reconciled with detailed principal.
- Flow values are summed annually. Opening/ending cash, debt, and headcount are period-boundary values.

## Precision, placeholders, and validation

The engine retains module precision during monthly calculations. Loan schedules use the existing cent-rounding rules; projection totals and annual flow sums round to cents. UI formatting is separate. A $0.01 tolerance is used for reconciliation.

Tax, depreciation, and working-capital interfaces are present. Their adapters default to explicit zero/no-adjustment placeholders rather than invented rates, lives, or collection terms. Existing explicit inputs continue to work. No balance-sheet plug is introduced.

Rule-based checks cover finite inputs/outputs; revenue and direct-cost detail; operating-expense detail; loan interest and ending balances; monthly and inter-month cash roll-forward; proposed-loan reconciliation; sources and uses; negative cash; negative gross profit; missing cash/financing; and empty loan, staffing, and operating-expense assumptions.
