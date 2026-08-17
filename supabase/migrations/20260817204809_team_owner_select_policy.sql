-- A team owner must be able to read their own team independently of team_members.
-- Without this, `insert ... returning` fails: the RETURNING row is checked against the
-- select policy before the after-insert trigger has created the owner's membership row.
create policy "Owners can view their teams"
on public.teams for select to authenticated
using (owner_id = auth.uid());
