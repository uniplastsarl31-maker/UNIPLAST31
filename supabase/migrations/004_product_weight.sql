-- Optional legacy Supabase hosting. The Netlify store applies its own JSON migration.
alter table public.products add column if not exists weight_grams numeric
  check (weight_grams is null or (weight_grams > 0 and weight_grams <= 10000000));
alter table public.store_settings add column if not exists viber_phone text not null default '';
alter table public.products alter column available set default true;
alter table public.products alter column availability_confirmed set default true;
