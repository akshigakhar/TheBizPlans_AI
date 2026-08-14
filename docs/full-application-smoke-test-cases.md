# TheBizPlans full-application smoke test cases

## Purpose and scope

This suite validates the existing customer journey from public landing page through
authentication, plan creation, questionnaire completion, financial modelling,
financial approval, narrative editing, preview, and export. It also includes
negative, persistence, security, accessibility, responsive-layout, console, and
network checks needed for a launch smoke test.

The suite is intentionally provider-safe:

- use a dedicated QA user and non-production test data;
- never print passwords, access tokens, refresh tokens, or service credentials;
- never use production Stripe credentials or create a live charge;
- keep AI disabled or mocked except for a single separately approved provider test;
- delete the QA plan after the run when deletion is known to be safe.

## Test environments

Run the suite against both environments when available:

| Environment | Purpose | Database | External services |
| --- | --- | --- | --- |
| Local or preview | Destructive and mocked-provider checks | Dedicated QA Supabase project or local Supabase | Mock AI; mock Stripe or Stripe test mode; local/private export storage |
| Deployed production candidate | Release smoke test | Deployed Supabase project with a dedicated QA user | AI disabled/mocked; do not enter payment details or start a live charge |

Record the deployed URL, commit SHA, browser/version, viewport, database project
identifier (never credentials), feature flags, and whether each provider was real,
mocked, or disabled in the run report.

## Required test data

Use a unique timestamp `YYYYMMDD-HHmmss` for every run.

| Field | Value |
| --- | --- |
| Plan name | `QA Test Business - <timestamp>` |
| Business name | `QA Neighborhood Services` |
| Location | Brooklyn, New York, United States |
| Currency / projection | USD / 36 months |
| Business description | A local subscription and on-demand property-care service for small businesses. |
| Revenue stream | Monthly care subscription; 25 units at $200/month; 5% annual price growth; 10% direct cost |
| Startup cost | Equipment, $12,000, paid in month 1 |
| Operating expense | Rent, $2,000/month, starting month 1; 3% annual increase |
| Staffing | Operations Coordinator, one salaried employee at $48,000/year, starting month 2 |
| Loan | Proposed term loan, $30,000 principal, 8% annual interest, 36 months, starting month 1 |
| Working capital | Receivable days 15; payable days 20; inventory days 5 |
| Fixed asset | Service equipment, $12,000 cost, 60-month life, $0 residual, purchased month 1 |
| Manual narrative | `QA manual content saved at <timestamp>.` |

Use values allowed by the UI if its labels or units differ. Record any substitution.

## Execution rules

1. Start with a clean browser context and retain a second clean/incognito context for
   authorization tests.
2. Capture browser console messages, page errors, failed requests, HTTP responses
   with status `>= 400`, and downloads. Redact authorization headers and credentials.
3. Take screenshots at landing, dashboard after creation, questionnaire after
   refresh, annual statements, financial review, editor, preview, and mobile layout.
4. Do not continue after a destructive or billing warning until the target is
   confirmed as a QA environment.
5. A case passes only when every expected result is observed. Mark unexecutable cases
   `BLOCKED`, not `PASS`, and record the blocker.
6. Use severities: `CRITICAL` for security/data-loss/payment/primary-journey blockers,
   `HIGH` for major feature failure, `MEDIUM` for recoverable workflow defects, and
   `LOW` for polish or minor accessibility defects.

## A. Public page and routing

### PUB-001 — Landing page loads

**Preconditions:** Clean browser context.  
**Steps:**

1. Open the configured application base URL.
2. Wait for loading to settle.
3. Inspect the document title and visible page.

**Expected:** HTTP 200; no blank screen; TheBizPlans branding, sign-in control, and
primary create-plan call to action are visible; there are no uncaught page errors or
failed critical asset requests.

### PUB-002 — Landing anchors and calls to action

**Steps:** Activate `What's included`, `How it works`, `Sign in`, and the primary
create-plan button one at a time.  
**Expected:** Anchors move to their named sections; Sign in opens sign-in mode; both
create-plan calls to action open sign-up mode; keyboard activation works.

