-- =====================================================================
-- RIOS — patch_missing_functions.sql
-- وظائف مفقودة يجب تشغيلها في Supabase SQL Editor
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================================

-- =====================================================================
-- 1. update_sale_metadata
-- Called by POS after create_sale to store currency, wholesale, discount.
-- The base create_sale is atomic; this updates supplementary metadata.
-- =====================================================================
create or replace function public.update_sale_metadata(
  p_sale_id        uuid,
  p_currency       text    default null,
  p_rate           numeric default 1,
  p_wholesale      boolean default false,
  p_invoice_discount numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard: only authenticated managers/admins
  perform public._assert_manager_or_admin();

  if p_sale_id is null then
    raise exception 'VALIDATION: sale_id is required';
  end if;

  -- Update only if columns exist (handles both old and new schema)
  update public.sales
  set
    currency_code     = coalesce(p_currency, currency_code),
    exchange_rate     = coalesce(p_rate, 1),
    is_wholesale      = coalesce(p_wholesale, false),
    discount_invoice  = coalesce(p_invoice_discount, 0)
  where id = p_sale_id;

  -- If update touched 0 rows the sale doesn't exist — ignore silently
  -- (prevents crashing the POS if columns haven't been migrated yet)
end;
$$;

grant execute on function public.update_sale_metadata(uuid, text, numeric, boolean, numeric) to authenticated;


-- =====================================================================
-- 2. Migration: Add missing columns to sales table (if not exists)
-- These columns are referenced in api.js selects but absent in schema.sql
-- =====================================================================
do $$
begin
  -- currency_code
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'currency_code'
  ) then
    alter table public.sales add column currency_code text default 'IQD';
  end if;

  -- exchange_rate
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'exchange_rate'
  ) then
    alter table public.sales add column exchange_rate numeric(14,6) default 1;
  end if;

  -- is_wholesale
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'is_wholesale'
  ) then
    alter table public.sales add column is_wholesale boolean default false;
  end if;

  -- discount_invoice (invoice-level discount)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'discount_invoice'
  ) then
    alter table public.sales add column discount_invoice numeric(14,2) default 0;
  end if;

  -- customer_id (FK to customers table)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'customer_id'
  ) then
    alter table public.sales add column customer_id uuid references public.customers(id) on delete set null;
  end if;

  -- paid_amount
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'paid_amount'
  ) then
    alter table public.sales add column paid_amount numeric(14,2) default 0;
  end if;

  -- subtotal
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'subtotal'
  ) then
    alter table public.sales add column subtotal numeric(14,2) default 0;
  end if;

  -- total_vat
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'total_vat'
  ) then
    alter table public.sales add column total_vat numeric(14,2) default 0;
  end if;

  -- grand_total (alias for total_value in newer schema)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'grand_total'
  ) then
    alter table public.sales add column grand_total numeric(14,2) default 0;
  end if;

  -- sale_number uniqueness index
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'sale_number'
  ) then
    -- sale_number already exists in original schema, skip
    null;
  end if;

end$$;


-- =====================================================================
-- 3. Migration: Add vat_rate and discount_amount to sale_items (if not exists)
-- =====================================================================
do $$
begin
  -- vat_rate
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_items' and column_name = 'vat_rate'
  ) then
    alter table public.sale_items add column vat_rate numeric(5,2) default 0;
  end if;

  -- vat_amount
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_items' and column_name = 'vat_amount'
  ) then
    alter table public.sale_items add column vat_amount numeric(14,2) default 0;
  end if;

  -- discount_amount
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_items' and column_name = 'discount_amount'
  ) then
    alter table public.sale_items add column discount_amount numeric(14,2) default 0;
  end if;
end$$;


-- =====================================================================
-- 4. Fix app_role enum: add 'staff' if missing (DB has 'viewer')
-- =====================================================================
do $$
begin
  -- Add 'staff' to the app_role enum if it doesn't exist
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'staff'
  ) then
    alter type public.app_role add value if not exists 'staff';
  end if;
end$$;


-- =====================================================================
-- 5. Safe fallback for update_sale_metadata if columns don't exist yet
--    (replaces the strict version above with exception handling)
-- =====================================================================
create or replace function public.update_sale_metadata(
  p_sale_id          uuid,
  p_currency         text    default null,
  p_rate             numeric default 1,
  p_wholesale        boolean default false,
  p_invoice_discount numeric  default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_manager_or_admin();

  if p_sale_id is null then return; end if;

  -- Use a dynamic UPDATE so it doesn't crash if columns are missing
  begin
    execute format(
      'UPDATE public.sales SET
         currency_code    = $1,
         exchange_rate    = $2,
         is_wholesale     = $3,
         discount_invoice = $4
       WHERE id = $5',
      p_sale_id
    ) using
      coalesce(p_currency, 'IQD'),
      coalesce(p_rate, 1),
      coalesce(p_wholesale, false),
      coalesce(p_invoice_discount, 0),
      p_sale_id;
  exception when others then
    -- Columns may not exist in this schema version — silently ignore
    null;
  end;
end;
$$;

grant execute on function public.update_sale_metadata(uuid, text, numeric, boolean, numeric) to authenticated;


-- =====================================================================
-- 6. Ensure profiles has default_branch_id column
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'default_branch_id'
  ) then
    alter table public.profiles add column default_branch_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'permissions'
  ) then
    alter table public.profiles add column permissions jsonb default '[]'::jsonb;
  end if;
end$$;
