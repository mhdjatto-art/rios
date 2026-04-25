// frontend/permissions.js  (Phase 18)
import { supabase } from './api.js';
import { auth } from './auth.js';

export const PERMISSION_GROUPS = [
  {
    id: 'pos', icon: '🛒', key: 'nav_group_sales',
    perms: [
      { key: 'pos.access', label_ar: 'الوصول لنقطة البيع', label_en: 'Access POS' },
      { key: 'pos.discount', label_ar: 'تطبيق الخصومات في POS', label_en: 'Apply discounts in POS' },
      { key: 'pos.void', label_ar: 'إلغاء/استرجاع من POS', label_en: 'Void/return from POS' },
      { key: 'pos.wholesale', label_ar: 'بيع بأسعار الجملة', label_en: 'Sell wholesale prices' },
      { key: 'pos.cash_session', label_ar: 'فتح/إغلاق الصندوق', label_en: 'Open/close cash session' },
    ],
  },
  {
    id: 'sales', icon: '💰', key: 'sales',
    perms: [
      { key: 'sales.view', label_ar: 'عرض المبيعات', label_en: 'View sales' },
      { key: 'sales.create', label_ar: 'إنشاء فاتورة', label_en: 'Create sales invoice' },
      { key: 'sales.edit', label_ar: 'تعديل المبيعات', label_en: 'Edit sales' },
      { key: 'sales.delete', label_ar: 'حذف المبيعات', label_en: 'Delete sales' },
      { key: 'quotations.manage', label_ar: 'عروض الأسعار', label_en: 'Manage quotations' },
      { key: 'returns.manage', label_ar: 'إدارة المرتجعات', label_en: 'Manage returns' },
    ],
  },
  {
    id: 'purchases', icon: '📦', key: 'purchases',
    perms: [
      { key: 'purchases.view', label_ar: 'عرض المشتريات', label_en: 'View purchases' },
      { key: 'purchases.create', label_ar: 'إنشاء مشتريات', label_en: 'Create purchases' },
      { key: 'purchases.edit', label_ar: 'تعديل المشتريات', label_en: 'Edit purchases' },
      { key: 'purchase_orders.manage', label_ar: 'أوامر الشراء', label_en: 'Manage POs' },
    ],
  },
  {
    id: 'inventory', icon: '📦', key: 'nav_group_stock',
    perms: [
      { key: 'inventory.view', label_ar: 'عرض المخزون', label_en: 'View inventory' },
      { key: 'inventory.adjust', label_ar: 'تعديل المخزون', label_en: 'Adjust stock' },
      { key: 'inventory.transfer', label_ar: 'التحويلات بين الفروع', label_en: 'Transfer between branches' },
      { key: 'inventory.count', label_ar: 'جرد المخزون', label_en: 'Physical counts' },
    ],
  },
  {
    id: 'parties', icon: '👥', key: 'customers',
    perms: [
      { key: 'customers.view', label_ar: 'عرض العملاء', label_en: 'View customers' },
      { key: 'customers.create', label_ar: 'إضافة عملاء', label_en: 'Add customers' },
      { key: 'customers.edit', label_ar: 'تعديل العملاء', label_en: 'Edit customers' },
      { key: 'customers.delete', label_ar: 'حذف العملاء', label_en: 'Delete customers' },
      { key: 'suppliers.manage', label_ar: 'إدارة الموردين', label_en: 'Manage suppliers' },
    ],
  },
  {
    id: 'products', icon: '📋', key: 'products',
    perms: [
      { key: 'products.view', label_ar: 'عرض المنتجات', label_en: 'View products' },
      { key: 'products.create', label_ar: 'إضافة منتج', label_en: 'Create products' },
      { key: 'products.edit', label_ar: 'تعديل المنتج', label_en: 'Edit products' },
      { key: 'products.delete', label_ar: 'حذف المنتج', label_en: 'Delete products' },
      { key: 'products.import', label_ar: 'استيراد CSV', label_en: 'Import CSV' },
    ],
  },
  {
    id: 'accounting', icon: '📚', key: 'nav_group_accounting',
    perms: [
      { key: 'accounting.view', label_ar: 'عرض المحاسبة', label_en: 'View accounting' },
      { key: 'accounting.post', label_ar: 'ترحيل قيود يدوية', label_en: 'Post manual entries' },
      { key: 'accounting.rebuild', label_ar: 'إعادة بناء الدفتر', label_en: 'Rebuild ledger' },
      { key: 'accounting.year_end', label_ar: 'إقفال السنة', label_en: 'Year-end closing' },
      { key: 'payments.manage', label_ar: 'إدارة المدفوعات', label_en: 'Manage payments' },
      { key: 'expenses.manage', label_ar: 'إدارة المصروفات', label_en: 'Manage expenses' },
      { key: 'assets.manage', label_ar: 'إدارة الأصول الثابتة', label_en: 'Manage fixed assets' },
      { key: 'recurring.manage', label_ar: 'القيود الدورية', label_en: 'Recurring entries' },
    ],
  },
  {
    id: 'hr', icon: '👥', key: 'nav_group_hr',
    perms: [
      { key: 'employees.view', label_ar: 'عرض الموظفين', label_en: 'View employees' },
      { key: 'employees.manage', label_ar: 'إدارة الموظفين', label_en: 'Manage employees' },
      { key: 'payroll.view', label_ar: 'عرض الرواتب', label_en: 'View payroll' },
      { key: 'payroll.run', label_ar: 'تشغيل مسير الرواتب', label_en: 'Run payroll' },
    ],
  },
  {
    id: 'reports', icon: '📊', key: 'nav_group_reports',
    perms: [
      { key: 'reports.view', label_ar: 'عرض التقارير', label_en: 'View reports' },
      { key: 'reports.export', label_ar: 'تصدير التقارير', label_en: 'Export reports' },
      { key: 'dashboard.view', label_ar: 'عرض لوحة التحكم', label_en: 'View dashboard' },
    ],
  },
  {
    id: 'admin', icon: '⚙️', key: 'nav_group_admin',
    perms: [
      { key: 'users.manage', label_ar: 'إدارة المستخدمين', label_en: 'Manage users' },
      { key: 'settings.edit', label_ar: 'تعديل الإعدادات', label_en: 'Edit settings' },
      { key: 'branches.manage', label_ar: 'إدارة الفروع', label_en: 'Manage branches' },
      { key: 'currencies.manage', label_ar: 'إدارة العملات', label_en: 'Manage currencies' },
      { key: 'backup.restore', label_ar: 'نسخ احتياطي/استعادة', label_en: 'Backup/restore' },
      { key: 'theme.customize', label_ar: 'تخصيص الثيم', label_en: 'Customize theme' },
    ],
  },
];