### PUB-003 — Direct protected-view access while signed out

**Steps:** In a clean context, attempt all known protected URLs/query parameters and
use browser Back/Forward after signing out.  
**Expected:** No protected plan data appears; the user is returned to landing/sign-in;
no protected API response succeeds without an authenticated user.

### PUB-004 — Refresh and history behavior

**Steps:** Navigate between public views, refresh, then use Back and Forward.  
**Expected:** The app does not crash or display a stale protected view; navigation is
predictable and does not create an infinite redirect or loading state.

## B. Authentication

### AUTH-001 — Valid QA-account login

**Preconditions:** Dedicated confirmed QA account; credentials supplied through the
test runner's secret store.  
**Steps:** Open Sign in, enter the QA email/password, submit once.  
**Expected:** A single authentication request completes; dashboard appears; user
identity is correct; credentials are absent from console, URL, screenshots, and
application logs.

### AUTH-002 — Invalid password

**Steps:** Enter the QA email with an intentionally wrong password and submit.  
**Expected:** Authentication is rejected with useful, non-sensitive messaging;
dashboard and plan APIs remain inaccessible; the form is usable for another attempt.

### AUTH-003 — Client validation

**Steps:** Submit an empty email, malformed email, password shorter than eight
characters, and empty form.  
**Expected:** Clear validation is shown; duplicate requests are not sent; secrets are
not echoed in error messages.

### AUTH-004 — Session persistence after refresh

**Steps:** Log in, open dashboard, refresh the page.  
**Expected:** The valid session is restored and dashboard reloads without asking for
credentials again; only the current user's plans are returned.

### AUTH-005 — Expired access-token refresh

**Preconditions:** Preview/local environment where expiry can be simulated.  
**Steps:** Expire the access token while retaining a valid refresh token, then load
plans or save a plan.  
**Expected:** Exactly one refresh occurs; the original request is retried once and
succeeds; concurrent operations do not create multiple refresh races.

### AUTH-006 — Invalid/expired refresh token

**Steps:** Simulate an invalid refresh token and refresh the page.  
**Expected:** Local session is cleared; user is asked to sign in; protected data is
not displayed from stale state.

### AUTH-007 — Sign out

**Steps:** Sign out, refresh, and use browser Back.  
**Expected:** Session storage is cleared, landing page appears, and no plan data is
visible or returned by authenticated endpoints.

### AUTH-008 — Password reset and recovery callback

**Preconditions:** QA email transport or mocked auth service.  
**Steps:** Request reset for the QA account, follow a controlled recovery callback,
set a valid new password, then sign in.  
**Expected:** Actionable success/error states; callback tokens are removed from the
address bar; invalid/expired links fail safely; no token is logged.

### AUTH-009 — Google OAuth start/cancel

**Preconditions:** OAuth configured in a preview environment.  
**Steps:** Start Google sign-in and cancel or return with an OAuth error.  
**Expected:** Correct redirect URL is used; cancellation returns to a usable auth
screen; provider error details are sanitized.

## C. Dashboard and plan lifecycle

### PLAN-001 — Dashboard loads

**Steps:** Complete AUTH-001.  
**Expected:** Loading state resolves; existing plans or a meaningful empty state is
shown; no other user's plans appear; counts match returned data.

### PLAN-002 — Create a uniquely named plan

**Steps:** Select New/Create plan; enter the required test data and the timestamped
plan name; submit once.  
**Expected:** One plan row is created, builder opens, success feedback appears, and
the new plan has a stable unique ID owned by the QA user.

### PLAN-003 — Created plan appears on dashboard

**Steps:** Return to dashboard and, if available, refresh/filter/search.  
**Expected:** Exactly one matching QA plan appears with correct business name,
updated timestamp, status, and completion; opening it returns to the same plan.

### PLAN-004 — Prevent duplicate creation

**Steps:** Double-click the create button or rapidly submit twice.  
**Expected:** Only one plan is created; button shows a pending/disabled state; retry
after a failure does not silently duplicate the plan.

