begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter table public.families
 add column slides jsonb not null default '[]' check(jsonb_typeof(slides)='array' and jsonb_array_length(slides)<=12 and octet_length(slides::text)<=40000),
 add column slider_height integer not null default 380 check(slider_height between 260 and 760);
alter table public.store_settings
 add column home_slider_height integer not null default 520 check(home_slider_height between 260 and 760),
 add column slider_interval integer not null default 6 check(slider_interval between 3 and 20),
 add column about_title text not null default 'Des solutions utiles, signées UNIPLAST.' check(length(about_title) between 1 and 200),
 add column about_body text not null default 'UNIPLAST propose des produits en plastique pour la maison, les commerces et les professionnels. Conservation, rangement, entretien et mobilier : découvrez nos collections et leurs différents formats.' check(length(about_body) between 1 and 10000),
 add column about_image text not null default '/assets/royal-chair.webp';
alter table public.store_settings alter column price_visibility set default 'approved';
update public.store_settings set price_visibility='approved';

create table public.customer_codes (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 150),
 phone text not null unique check(phone ~ '^\+?[1-9][0-9]{7,14}$'),
 pin_hash text not null,
 enabled boolean not null default true,
 version integer not null default 1,
 created_at timestamptz not null default now()
);
create table public.customer_code_grants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 code_id uuid not null references public.customer_codes(id) on delete cascade,
 version integer not null,
 expires_at timestamptz not null
);
create table public.customer_code_attempts (
 key text primary key, attempts integer not null, until_time timestamptz not null
);
alter table public.customer_codes enable row level security;
alter table public.customer_code_grants enable row level security;
alter table public.customer_code_attempts enable row level security;
revoke all on public.customer_codes,public.customer_code_grants,public.customer_code_attempts from public,anon,authenticated;

