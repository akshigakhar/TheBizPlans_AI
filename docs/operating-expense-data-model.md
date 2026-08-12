# Operating expense data model

The operating expense schema is defined by
`migrations/20260730000000_create_operating_expenses.sql` and uses PostgreSQL.
It follows the application's one-based projection convention: month `1` is the
first projection month.

## Percentage convention

`percentage_of_revenue` and `annual_increase_percentage` store **percentage points**.
For example, 5% is persisted as `5.0000`, not `0.05`. Forms should display and
submit `5`; calculations convert it to a multiplier by dividing by 100. Both
columns allow four decimal places so that fractional percentages are not lost.

## Scheduling rules

- `start_month` is one-based and inclusive. A null `end_month` means the item
  remains active to the end of the projection.
- Percentage expenses are monthly. Their amount is the relevant month's revenue
  multiplied by `percentage_of_revenue / 100`.
- For a fixed recurring expense, `payment_month` is the one-based projection
  month of its first payment. Later payments repeat from that anchor according
  to `frequency`. If it is null, `start_month` is the anchor.
- For a one-time expense, `payment_month` is its one-based payment month. If it
  is null, the expense is paid in `start_month`.
- Annual increases apply on projection boundaries (months 13, 25, and so on),
  relative to the projection start—not the expense start. The multiplier for
  month `m` is `(1 + annual_increase_percentage / 100) ^ floor((m - 1) / 12)`.

The database rejects payment months outside an expense's active date range.

## Selected revenue streams

An expense with `revenue_basis = 'selected_revenue_streams'` is associated with
revenue streams through `operating_expense_revenue_streams`. IDs are never
serialized into a string. Application validation must require at least one
mapping for this basis and must ensure that the expense and streams belong to
the same business plan; those cross-row rules should be enforced in the service
transaction that writes the expense.

## Ordering and lifecycle

If `display_order` is omitted, an insert trigger assigns the current maximum for
the business plan plus one. A transaction-scoped advisory lock serializes this
operation for each plan. Explicit ordering remains available for reorder
operations, and the `(business_plan_id, display_order)` constraint prevents
duplicates.

Operating expenses are active by default. Deleting a business plan cascades to
its expenses, and deleting an expense cascades to its revenue-stream mappings.
Deleting a revenue stream removes only its mappings. `updated_at` is maintained
automatically by a trigger.