### PLAN-005 — Duplicate plan

**Steps:** Duplicate the QA plan.  
**Expected:** One clearly named copy is created for the same owner; source plan is
unchanged; paid entitlements/approvals are not incorrectly copied; delete the copy.

### PLAN-006 — Open-plan isolation

**Steps:** Open plan A, edit unsaved/saved data, return to dashboard, then open plan B.  
**Expected:** Plan B never displays plan A's questionnaire, financial, narrative,
approval, or version-history state.

### PLAN-007 — Delete cancellation

**Steps:** Start deletion and cancel.  
**Expected:** Plan and all its data remain; no DELETE request succeeds.

### PLAN-008 — Delete test plan

**Steps:** At final cleanup, confirm the timestamped plan is safe to remove, approve
the confirmation, and refresh dashboard.  
**Expected:** Plan disappears; reopening by ID is denied/not found; related QA rows
are deleted according to schema cascades. If deletion is unsafe, retain it with the
`QA Test Business` prefix and record its ID.

## D. Questionnaire

### QUEST-001 — Every step loads

**Steps:** Open the QA plan and visit each of the ten questionnaire steps by sidebar
and by Save & continue.  
**Expected:** Each step has the correct title, fields, saved values, Previous/Next
behavior, and no blank/frozen state; completion indicator stays within 0–100%.

### QUEST-002 — Enter generic business information

**Steps:** Populate all applicable fields using the required test data; avoid real
personal or confidential information.  
**Expected:** Inputs accept supported characters and lengths; labels map to the
correct data fields; no field unexpectedly resets another field.

### QUEST-003 — Save and move between steps

**Steps:** Change a field, select Save & continue, return with Previous, then select
another step directly.  
**Expected:** Save state progresses through pending to saved; values remain; one
logical update does not create conflicting writes.

### QUEST-004 — Persistence after refresh

**Steps:** Enter a unique marker, wait for confirmed save, refresh, reopen the plan,
and revisit every step.  
**Expected:** The marker and all entered values exactly match; plan ID and ownership
remain unchanged.

### QUEST-005 — Pending-save navigation

**Steps:** Throttle the network, edit a field, and immediately navigate or reload.  
**Expected:** The app waits, flushes the write, or clearly warns about unsaved data;
it must not show a false saved state or silently lose the change.

### QUEST-006 — Validation and boundary input

**Steps:** Test required fields, whitespace-only input, long input at the documented
limit, one character beyond it, Unicode, punctuation, and HTML/script-like text.  
**Expected:** Validation is actionable; stored content is treated as text; no script
executes; valid international text persists unchanged.

## E. Financial input modules

### FIN-IN-001 — Projection settings

**Steps:** Confirm USD, 36 months, and a valid start date; switch valid settings and
restore them.  
**Expected:** Projection recalculates deterministically; labels and month/year ranges
match the selected start date; invalid periods are rejected.

### FIN-IN-002 — Revenue stream

**Steps:** Add the required subscription revenue stream, save, edit it, and return.  
**Expected:** Stream persists; monthly revenue, direct cost, annual growth, and annual
totals reflect the entered assumptions; deletion requires a clear action.

### FIN-IN-003 — Multiple and zero revenue streams

**Steps:** Add a second stream, verify aggregation, then set a valid zero-revenue
startup period where supported.  
**Expected:** Totals equal component streams; no division produces `NaN` or
`Infinity`; zero denominator metrics show zero or `N/A` with an explanation.

### FIN-IN-004 — Startup/project costs

**Steps:** Add the $12,000 equipment cost in month 1 and another non-asset startup
expense.  
**Expected:** Both persist and appear in uses of funds; asset cost is investing/capex
and is not fully expensed; non-asset cost is classified correctly.

### FIN-IN-005 — Operating expense

**Steps:** Add $2,000 monthly rent with 3% annual increase and validate the monthly
schedule across year boundaries.  
**Expected:** Months 1–12 use the base amount; the configured increase applies at the
correct transition; totals reconcile to detail.

