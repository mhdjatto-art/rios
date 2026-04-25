-- =====================================================================
-- RIOS — seed.sql
-- Optional demo data. Run AFTER schema.sql, policies.sql, functions.sql.
-- Run this as the service_role (in Supabase SQL editor) so it bypasses RLS.
-- =====================================================================
-- NOTE: This seed creates products only. Purchases / sales should be
-- created through the create_purchase / create_sale RPCs using a real
-- authenticated user, so the stock_movements ledger stays consistent.
-- =====================================================================

insert into public.products (sku, name, brand, category, status) values
  ('SKU-001', 'Wireless Mouse',      'Logi',     'Accessories', 'active'),
  ('SKU-002', 'Mechanical Keyboard', 'Keychron', 'Accessories', 'active'),
  ('SKU-003', '27" 4K Monitor',      'Dell',     'Displays',    'active'),
  ('SKU-004', 'USB-C Hub 7-in-1',    'Anker',    'Accessories', 'active'),
  ('SKU-005', 'Webcam 1080p',        'Logi',     'Peripherals', 'active'),
  ('SKU-006', 'Noise-Cancel Headset','Sony',     'Audio',       'active'),
  ('SKU-007', 'Standing Desk Mat',   'Ergodox',  'Furniture',   'active'),
  ('SKU-008', 'Laptop Stand',        'Rain',     'Accessories', 'inactive')
on conflict (sku) do nothing;
