# Supabase database setup

There are two SQL bundles. Choose **one** based on the state of the project:

- [`database-setup.sql`](./database-setup.sql) is only for a **new, empty**
  Supabase project.
- [`database-upgrade.sql`](./database-upgrade.sql) is for an **existing** project
  that already has the `public.business_plans` table.
- [`database-seed.sql`](./database-seed.sql) is the safest targeted query when
  the application schema is already installed and only `plan_data` plus the four
  requested sample plans are needed.
- [`database-rebuild.sql`](./database-rebuild.sql) is the **destructive recovery
  script** for a partially deleted or inconsistent database. It drops and
  recreates the complete `public` schema while preserving Supabase Auth users.

Running the fresh-project bundle on an existing project causes errors such as
`42P16: multiple primary keys for table "business_plans" are not allowed`.
That happens because a schema dump must add the initial primary key, while an
existing database already has it. Use the upgrade bundle in that situation.

## Create and prefill the database

1. Create a Supabase project.
2. In **Authentication → Users**, create or invite `akshi.gakhar@gmail.com`.
   The seed intentionally does not create an Auth identity or choose a password.
3. Open **SQL Editor → New query** and execute the appropriate file:
   - Empty database: [`database-setup.sql`](./database-setup.sql).
   - Existing base-only database: [`database-upgrade.sql`](./database-upgrade.sql).
   - Existing configured application database: [`database-seed.sql`](./database-seed.sql).
   - Deleted `business_plans` table or partial/failed setup:
     [`database-rebuild.sql`](./database-rebuild.sql).
4. Confirm the seed:

   ```sql
   select p.id, p.plan_name, p.business_name, p.currency, p.updated_at
   from public.business_plans p
   join auth.users u on u.id = p.user_id
   where lower(u.email) = 'akshi.gakhar@gmail.com'
   order by p.updated_at desc;
   ```

   The result must contain the four deterministic sample IDs beginning with
   `a1000000`. Re-running the complete seed is safe: those rows are updated via
   `ON CONFLICT` rather than duplicated.

## Recovery after deleting `business_plans`

Run the complete [`database-rebuild.sql`](./database-rebuild.sql) file. It starts
with `drop schema public cascade`, so it removes partial tables, policies, types,
triggers, and functions before recreating the application in dependency order.
It preserves `auth.users`, then the final seed resolves the existing Akshi user
by email and assigns all four plans to that user's UUID.

This is intentionally destructive: **all current data in `public` is deleted**.
Do not run it when public data must be retained. Use `database-seed.sql` for a
healthy existing schema instead.

The generated bundles restore `search_path = public, extensions` before every
source file. This is required because the initial Supabase schema dump clears
the search path, while later migrations contain statements such as
`CREATE TABLE operating_expenses` without an explicit schema. Without the reset,
Postgres reports `3F000: no schema has been selected to create in`.

## Rebuild the complete query

After changing a migration, regenerate the executable SQL file:

```bash
npm run database:sql
```

For a linked Supabase project, migrations can instead be applied with the CLI
after authenticating and linking the project. Never commit the access token,
database password, or service-role key.