### FIN-IN-006 — Percentage and one-time expenses

**Steps:** Add a percentage-of-revenue expense and a one-time expense.  
**Expected:** Percentage expense follows only selected streams; one-time expense
appears once; invalid percentages or timing are rejected.

### FIN-IN-007 — Payroll/staffing

**Steps:** Add the required coordinator, employer costs/benefits if available, and a
start in month 2.  
**Expected:** Month 1 payroll is zero for that role; salary and employer additions
start in month 2; annual and headcount totals reconcile; record persists.

### FIN-IN-008 — Payroll role variants

**Steps:** In preview/local, test hourly employee, contractor, and unpaid owner.  
**Expected:** Hourly calculation uses configured hours/rate; contractor has no
employee burden/benefits; unpaid owner contributes headcount but zero compensation.

### FIN-IN-009 — Loan

**Steps:** Add the required proposed loan and open its amortization schedule.  
**Expected:** Proceeds occur in the selected start month; interest/principal/payment
values are finite; balances never fall below zero; final balance and annual debt
service reconcile with monthly detail.

### FIN-IN-010 — Loan validation

**Steps:** Try negative principal, invalid interest, zero term, invalid start month,
and balloon beyond allowed range.  
**Expected:** Invalid input is rejected with field-specific messages; existing valid
loan remains intact.

### FIN-IN-011 — Working capital

**Steps:** Enable working capital and enter the required receivable, payable, and
inventory days; then disable and re-enable it.  
**Expected:** Receivables/payables/inventory and cash impacts recalculate; disabled
mode produces no ongoing working-capital changes; values persist when appropriate.

### FIN-IN-012 — Fixed asset/depreciation

**Steps:** Add the required fixed asset with purchase month, life, and residual value.  
**Expected:** Purchase appears once in investing cash flow; depreciation starts in
the configured month, is straight-line, stops at residual value, and never duplicates
the linked startup capex.

### FIN-IN-013 — Financial-input persistence

**Steps:** Wait for save, refresh, reopen the plan, and inspect every module above.  
**Expected:** Every record and assumption persists exactly once and produces the same
assumptions hash and results.

## F. Projection, statements, and analysis

### FIN-OUT-001 — Projection calculation completes

**Steps:** Open Financial Projections after entering all assumptions.  
**Expected:** Calculation completes without uncaught exception or frozen loading
state; 36 monthly rows and three annual periods exist; currency is USD.

### FIN-OUT-002 — Non-finite-value scan

**Steps:** Search rendered financial pages, accessible text, exported raw test data,
console, and responses for `NaN`, `Infinity`, `-Infinity`, `undefined`, and `null` in
fields that require numeric display.  
**Expected:** None is displayed as a financial value; non-applicable ratios use a
clear `N/A`/explanation; validation reports any bad source value.

### FIN-OUT-003 — Income Statement

**Steps:** Open annual and monthly Income Statement; change projection year.  
**Expected:** Revenue minus direct costs equals gross profit; operating expenses and
payroll flow to EBITDA; interest/depreciation/tax flow to net income; annual values
equal their monthly sums where appropriate.

### FIN-OUT-004 — Cash Flow

**Steps:** Open annual and monthly Cash Flow.  
**Expected:** Opening cash plus operating, investing, and financing flows equals
closing cash; loan proceeds and asset purchase appear in correct categories; annual
flow totals equal monthly sums.

### FIN-OUT-005 — Balance Sheet

**Steps:** Open annual and monthly Balance Sheet.  
**Expected:** Assets equal liabilities plus equity within the documented tolerance;
cash, debt, fixed assets, accumulated depreciation, working capital, and retained
earnings agree with the other statements.

### FIN-OUT-006 — Statement controls

**Steps:** Switch rapidly among Income Statement, Cash Flow, Balance Sheet,
annual/monthly, and each projection year.  
**Expected:** Active state and heading remain synchronized; no stale table or values
from the previously selected statement appear.