export const ROLE_DEFAULTS = {
  admin: '*',
  manager: [],
  // 'staff' is the frontend name; 'viewer' is the DB enum name — both are supported
  staff: [
    'pos.access', 'pos.cash_session',
    'products.view', 'customers.view', 'customers.create',
    'inventory.view', 'sales.view', 'dashboard.view',
  ],
  viewer: [
    'pos.access', 'pos.cash_session',
    'products.view', 'customers.view', 'customers.create',
    'inventory.view', 'sales.view', 'dashboard.view',
  ],
};

const ADMIN_ONLY = [
  'users.manage', 'settings.edit', 'accounting.rebuild',
  'currencies.manage', 'recurring.manage', 'backup.restore',
];

let _permsCache = { userId: null, role: null, perms: [] };

export function refreshPermissionsCache() {
  const user = auth.state?.user;
  const profile = auth.state?.profile;
  _permsCache = {
    userId: user?.id,
    role: profile?.role || 'staff',
    perms: Array.isArray(profile?.permissions) ? profile.permissions : [],
  };
}

export function hasPermission(key) {
  const { role, perms } = _permsCache;
  if (perms.includes('deny:' + key)) return false;
  if (perms.includes(key)) return true;
  if (role === 'admin') return true;
  if (role === 'manager') return !ADMIN_ONLY.includes(key);
  // Support both 'staff' (frontend name) and 'viewer' (DB enum name)
  if (role === 'staff' || role === 'viewer') return ROLE_DEFAULTS.staff.includes(key);
  return false;
}

export async function setUserPermissions(userId, perms) {
  const { error } = await supabase.rpc('set_user_permissions', {
    p_user_id: userId, p_perms: perms,
  });
  return { error };
}
