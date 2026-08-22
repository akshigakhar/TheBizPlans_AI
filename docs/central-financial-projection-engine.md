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
- Interest is an operating cash outflow. Principal and loan proceeds are financing cash flows. Capital purchases, deposits, and opening inventory are investing/asset cash outflows. Expensed startup costs are operating cash outflows and reduce EBITDA and net income; asset-classified startup uses are not expensed.
- Net cash movement is operating + investing + financing cash flow. Closing cash is opening cash + movement; it is never clamped. Funding shortfall is the positive inverse of the minimum negative closing balance.
- `capital_expenditure`/`capital_asset` costs are capital purchases; `operating_expense`, `startup`, `project`, and legacy `other` are expensed startup uses; `opening_inventory` and `deposit_or_prepaid` remain separately identified asset uses. No new unclassified record is guessed by the adapter.
- Owner contributions are equity financing, never revenue. Legacy investor contributions are safely consolidated into owner equity. Existing loans create opening debt and no proceeds. Detailed proposed loans are authoritative for proceeds; high-level proposed-loan funding remains sources-and-uses data only and is reconciled with detailed principal.
- Flow values are summed annually. Opening/ending cash, debt, and headcount are period-boundary values.

## Precision, placeholders, and validation

The engine retains module precision during monthly calculations. Loan schedules use the existing cent-rounding rules; projection totals and annual flow sums round to cents. UI formatting is separate. A $0.01 tolerance is used for reconciliation.

Tax, depreciation, and working-capital interfaces are present. Their adapters default to explicit zero/no-adjustment placeholders rather than invented rates, lives, or collection terms. Existing explicit inputs continue to work. No balance-sheet plug is introduced.

Rule-based checks cover finite inputs/outputs; revenue and direct-cost detail; operating-expense detail; loan interest and ending balances; monthly and inter-month cash roll-forward; proposed-loan reconciliation; sources and uses; negative cash; negative gross profit; missing cash/financing; and empty loan, staffing, and operating-expense assumptions.

## Model 1.1 working capital and fixed assets

Version 1.1.0 adds explicitly enabled, calendar-day working capital. AR is revenue / actual days in month × AR days; inventory is the greater of COGS / actual days × inventory days and the optional minimum; AP is COGS / actual days × AP days. Changes are ending less prior balances and the cash adjustment is `-change AR - change inventory + change AP`. Startup opening inventory is the Month 1 opening balance and remains a separately paid startup use, so only movement beyond that balance affects operating cash. When disabled, AR/AP are zero and opening inventory remains unchanged.

Each active asset is purchased once in its purchase month. A `sourceStartupCostId` makes the asset schedule authoritative for the linked startup-cost cash outflow, preventing duplicate capex. Depreciable base is purchase cost less residual value; straight-line monthly expense is base / useful-life months beginning in the in-service month. Expense and accumulated depreciation stop at the base, gross cost remains after purchase, and net fixed assets are gross cost less accumulated depreciation. Existing pre-projection assets are not supported in v1 unless entered as projection assumptions.

EBIT is EBITDA less depreciation. Net income is EBIT less interest and tax. Operating cash is the cash operating result (equivalent to net income plus depreciation and the working-capital cash adjustment when accrual and cash tax timing coincide); investing cash includes negative capex, deposits, and opening inventory purchases; financing cash includes funding less principal and fees. Closing cash equals opening cash plus all three cash-flow sections.

## Model 1.2 financial statements

Version 1.2.0 adds a pure statement layer under `src/lib/financials/statements`. It consumes finalized monthly projection rows and does not query storage or recalculate revenue streams, payroll schedules, operating-expense schedules, loan amortization, working capital, or depreciation. Startup expenses are recognized in EBITDA and net income; deposits remain other assets; opening inventory remains inventory; explicit opening cash follows the existing startup convention as opening contributed capital.

The indirect cash-flow statement starts with net income, adds depreciation and amortization, subtracts increases in receivables and inventory, and adds increases in payables. Capital purchases, deposits, and opening inventory are investing uses. Owner/investor funding and loan proceeds are financing inflows, while principal and the loan module's explicitly paid financing fees are financing outflows. Interest remains in net income and therefore operating cash flow.

Balance sheets show current assets, gross/accumulated/net fixed assets, deposits, payables, accrued unpaid income tax, debt, contributed capital, other explicit funding equity, and cumulative retained earnings. The current portion of debt is the lesser of ending debt and scheduled principal in the next 12 available projection months; near the horizon this is limited to the remaining forecast because schedules beyond it are not available. Long-term debt is the non-negative remainder.

Every month validates cash roll-forward, cash-to-balance-sheet cash, debt, fixed assets, retained earnings, finite values, and Assets = Liabilities + Equity at the unrounded $0.01 tolerance. Differences are reported rather than plugged. Negative cash/equity, losses, and current-liquidity shortfalls are warnings; absent debt, fixed assets, working capital, and configured tax expense are advisories. Annual income and cash-flow values sum monthly flows; annual cash boundaries and balance sheets use the first/opening and final/ending month values.