### FIN-OUT-007 — Balance-sheet reconciliation status

**Steps:** Inspect Financial Review reconciliation and statement validation.  
**Expected:** The QA dataset is reported Reconciled; a deliberately invalid fixture
in preview/local reports an explicit error rather than adding a hidden plug value.

### FIN-OUT-008 — Financial Analysis

**Steps:** Open Financial Analysis and record Years 1–3 gross margin, EBITDA margin,
net margin, break-even, DSCR, ending/minimum cash, and working capital.  
**Expected:** Every metric renders with the correct unit; ratios agree with statement
values; zero debt service or zero denominators show explained `N/A`, not infinity.

### FIN-OUT-009 — Independent formula cross-check

**Steps:** Independently calculate Year 1 gross margin, EBITDA margin, net margin,
working capital, and debt service using exported/raw statement totals.  
**Expected:** Values match the application within the documented rounding tolerance;
record the input totals and difference without copying credentials or tokens.

### FIN-OUT-010 — Negative-cash behavior

**Preconditions:** Preview/local copy of the plan.  
**Steps:** Reduce funding until cash becomes negative.  
**Expected:** Negative cash is retained and warning/shortfall is shown; it is not
silently clipped to zero; other statements remain reconciled.

## G. Financial Review and approval

### REVIEW-001 — Review completeness

**Steps:** Open Financial Review.  
**Expected:** Assumption summary, statement summary, reconciliation, analysis,
errors/warnings/advisories, model version, calculation timestamp, and approval state
all render and agree with Financial Projections.

### REVIEW-002 — Block approval on errors

**Preconditions:** Preview/local invalid fixture.  
**Steps:** Create a blocking financial validation error and open Review.  
**Expected:** Approval is disabled; the error identifies the affected module/field;
no financial snapshot is created.

### REVIEW-003 — Warning acknowledgement

**Steps:** With a non-blocking warning present, attempt approval before and after
checking the acknowledgement.  
**Expected:** Approval is blocked before acknowledgement and available afterward;
the snapshot records warnings and acknowledgement.

### REVIEW-004 — Approve financials

**Steps:** Select Approve, review the confirmation, confirm once.  
**Expected:** One immutable snapshot is created for the actual QA plan/user; status
becomes Approved; snapshot version/hash/model/analysis versions and approval time are
shown; duplicate click is idempotent.

### REVIEW-005 — Approval persistence

**Steps:** Refresh, sign out/in, and reopen the QA plan.  
**Expected:** Approved status, current snapshot, version, history, and warning record
persist and are scoped to this plan only.

### REVIEW-006 — Outdated approval

**Steps:** After approval, change one financial assumption and save.  
**Expected:** Prior snapshot remains immutable; current financial status becomes
Outdated/Requires update; narrative generation/export are blocked until reapproval.

### REVIEW-007 — Reapprove changed financials

**Steps:** Review the changed projection and approve it.  
**Expected:** Snapshot version increments; new snapshot is current; old snapshot is
visible as historical/superseded; no version is overwritten.

## H. Business-plan generation and editor

### EDIT-001 — Generation gate

**Steps:** Try to open/generate sections before financial approval, after approval,
and after financials become outdated.  
**Expected:** Generation is available only with current approved financials and
sufficient source information; blocked states explain the corrective action.

### EDIT-002 — All section navigation

**Steps:** Visit all 12 business-plan sections.  
**Expected:** Correct title, ordinal, status, source status, content origin, approval
state, and version count render for the selected plan; URL/query state is safe.

### EDIT-003 — Manual section creation and save

**Steps:** Choose a non-executive section, select Write Manually, enter the unique
manual narrative marker, and Save.  
**Expected:** No AI request occurs; Save becomes enabled only when dirty; success
state follows a durable write; a version is recorded.

### EDIT-004 — Narrative persistence

**Steps:** Refresh, sign out/in, reopen the same plan and section.  
**Expected:** Manual content, version history, source hash, status, and timestamps
persist exactly; another plan does not display the content.

