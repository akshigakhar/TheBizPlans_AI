begin;
create policy "users delete own plans" on public.business_plans
for delete using (user_id = auth.uid());
commit;
