-- =====================================================================
-- RIOS — policies.sql
-- Row Level Security (RLS) policies
-- =====================================================================
-- Role model:
--   admin   → full access (incl. user role management, deletes)
--   manager → read all + create/update operational data
--             (CANNOT delete; CANNOT change roles)
--   viewer  → read-only access
--
-- All business mutations (purchases, sales, adjustments) should go
-- through the SECURITY DEFINER RPC functions in functions.sql. Those
-- functions perform their OWN role checks. RLS here is defense-in-depth
-- for direct-table access via PostgREST.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: current user's role (null if no profile)
-- ---------------------------------------------------------------------
create or replace function public.current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()   returns boolean
language sql stable as $$ select public.current_role() = 'admin' $$;

create or replace function public.is_manager_or_admin() returns boolean
language sql stable as $$ select public.current_role() in ('admin','manager') $$;

create or replace function public.is_authenticated() returns boolean
language sql stable as $$ select auth.uid() is not null $$;

-- ---------------------------------------------------------------------
-- Enable RLS on every business table
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.purchases       enable row level security;
alter table public.purchase_items  enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.stock_movements enable row level security;

-- Force RLS even for table owners (extra safety for service-role misuse)
alter table public.profiles        force row level security;
alter table public.products        force row level security;
alter table public.purchases       force row level security;
alter table public.purchase_items  force row level security;
alter table public.sales           force row level security;
alter table public.sale_items      force row level security;
alter table public.stock_movements force row level security;

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select
  using ( auth.uid() = id or public.is_admin() );

drop policy if exists profiles_update_self_name on public.profiles;
create policy profiles_update_self_name on public.profiles
  for update
  using ( auth.uid() = id )
  with check (
    auth.uid() = id
    -- A user can update themselves, but CANNOT change their own role.
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ---------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------
drop policy if exists products_select_auth on public.products;
create policy products_select_auth on public.products
  for select
  using ( public.is_authenticated() );

drop policy if exists products_insert_mgr on public.products;
create policy products_insert_mgr on public.products
  for insert
  with check ( public.is_manager_or_admin() );

drop policy if exists products_update_mgr on public.products;
create policy products_update_mgr on public.products
  for update
  using  ( public.is_manager_or_admin() )
  with check ( public.is_manager_or_admin() );

drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin on public.products
  for delete
  using ( public.is_admin() );

-- ---------------------------------------------------------------------
-- PURCHASES / PURCHASE_ITEMS
-- (Inserts happen via RPC; policies below allow authorized direct reads.)
-- ---------------------------------------------------------------------
drop policy if exists purchases_select_auth on public.purchases;
create policy purchases_select_auth on public.purchases
  for select using ( public.is_authenticated() );

drop policy if exists purchases_insert_mgr on public.purchases;
create policy purchases_insert_mgr on public.purchases
  for insert with check ( public.is_manager_or_admin() );

drop policy if exists purchases_delete_admin on public.purchases;
create policy purchases_delete_admin on public.purchases
  for delete using ( public.is_admin() );

drop policy if exists pitems_select_auth on public.purchase_items;
create policy pitems_select_auth on public.purchase_items
  for select using ( public.is_authenticated() );

drop policy if exists pitems_insert_mgr on public.purchase_items;
create policy pitems_insert_mgr on public.purchase_items
  for insert with check ( public.is_manager_or_admin() );

-- ---------------------------------------------------------------------
-- SALES / SALE_ITEMS
-- ---------------------------------------------------------------------
drop policy if exists sales_select_auth on public.sales;
create policy sales_select_auth on public.sales
  for select using ( public.is_authenticated() );

drop policy if exists sales_insert_mgr on public.sales;
create policy sales_insert_mgr on public.sales
  for insert with check ( public.is_manager_or_admin() );

drop policy if exists sales_delete_admin on public.sales;
create policy sales_delete_admin on public.sales
  for delete using ( public.is_admin() );

drop policy if exists sitems_select_auth on public.sale_items;
create policy sitems_select_auth on public.sale_items
  for select using ( public.is_authenticated() );

drop policy if exists sitems_insert_mgr on public.sale_items;
create policy sitems_insert_mgr on public.sale_items
  for insert with check ( public.is_manager_or_admin() );

-- ---------------------------------------------------------------------
-- STOCK MOVEMENTS
-- Reads are open to any authenticated user.
-- Writes are BLOCKED at the RLS layer — movements may ONLY be created
-- by the SECURITY DEFINER RPC functions in functions.sql.
-- ---------------------------------------------------------------------
drop policy if exists sm_select_auth on public.stock_movements;
create policy sm_select_auth on public.stock_movements
  for select using ( public.is_authenticated() );

-- No insert/update/delete policies → denied by default for all users.
-- RPC functions bypass RLS via SECURITY DEFINER.