### EDIT-005 — Unsaved-change protection

**Steps:** Modify content without saving, then switch sections, refresh, and close
the tab in separate attempts.  
**Expected:** A clear discard warning appears; Cancel retains the draft; Confirm
discards only the unsaved change, not the last saved version.

### EDIT-006 — Section approval and reopen

**Steps:** Save non-empty content, approve it, refresh, reopen it, edit, and save.  
**Expected:** Approval persists; reopening/editing clears current approval while
preserving the approved version/history; export readiness updates immediately.

### EDIT-007 — Outdated-section detection

**Steps:** Approve a section, change a source field used by that section, and return.  
**Expected:** Only dependent sections become Outdated; prior text remains visible;
approval/export readiness is revoked; affected source is identified.

### EDIT-008 — Mark outdated section reviewed

**Steps:** Review content against current data and select Mark Reviewed.  
**Expected:** Confirmation is required; hash/status update without an AI request;
content and version history remain intact; approval must be performed again if
required.

### EDIT-009 — Version history and restore

**Steps:** Save at least two versions, open each read-only version, restore the older
one, then refresh.  
**Expected:** Version content/timestamps are accurate; restore creates/currently
selects a new manual version per product rules, clears approval, and persists.

### EDIT-010 — Mocked initial generation

**Preconditions:** Mock provider and approved financials; assert provider call count.  
**Steps:** Explicitly Generate one non-executive section once.  
**Expected:** Exactly one provider call; sanitized section-specific context only;
response, source hash, prompt/model metadata, token usage, and version persist;
financials are not recalculated by AI.

### EDIT-011 — Double-click/idempotency

**Steps:** Rapidly activate Generate twice.  
**Expected:** Button is pending/disabled and exactly one provider call/version/usage
event occurs.

### EDIT-012 — Provider failure

**Preconditions:** Mock provider returns a timeout/error.  
**Steps:** Explicitly generate a section.  
**Expected:** One attempt unless user explicitly retries; useful error is shown;
existing content is preserved; failed usage/audit event is recorded without secrets.

### EDIT-013 — Regeneration limit

**Steps:** Generate and regenerate until the configured QA limit is reached, then
attempt one more regeneration.  
**Expected:** Allowed regenerations each make one call and preserve older versions;
over-limit attempt is blocked before contacting the provider.

### EDIT-014 — Executive Summary dependency

**Steps:** Attempt generation before all other current sections are approved, then
after approving them.  
**Expected:** First attempt is blocked before provider call; second is allowed and
uses only current approved narrative/financial context.

### EDIT-015 — Content safety and limits

**Steps:** Paste HTML/script-like content, Unicode, supported markdown, maximum-length
content, and content one character too long.  
**Expected:** Script never executes; valid text/markdown is preserved; oversized
content is rejected without losing the current draft.

## I. Preview and exports

### EXPORT-001 — Full-plan preview

**Steps:** Open Preview Full Plan before and after approvals.  
**Expected:** All 12 sections appear in order; plan/business identity is correct;
unapproved content is clearly marked; approved content matches current versions;
returning to editor preserves state.

### EXPORT-002 — Export readiness gating

**Steps:** Check readiness with missing content, unapproved section, outdated section,
unapproved/outdated financials, and fully approved current content.  
**Expected:** Each incomplete state blocks downloads with a specific reason and takes
Review Plan to the blocking section; only the complete state enables exports.

### EXPORT-003 — Payment/entitlement gate

**Preconditions:** Mock payment repository or Stripe test mode; no live checkout.  
**Steps:** Attempt each export without entitlement, with another plan's entitlement,
and with the QA plan's active entitlement.  
**Expected:** First two are denied without generating a file; plan-specific active
entitlement allows only its supported formats; browser never supplies the price or
amount trusted by the server.

### EXPORT-004 — Generate DOCX

**Steps:** Generate/download DOCX in preview/local private storage.  
**Expected:** Valid `.docx` opens; filename is safe; it contains current approved
sections, plan identity, current approved snapshot values, statements, and no draft,
outdated, other-plan, or secret content.

