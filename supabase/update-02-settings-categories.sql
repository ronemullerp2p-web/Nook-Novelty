-- =========================================================
-- Update 02: Business settings + Categories
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Safe to run more than once.
-- =========================================================

-- ---------- BUSINESS SETTINGS (single row) ----------
create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.settings enable row level security;

-- Business details are shown on the shop, so everyone may read them
drop policy if exists "Anyone can read settings" on public.settings;
create policy "Anyone can read settings"
  on public.settings for select to anon, authenticated using (true);

drop policy if exists "Team updates settings" on public.settings;
create policy "Team updates settings"
  on public.settings for update to authenticated using (true) with check (true);

-- ---------- CATEGORIES ----------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "Public can view active categories" on public.categories;
create policy "Public can view active categories"
  on public.categories for select to anon using (active = true);

drop policy if exists "Team manages categories" on public.categories;
create policy "Team manages categories"
  on public.categories for all to authenticated using (true) with check (true);

-- ---------- LINK PRODUCTS TO CATEGORIES ----------
alter table public.products
  add column if not exists category_id uuid references public.categories(id) on delete set null;

-- Move any existing text categories into the new table
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'products' and column_name = 'category') then
    insert into public.categories (name)
      select distinct trim(category) from public.products
      where category is not null and trim(category) <> ''
    on conflict (name) do nothing;

    update public.products p set category_id = c.id
      from public.categories c
      where p.category_id is null and trim(p.category) = c.name;

    alter table public.products drop column category;
  end if;
end $$;

create index if not exists products_category_id_idx on public.products(category_id);
