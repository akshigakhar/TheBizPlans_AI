# Supabase database setup

`database-setup.sql` contains the complete, ordered SQL needed by this
repository: the base `business_plans` schema, all financial/editor/payment/admin
migrations, full-form persistence, and four sample plans.

## Create and prefill the database

1. Create a Supabase project.
2. In **Authentication → Users**, create or invite `akshi.gakhar@gmail.com`.
   The seed intentionally does not create an Auth identity or choose a password.
3. Open **SQL Editor → New query** and execute all of
   [`database-setup.sql`](./database-setup.sql).
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

## Rebuild the complete query

After changing a migration, regenerate the executable SQL file:

```bash
npm run database:sql
```

For a linked Supabase project, migrations can instead be applied with the CLI
after authenticating and linking the project. Never commit the access token,
database password, or service-role key.
