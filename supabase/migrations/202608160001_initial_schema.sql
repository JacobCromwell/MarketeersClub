create extension if not exists pgcrypto;

create type public.team_member_role as enum ('owner', 'member');
create type public.team_member_status as enum ('pending', 'active');
create type public.trip_status as enum ('upcoming', 'in_progress', 'completed', 'cancelled');
create type public.agreement_status as enum ('proposed', 'changes_requested', 'approved', 'reported', 'settled', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.team_member_role not null default 'member',
  status public.team_member_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  sku text check (sku is null or char_length(sku) <= 50),
  description text check (description is null or char_length(description) <= 500),
  quantity integer not null default 0 check (quantity >= 0),
  default_price_cents integer not null default 0 check (default_price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 120),
  event_at timestamptz not null,
  pickup_at timestamptz not null,
  pickup_location text not null check (char_length(pickup_location) between 2 and 300),
  return_at timestamptz not null,
  return_location text not null check (char_length(return_location) between 2 and 300),
  note text check (note is null or char_length(note) <= 1000),
  status public.trip_status not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_at <= event_at),
  check (return_at >= event_at)
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  commission_per_item_cents integer not null check (
    commission_per_item_cents >= 0 and commission_per_item_cents <= unit_price_cents
  ),
  sold_quantity integer check (sold_quantity is null or sold_quantity between 0 and quantity),
  terms_version integer not null default 1 check (terms_version > 0),
  owner_approved_version integer,
  seller_approved_version integer,
  status public.agreement_status not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id <> seller_id)
);

