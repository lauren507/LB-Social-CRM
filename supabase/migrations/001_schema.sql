create extension if not exists pgcrypto;
create type public.brand as enum ('ljco','pumps','gym_snack');
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);
create function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and lower(coalesce(auth.jwt()->>'email','')) like '%@louisvillebrands.com'
  and exists (select 1 from public.user_profiles where user_id = auth.uid() and lower(email) = lower(auth.jwt()->>'email'))
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (select 1 from public.user_profiles where user_id = auth.uid() and role = 'admin')
$$;
create function public.create_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) not like '%@louisvillebrands.com' or new.raw_app_meta_data->>'provider' is distinct from 'google' then raise exception 'Only Louisville Brands Google accounts are allowed'; end if;
  insert into public.user_profiles(user_id,email) values(new.id,lower(new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

create table public.outreach_rows (
 id uuid primary key default gen_random_uuid(), brand public.brand not null,
 creator_name text, date_first_contacted date, handle_raw text,
 handle_normalized text generated always as (lower(regexp_replace(btrim(coalesce(handle_raw,'')), '^@+', ''))) stored,
 platform text check (platform in ('TikTok','Instagram','YouTube','Other')),
 followers integer check (followers is null or followers >= 0), email text check (email is null or email = '' or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 segments text[] not null default '{}', contact_status text not null default 'Not Contacted' check (contact_status in ('Not Contacted','Contacted','Replied','Interested','Declined','Onboarded')),
 deliverable_ask text, shipping_address text, product_sku_sent text,
 tracking_carrier text check (tracking_carrier is null or tracking_carrier in ('USPS','UPS','FedEx','DHL','Other')),
 tracking_number text, tracking_est_delivery date, tracking_delivered boolean not null default false,
 deliverable_status text not null default 'Not Started' check (deliverable_status in ('Not Started','In Progress','Submitted','Needs Revision','Approved','Posted','Complete')),
 content_link text, date_posted date, partnership_terms text, ad_code text, notes text,
 source text not null default 'manual' check (source in ('manual','onboarding_form','import')),
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index outreach_brand_idx on public.outreach_rows(brand);
create index outreach_match_email_idx on public.outreach_rows(brand, lower(email));
create index outreach_match_handle_idx on public.outreach_rows(brand, handle_normalized);
create function public.normalize_outreach() returns trigger language plpgsql as $$
begin
 new.email := nullif(lower(btrim(new.email)), '');
 new.updated_at := now();
 return new;
end $$;
create trigger normalize_outreach_before before insert or update on public.outreach_rows for each row execute function public.normalize_outreach();

create table public.creator_memberships (
 id uuid primary key default gen_random_uuid(), creator_key text not null, brand public.brand not null,
 outreach_row_id uuid references public.outreach_rows(id) on delete set null,
 source_deleted boolean not null default false, first_qualified_at timestamptz not null default now(),
 snapshot jsonb not null default '{}'::jsonb, snapshot_updated_at timestamptz not null default now()
);
create unique index one_membership_per_source on public.creator_memberships(outreach_row_id) where outreach_row_id is not null;
create index membership_key_idx on public.creator_memberships(creator_key);

create function public.merge_creator_keys(old_key text, new_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
 if old_key is null or new_key is null or old_key = new_key then return; end if;
 update public.creator_memberships set creator_key = new_key where creator_key = old_key;
end $$;
revoke all on function public.merge_creator_keys(text,text) from public, anon, authenticated;

create function public.outreach_gate() returns trigger language plpgsql security definer set search_path = public as $$
declare key text; old_key text; snap jsonb;
begin
 if new.email is not null then key := lower(new.email);
 elsif new.handle_normalized <> '' then key := 'h:' || new.handle_normalized;
 else key := 'row:' || new.id::text; end if;
 if tg_op = 'UPDATE' then
   select creator_key into old_key from public.creator_memberships where outreach_row_id = new.id;
   if old_key is not null and old_key <> key then perform public.merge_creator_keys(old_key,key); end if;
 end if;
 if new.email is not null and new.handle_normalized <> '' then
   perform public.merge_creator_keys('h:' || new.handle_normalized,key);
 end if;
 if nullif(btrim(coalesce(new.shipping_address,'')),'') is not null
    and new.deliverable_status in ('Submitted','Approved','Posted','Complete') then
    snap := jsonb_build_object('creator_name',new.creator_name,'handle_raw',new.handle_raw,
      'platform',new.platform,'email',new.email,'shipping_address',new.shipping_address);
    insert into public.creator_memberships(creator_key,brand,outreach_row_id,snapshot,snapshot_updated_at)
    values(key,new.brand,new.id,snap,new.updated_at)
    on conflict (outreach_row_id) where outreach_row_id is not null
    do update set creator_key = excluded.creator_key, snapshot = excluded.snapshot,
      snapshot_updated_at = excluded.snapshot_updated_at;
 end if;
 return new;
end $$;
create trigger outreach_gate_after after insert or update on public.outreach_rows for each row execute function public.outreach_gate();
create function public.mark_source_deleted() returns trigger language plpgsql security definer set search_path = public as $$
begin
 update public.creator_memberships set source_deleted = true, outreach_row_id = null where outreach_row_id = old.id;
 return old;
end $$;
create trigger source_deleted_before before delete on public.outreach_rows for each row execute function public.mark_source_deleted();

create view public.creator_database with (security_invoker = true) as
select grouped.creator_key, grouped.brand_tags, grouped.first_qualified_at, grouped.last_updated_at,
  latest.snapshot->>'creator_name' as creator_name, latest.snapshot->>'handle_raw' as handle,
  latest.snapshot->>'platform' as platform, latest.snapshot->>'email' as email,
  latest.snapshot->>'shipping_address' as address
from (
 select creator_key, array_agg(distinct brand order by brand) as brand_tags,
   min(first_qualified_at) as first_qualified_at, max(snapshot_updated_at) as last_updated_at
 from public.creator_memberships group by creator_key
) grouped
cross join lateral (
 select snapshot from public.creator_memberships m where m.creator_key = grouped.creator_key
 order by snapshot_updated_at desc, first_qualified_at desc limit 1
) latest;

create table public.trybe_creators (
 id uuid primary key default gen_random_uuid(), brand public.brand not null, trybe_creator_id text not null,
 creator_name text, joined date, program text, commission text, status text,
 active boolean not null default true, synced_at timestamptz,
 unique(brand,trybe_creator_id)
);
create table public.trybe_sync_runs (
 id uuid primary key default gen_random_uuid(), brand public.brand not null,
 started_at timestamptz not null default now(), finished_at timestamptz,
 ok boolean, rows_upserted integer, error text
);
create table public.onboarding_submissions (
 id uuid primary key default gen_random_uuid(), payload jsonb not null, brands public.brand[] not null,
 created_at timestamptz not null default now()
);
create table public.brand_integrations (
 brand public.brand primary key, api_key_ciphertext text, api_key_last4 text, account_id text,
 updated_at timestamptz not null default now()
);
create table public.app_settings (id boolean primary key default true check(id), sync_interval_hours integer not null default 6 check(sync_interval_hours between 1 and 24));
insert into public.app_settings(id) values(true);

alter table public.user_profiles enable row level security;
alter table public.outreach_rows enable row level security;
alter table public.creator_memberships enable row level security;
alter table public.trybe_creators enable row level security;
alter table public.trybe_sync_runs enable row level security;
alter table public.onboarding_submissions enable row level security;
alter table public.brand_integrations enable row level security;
alter table public.app_settings enable row level security;
create policy profiles_read on public.user_profiles for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy outreach_read on public.outreach_rows for select to authenticated using (public.is_staff());
create policy outreach_insert on public.outreach_rows for insert to authenticated with check (public.is_staff());
create policy outreach_update on public.outreach_rows for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy outreach_delete on public.outreach_rows for delete to authenticated using (public.is_admin());
create policy memberships_read on public.creator_memberships for select to authenticated using (public.is_staff());
create policy trybe_read on public.trybe_creators for select to authenticated using (public.is_staff());
create policy sync_runs_read on public.trybe_sync_runs for select to authenticated using (public.is_staff());
create policy settings_read on public.app_settings for select to authenticated using (public.is_admin());
create policy integrations_read on public.brand_integrations for select to authenticated using (public.is_admin());
revoke all on public.brand_integrations from anon, authenticated;
revoke all on public.onboarding_submissions from anon, authenticated;
revoke all on public.creator_memberships from anon;
revoke insert,update,delete on public.creator_memberships, public.trybe_creators, public.trybe_sync_runs from authenticated;

create table public.onboarding_rate_limits (
 ip_hash text primary key, window_start timestamptz not null default now(), hits integer not null default 0
);
create function public.consume_onboard_limit(p_hash text) returns boolean language plpgsql security definer set search_path = public as $$
declare hit_count integer;
begin
 insert into public.onboarding_rate_limits(ip_hash,hits) values(p_hash,1)
 on conflict(ip_hash) do update set
 window_start = case when public.onboarding_rate_limits.window_start < now() - interval '1 hour' then now() else public.onboarding_rate_limits.window_start end,
 hits = case when public.onboarding_rate_limits.window_start < now() - interval '1 hour' then 1 else public.onboarding_rate_limits.hits + 1 end
 returning hits into hit_count;
 return hit_count <= 5;
end $$;
revoke all on public.onboarding_rate_limits from anon,authenticated;
revoke all on function public.consume_onboard_limit(text) from public,anon,authenticated;

create function public.process_onboarding(p_name text,p_handle text,p_platform text,p_email text,p_address text,p_brands public.brand[],p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare b public.brand; existing public.outreach_rows%rowtype; clean_email text := lower(btrim(p_email)); clean_handle text := lower(regexp_replace(btrim(p_handle),'^@+',''));
begin
 if cardinality(p_brands) < 1 or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or btrim(p_name) = '' or clean_handle = '' or btrim(p_address) = '' then raise exception 'Invalid submission'; end if;
 if p_platform not in ('TikTok','Instagram','YouTube','Other') then raise exception 'Invalid platform'; end if;
 insert into public.onboarding_submissions(payload,brands) values(p_payload,p_brands);
 foreach b in array p_brands loop
   select * into existing from public.outreach_rows where brand=b and lower(email)=clean_email order by updated_at desc limit 1 for update;
   if not found then select * into existing from public.outreach_rows where brand=b and handle_normalized=clean_handle order by updated_at desc limit 1 for update; end if;
   if found then
     update public.outreach_rows set
       creator_name=coalesce(nullif(btrim(creator_name),''),p_name),
       handle_raw=coalesce(nullif(btrim(handle_raw),''),p_handle),
       platform=coalesce(platform,p_platform),
       email=coalesce(nullif(btrim(email),''),clean_email),
       shipping_address=coalesce(nullif(btrim(shipping_address),''),p_address),
       notes=case when nullif(btrim(existing.shipping_address),'') is not null and btrim(existing.shipping_address) <> btrim(p_address)
         then concat_ws(E'\n',nullif(existing.notes,''),'Onboarding form submitted new address on '||current_date::text||': '||p_address)
         else existing.notes end
     where id=existing.id;
   else
     insert into public.outreach_rows(brand,creator_name,handle_raw,platform,email,shipping_address,contact_status,deliverable_status,source)
     values(b,p_name,p_handle,p_platform,clean_email,p_address,'Onboarded','Not Started','onboarding_form');
   end if;
 end loop;
end $$;
revoke all on function public.process_onboarding(text,text,text,text,text,public.brand[],jsonb) from public,anon,authenticated;
grant execute on function public.consume_onboard_limit(text) to service_role;
grant execute on function public.process_onboarding(text,text,text,text,text,public.brand[],jsonb) to service_role;