create function public.normalized_phone(p_phone text) returns text language plpgsql immutable set search_path='' as $$
declare v text;
begin
 v:=regexp_replace(translate(coalesce(p_phone,''),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[[:space:]().-]','','g');
 if left(v,2)='00' then v:='+'||substr(v,3);end if;
 if v ~ '^0[567][0-9]{8}$' then v:='+213'||substr(v,2);end if;
 return v;
end;$$;
create function public.active_customer_code() returns uuid language sql stable security definer set search_path='' as $$
 select c.id from public.customer_code_grants g join public.customer_codes c on c.id=g.code_id
 where g.user_id=auth.uid() and c.enabled and c.version=g.version and g.expires_at>now();
$$;
create or replace function public.can_view_prices() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.store_settings where id and price_visibility='public') or public.active_customer_code() is not null;
$$;
create function public.customer_code_session() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',c.id,'name',c.name,'phone',c.phone,'status','approved','created_at',c.created_at)
 from public.customer_codes c where c.id=public.active_customer_code();
$$;
create function public.lock_customer() returns void language sql security definer set search_path='' as $$
 delete from public.customer_code_grants where user_id=auth.uid();
$$;
revoke all on function public.lock_customer() from public;
grant execute on function public.lock_customer() to authenticated;
create function public.list_customer_codes() returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
 return query select jsonb_build_object('user_id',c.id,'name',c.name,'phone',c.phone,'status',case when c.enabled then 'approved' else 'revoked' end,'created_at',c.created_at) from public.customer_codes c order by c.created_at desc;
end;$$;
create function public.save_customer_code(p_id uuid,p_name text,p_phone text,p_pin text,p_enabled boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare v_phone text:=public.normalized_phone(p_phone);v_pin text:=translate(coalesce(p_pin,''),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');v_id uuid:=coalesce(p_id,gen_random_uuid());v_hash text;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
 if length(trim(p_name)) not between 2 and 150 or v_phone !~ '^\+?[1-9][0-9]{7,14}$' or p_enabled is null then raise exception 'Nom ou téléphone invalide';end if;
 if v_pin<>'' and v_pin !~ '^[0-9]{6}$' then raise exception 'Le code doit contenir exactement 6 chiffres';end if;
 if p_id is not null then select pin_hash into v_hash from public.customer_codes where id=p_id for update;if not found then raise exception 'Client introuvable';end if;end if;
 if v_pin<>'' then v_hash:=extensions.crypt(v_pin,extensions.gen_salt('bf',12));end if;
 if v_hash is null then raise exception 'Code de 6 chiffres requis';end if;
 insert into public.customer_codes(id,name,phone,pin_hash,enabled) values(v_id,trim(p_name),v_phone,v_hash,p_enabled)
 on conflict(id) do update set name=excluded.name,phone=excluded.phone,pin_hash=excluded.pin_hash,enabled=excluded.enabled,version=public.customer_codes.version+1;
 delete from public.customer_code_grants where code_id=v_id;
 insert into public.audit_log(actor,action,entity_id,details) values(auth.uid(),'customer_code_updated',v_id,jsonb_build_object('enabled',p_enabled));
 return v_id;
end;$$;
-- Return failures as data so failed-attempt counters survive the RPC transaction.
create function public.unlock_customer(p_phone text,p_pin text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_phone text:=public.normalized_phone(p_phone);v_pin text:=translate(coalesce(p_pin,''),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');c public.customer_codes%rowtype;k text;a public.customer_code_attempts%rowtype;v_keys text[];
begin
 if auth.uid() is null then raise exception 'Session requise' using errcode='42501';end if;
 if length(v_phone)>30 or length(v_pin)>20 then return jsonb_build_object('ok',false,'error','Téléphone ou code incorrect.');end if;
 v_keys:=array['p:'||md5(v_phone),'u:'||auth.uid()::text];
 foreach k in array v_keys loop
  insert into public.customer_code_attempts values(k,0,now()+interval '15 minutes') on conflict(key) do nothing;
  select * into a from public.customer_code_attempts where key=k for update;
  if a.until_time>now() and a.attempts>=5 then return jsonb_build_object('ok',false,'error','Trop de tentatives. Réessayez dans 15 minutes.');end if;
  update public.customer_code_attempts set attempts=case when until_time<=now() then 1 else attempts+1 end,until_time=case when until_time<=now() then now()+interval '15 minutes' else until_time end where key=k;
 end loop;
 select * into c from public.customer_codes where phone=v_phone;
 if c.id is null or not c.enabled or v_pin !~ '^[0-9]{6}$' then
  perform extensions.crypt(coalesce(v_pin,''),extensions.gen_salt('bf',12));
  return jsonb_build_object('ok',false,'error','Téléphone ou code incorrect.');
 end if;
 if extensions.crypt(v_pin,c.pin_hash)<>c.pin_hash then return jsonb_build_object('ok',false,'error','Téléphone ou code incorrect.');end if;
 insert into public.customer_code_grants values(auth.uid(),c.id,c.version,now()+interval '30 days')
 on conflict(user_id) do update set code_id=excluded.code_id,version=excluded.version,expires_at=excluded.expires_at;
 delete from public.customer_code_attempts where key=any(v_keys);
 return jsonb_build_object('ok',true);
end;$$;

create or replace function public.get_catalog_products(p_offset integer default 0,p_limit integer default 500)
returns setof jsonb language sql stable security definer set search_path='' as $$
 select case when public.can_view_prices() then (case when public.is_admin() then to_jsonb(p) else to_jsonb(p)-'source_metadata' end)||jsonb_build_object('price_hidden',false)
 else (to_jsonb(p)-'source_metadata')||jsonb_build_object('price_hidden',true,'unit_price_cents',0,'discount_price_cents',null,'public_discount_percent',case when p.unit_price_cents>0 and p.discount_price_cents<p.unit_price_cents then round(100.0*(p.unit_price_cents-p.discount_price_cents)/p.unit_price_cents) else 0 end) end
 from public.products p join public.families f on f.id=p.family_id where f.visible or public.is_admin()
 order by p.sort_order,p.id limit greatest(0,least(p_limit,1000)) offset greatest(0,p_offset);
$$;
-- A phone code, rather than an individual browser, owns new customer history.
alter table public.orders add column client_code_id uuid references public.customer_codes(id);
create function public.assign_order_code() returns trigger language plpgsql security definer set search_path='' as $$begin new.client_code_id:=public.active_customer_code();return new;end;$$;
create trigger order_phone_code before insert on public.orders for each row execute function public.assign_order_code();
create function public.can_read_order(p_user uuid,p_code uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (p_code is null and p_user=auth.uid()) or (p_code is not null and p_code=public.active_customer_code());
$$;
drop policy orders_private on public.orders;
create policy orders_private on public.orders for select to authenticated using(public.can_read_order(user_id,client_code_id));
drop policy order_items_private on public.order_items;
create policy order_items_private on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and public.can_read_order(o.user_id,o.client_code_id)));
create or replace function public.order_document(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)-'id'-'order_id' order by i.code) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
 from public.orders o where o.id=p_id and public.can_read_order(o.user_id,o.client_code_id);
$$;

create table public.customer_feedback (
 id uuid primary key default gen_random_uuid(),name text not null default '' check(length(name)<=150),phone text not null default '' check(length(phone)<=40),
 message text not null check(length(trim(message)) between 10 and 3000),status text not null default 'new' check(status in ('new','read','archived')),created_at timestamptz not null default now(),
 sender_key text not null
);
alter table public.customer_feedback enable row level security;
create policy feedback_admin_read on public.customer_feedback for select to authenticated using(public.is_admin());
create policy feedback_admin_update on public.customer_feedback for update to authenticated using(public.is_admin()) with check(public.is_admin());
revoke all on public.customer_feedback from public,anon,authenticated;
grant select(id,name,phone,message,status,created_at),update(status) on public.customer_feedback to authenticated;
create function public.submit_feedback(p_name text,p_phone text,p_message text) returns void language plpgsql security definer set search_path='' as $$
declare v_sender text:=coalesce(auth.uid()::text,'public');
begin
 perform pg_advisory_xact_lock(hashtext('feedback:'||v_sender));
 if(select count(*) from public.customer_feedback where sender_key=v_sender and created_at>now()-interval '1 minute')>=3 then raise exception 'RATE_LIMIT';end if;
 insert into public.customer_feedback(name,phone,message,sender_key) values(trim(coalesce(p_name,'')),trim(coalesce(p_phone,'')),trim(p_message),v_sender);
end;$$;
revoke all on function public.request_customer_access(text,text),public.set_customer_access(uuid,text),public.list_customer_access() from public,anon,authenticated;
revoke all on function public.normalized_phone(text),public.active_customer_code(),public.customer_code_session(),public.list_customer_codes(),public.save_customer_code(uuid,text,text,text,boolean),public.unlock_customer(text,text),public.assign_order_code(),public.can_read_order(uuid,uuid),public.submit_feedback(text,text,text) from public;
grant execute on function public.active_customer_code(),public.can_read_order(uuid,uuid) to authenticated;
grant execute on function public.active_customer_code() to anon;
grant execute on function public.customer_code_session(),public.list_customer_codes(),public.save_customer_code(uuid,text,text,text,boolean),public.unlock_customer(text,text) to authenticated;
grant execute on function public.submit_feedback(text,text,text) to anon,authenticated;
commit;
