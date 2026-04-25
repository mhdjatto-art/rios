-- =====================================================================
-- RIOS — seed_users.sql  (Fixed: bypasses prevent_profile_escalation trigger)
-- إنشاء مستخدمين تجريبيين للنظام
-- شغّل هذا في Supabase Dashboard > SQL Editor
-- =====================================================================
-- ملاحظة: الإدراج المباشر في auth.users عبر SQL يتجاوز
--         سياسات كلمة المرور الخاصة بـ GoTrue تلقائياً.
--         كلمات المرور المستخدمة: Rios2026 (يمكن تغييرها بعد الدخول)
-- =====================================================================

-- تجاوز جميع الـ triggers مؤقتاً (ضروري لتعيين الأدوار)
set session_replication_role = 'replica';

-- =====================================================================
-- 1. Admin — مدير النظام (صلاحيات كاملة)
-- =====================================================================
do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'admin@rios.local' limit 1;
  if v_id is null then
    insert into auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'admin@rios.local', crypt('Rios2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"مدير النظام"}'::jsonb,
      false, 'authenticated', 'authenticated'
    ) returning id into v_id;
  end if;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (v_id, 'admin@rios.local', 'مدير النظام', 'admin', true)
  on conflict (id) do update
    set role = 'admin', full_name = 'مدير النظام', is_active = true;

  raise notice '✅ Admin: %', v_id;
end$$;

-- =====================================================================
-- 2. Manager — مدير الفرع
-- =====================================================================
do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'manager@rios.local' limit 1;
  if v_id is null then
    insert into auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'manager@rios.local', crypt('Rios2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"مدير الفرع"}'::jsonb,
      false, 'authenticated', 'authenticated'
    ) returning id into v_id;
  end if;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (v_id, 'manager@rios.local', 'مدير الفرع', 'manager', true)
  on conflict (id) do update
    set role = 'manager', full_name = 'مدير الفرع', is_active = true;

  raise notice '✅ Manager: %', v_id;
end$$;

-- =====================================================================
-- 3. Cashier — كاشير
-- =====================================================================
do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'cashier@rios.local' limit 1;
  if v_id is null then
    insert into auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'cashier@rios.local', crypt('Rios2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"الكاشير"}'::jsonb,
      false, 'authenticated', 'authenticated'
    ) returning id into v_id;
  end if;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (v_id, 'cashier@rios.local', 'الكاشير', 'viewer', true)
  on conflict (id) do update
    set role = 'viewer', full_name = 'الكاشير', is_active = true;

  raise notice '✅ Cashier: %', v_id;
end$$;

-- =====================================================================
-- 4. Accountant — محاسب
-- =====================================================================
do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'accountant@rios.local' limit 1;
  if v_id is null then
    insert into auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud
    ) values (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'accountant@rios.local', crypt('Rios2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"المحاسب"}'::jsonb,
      false, 'authenticated', 'authenticated'
    ) returning id into v_id;
  end if;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (v_id, 'accountant@rios.local', 'المحاسب', 'viewer', true)
  on conflict (id) do update
    set role = 'viewer', full_name = 'المحاسب', is_active = true;

  raise notice '✅ Accountant: %', v_id;
end$$;

-- إعادة تفعيل الـ triggers (مهم!)
set session_replication_role = 'origin';

-- =====================================================================
-- عرض النتيجة
-- =====================================================================
select
  p.email       as "البريد",
  p.full_name   as "الاسم",
  p.role        as "الدور",
  case p.role
    when 'admin'   then '🔴 كامل الصلاحيات'
    when 'manager' then '🟠 مدير العمليات'
    when 'viewer'  then '🟢 قراءة / كاشير'
  end           as "الصلاحيات",
  p.is_active   as "نشط"
from public.profiles p
where p.email like '%@rios.local'
order by case p.role when 'admin' then 1 when 'manager' then 2 else 3 end;

-- =====================================================================
-- بيانات الدخول (كلمة المرور موحّدة للجميع):
--   admin@rios.local       / Rios2026   ← مدير النظام
--   manager@rios.local     / Rios2026   ← مدير الفرع
--   cashier@rios.local     / Rios2026   ← كاشير
--   accountant@rios.local  / Rios2026   ← محاسب
-- ⚠️ غيّر كلمات المرور فور تسجيل الدخول الأول!
-- =====================================================================
