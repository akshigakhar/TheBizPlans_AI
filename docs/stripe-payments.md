# Stripe one-time plan purchases

`complete_business_plan` is configured by `STRIPE_COMPLETE_PLAN_PRICE_ID` and grants `docx_export`, `pdf_export`, and `xlsx_export` to one plan. Amount and currency come from Stripe and are persisted in minor units; the browser never submits an amount. Normal access checks use the database, not Stripe.

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_COMPLETE_PLAN_PRICE_ID`, and `APP_BASE_URL`. Use matching test keys and a test-mode Price. The deployment adapter uses the official Stripe Node SDK, pins its supported API version, and passes the raw request body through `stripe.webhooks.constructEvent` before calling `handleStripeWebhook`.

For local testing, run `stripe listen --forward-to localhost:5173/api/stripe/webhook`, copy its `whsec_…`, and complete Checkout using Stripe's `4242 4242 4242 4242` test card, any future expiry, and any CVC. Stripe CLI is development tooling only.

The webhook is authoritative. Completed paid sessions are price-validated and finalized transactionally. Event IDs and entitlement uniqueness make retries safe; refunded is terminal so an older completion cannot restore access. Full refunds revoke exports and prior-file downloads. Partial refunds are recorded without revocation. Open disputes suspend access, wins restore it, and losses revoke it. Abandoned sessions remain `checkout_started` and grant nothing.

This release has no subscriptions, recurring billing, Stripe Tax, custom invoices, credit packs, or custom coupons. Duplicated plans receive no entitlement. Durable repository writes use service credentials; RLS gives users read-only access to their own commercial records.
