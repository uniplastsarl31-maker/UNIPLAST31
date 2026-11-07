-- Optional legacy Supabase schema. Netlify and RUN.BAT apply their JSON migration automatically.
alter table public.products add column if not exists new_until timestamptz;
alter table public.families add column if not exists kind text not null default 'standard' check (kind in ('standard','new'));
alter table public.families add column if not exists aliases jsonb not null default '[]';
alter table public.families add column if not exists introduction text not null default '';
alter table public.families add column if not exists slider_enabled boolean not null default true;
alter table public.families add column if not exists slider_autoplay boolean not null default true;
alter table public.families add column if not exists slider_interval integer not null default 6 check (slider_interval between 3 and 20);
alter table public.families add column if not exists promotions jsonb not null default '[]';
alter table public.store_settings add column if not exists product_display jsonb not null default '{}';
alter table public.store_settings add column if not exists custom_order jsonb not null default '{}';
alter table public.store_settings add column if not exists family_options jsonb not null default '{}';
