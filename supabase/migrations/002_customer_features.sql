begin;
alter table public.store_settings
  add column price_visibility text not null default 'public' check(price_visibility in ('public','approved')),
  add column secondary_phone text not null default '' check(length(secondary_phone)<=40),
  add column whatsapp_phone text not null default '' check(length(whatsapp_phone)<=40),
  add column website_url text not null default '' check(website_url='' or website_url ~ '^https://[^[:space:]@]+$'),
  add column facebook_url text not null default '' check(facebook_url='' or facebook_url ~ '^https://[^[:space:]@]+$'),
  add column catalog_pdf_url text not null default '' check(catalog_pdf_url='' or catalog_pdf_url ~ '^https://[^[:space:]@]+$'),
  add column catalog_pdf_title text not null default 'Catalogue UNIPLAST' check(length(catalog_pdf_title) between 1 and 150),
  add column seasons jsonb not null default '[]' check(jsonb_typeof(seasons)='array' and jsonb_array_length(seasons)<=20 and octet_length(seasons::text)<=100000),
  add column recommendation_mode text not null default 'balanced' check(recommendation_mode in ('balanced','sales'));

create table public.customer_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 150),
 phone text not null check(length(phone) between 8 and 40),
 status text not null default 'pending' check(status in ('pending','approved','revoked')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.customer_access enable row level security;
create policy access_private_read on public.customer_access for select to authenticated using(user_id=auth.uid() or public.is_admin());
revoke all on public.customer_access from anon,authenticated;
grant select on public.customer_access to authenticated;

create function public.can_view_prices() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin()
 or exists(select 1 from public.store_settings where id=true and price_visibility='public')
 or (auth.uid() is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
     and exists(select 1 from public.customer_access where user_id=auth.uid() and status='approved'));
$$;
-- Block direct REST/table reads too. The public RPC below returns redacted products.
drop policy products_public on public.products;
create policy products_public on public.products for select to anon,authenticated using(
 public.is_admin() or (public.can_view_prices() and exists(select 1 from public.families f where f.id=family_id and f.visible))
);
create function public.get_catalog_products(p_offset integer default 0,p_limit integer default 500)
returns setof jsonb language sql stable security definer set search_path='' as $$
 select case when public.can_view_prices() then
   (case when public.is_admin() then to_jsonb(p) else to_jsonb(p)-'source_metadata' end)||jsonb_build_object('price_hidden',false)
 else (to_jsonb(p)-'source_metadata')||jsonb_build_object('price_hidden',true,'unit_price_cents',0,'discount_price_cents',null,'discount_start',null,'discount_end',null) end
 from public.products p join public.families f on f.id=p.family_id
 where f.visible or public.is_admin()
 order by p.sort_order,p.id limit greatest(0,least(p_limit,1000)) offset greatest(0,p_offset);
$$;

create function public.request_customer_access(p_name text,p_phone text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Compte personnel confirmé requis' using errcode='42501'; end if;
 if length(trim(p_name)) not between 2 and 150 or length(regexp_replace(p_phone,'[^0-9]','','g')) not between 8 and 15 or length(p_phone)>40 then raise exception 'Nom et téléphone invalides'; end if;
 insert into public.customer_access(user_id,name,phone) values(auth.uid(),trim(p_name),trim(p_phone))
 on conflict(user_id) do update set name=excluded.name,phone=excluded.phone,updated_at=now();
 -- A revoked account stays revoked; only an administrator can grant access.
end;$$;
create function public.list_customer_access() returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 return query select to_jsonb(c)||jsonb_build_object('email',u.email) from public.customer_access c join auth.users u on u.id=c.user_id order by c.created_at desc;
end;$$;
create function public.set_customer_access(p_user_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_status is null or p_status not in ('pending','approved','revoked') then raise exception 'Statut invalide'; end if;
 update public.customer_access set status=p_status,updated_at=now() where user_id=p_user_id;
 if not found then raise exception 'Client introuvable'; end if;
 insert into public.audit_log(actor,action,entity_id,details) values(auth.uid(),'customer_access',p_user_id,jsonb_build_object('status',p_status));
end;$$;

-- Guard at the entry point, before any price comparison or stock mutation.
alter function public.create_order(jsonb,jsonb,uuid,bigint,text) rename to create_order_internal;
revoke all on function public.create_order_internal(jsonb,jsonb,uuid,bigint,text) from public,anon,authenticated;
create function public.create_order(p_lines jsonb,p_customer jsonb,p_idempotency_key uuid,p_expected_shipping_cents bigint,p_expected_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.can_view_prices() then raise exception 'APPROVAL_REQUIRED' using errcode='42501'; end if;
 return public.create_order_internal(p_lines,p_customer,p_idempotency_key,p_expected_shipping_cents,p_expected_currency);
end;$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('company-catalogs','company-catalogs',true,15728640,array['application/pdf'])
 on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy catalogs_public_read on storage.objects for select to anon,authenticated using(bucket_id='company-catalogs');
create policy catalogs_admin_insert on storage.objects for insert to authenticated with check(bucket_id='company-catalogs' and public.is_admin() and name ~ '^[0-9a-f-]+\.pdf$');

revoke all on function public.can_view_prices(),public.get_catalog_products(integer,integer),public.request_customer_access(text,text),public.list_customer_access(),public.set_customer_access(uuid,text),public.create_order(jsonb,jsonb,uuid,bigint,text) from public;
grant execute on function public.can_view_prices(),public.get_catalog_products(integer,integer) to anon,authenticated;
grant execute on function public.request_customer_access(text,text),public.list_customer_access(),public.set_customer_access(uuid,text),public.create_order(jsonb,jsonb,uuid,bigint,text) to authenticated;
commit;
