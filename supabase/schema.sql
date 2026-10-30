-- =========================================================
-- Online Shop schema for Supabase
-- Run this once in: Supabase Dashboard > SQL Editor > New query
-- =========================================================

-- ---------- PRODUCTS ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       numeric(12,2) not null check (price >= 0),
  stock       integer not null default 0 check (stock >= 0),
  category    text,
  image_url   text,
  image_path  text,           -- path inside the storage bucket (used for deleting)
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- ORDERS ----------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null,
  email         text not null,
  phone         text,
  address       text,
  items         jsonb not null,          -- [{product_id, name, price, qty}]
  total         numeric(12,2) not null,
  status        text not null default 'new'
                check (status in ('new','paid','shipped','completed','cancelled')),
  created_at    timestamptz not null default now()
);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- Shoppers (not logged in) can only see active products
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products for select to anon
  using (active = true);

-- Logged-in team members can do everything with products
drop policy if exists "Team manages products" on public.products;
create policy "Team manages products"
  on public.products for all to authenticated
  using (true) with check (true);

-- Team can view and update orders. Shoppers cannot read orders at all;
-- they create orders only through the place_order() function below.
drop policy if exists "Team views orders" on public.orders;
create policy "Team views orders"
  on public.orders for select to authenticated using (true);

drop policy if exists "Team updates orders" on public.orders;
create policy "Team updates orders"
  on public.orders for update to authenticated using (true) with check (true);

-- ---------- PLACE ORDER (server-side, tamper-proof) ----------
-- Prices and totals are taken from the database, never from the browser,
-- and stock is reduced in the same transaction.
create or replace function public.place_order(p_customer jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total    numeric := 0;
  v_item     jsonb;
  v_prod     products%rowtype;
  v_qty      int;
  v_lines    jsonb := '[]'::jsonb;
begin
  if coalesce(trim(p_customer->>'name'), '') = '' or coalesce(trim(p_customer->>'email'), '') = '' then
    raise exception 'Name and email are required';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 100 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_prod from products
      where id = (v_item->>'id')::uuid and active = true
      for update;
    if not found then
      raise exception 'A product in your cart is no longer available';
    end if;
    if v_prod.stock < v_qty then
      raise exception 'Not enough stock for %', v_prod.name;
    end if;

    update products set stock = stock - v_qty where id = v_prod.id;
    v_total := v_total + v_prod.price * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_prod.id, 'name', v_prod.name, 'price', v_prod.price, 'qty', v_qty);
  end loop;

  insert into orders (customer_name, email, phone, address, items, total)
  values (trim(p_customer->>'name'), trim(p_customer->>'email'),
          p_customer->>'phone', p_customer->>'address', v_lines, v_total)
  returning id into v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;

-- ---------- STORAGE: product images ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public reads product images" on storage.objects;
create policy "Public reads product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Team uploads product images" on storage.objects;
create policy "Team uploads product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Team updates product images" on storage.objects;
create policy "Team updates product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Team deletes product images" on storage.objects;
create policy "Team deletes product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');
