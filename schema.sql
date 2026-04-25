-- =====================================================================
-- RIOS — Retail Intelligence & Operations System
-- schema.sql — Tables, indexes, triggers, and read-only views
-- =====================================================================
-- Design principles:
--   1. Stock is NEVER stored as an authoritative column on products.
--      The authoritative source of truth is `stock_movements`.
--      current_stock(product) = SUM(stock_movements.qty)
--   2. Purchases and sales are append-only headers with line items.
--      Mutations to stock happen ONLY through stock_movements, and
--      ONLY through the RPC functions defined in functions.sql.
--   3. Every destructive/mutating business operation is atomic and
--      executes inside a PostgreSQL function (see functions.sql).
-- =====================================================================

-- Enable useful extensions ------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive text

-- =====================================================================
-- 1. PROFILES  (extends auth.users with role + display info)
-- =====================================================================
-- We use Supabase Auth as the identity provider and attach a profile row
-- for each user with an application role.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'manager', 'viewer');
  end if;
end$$;

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null unique,
  full_name     text,
  role          app_role not null default 'viewer',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

-- Auto-create a profile row when a user signs up in auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'viewer'   -- Default role. Admin must promote users explicitly.
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 2. PRODUCTS
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_status') then
    create type product_status as enum ('active', 'inactive', 'discontinued');
  end if;
end$$;

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  sku           citext not null unique,
  name          text not null,
  brand         text,
  category      text,
  barcode       text unique,
  status        product_status not null default 'active',
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_products_status   on public.products(status);
create index if not exists idx_products_brand    on public.products(brand);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_name     on public.products(name);

-- =====================================================================
-- 3. PURCHASES (header)
-- =====================================================================
create table if not exists public.purchases (
  id              uuid primary key default gen_random_uuid(),
  purchase_number text not null unique,
  supplier        text not null,
  purchase_date   date not null default current_date,
  total_cost      numeric(14,2) not null default 0 check (total_cost >= 0),
  notes           text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_purchases_date     on public.purchases(purchase_date);
create index if not exists idx_purchases_supplier on public.purchases(supplier);

-- =====================================================================
-- 4. PURCHASE ITEMS (lines)
-- =====================================================================
create table if not exists public.purchase_items (
  id           uuid primary key default gen_random_uuid(),
  purchase_id  uuid not null references public.purchases(id) on delete cascade,
  product_id   uuid not null references public.products(id)  on delete restrict,
  qty          numeric(14,3) not null check (qty > 0),
  cost_price   numeric(14,4) not null check (cost_price >= 0),
  line_total   numeric(14,2) not null check (line_total >= 0)
);

create index if not exists idx_pi_purchase on public.purchase_items(purchase_id);
create index if not exists idx_pi_product  on public.purchase_items(product_id);

-- =====================================================================
-- 5. SALES (header)
-- =====================================================================
create table if not exists public.sales (
  id           uuid primary key default gen_random_uuid(),
  sale_number  text not null unique,
  customer     text,
  sale_date    date not null default current_date,
  total_value  numeric(14,2) not null default 0 check (total_value >= 0),
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_sales_date     on public.sales(sale_date);
create index if not exists idx_sales_customer on public.sales(customer);

-- =====================================================================
-- 6. SALE ITEMS (lines)
-- =====================================================================
create table if not exists public.sale_items (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  qty             numeric(14,3) not null check (qty > 0),
  selling_price   numeric(14,4) not null check (selling_price >= 0),
  line_total      numeric(14,2) not null check (line_total >= 0)
);

create index if not exists idx_si_sale    on public.sale_items(sale_id);
create index if not exists idx_si_product on public.sale_items(product_id);

-- =====================================================================
-- 7. STOCK MOVEMENTS (the single source of truth for inventory)
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'movement_type') then
    create type movement_type as enum (
      'purchase',     -- +qty, reference_table = 'purchases'
      'sale',         -- -qty, reference_table = 'sales'
      'adjustment',   -- +/- qty, manual correction
      'return_in',    -- +qty, customer returns goods
      'return_out'    -- -qty, return to supplier
    );
  end if;
end$$;

create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete restrict,
  movement_type   movement_type not null,
  qty             numeric(14,3) not null check (qty <> 0),
  unit_cost       numeric(14,4),              -- snapshot cost for valuation (optional)
  reference_id    uuid,                       -- id of purchase/sale/etc.
  reference_table text,                       -- 'purchases' | 'sales' | 'adjustments'
  movement_date   timestamptz not null default now(),
  notes           text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),

  -- Enforce sign-of-qty per movement_type so the ledger stays honest.
  constraint chk_movement_sign check (
    (movement_type in ('purchase', 'return_in')  and qty > 0) or
    (movement_type in ('sale', 'return_out')     and qty < 0) or
    (movement_type = 'adjustment')
  )
);

create index if not exists idx_sm_product   on public.stock_movements(product_id);
create index if not exists idx_sm_type      on public.stock_movements(movement_type);
create index if not exists idx_sm_date      on public.stock_movements(movement_date);
create index if not exists idx_sm_reference on public.stock_movements(reference_table, reference_id);

