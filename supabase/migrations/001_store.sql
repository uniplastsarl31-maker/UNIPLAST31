begin;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
create policy admin_self_read on public.admin_users for select to authenticated using (user_id=auth.uid());

create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
    and exists(select 1 from public.admin_users where user_id=auth.uid());
$$;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 150),
  name_fr text not null default '', image text not null default '',
  sort_order integer not null default 0, visible boolean not null default true
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 150),
  name_fr text not null default '',
  code text not null check(length(trim(code)) between 1 and 80 and code=trim(code)),
  barcode text check(barcode is null or length(trim(barcode)) between 1 and 80 and barcode=trim(barcode)),
  family_id uuid not null references public.families(id) on delete restrict,
  description text not null default '' check(length(description)<=5000),
  dimensions text not null default '' check(length(dimensions)<=200),
  capacity text not null default '' check(length(capacity)<=100),
  material text not null default '' check(length(material)<=100),
  pack_size integer not null check(pack_size between 1 and 10000),
  pack_label text not null default 'carton' check(length(trim(pack_label)) between 1 and 30),
  unit_price_cents bigint not null check(unit_price_cents between 0 and 100000000),
  price_on_request boolean not null default false,
  available boolean not null default false, availability_confirmed boolean not null default false,
  stock_cartons integer check(stock_cartons is null or stock_cartons between 0 and 10000000),
  is_new boolean not null default false, upcoming boolean not null default false,
  preorder_enabled boolean not null default false,
  discount_price_cents bigint, discount_start timestamptz, discount_end timestamptz,
  offer_title text not null default '' check(length(offer_title)<=150), show_offer boolean not null default true,
  pinned boolean not null default false, sort_order integer not null default 0,
  images jsonb not null default '[]' check(jsonb_typeof(images)='array' and jsonb_array_length(images)<=10),
  created_at timestamptz not null default now(), source_metadata jsonb,
  constraint valid_discount check(discount_price_cents is null or
    (discount_price_cents>=0 and discount_price_cents<unit_price_cents and not price_on_request
      and discount_start is not null and discount_end is not null and discount_start<discount_end))
);
create unique index product_unique_code on public.products(lower(code));
create unique index product_unique_barcode on public.products(barcode) where barcode is not null;
create index products_family_sort on public.products(family_id,sort_order);

