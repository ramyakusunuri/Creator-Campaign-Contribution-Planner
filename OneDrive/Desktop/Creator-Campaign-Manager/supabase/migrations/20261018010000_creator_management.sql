-- Enables creator management from the prototype UI.
-- IMPORTANT: this makes the shared creator catalogue writable to authenticated users,
-- including anonymous-auth sessions. For a public production deployment, replace these
-- policies with an admin role / server-side authorization before enabling writes.
alter table public.creator_financials drop constraint if exists creator_financials_orders_check;
alter table public.creator_financials add constraint creator_financials_orders_check check (orders >= 0);

create policy "authenticated users can add creators"
  on public.creators for insert to authenticated with check (true);
create policy "authenticated users can update creators"
  on public.creators for update to authenticated using (true) with check (true);
create policy "authenticated users can remove creators"
  on public.creators for delete to authenticated using (true);

create policy "authenticated users can add creator financials"
  on public.creator_financials for insert to authenticated with check (true);
create policy "authenticated users can update creator financials"
  on public.creator_financials for update to authenticated using (true) with check (true);
create policy "authenticated users can remove creator financials"
  on public.creator_financials for delete to authenticated using (true);