### EXPORT-005 — Generate PDF

**Steps:** Generate/download PDF.  
**Expected:** Valid `%PDF` file opens; pages are readable and ordered; approved
content and financial appendices match the current snapshot; no text is clipped in
the primary supported page size.

### EXPORT-006 — Generate XLSX

**Steps:** Generate/download XLSX and inspect every sheet.  
**Expected:** Valid workbook opens; Summary, available input details, Income
Statement, Cash Flow, Balance Sheet, Analysis, and monthly data are present; numbers
are numeric cells where appropriate and match the approved snapshot.

### EXPORT-007 — Export cache/version/history

**Steps:** Generate the same format twice without changes, then approve a content
change and generate again.  
**Expected:** Unchanged export uses the cached artifact without AI; changed approved
source creates a new version/hash; old version is superseded but remains correctly
represented in authorized history.

### EXPORT-008 — Export authorization and private download

**Steps:** From an incognito/second-user context, request the QA plan's export list,
export ID, storage path, and expired download link.  
**Expected:** Every request is denied without exposing metadata/file bytes; valid
owner download is time-limited; private object keys are not public URLs.

### EXPORT-009 — Export failure and retry

**Preconditions:** Preview/local storage failure injection.  
**Steps:** Fail file storage once, then retry.  
**Expected:** UI leaves loading state, reports a useful error, records failed status,
does not expose a partial file, and allows a safe retry.

## J. Payments and Stripe safety

### PAY-001 — Configuration fail-closed

**Preconditions:** Preview/local with missing Stripe Price ID.  
**Steps:** Attempt checkout.  
**Expected:** Checkout is blocked with configuration-safe messaging; no customer,
payment, or entitlement is created.

### PAY-002 — Stripe test checkout only

**Preconditions:** Explicit approval, Stripe test keys and test Price confirmed.  
**Steps:** Start checkout but use only Stripe's test environment/test payment method.  
**Expected:** Server selects trusted Price; metadata contains correct user/plan;
success grants plan-specific entitlements once. Never execute this case when keys are
live or mode cannot be proven.

### PAY-003 — Cancelled/failed checkout

**Steps:** Cancel test checkout and separately simulate a failed async payment.  
**Expected:** User returns safely; no active entitlement is granted; retry does not
create conflicting active attempts.

### PAY-004 — Webhook signature and idempotency

**Preconditions:** Mock/test webhook verifier.  
**Steps:** Send invalid signature, valid event, duplicate valid event, refund, and
dispute fixtures.  
**Expected:** Invalid event changes nothing; valid event applies exactly once;
duplicates are idempotent; refund/dispute updates entitlement according to policy.

## K. Console, network, accessibility, and responsive UI

### OBS-001 — Console and page-error review

**Steps:** Complete the full journey while recording console, page errors, and
unhandled rejections.  
**Expected:** No uncaught errors, React warnings, failed resource errors, leaked
tokens, credentials, customer data, `NaN`, or `undefined` financial output.

### OBS-002 — Network review

**Steps:** Record requests during login, plan CRUD, autosave, approval, generation,
and export.  
**Expected:** HTTPS only; expected status codes; no duplicate mutation/provider
calls; authorization headers are not sent to unrelated origins; no OpenAI/Stripe
secret is present in browser requests or bundles; error bodies reveal no internals.

### OBS-003 — Offline/interrupted request recovery

**Steps:** Interrupt plan autosave, financial save, narrative save, generation, and
export separately.  
**Expected:** Each operation exits loading state, preserves recoverable user input,
shows accurate unsaved/failed messaging, and supports an idempotent retry.

### A11Y-001 — Keyboard and focus

**Steps:** Complete primary navigation and form actions with keyboard only; open and
close every dialog.  
**Expected:** Visible focus, logical order, reachable controls, Enter/Space behavior,
focus trapped/restored for modals, and no keyboard trap.

### A11Y-002 — Names, messages, and structure

