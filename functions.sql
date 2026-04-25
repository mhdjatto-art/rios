-- =====================================================================
-- RIOS — functions.sql
-- Atomic business operations exposed as Supabase RPCs
-- =====================================================================
-- Every multi-row mutation (purchase create, sale create, adjustment)
-- runs here as SECURITY DEFINER so it can:
--   1. Bypass RLS on stock_movements (writes are blocked there by RLS).
--   2. Enforce its own role check + row-locking stock validation.
--   3. Wrap everything in one transaction — partial writes are impossible.
--
-- Any caller on the frontend goes through supabase.rpc('fn_name', {...}).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Internal guard — raises if the caller is not allowed to write ops data
-- ---------------------------------------------------------------------
create or replace function public._assert_manager_or_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select role into v_role from public.profiles where id = auth.uid();

  if v_role is null or v_role not in ('admin','manager') then
    raise exception 'FORBIDDEN: manager or admin role required'
      using errcode = '42501';
  end if;
end;
$$;

-- =====================================================================
-- 1. create_purchase
-- Atomically: insert header, insert items, insert +qty stock_movements.
-- =====================================================================
-- Input JSON shape (example):
-- {
--   "purchase_number": "PO-2026-0001",
--   "supplier": "ACME Ltd",
--   "purchase_date": "2026-04-17",
--   "notes": "...",
--   "items": [
--     { "product_id": "<uuid>", "qty": 10, "cost_price": 5.25 },
--     ...
--   ]
-- }
-- =====================================================================
create or replace function public.create_purchase(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid := auth.uid();
  v_purchase_id   uuid;
  v_purchase_no   text;
  v_supplier      text;
  v_date          date;
  v_notes         text;
  v_items         jsonb;
  v_item          jsonb;
  v_product_id    uuid;
  v_qty           numeric(14,3);
  v_cost          numeric(14,4);
  v_line_total    numeric(14,2);
  v_grand_total   numeric(14,2) := 0;
begin
  perform public._assert_manager_or_admin();

  v_purchase_no := nullif(trim(payload->>'purchase_number'), '');
  v_supplier    := nullif(trim(payload->>'supplier'), '');
  v_date        := coalesce((payload->>'purchase_date')::date, current_date);
  v_notes       := payload->>'notes';
  v_items       := payload->'items';

  if v_purchase_no is null then
    raise exception 'VALIDATION: purchase_number is required';
  end if;
  if v_supplier is null then
    raise exception 'VALIDATION: supplier is required';
  end if;
  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'VALIDATION: at least one item is required';
  end if;

  -- Header (total_cost filled in after loop)
  insert into public.purchases (
    purchase_number, supplier, purchase_date, total_cost, notes, created_by
  )
  values (v_purchase_no, v_supplier, v_date, 0, v_notes, v_user_id)
  returning id into v_purchase_id;

  -- Items + stock movements
  for v_item in select * from jsonb_array_elements(v_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty        := (v_item->>'qty')::numeric;
    v_cost       := (v_item->>'cost_price')::numeric;

    if v_product_id is null then
      raise exception 'VALIDATION: product_id missing on item';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'VALIDATION: qty must be > 0 (got %)', v_qty;
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'VALIDATION: cost_price must be >= 0 (got %)', v_cost;
    end if;

    if not exists (select 1 from public.products where id = v_product_id) then
      raise exception 'VALIDATION: unknown product_id %', v_product_id;
    end if;

    v_line_total  := round(v_qty * v_cost, 2);
    v_grand_total := v_grand_total + v_line_total;

    insert into public.purchase_items (
      purchase_id, product_id, qty, cost_price, line_total
    ) values (
      v_purchase_id, v_product_id, v_qty, v_cost, v_line_total
    );

    insert into public.stock_movements (
      product_id, movement_type, qty, unit_cost,
      reference_id, reference_table, notes, created_by
    ) values (
      v_product_id, 'purchase', v_qty, v_cost,
      v_purchase_id, 'purchases',
      'Purchase ' || v_purchase_no, v_user_id
    );
  end loop;

  update public.purchases
     set total_cost = v_grand_total
   where id = v_purchase_id;

  return v_purchase_id;
end;
$$;

-- =====================================================================
-- 2. create_sale
-- Atomically: validate stock for all items, insert header, insert items,
-- insert -qty stock_movements. Row-level locking prevents overselling
-- under concurrent sales.
-- =====================================================================
-- Input JSON shape:
-- {
--   "sale_number": "SO-2026-0001",
--   "customer": "Walk-in",
--   "sale_date": "2026-04-17",
--   "notes": "...",
--   "items": [
--     { "product_id": "<uuid>", "qty": 2, "selling_price": 12.50 },
--     ...
--   ]
-- }
-- =====================================================================
create or replace function public.create_sale(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_sale_id      uuid;
  v_sale_no      text;
  v_customer     text;
  v_date         date;
  v_notes        text;
  v_items        jsonb;
  v_item         jsonb;
  v_product_id   uuid;
  v_qty          numeric(14,3);
  v_price        numeric(14,4);
  v_line_total   numeric(14,2);
  v_grand_total  numeric(14,2) := 0;
  v_current_stk  numeric(14,3);
  v_required     record;
begin
  perform public._assert_manager_or_admin();

  v_sale_no   := nullif(trim(payload->>'sale_number'), '');
  v_customer  := payload->>'customer';
  v_date      := coalesce((payload->>'sale_date')::date, current_date);
  v_notes     := payload->>'notes';
  v_items     := payload->'items';

  if v_sale_no is null then
    raise exception 'VALIDATION: sale_number is required';
  end if;
  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'VALIDATION: at least one item is required';
  end if;

  -- Pre-aggregate required qty per product (same product can appear twice)
  -- and lock those product rows to serialize concurrent sales.
  for v_required in
    select (item->>'product_id')::uuid as product_id,
           sum((item->>'qty')::numeric) as qty_needed
      from jsonb_array_elements(v_items) item
     group by (item->>'product_id')::uuid
  loop
    -- Lock the product row; its stock is computed from movements.
    perform 1 from public.products
      where id = v_required.product_id
      for update;

    select coalesce(sum(qty), 0) into v_current_stk
      from public.stock_movements
     where product_id = v_required.product_id;

    if v_current_stk < v_required.qty_needed then
      raise exception
        'INSUFFICIENT_STOCK: product % has % available, % requested',
        v_required.product_id, v_current_stk, v_required.qty_needed
        using errcode = 'P0001';
    end if;
  end loop;

  insert into public.sales (
    sale_number, customer, sale_date, total_value, notes, created_by
  ) values (
    v_sale_no, v_customer, v_date, 0, v_notes, v_user_id
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty        := (v_item->>'qty')::numeric;
    v_price      := (v_item->>'selling_price')::numeric;

    if v_qty is null or v_qty <= 0 then
      raise exception 'VALIDATION: qty must be > 0 (got %)', v_qty;
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'VALIDATION: selling_price must be >= 0 (got %)', v_price;
    end if;

    v_line_total  := round(v_qty * v_price, 2);
    v_grand_total := v_grand_total + v_line_total;

    insert into public.sale_items (
      sale_id, product_id, qty, selling_price, line_total
    ) values (
      v_sale_id, v_product_id, v_qty, v_price, v_line_total
    );

    insert into public.stock_movements (
      product_id, movement_type, qty,
      reference_id, reference_table, notes, created_by
    ) values (
      v_product_id, 'sale', -v_qty,
      v_sale_id, 'sales',
      'Sale ' || v_sale_no, v_user_id
    );
  end loop;

  update public.sales
     set total_value = v_grand_total
   where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- =====================================================================
-- 3. adjust_stock  (manual stock correction)
-- Positive qty = stock in, negative = stock out.
-- =====================================================================
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_qty        numeric,
  p_reason     text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_move_id uuid;
  v_stock   numeric(14,3);
begin
  perform public._assert_manager_or_admin();

  if p_product_id is null then
    raise exception 'VALIDATION: product_id is required';
  end if;
  if p_qty is null or p_qty = 0 then
    raise exception 'VALIDATION: qty must be non-zero';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'VALIDATION: reason is required for adjustments';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'VALIDATION: unknown product_id %', p_product_id;
  end if;

  -- For negative adjustments, make sure we do not drive stock negative.
  if p_qty < 0 then
    perform 1 from public.products where id = p_product_id for update;
    select coalesce(sum(qty), 0) into v_stock
      from public.stock_movements where product_id = p_product_id;
    if v_stock + p_qty < 0 then
      raise exception
        'INSUFFICIENT_STOCK: product % has %, adjustment of % would go negative',
        p_product_id, v_stock, p_qty
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.stock_movements (
    product_id, movement_type, qty, reference_table, notes, created_by
  ) values (
    p_product_id, 'adjustment', p_qty, 'adjustments', p_reason, v_user_id
  )
  returning id into v_move_id;

  return v_move_id;
end;
$$;

-- =====================================================================
-- 4. set_user_role  (admin-only)
-- =====================================================================
create or replace function public.set_user_role(
  p_user_id uuid,
  p_role    app_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN: admin role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_role is null then
    raise exception 'VALIDATION: user_id and role are required';
  end if;

  update public.profiles
     set role = p_role, updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'User % not found', p_user_id;
  end if;
end;
$$;

-- =====================================================================
-- 5. dashboard_summary  (convenience wrapper)
-- =====================================================================
create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(k) from public.v_dashboard_kpis k;
$$;

-- =====================================================================
-- Grant EXECUTE on RPC functions to authenticated users.
-- (Anon users have no business executing these.)
-- =====================================================================
grant execute on function public.create_purchase(jsonb)           to authenticated;
grant execute on function public.create_sale(jsonb)               to authenticated;
grant execute on function public.adjust_stock(uuid, numeric, text) to authenticated;
grant execute on function public.set_user_role(uuid, app_role)    to authenticated;
grant execute on function public.dashboard_summary()              to authenticated;