-- =====================================================================
-- 8. updated_at TRIGGER (generic)
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 9. VIEWS — derived data that the dashboard consumes
-- =====================================================================

-- 9.1 Current stock per product (THE canonical stock query)
create or replace view public.v_product_stock as
select
  p.id                                  as product_id,
  p.sku,
  p.name,
  p.brand,
  p.category,
  p.status,
  coalesce(sum(sm.qty), 0)::numeric(14,3) as current_stock
from public.products p
left join public.stock_movements sm on sm.product_id = p.id
group by p.id, p.sku, p.name, p.brand, p.category, p.status;

-- 9.2 Weighted-average cost per product (based on all purchase receipts).
-- Note: This is a lifetime WAC. Acceptable for v1 reporting.
create or replace view public.v_product_wac as
select
  p.id as product_id,
  case
    when coalesce(sum(pi.qty), 0) = 0 then 0
    else (sum(pi.qty * pi.cost_price) / sum(pi.qty))::numeric(14,4)
  end as wac
from public.products p
left join public.purchase_items pi on pi.product_id = p.id
group by p.id;

-- 9.3 Inventory valuation (current_stock * WAC)
create or replace view public.v_inventory_value as
select
  s.product_id,
  s.sku,
  s.name,
  s.brand,
  s.category,
  s.current_stock,
  w.wac,
  (s.current_stock * w.wac)::numeric(14,2) as stock_value
from public.v_product_stock s
join public.v_product_wac w on w.product_id = s.product_id;

-- 9.4 Sales by product (used by dashboard and fast/slow movement)
create or replace view public.v_sales_by_product as
select
  si.product_id,
  p.sku,
  p.name,
  p.brand,
  p.category,
  sum(si.qty)::numeric(14,3)        as qty_sold,
  sum(si.line_total)::numeric(14,2) as revenue
from public.sale_items si
join public.products   p on p.id = si.product_id
group by si.product_id, p.sku, p.name, p.brand, p.category;

-- 9.5 Purchases by product
create or replace view public.v_purchases_by_product as
select
  pi.product_id,
  p.sku,
  p.name,
  p.brand,
  p.category,
  sum(pi.qty)::numeric(14,3)        as qty_purchased,
  sum(pi.line_total)::numeric(14,2) as cost_total
from public.purchase_items pi
join public.products        p on p.id = pi.product_id
group by pi.product_id, p.sku, p.name, p.brand, p.category;

-- 9.6 Product P&L estimate using lifetime WAC as cost basis
create or replace view public.v_product_pnl as
select
  p.id                                             as product_id,
  p.sku,
  p.name,
  p.brand,
  p.category,
  coalesce(sp.qty_sold, 0)                         as qty_sold,
  coalesce(sp.revenue, 0)                          as revenue,
  coalesce(w.wac, 0)                               as wac,
  (coalesce(sp.qty_sold, 0) * coalesce(w.wac, 0))::numeric(14,2)         as cogs,
  (coalesce(sp.revenue, 0) -
   coalesce(sp.qty_sold, 0) * coalesce(w.wac, 0))::numeric(14,2)         as gross_profit
from public.products p
left join public.v_sales_by_product sp on sp.product_id = p.id
left join public.v_product_wac      w  on w.product_id  = p.id;

-- 9.7 Dashboard headline KPIs (single-row view for fast reads)
create or replace view public.v_dashboard_kpis as
select
  (select coalesce(sum(total_value), 0) from public.sales)     as total_sales,
  (select coalesce(sum(total_cost),  0) from public.purchases) as total_purchases,
  (select coalesce(sum(current_stock), 0) from public.v_product_stock)        as total_stock_qty,
  (select coalesce(sum(stock_value),   0) from public.v_inventory_value)      as total_stock_value,
  (select coalesce(sum(gross_profit),  0) from public.v_product_pnl)          as total_gross_profit,
  (select count(*) from public.v_product_stock where current_stock <= 0)      as out_of_stock_count,
  (select count(*) from public.v_product_stock
     where current_stock > 0 and current_stock < 10)                          as low_stock_count,
  (select count(*) from public.products where status = 'active')              as active_products;

-- ---------------------------------------------------------------------
-- 9.8 Make views respect the caller's RLS (Postgres 15+ / Supabase).
-- Without this, views run with the owner's privileges and would
-- BYPASS Row Level Security on their underlying tables.
-- ---------------------------------------------------------------------
alter view public.v_product_stock        set (security_invoker = on);
alter view public.v_product_wac          set (security_invoker = on);
alter view public.v_inventory_value      set (security_invoker = on);
alter view public.v_sales_by_product     set (security_invoker = on);
alter view public.v_purchases_by_product set (security_invoker = on);
alter view public.v_product_pnl          set (security_invoker = on);
alter view public.v_dashboard_kpis       set (security_invoker = on);

-- Explicit SELECT grants to authenticated users (anon gets nothing).
grant select on public.v_product_stock        to authenticated;
grant select on public.v_product_wac          to authenticated;
grant select on public.v_inventory_value      to authenticated;
grant select on public.v_sales_by_product     to authenticated;
grant select on public.v_purchases_by_product to authenticated;
grant select on public.v_product_pnl          to authenticated;
grant select on public.v_dashboard_kpis       to authenticated;