create table public.store_settings (
  id boolean primary key default true check(id),
  company_name text not null default 'UNIPLAST' check(length(company_name) between 1 and 150),
  company_name_fr text not null default 'UNIPLAST — Home Design',
  logo_url text not null default '/assets/uniplast-logo.png',
  phone text not null default '' check(length(phone)<=40),email text not null default '' check(length(email)<=254),
  address text not null default '' check(length(address)<=500),
  currency text not null default 'DZD' check(currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Algiers',
  shipping_cents bigint not null default 0 check(shipping_cents between 0 and 100000000),
  tax_note text not null default 'Tarifs unitaires issus de la colonne P.V. TTC du catalogue fourni. Aucun taux de taxe supplémentaire appliqué.' check(length(tax_note)<=2000),
  pack_label text not null default 'carton' check(length(trim(pack_label)) between 1 and 30),
  accent_color text not null default '#f4df13' check(accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  primary_color text not null default '#254496' check(primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  heroes jsonb not null default '[]' check(jsonb_typeof(heroes)='array' and jsonb_array_length(heroes)<=12),
  privacy text not null default '' check(length(privacy)<=10000),
  terms text not null default '' check(length(terms)<=10000)
);
create function public.validate_settings() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Fuseau horaire invalide'; end if;
  return new;
end;$$;
create trigger settings_validation before insert or update on public.store_settings for each row execute function public.validate_settings();
insert into public.store_settings(id,heroes,privacy,terms) values(true,
 '[{"id":"hero-1","eyebrow":"PENSÉ POUR VOTRE QUOTIDIEN","title":"De bonnes idées.\nPour chaque jour.","body":"Conserver, organiser, partager. Découvrez les solutions UNIPLAST pour la maison et les professionnels.","image":"/assets/basket.webp","cta":"Explorer le catalogue","family_id":"","visible":true},{"id":"hero-2","eyebrow":"LES PETITS DÉTAILS FONT LA DIFFÉRENCE","title":"Tout à sa place.\nTout simplement.","body":"Des produits pratiques pour une maison qui vous ressemble. Trouvez votre solution parmi nos collections.","image":"/assets/lunchbox.webp","cta":"Découvrir nos collections","family_id":"","visible":true}]',
 'Les coordonnées servent au traitement des demandes. Cette politique doit être complétée et validée par UNIPLAST avant ouverture commerciale, avec les coordonnées du responsable et les durées de conservation.',
 'Les commandes sont soumises à confirmation par UNIPLAST. Les quantités sont exprimées en cartons. Les prix, le colisage et la disponibilité sont revérifiés à l’envoi. Aucun paiement en ligne. Les réservations et demandes de fabrication sont distinctes des ventes. Conditions à valider par l’entreprise.');

create sequence public.order_reference_seq;
create sequence public.request_reference_seq;
create table public.orders (
  id uuid primary key default gen_random_uuid(),reference text not null unique,
  user_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
  status text not null default 'new' check(status in ('new','confirmed','preparing','delivered','cancelled')),
  customer jsonb not null, subtotal_cents bigint not null check(subtotal_cents>=0),
  discount_cents bigint not null check(discount_cents>=0),shipping_cents bigint not null check(shipping_cents>=0),
  total_cents bigint not null check(total_cents=subtotal_cents-discount_cents+shipping_cents and total_cents>=0),
  currency text not null,company_snapshot jsonb not null,idempotency_key uuid not null,
  unique(user_id,idempotency_key)
);
create index orders_owner_date on public.orders(user_id,created_at desc);
create index orders_status_date on public.orders(status,created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null, name text not null,code text not null,barcode text,pack_label text not null,
  unit_price_cents bigint not null, original_unit_price_cents bigint not null,pack_size integer not null,
  cartons integer not null,total_units integer not null,carton_price_cents bigint not null,
  discount_cents bigint not null,total_cents bigint not null,stock_reserved boolean not null default false,
  check(cartons between 1 and 10000 and pack_size between 1 and 10000 and total_units=cartons*pack_size),
  check(unit_price_cents>=0 and original_unit_price_cents>=unit_price_cents),
  check(carton_price_cents=unit_price_cents*pack_size and total_cents=cartons*carton_price_cents),
  check(discount_cents=(original_unit_price_cents-unit_price_cents)*total_units),unique(order_id,product_id)
);
create index order_items_order on public.order_items(order_id);
create table public.customer_requests (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
  reference text not null unique,created_at timestamptz not null default now(),
  kind text not null check(kind in ('preorder','custom')),
  status text not null default 'pending' check(status in ('pending','reviewing','accepted','declined')),
  product_id uuid,cartons integer not null default 0,customer jsonb not null,details jsonb not null,
  idempotency_key uuid not null,unique(user_id,idempotency_key)
);
create index requests_owner_date on public.customer_requests(user_id,created_at desc);
create table public.audit_log (
  id bigint generated always as identity primary key,actor uuid,action text not null,
  entity_id uuid,created_at timestamptz not null default now(),details jsonb not null default '{}'
);

alter table public.families enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customer_requests enable row level security;
alter table public.audit_log enable row level security;
create policy families_public on public.families for select to anon,authenticated using(visible or public.is_admin());
create policy families_admin on public.families for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy products_public on public.products for select to anon,authenticated using(public.is_admin() or exists(select 1 from public.families f where f.id=family_id and f.visible));
create policy products_admin on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy settings_read on public.store_settings for select to anon,authenticated using(true);
create policy settings_admin on public.store_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy orders_private on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy order_items_private on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and(o.user_id=auth.uid() or public.is_admin())));
create policy requests_private on public.customer_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy requests_admin_status on public.customer_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy audit_admin_read on public.audit_log for select to authenticated using(public.is_admin());

create function public.sanitize_customer(p_customer jsonb,p_full boolean) returns jsonb language plpgsql set search_path='' as $$
declare v_phone text;
begin
  if p_customer is null or jsonb_typeof(p_customer)<>'object' or octet_length(p_customer::text)>16000 then raise exception 'Coordonnées invalides'; end if;
  if length(trim(coalesce(p_customer->>'name',''))) not between 2 and 150 then raise exception 'Nom du client invalide'; end if;
  v_phone:=regexp_replace(coalesce(p_customer->>'phone',''),'[^0-9]','','g');
  if length(v_phone) not between 8 and 15 or length(p_customer->>'phone')>25 then raise exception 'Téléphone invalide'; end if;
  if p_full and (length(trim(coalesce(p_customer->>'wilaya',''))) not between 2 and 100 or length(trim(coalesce(p_customer->>'address',''))) not between 5 and 500) then raise exception 'Wilaya et adresse requises'; end if;
  if length(coalesce(p_customer->>'notes',''))>2000 then raise exception 'Notes trop longues'; end if;
  if length(coalesce(p_customer->>'email',''))>254 or (coalesce(p_customer->>'email','')<>'' and p_customer->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'E-mail invalide'; end if;
  return jsonb_build_object('name',trim(p_customer->>'name'),'phone',trim(p_customer->>'phone'),'wilaya',left(coalesce(p_customer->>'wilaya',''),100),'address',left(coalesce(p_customer->>'address',''),500),'notes',coalesce(p_customer->>'notes',''),'email',coalesce(p_customer->>'email',''));
end;$$;

create function public.order_document(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(o)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)-'id'-'order_id' order by i.code) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
  from public.orders o where o.id=p_id and(o.user_id=auth.uid() or public.is_admin());
$$;

create function public.create_order(p_lines jsonb,p_customer jsonb,p_idempotency_key uuid,p_expected_shipping_cents bigint,p_expected_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=auth.uid();v_existing uuid;v_order uuid:=gen_random_uuid();v_entry jsonb;v_product public.products%rowtype;v_settings public.store_settings%rowtype;
  v_cartons integer;v_units integer;v_price bigint;v_subtotal bigint:=0;v_discount bigint:=0;v_lines jsonb:='[]';v_customer jsonb;v_now timestamptz:=now();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_idempotency_key is null then raise exception 'Clé de requête manquante'; end if;
  perform pg_advisory_xact_lock(hashtextextended('orders:'||v_uid::text,0));
  select id into v_existing from public.orders where user_id=v_uid and idempotency_key=p_idempotency_key;
  if found then return public.order_document(v_existing); end if;
  if(select count(*) from public.orders where user_id=v_uid and created_at>v_now-interval '1 minute')>=5 then raise exception 'RATE_LIMIT'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' then raise exception 'Panier invalide'; end if;
  if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Panier invalide'; end if;
  if(select count(distinct value->>'product_id') from jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) then raise exception 'Référence répétée dans le panier'; end if;
  v_customer:=public.sanitize_customer(p_customer,true);
  select * into strict v_settings from public.store_settings where id=true for share;
  if v_settings.shipping_cents is distinct from p_expected_shipping_cents or v_settings.currency is distinct from p_expected_currency then raise exception 'PRICES_CHANGED'; end if;
  -- Stable lock order prevents deadlocks between multi-product orders.
  for v_entry in select value from jsonb_array_elements(p_lines) order by value->>'product_id' loop
    v_cartons:=(v_entry->>'cartons')::integer;
    if v_cartons is null or v_cartons not between 1 and 10000 then raise exception 'Quantité invalide'; end if;
    select * into v_product from public.products where id=(v_entry->>'product_id')::uuid for update;
    if not found then raise exception 'UNAVAILABLE'; end if;
    if not v_product.available or not v_product.availability_confirmed or v_product.price_on_request or v_product.upcoming or
      (v_product.stock_cartons is not null and v_product.stock_cartons<v_cartons) or
      not exists(select 1 from public.families where id=v_product.family_id and visible) then raise exception 'UNAVAILABLE'; end if;
    v_price:=case when v_product.discount_price_cents is not null and v_product.discount_start<=v_now and v_product.discount_end>v_now then v_product.discount_price_cents else v_product.unit_price_cents end;
    if v_price is distinct from (v_entry->>'expected_unit_price_cents')::bigint or v_product.pack_size is distinct from (v_entry->>'expected_pack_size')::integer then raise exception 'PRICES_CHANGED'; end if;
    v_units:=v_cartons*v_product.pack_size;
    v_subtotal:=v_subtotal+v_product.unit_price_cents*v_units;v_discount:=v_discount+(v_product.unit_price_cents-v_price)*v_units;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object('product_id',v_product.id,'name',v_product.name,'code',v_product.code,'barcode',v_product.barcode,'pack_label',v_product.pack_label,
      'unit_price_cents',v_price,'original_unit_price_cents',v_product.unit_price_cents,'pack_size',v_product.pack_size,'cartons',v_cartons,'total_units',v_units,
      'carton_price_cents',v_price*v_product.pack_size,'discount_cents',(v_product.unit_price_cents-v_price)*v_units,'total_cents',v_price*v_units,'stock_reserved',v_product.stock_cartons is not null));
    if v_product.stock_cartons is not null then update public.products set stock_cartons=stock_cartons-v_cartons where id=v_product.id; end if;
  end loop;
  if v_subtotal>9000000000000 then raise exception 'Montant de commande trop élevé'; end if;
  insert into public.orders(id,reference,user_id,customer,subtotal_cents,discount_cents,shipping_cents,total_cents,currency,company_snapshot,idempotency_key)
    values(v_order,'UP-'||to_char(v_now at time zone v_settings.timezone,'YYYYMMDD')||'-'||lpad(nextval('public.order_reference_seq')::text,6,'0'),v_uid,v_customer,v_subtotal,v_discount,v_settings.shipping_cents,v_subtotal-v_discount+v_settings.shipping_cents,v_settings.currency,
      jsonb_build_object('company_name',v_settings.company_name,'logo_url',v_settings.logo_url,'phone',v_settings.phone,'email',v_settings.email,'address',v_settings.address,'tax_note',v_settings.tax_note,'timezone',v_settings.timezone),p_idempotency_key);
  insert into public.order_items(order_id,product_id,name,code,barcode,pack_label,unit_price_cents,original_unit_price_cents,pack_size,cartons,total_units,carton_price_cents,discount_cents,total_cents,stock_reserved)
    select v_order,x.product_id,x.name,x.code,x.barcode,x.pack_label,x.unit_price_cents,x.original_unit_price_cents,x.pack_size,x.cartons,x.total_units,x.carton_price_cents,x.discount_cents,x.total_cents,x.stock_reserved
    from jsonb_to_recordset(v_lines) as x(product_id uuid,name text,code text,barcode text,pack_label text,unit_price_cents bigint,original_unit_price_cents bigint,pack_size integer,cartons integer,total_units integer,carton_price_cents bigint,discount_cents bigint,total_cents bigint,stock_reserved boolean);
  insert into public.audit_log(actor,action,entity_id) values(v_uid,'order_created',v_order);
  return public.order_document(v_order);
end;$$;

create function public.set_order_status(p_order_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype;v_line record;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into strict v_order from public.orders where id=p_order_id for update;
  if v_order.status=p_status then return; end if;
  if not ((v_order.status='new' and p_status in('confirmed','cancelled')) or(v_order.status='confirmed' and p_status in('preparing','delivered','cancelled')) or(v_order.status='preparing' and p_status in('delivered','cancelled'))) then raise exception 'Transition de statut non autorisée'; end if;
  if p_status='cancelled' then
    for v_line in select product_id,cartons from public.order_items where order_id=p_order_id and stock_reserved order by product_id loop
      update public.products set stock_cartons=stock_cartons+v_line.cartons where id=v_line.product_id and stock_cartons is not null;
    end loop;
  end if;
  update public.orders set status=p_status where id=p_order_id;
  insert into public.audit_log(actor,action,entity_id,details) values(auth.uid(),'order_status',p_order_id,jsonb_build_object('from',v_order.status,'to',p_status));
end;$$;

create function public.create_customer_request(p_kind text,p_product_id uuid,p_cartons integer,p_customer jsonb,p_details jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_old public.customer_requests%rowtype;v_id uuid:=gen_random_uuid();v_customer jsonb;v_path jsonb;v_details jsonb;v_product public.products%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_idempotency_key is null then raise exception 'Clé de requête requise'; end if;
  perform pg_advisory_xact_lock(hashtextextended('requests:'||v_uid::text,0));
  select * into v_old from public.customer_requests where user_id=v_uid and idempotency_key=p_idempotency_key;
  if found then return to_jsonb(v_old); end if;
  if(select count(*) from public.customer_requests where user_id=v_uid and created_at>now()-interval '1 minute')>=5 then raise exception 'RATE_LIMIT'; end if;
  if p_kind not in('preorder','custom') or p_kind is null then raise exception 'Type de demande invalide'; end if;
  v_customer:=public.sanitize_customer(p_customer,p_kind='preorder');
  if p_details is null or jsonb_typeof(p_details)<>'object' or octet_length(p_details::text)>30000 then raise exception 'Détails invalides'; end if;
  if p_kind='preorder' then
    select * into v_product from public.products where id=p_product_id;
    if not found or not v_product.upcoming or not v_product.preorder_enabled or not exists(select 1 from public.families where id=v_product.family_id and visible) then raise exception 'Réservation non ouverte'; end if;
    if p_cartons is null or p_cartons not between 1 and 10000 then raise exception 'Quantité invalide'; end if;
  else
    if length(trim(coalesce(p_details->>'description',''))) not between 10 and 5000 or length(trim(coalesce(p_details->>'quantity',''))) not between 1 and 100 then raise exception 'Description et quantité requises'; end if;
  end if;
  if jsonb_typeof(coalesce(p_details->'attachments','[]'))<>'array' or jsonb_array_length(coalesce(p_details->'attachments','[]'))>4 then raise exception 'Pièces jointes invalides'; end if;
  for v_path in select value from jsonb_array_elements(coalesce(p_details->'attachments','[]')) loop
    if jsonb_typeof(v_path)<>'string' or split_part(v_path#>>'{}','/',1)<>v_uid::text or not exists(select 1 from storage.objects where bucket_id='request-attachments' and name=v_path#>>'{}') then raise exception 'Pièce jointe non autorisée'; end if;
  end loop;
  v_details:=jsonb_build_object('description',left(coalesce(p_details->>'description',''),5000),'dimensions',left(coalesce(p_details->>'dimensions',''),200),'capacity',left(coalesce(p_details->>'capacity',''),100),'color',left(coalesce(p_details->>'color',''),100),'material',left(coalesce(p_details->>'material',''),100),'quantity',left(coalesce(p_details->>'quantity',''),100),'attachments',coalesce(p_details->'attachments','[]'));
  if p_kind='preorder' then v_details:=v_details||jsonb_build_object('product_name',v_product.name,'product_code',v_product.code,'pack_size',v_product.pack_size); end if;
  insert into public.customer_requests(id,user_id,reference,kind,product_id,cartons,customer,details,idempotency_key)
    values(v_id,v_uid,'REQ-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('public.request_reference_seq')::text,6,'0'),p_kind,case when p_kind='preorder' then p_product_id else null end,case when p_kind='preorder' then p_cartons else 0 end,v_customer,v_details,p_idempotency_key);
  select * into v_old from public.customer_requests where id=v_id;return to_jsonb(v_old);
end;$$;

create function public.delete_family(p_family_id uuid,p_target_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_family_id=p_target_id then raise exception 'FAMILY_NOT_EMPTY'; end if;
  if exists(select 1 from public.products where family_id=p_family_id) then
    if p_target_id is null then raise exception 'FAMILY_NOT_EMPTY'; end if;
    if not exists(select 1 from public.families where id=p_target_id) then raise exception 'Collection de destination introuvable'; end if;
    update public.products set family_id=p_target_id where family_id=p_family_id;
  end if;
  delete from public.families where id=p_family_id;
end;$$;

create function public.catalog_sales() returns table(product_id uuid,cartons bigint) language sql stable security definer set search_path='' as $$
  select i.product_id,sum(i.cartons)::bigint from public.order_items i join public.orders o on o.id=i.order_id
  join public.products p on p.id=i.product_id join public.families f on f.id=p.family_id
  where o.status in('confirmed','preparing','delivered') and f.visible group by i.product_id;
$$;

create function public.reorder_families(p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_ids is null or cardinality(p_ids)<>(select count(*) from public.families) or
    cardinality(p_ids)<>(select count(distinct i) from unnest(p_ids) as u(i)) or
    exists(select 1 from unnest(p_ids) as u(i) where not exists(select 1 from public.families f where f.id=i)) then raise exception 'Liste des collections invalide'; end if;
  update public.families f set sort_order=(u.ordinality-1)::integer from unnest(p_ids) with ordinality as u(id,ordinality) where f.id=u.id;
end;$$;

-- Only these roles can call the browser APIs. No service-role key belongs in dist.
revoke all on public.admin_users,public.orders,public.order_items,public.customer_requests,public.audit_log from anon,authenticated;
grant select on public.admin_users,public.orders,public.order_items,public.customer_requests,public.audit_log to authenticated;
grant update(status) on public.customer_requests to authenticated;
grant select on public.families,public.products,public.store_settings to anon,authenticated;
grant insert,update,delete on public.families,public.products,public.store_settings to authenticated;
revoke all on function public.is_admin(),public.validate_settings(),public.sanitize_customer(jsonb,boolean),public.order_document(uuid),public.create_order(jsonb,jsonb,uuid,bigint,text),public.set_order_status(uuid,text),public.create_customer_request(text,uuid,integer,jsonb,jsonb,uuid),public.delete_family(uuid,uuid),public.catalog_sales(),public.reorder_families(uuid[]) from public;
grant execute on function public.is_admin(),public.catalog_sales() to anon,authenticated;
grant execute on function public.order_document(uuid),public.create_order(jsonb,jsonb,uuid,bigint,text),public.set_order_status(uuid,text),public.create_customer_request(text,uuid,integer,jsonb,jsonb,uuid),public.delete_family(uuid,uuid),public.reorder_families(uuid[]) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('request-attachments','request-attachments',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
 on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy product_images_read on storage.objects for select to anon,authenticated using(bucket_id='product-images');
create policy product_images_admin_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_admin() and name ~ '^[0-9a-f-]+/(original\.(jpg|png|webp)|display\.webp)$');
create policy request_files_owner_insert on storage.objects for insert to authenticated with check(bucket_id='request-attachments' and split_part(name,'/',1)=auth.uid()::text and name ~ '/[0-9a-f-]+\.(jpg|png|webp|pdf)$');
create policy request_files_private_read on storage.objects for select to authenticated using(bucket_id='request-attachments' and(split_part(name,'/',1)=auth.uid()::text or public.is_admin()));
-- No overwrite policy: immutable file URLs preserve historical references and originals.

do $$begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.products,public.families,public.store_settings;
  end if;
end;$$;
commit;