**Steps:** Inspect accessible names/roles, headings, tables, labels, error/status live
regions, disabled states, and contrast with an accessibility scanner plus manual
review.  
**Expected:** Every interactive control has a unique useful name; errors associate
with fields; tables have headers; status is not communicated by color alone; no
critical/serious automated violation.

### UI-001 — Mobile layout

**Viewports:** 320×568, 375×812, and 390×844.  
**Steps:** Test landing, auth, dashboard, every questionnaire step, financial input
tables/modals, statements, review, editor, preview, and export area.  
**Expected:** No unintended horizontal page overflow, clipped controls, overlapping
text, inaccessible sidebar/modal, or offscreen primary action; intentional tables
have usable contained scrolling.

### UI-002 — Desktop and zoom

**Viewports:** 1280×720 and 1440×900; browser zoom 200%.  
**Expected:** Core content and controls remain readable/reachable; dialogs fit or
scroll; sticky/fixed elements do not hide focused content.

## L. Security and data-isolation cases

### SEC-001 — Anonymous API access

**Steps:** Without a session, call plan list/read/create/update/delete and related
financial, snapshot, section, version, export, payment, and entitlement endpoints.  
**Expected:** No protected row or metadata is returned or changed.

### SEC-002 — Cross-user plan access

**Preconditions:** Two QA users and a plan owned by user A.  
**Steps:** As user B, attempt read/update/delete of A's plan and every related child
resource using guessed IDs and direct REST/API calls.  
**Expected:** All operations are denied or return an indistinguishable not-found
response; no existence, name, amount, status, or owner information leaks.

### SEC-003 — Client-side identifier tampering

**Steps:** Modify plan ID, user ID, snapshot ID, section ID, export ID, payment ID,
and query-string section in browser requests.  
**Expected:** Server/RLS independently enforces ownership; changing client state
cannot authorize an operation.

### SEC-004 — Stored content injection

**Steps:** Store script-like payloads in questionnaire, plan name, narrative, and
other free-text fields, then render dashboard, editor, preview, and exports.  
**Expected:** No script/HTML event executes; UI safely renders text; exported content
does not create active content unexpectedly.

### SEC-005 — Secret and bundle inspection

**Steps:** Inspect built JS, source maps if deployed, local/session storage, network
payloads, error responses, console, and downloadable files.  
**Expected:** No Supabase service-role key, Stripe secret/webhook secret, OpenAI API
key, database URL/password, raw password, or other user's token/data is present. A
browser-safe Supabase publishable key is acceptable.

### SEC-006 — Rate limit and repeated mutations

**Steps:** In preview/local, rapidly repeat login failures, create-plan, save,
approval, generation, regeneration, checkout, and export requests.  
**Expected:** Sensitive/provider-backed operations are server-limited and idempotent;
limits fail safely without inconsistent rows, duplicate charges, calls, or files.

## Exit criteria

The release smoke test passes only when:

1. all `CRITICAL` and `HIGH` cases pass in the production candidate;
2. no unauthorized access, secret exposure, live payment, or unexplained external AI
   call occurs;
3. questionnaire, financial, approval, and narrative data survive refresh and a new
   login session;
4. all three statements reconcile and no non-finite value is displayed;
5. current approved narrative and financial snapshot appear in valid DOCX, PDF, and
   XLSX files;
6. console/page errors and unexpected failed network requests are zero;
7. the QA plan is deleted or its retained ID and reason are recorded.

## Run-result template

For each case, record:

| Field | Required value |
| --- | --- |
| Case ID / result | `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` |
| Timestamp / tester | UTC timestamp and tester identity |
| Environment | URL, commit SHA, database identifier, browser/version, viewport |
| Reproduction | Exact numbered steps and test data used |
| Expected / actual | Concise comparison |
| Evidence | Redacted screenshot, trace, console entry, request ID, or download hash |
| Errors | Browser console error and server/request error separately |
| Likely root cause | Evidence-based hypothesis, clearly marked if inferred |
| Severity | `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` |
| Cleanup | Deleted plan/resource IDs or reason retained |

