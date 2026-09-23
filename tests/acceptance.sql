-- Run against a disposable Supabase database: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/acceptance.sql
begin;
do $$
declare a uuid; b uuid; c uuid; d uuid; count_roster integer; tags public.brand[];
begin
 insert into public.outreach_rows(brand,creator_name,handle_raw,email,shipping_address,deliverable_status)
 values('pumps','Gate Test','@GateTester','gate-test@example.com','123 Test St','In Progress') returning id into a;
 select count(*) into count_roster from public.creator_database where creator_key='gate-test@example.com';
 if count_roster<>0 then raise exception 'Gate entered before Submitted'; end if;
 update public.outreach_rows set deliverable_status='Submitted' where id=a;
 select count(*) into count_roster from public.creator_database where creator_key='gate-test@example.com';
 if count_roster<>1 then raise exception 'Gate did not enter'; end if;
 update public.outreach_rows set deliverable_status='Needs Revision' where id=a;
 select count(*) into count_roster from public.creator_database where creator_key='gate-test@example.com';
 if count_roster<>1 then raise exception 'Membership did not stick'; end if;
 insert into public.outreach_rows(brand,creator_name,handle_raw,email,shipping_address,deliverable_status)
 values('gym_snack','Gate Test','@GateTester','gate-test@example.com','123 Test St','Posted') returning id into b;
 select count(*) into count_roster from public.creator_database where creator_key='gate-test@example.com';
 select brand_tags into tags from public.creator_database where creator_key='gate-test@example.com';
 if count_roster<>1 or cardinality(tags)<>2 then raise exception 'Multi-brand dedupe failed'; end if;
 insert into public.outreach_rows(brand,creator_name,handle_raw,shipping_address,deliverable_status)
 values('ljco','Handle Test','@@HandleTester','456 Test Ave','Approved') returning id into c;
 if not exists(select 1 from public.creator_database where creator_key='h:handletester') then raise exception 'Handle key absent'; end if;
 update public.outreach_rows set email='handle-test@example.com' where id=c;
 if exists(select 1 from public.creator_database where creator_key='h:handletester') or not exists(select 1 from public.creator_database where creator_key='handle-test@example.com') then raise exception 'Handle key did not merge into email'; end if;
 delete from public.outreach_rows where id=c;
 if not exists(select 1 from public.creator_memberships where creator_key='handle-test@example.com' and source_deleted and outreach_row_id is null) then raise exception 'Deleted source was not retained'; end if;
 perform public.process_onboarding('Onboard Test','@onboard-test','Instagram','onboard-test@example.com','789 Test Rd',array['ljco','pumps']::public.brand[],jsonb_build_object('test',true));
 select count(*) into count_roster from public.outreach_rows where email='onboard-test@example.com';
 if count_roster<>2 then raise exception 'Onboarding did not route exactly two brands'; end if;
 update public.outreach_rows set deliverable_status='Submitted' where email='onboard-test@example.com';
 select count(*) into count_roster from public.creator_database where creator_key='onboard-test@example.com';
 if count_roster<>1 then raise exception 'Onboarding to gate to database failed'; end if;
end $$;
rollback;
