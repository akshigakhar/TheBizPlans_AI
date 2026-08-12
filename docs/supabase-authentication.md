# Supabase authentication setup

The application uses Supabase Auth for email/password accounts, Google sign-in,
password recovery, session refresh, and sign-out. It does **not** act as an OAuth
identity provider for other applications.

## Do not enable Supabase OAuth Server

The **Authentication → OAuth Server** screen configures Supabase to become an
identity provider for third-party applications. It is unrelated to signing in to
this application with Google. Leave both **Enable the Supabase OAuth Server** and
**Allow Dynamic OAuth Apps** disabled. The `/oauth/consent` page shown on that
screen is therefore not required by this application.

## URL configuration

In **Authentication → URL Configuration**:

1. Set **Site URL** to the canonical production origin:
   `https://the-biz-plans-ai-akshigakhars-projects.vercel.app`
2. Add these exact redirect URLs:
   - `https://the-biz-plans-ai-akshigakhars-projects.vercel.app`
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
3. Set `VITE_AUTH_REDIRECT_URL` to the same canonical URL in Vercel. The browser
   uses this value for both Google OAuth and password-reset links.

Add preview deployment URLs only when they are intentionally used for auth.
Avoid a broad wildcard for production callbacks.

## Email/password

In **Authentication → Providers → Email**, enable the Email provider. Choose
whether email confirmation is required. If it is enabled, a new account receives
a confirmation message and cannot sign in until it is confirmed.

Configure production SMTP before launch. Supabase's default mail delivery is
appropriate for development only and is rate limited.

## Google sign-in

The Google Cloud dashboard shown after selecting a project is the correct starting
point. The Google Cloud project name does not have to match the Supabase project,
although a dedicated production project is easier to administer.

1. In Google Cloud, confirm the intended project is selected in the top project
   picker. Then open **APIs & Services** (or search for **Google Auth Platform**).
2. Complete **Google Auth Platform → Branding**:
   - App name: `TheBizPlans AI`
   - User support email: a monitored support address
   - App domain/home page: the canonical production URL
   - Developer contact email: a monitored technical address
3. Under **Audience**, select **External** so customers outside the Google Cloud
   organization can sign in. While the app is in testing, add the Google accounts
   that will test it as test users. Publish the app when production verification
   and branding are ready.
4. Open **Clients → Create client → Web application** and name it
   `TheBizPlans AI Web`.
5. Add these **Authorized JavaScript origins** (origins contain no path):
   - `https://the-biz-plans-ai-akshigakhars-projects.vercel.app`
   - `http://localhost:5173`
6. Add this exact **Authorized redirect URI**:
   `https://bfokmiteswljdgjjvxtt.supabase.co/auth/v1/callback`
7. Create the client and copy its client ID and client secret.
8. In Supabase, open **Authentication → Sign In / Providers → Google**, enable
   Google, paste the Google client ID and secret, and save.
9. Do not put the Google client secret in a `VITE_*` environment variable or in
   this repository.

Do not add the Vercel application URL as Google's redirect URI. Google redirects
to Supabase; Supabase then redirects to the application URL allowed under
**Authentication → URL Configuration**.

The application first redirects to Supabase `/auth/v1/authorize`; Supabase then
handles the Google callback and returns the resulting session to the configured
application redirect URL.

### Google setup checklist

- [ ] Google Auth Platform branding completed
- [ ] Audience is External (with test users while in testing)
- [ ] OAuth client type is Web application
- [ ] Production and local JavaScript origins added
- [ ] Supabase `/auth/v1/callback` added as the sole Google redirect URI
- [ ] Google provider enabled in Supabase with the client ID and secret
- [ ] Supabase OAuth Server remains disabled

## Required browser environment

```dotenv
VITE_SUPABASE_URL=https://bfokmiteswljdgjjvxtt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_AUTH_REDIRECT_URL=https://the-biz-plans-ai-akshigakhars-projects.vercel.app
```

Only the publishable key belongs in browser configuration. Never expose the
service-role key, Google client secret, or SMTP password through `VITE_*`.

## Logging in and saving a plan

1. Deploy the current migrations with `supabase db push` from the linked project.
   The plan table already permits authenticated owners to insert, read, and
   update their rows. The owner-delete migration adds safe deletion support.
2. Open the deployed application and select **Sign in**. Use email/password or
   **Continue with Google**. Supabase users appear under **Authentication →
   Users**, not in the `business_plans` table.
3. After login, select **Create new plan**, complete the plan setup form, and
   choose **Create plan**.
4. The application writes the row to `public.business_plans` with the logged-in
   user's UUID. Refreshing the dashboard reloads that user's rows from Supabase.
   The table remains empty until a signed-in user creates their first plan.

RLS derives access from the bearer token and restricts each user to their own
rows. Do not manually enter `user_id` in Table Editor for normal application use.
The current persistence slice stores the plan setup fields represented by
`business_plans`; questionnaire and financial-detail persistence use their own
domain tables and are separate integration work.