create table public.agreement_messages (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  href text check (href is null or char_length(href) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index team_members_profile_id_idx on public.team_members(profile_id);
create index inventory_items_owner_id_idx on public.inventory_items(owner_id);
create index trips_team_event_idx on public.trips(team_id, event_at);
create index agreements_owner_status_idx on public.agreements(owner_id, status);
create index agreements_seller_status_idx on public.agreements(seller_id, status);
create index agreements_item_status_idx on public.agreements(item_id, status);
create index agreement_messages_agreement_idx on public.agreement_messages(agreement_id, created_at);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index profiles_display_name_idx on public.profiles(lower(display_name));

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create trigger trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

create trigger agreements_set_updated_at
before update on public.agreements
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.is_active_team_member(p_team_id uuid, p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and profile_id = p_profile_id and status = 'active'
  );
$$;

create function public.is_team_member(p_team_id uuid, p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and profile_id = p_profile_id
  );
$$;

create function public.add_team_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.team_members (team_id, profile_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active');
  return new;
end;
$$;

create trigger on_team_created
after insert on public.teams
for each row execute function public.add_team_owner();

create function public.create_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_href text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, title, body, href)
  values (p_user_id, p_title, p_body, p_href);
$$;

create function public.invite_team_member(p_team_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_name text;
begin
  select name into v_team_name
  from public.teams
  where id = p_team_id and owner_id = auth.uid();

  if v_team_name is null then
    raise exception 'Only the team owner can invite members.';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'You are already a member of this team.';
  end if;

  insert into public.team_members (team_id, profile_id, role, status)
  values (p_team_id, p_profile_id, 'member', 'pending')
  on conflict (team_id, profile_id) do nothing;

  perform public.create_notification(
    p_profile_id,
    'Team invitation',
    'You were invited to join ' || v_team_name || '.',
    '/teams'
  );
end;
$$;

create function public.accept_team_invite(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_members
  set status = 'active'
  where id = p_membership_id and profile_id = auth.uid() and status = 'pending';

  if not found then
    raise exception 'Invitation not found.';
  end if;
end;
$$;

create function public.prepare_agreement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_owner uuid;
  v_item_quantity integer;
  v_trip_seller uuid;
  v_team_id uuid;
begin
  select owner_id, quantity into v_item_owner, v_item_quantity
  from public.inventory_items where id = new.item_id;

  select seller_id, team_id into v_trip_seller, v_team_id
  from public.trips where id = new.trip_id and status <> 'cancelled';

  if v_item_owner is null or v_trip_seller is null then
    raise exception 'The item or trip is unavailable.';
  end if;
  if new.owner_id <> v_item_owner or new.seller_id <> v_trip_seller then
    raise exception 'Agreement participants must match the item owner and trip seller.';
  end if;
  if new.quantity > v_item_quantity then
    raise exception 'The requested quantity exceeds inventory on hand.';
  end if;
  if not public.is_active_team_member(v_team_id, new.owner_id)
    or not public.is_active_team_member(v_team_id, new.seller_id) then
    raise exception 'Both members must be active members of the trip team.';
  end if;

  new.terms_version := 1;
  new.owner_approved_version := 1;
  new.seller_approved_version := null;
  new.status := 'proposed';
  new.sold_quantity := null;
  return new;
end;
$$;

create trigger agreements_prepare_insert
before insert on public.agreements
for each row execute function public.prepare_agreement();

create function public.notify_agreement_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_notification(
    new.seller_id,
    'New sale proposal',
    'A teammate proposed merchandise for your trip.',
    '/agreements'
  );
  return new;
end;
$$;

create trigger agreements_notify_insert
after insert on public.agreements
for each row execute function public.notify_agreement_created();

create function public.approve_agreement(p_agreement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement public.agreements%rowtype;
  v_owner_version integer;
  v_seller_version integer;
  v_inventory_quantity integer;
  v_committed_quantity bigint;
  v_other_user uuid;
begin
  select * into v_agreement from public.agreements where id = p_agreement_id for update;

  if v_agreement.id is null or auth.uid() not in (v_agreement.owner_id, v_agreement.seller_id) then
    raise exception 'Agreement not found.';
  end if;
  if v_agreement.status not in ('proposed', 'changes_requested') then
    raise exception 'These terms can no longer be approved.';
  end if;

  v_owner_version := v_agreement.owner_approved_version;
  v_seller_version := v_agreement.seller_approved_version;
  if auth.uid() = v_agreement.owner_id then
    v_owner_version := v_agreement.terms_version;
    v_other_user := v_agreement.seller_id;
  else
    v_seller_version := v_agreement.terms_version;
    v_other_user := v_agreement.owner_id;
  end if;

  if v_owner_version = v_agreement.terms_version and v_seller_version = v_agreement.terms_version then
    select quantity into v_inventory_quantity
    from public.inventory_items where id = v_agreement.item_id for update;

    select coalesce(sum(quantity), 0) into v_committed_quantity
    from public.agreements
    where item_id = v_agreement.item_id
      and id <> v_agreement.id
      and status in ('approved', 'reported');

    if v_committed_quantity + v_agreement.quantity > v_inventory_quantity then
      raise exception 'Not enough uncommitted inventory remains for this agreement.';
    end if;
  end if;

  update public.agreements
  set owner_approved_version = v_owner_version,
      seller_approved_version = v_seller_version,
      status = case
        when v_owner_version = terms_version and v_seller_version = terms_version then 'approved'::public.agreement_status
        else status
      end
  where id = p_agreement_id;

  perform public.create_notification(
    v_other_user,
    case when v_owner_version = v_agreement.terms_version and v_seller_version = v_agreement.terms_version
      then 'Agreement approved' else 'Terms approved' end,
    case when v_owner_version = v_agreement.terms_version and v_seller_version = v_agreement.terms_version
      then 'Both members approved the current sale terms.' else 'Your teammate approved the current terms.' end,
    '/agreements'
  );
end;
$$;

create function public.request_agreement_change(
  p_agreement_id uuid,
  p_quantity integer,
  p_unit_price_cents integer,
  p_commission_cents integer,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement public.agreements%rowtype;
  v_next_version integer;
  v_other_user uuid;
begin
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if v_agreement.id is null or auth.uid() not in (v_agreement.owner_id, v_agreement.seller_id) then
    raise exception 'Agreement not found.';
  end if;
  if v_agreement.status not in ('proposed', 'changes_requested', 'approved') then
    raise exception 'Terms can no longer be changed.';
  end if;
  if p_quantity < 1 or p_unit_price_cents < 0 or p_commission_cents < 0
    or p_commission_cents > p_unit_price_cents then
    raise exception 'Invalid agreement terms.';
  end if;
  if nullif(trim(p_message), '') is null then
    raise exception 'Explain what changed.';
  end if;

  v_next_version := v_agreement.terms_version + 1;
  if auth.uid() = v_agreement.owner_id then
    v_other_user := v_agreement.seller_id;
    update public.agreements
    set quantity = p_quantity,
        unit_price_cents = p_unit_price_cents,
        commission_per_item_cents = p_commission_cents,
        terms_version = v_next_version,
        owner_approved_version = v_next_version,
        seller_approved_version = null,
        sold_quantity = null,
        status = 'changes_requested'
    where id = p_agreement_id;
  else
    v_other_user := v_agreement.owner_id;
    update public.agreements
    set quantity = p_quantity,
        unit_price_cents = p_unit_price_cents,
        commission_per_item_cents = p_commission_cents,
        terms_version = v_next_version,
        owner_approved_version = null,
        seller_approved_version = v_next_version,
        sold_quantity = null,
        status = 'changes_requested'
    where id = p_agreement_id;
  end if;

  insert into public.agreement_messages (agreement_id, author_id, body)
  values (p_agreement_id, auth.uid(), trim(p_message));

  perform public.create_notification(
    v_other_user,
    'Agreement terms changed',
    'A teammate requested your approval for version ' || v_next_version || '.',
    '/agreements'
  );
end;
$$;

create function public.report_agreement_sales(p_agreement_id uuid, p_sold_quantity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement public.agreements%rowtype;
begin
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if v_agreement.id is null or auth.uid() <> v_agreement.seller_id then
    raise exception 'Only the trip seller can report sales.';
  end if;
  if v_agreement.status <> 'approved' then
    raise exception 'Only an approved agreement can be reported.';
  end if;
  if p_sold_quantity < 0 or p_sold_quantity > v_agreement.quantity then
    raise exception 'Sold quantity must be within the agreed quantity.';
  end if;

  update public.agreements
  set sold_quantity = p_sold_quantity, status = 'reported'
  where id = p_agreement_id;

  perform public.create_notification(
    v_agreement.owner_id,
    'Trip sales reported',
    'The seller reported results. Confirm the payout and returned inventory after handoff.',
    '/agreements'
  );
end;
$$;

create function public.settle_agreement(p_agreement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement public.agreements%rowtype;
begin
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if v_agreement.id is null or auth.uid() <> v_agreement.owner_id then
    raise exception 'Only the inventory owner can settle this agreement.';
  end if;
  if v_agreement.status <> 'reported' or v_agreement.sold_quantity is null then
    raise exception 'Sales must be reported before settlement.';
  end if;

  update public.inventory_items
  set quantity = quantity - v_agreement.sold_quantity
  where id = v_agreement.item_id and owner_id = v_agreement.owner_id
    and quantity >= v_agreement.sold_quantity;

  if not found then
    raise exception 'Inventory is no longer sufficient to settle this agreement.';
  end if;

  update public.agreements set status = 'settled' where id = p_agreement_id;

  perform public.create_notification(
    v_agreement.seller_id,
    'Agreement settled',
    'The owner confirmed the payout and returned merchandise.',
    '/agreements'
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.inventory_items enable row level security;
alter table public.trips enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_messages enable row level security;
alter table public.notifications enable row level security;

create policy "Authenticated users can find profiles"
on public.profiles for select to authenticated using (true);
create policy "Users can update their profile"
on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can view their teams"
on public.teams for select to authenticated using (public.is_team_member(id));
create policy "Users can create teams"
on public.teams for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners can update teams"
on public.teams for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners can delete teams"
on public.teams for delete to authenticated using (owner_id = auth.uid());

create policy "Members can view team membership"
on public.team_members for select to authenticated
using (profile_id = auth.uid() or public.is_active_team_member(team_id));

create policy "Owners control their inventory"
on public.inventory_items for all to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Agreement sellers can view committed items"
on public.inventory_items for select to authenticated
using (exists (
  select 1 from public.agreements
  where agreements.item_id = inventory_items.id and agreements.seller_id = auth.uid()
));

create policy "Active team members can view trips"
on public.trips for select to authenticated using (public.is_active_team_member(team_id));
create policy "Active members can create their trips"
on public.trips for insert to authenticated
with check (seller_id = auth.uid() and public.is_active_team_member(team_id));
create policy "Sellers can update their trips"
on public.trips for update to authenticated
using (seller_id = auth.uid()) with check (seller_id = auth.uid() and public.is_active_team_member(team_id));

create policy "Participants can view agreements"
on public.agreements for select to authenticated
using (auth.uid() in (owner_id, seller_id));
create policy "Owners can propose their inventory"
on public.agreements for insert to authenticated
with check (owner_id = auth.uid());

create policy "Participants can view agreement messages"
on public.agreement_messages for select to authenticated
using (exists (
  select 1 from public.agreements
  where agreements.id = agreement_messages.agreement_id
    and auth.uid() in (agreements.owner_id, agreements.seller_id)
));
create policy "Participants can add agreement messages"
on public.agreement_messages for insert to authenticated
with check (
  author_id = auth.uid() and exists (
    select 1 from public.agreements
    where agreements.id = agreement_messages.agreement_id
      and auth.uid() in (agreements.owner_id, agreements.seller_id)
  )
);

create policy "Users can view notifications"
on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users can mark notifications read"
on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update on public.trips to authenticated;
grant select, insert on public.agreements to authenticated;
grant select, insert on public.agreement_messages to authenticated;
grant select, update on public.notifications to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_team_owner() from public, anon, authenticated;
revoke execute on function public.create_notification(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.prepare_agreement() from public, anon, authenticated;
revoke execute on function public.notify_agreement_created() from public, anon, authenticated;

revoke execute on function public.is_active_team_member(uuid, uuid) from public, anon;
revoke execute on function public.is_team_member(uuid, uuid) from public, anon;
grant execute on function public.is_active_team_member(uuid, uuid) to authenticated;
grant execute on function public.is_team_member(uuid, uuid) to authenticated;

revoke execute on function public.invite_team_member(uuid, uuid) from public, anon;
revoke execute on function public.accept_team_invite(uuid) from public, anon;
revoke execute on function public.approve_agreement(uuid) from public, anon;
revoke execute on function public.request_agreement_change(uuid, integer, integer, integer, text) from public, anon;
revoke execute on function public.report_agreement_sales(uuid, integer) from public, anon;
revoke execute on function public.settle_agreement(uuid) from public, anon;

grant execute on function public.invite_team_member(uuid, uuid) to authenticated;
grant execute on function public.accept_team_invite(uuid) to authenticated;
grant execute on function public.approve_agreement(uuid) to authenticated;
grant execute on function public.request_agreement_change(uuid, integer, integer, integer, text) to authenticated;
grant execute on function public.report_agreement_sales(uuid, integer) to authenticated;
grant execute on function public.settle_agreement(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;