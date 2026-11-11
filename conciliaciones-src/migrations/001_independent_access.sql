create schema if not exists simoun_recon_private;
revoke all on schema simoun_recon_private from public, anon;
grant usage on schema simoun_recon_private to authenticated;
create function simoun_recon_private.authorized() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)='simoun.con.ia@gmail.com' and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false and u.deleted_at is null);
$$;
revoke all on function simoun_recon_private.authorized() from public, anon;
grant execute on function simoun_recon_private.authorized() to authenticated;
create table public.simoun_recon_state (
 id text primary key check(id='principal'),
 data jsonb not null default '{"periods":[],"clients":[],"movements":[]}'::jsonb,
 version integer not null default 0,
 updated timestamptz not null default now()
);
create table public.simoun_recon_history (version integer primary key, data jsonb not null, saved_at timestamptz not null default now());
create table public.simoun_recon_files (
 id uuid primary key,
 entity text not null,
 name text not null check(length(name) between 1 and 200),
 size bigint not null check(size between 0 and 20971520),
 kind text not null,
 created timestamptz not null default now()
);
alter table public.simoun_recon_state enable row level security;
alter table public.simoun_recon_history enable row level security;
alter table public.simoun_recon_files enable row level security;
revoke all on public.simoun_recon_state,public.simoun_recon_history,public.simoun_recon_files from public,anon,authenticated;
grant select,update on public.simoun_recon_state to authenticated;
grant select,insert on public.simoun_recon_history,public.simoun_recon_files to authenticated;
create policy recon_read on public.simoun_recon_state for select to authenticated using ((select simoun_recon_private.authorized()));
create policy recon_update on public.simoun_recon_state for update to authenticated using ((select simoun_recon_private.authorized())) with check ((select simoun_recon_private.authorized()));
create policy recon_history_read on public.simoun_recon_history for select to authenticated using ((select simoun_recon_private.authorized()));
create policy recon_history_insert on public.simoun_recon_history for insert to authenticated with check ((select simoun_recon_private.authorized()));
create policy recon_files_read on public.simoun_recon_files for select to authenticated using ((select simoun_recon_private.authorized()));
create policy recon_files_insert on public.simoun_recon_files for insert to authenticated with check ((select simoun_recon_private.authorized()));
create function simoun_recon_private.validate_save() returns trigger language plpgsql security invoker set search_path='' as $$
declare collection text; ids_count bigint; distinct_count bigint;
begin
 if new.version<>old.version+1 then raise exception 'Versión inválida. Recarga antes de guardar.'; end if;
 if octet_length(new.data::text)>15000000 then raise exception 'Expediente demasiado grande.'; end if;
 foreach collection in array array['periods','clients','movements'] loop
  if jsonb_typeof(new.data->collection) is distinct from 'array' then raise exception 'Formato de expediente inválido.'; end if;
 end loop;
 select count(*), count(distinct item->>'id') into ids_count,distinct_count from jsonb_array_elements((new.data->'periods')||(new.data->'clients')||(new.data->'movements')) item;
 if ids_count<>distinct_count then raise exception 'Hay identificadores repetidos o vacíos.'; end if;
 if exists(select 1 from jsonb_array_elements(new.data->'movements') m where not exists(select 1 from jsonb_array_elements(new.data->'periods') p where p->>'id'=m->>'period')) then raise exception 'Movimiento sin conciliación.'; end if;
 insert into public.simoun_recon_history(version,data) values(old.version,old.data);
 new.updated=now();return new;
end;
$$;
revoke all on function simoun_recon_private.validate_save() from public,anon;
grant execute on function simoun_recon_private.validate_save() to authenticated;
create trigger recon_before_save before update on public.simoun_recon_state for each row execute function simoun_recon_private.validate_save();
insert into public.simoun_recon_state(id) values('principal');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('simoun-conciliaciones','simoun-conciliaciones',false,20971520,array['application/octet-stream']);
create policy recon_storage_read on storage.objects for select to authenticated using(bucket_id='simoun-conciliaciones' and (select simoun_recon_private.authorized()));
create policy recon_storage_insert on storage.objects for insert to authenticated with check(bucket_id='simoun-conciliaciones' and (select simoun_recon_private.authorized()));
