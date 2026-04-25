// frontend/command_palette.js (Phase 22) — Global Command Palette (Cmd+K / Ctrl+K)
import { productsApi, customersApi, suppliersApi, salesApi } from './api.js';
import { t } from './i18n.js';
import { el } from './utils.js';

// Phase 22: Inject command palette CSS once
(function injectCPCSS() {
  if (document.getElementById('cp-styles')) return;
  const s = document.createElement('style');
  s.id = 'cp-styles';
  s.textContent = `/* Command Palette styles - Phase 22 */
.cp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
}

.cp-box {
  background: var(--rios-surface, #fff);
  color: var(--rios-text, #000);
  border: 1px solid var(--rios-border, #e5e7eb);
  border-radius: 12px;
  width: 92%;
  max-width: 600px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: cpSlideIn 0.15s ease-out;
}

@keyframes cpSlideIn {
  from { opacity: 0; transform: translateY(-10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.cp-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--rios-border, #e5e7eb);
}

.cp-input-icon {
  font-size: 18px;
  opacity: 0.6;
}

.cp-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;
  color: var(--rios-text, #000);
  padding: 4px 0;
  font-family: inherit;
}

.cp-input::placeholder {
  color: var(--rios-muted, #9ca3af);
}

.cp-kbd {
  padding: 3px 8px;
  font-size: 11px;
  background: var(--rios-surface2, #f3f4f6);
  border: 1px solid var(--rios-border, #e5e7eb);
  border-radius: 4px;
  color: var(--rios-muted, #6b7280);
  font-family: monospace;
}

.cp-results {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px 0;
}

.cp-category {
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rios-muted, #6b7280);
}

.cp-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.1s;
}

.cp-item:hover,
.cp-item--active {
  background: var(--rios-surface2, #f3f4f6);
}

.cp-item--active {
  background: rgba(var(--rios-primary-rgb, 36, 83, 184), 0.1);
}

.cp-item__icon {
  font-size: 20px;
  flex-shrink: 0;
}

.cp-item__text {
  flex: 1;
  min-width: 0;
}

.cp-item__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--rios-text, #000);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-item__subtitle {
  font-size: 12px;
  color: var(--rios-muted, #6b7280);
  margin-top: 2px;
}

.cp-item__hint {
  font-size: 12px;
  color: var(--rios-muted, #9ca3af);
  opacity: 0;
  transition: opacity 0.15s;
}

.cp-item--active .cp-item__hint {
  opacity: 1;
}

.cp-empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--rios-muted, #9ca3af);
}

.cp-footer {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--rios-border, #e5e7eb);
  font-size: 11px;
  color: var(--rios-muted, #9ca3af);
  background: var(--rios-surface2, #f9fafb);
}

/* Topbar search button */
.topbar__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--rios-surface2, #f3f4f6);
  border: 1px solid var(--rios-border, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
  color: var(--rios-muted, #6b7280);
  font-size: 13px;
  margin: 0 12px;
  min-width: 200px;
  transition: all 0.15s;
}

.topbar__search:hover {
  background: var(--rios-surface, #fff);
  border-color: var(--rios-primary, #2453b8);
  color: var(--rios-text, #000);
}

.topbar__search-text {
  flex: 1;
  text-align: start;
}

.topbar__search-kbd {
  padding: 2px 6px;
  font-size: 10px;
  background: var(--rios-surface, #fff);
  border: 1px solid var(--rios-border, #e5e7eb);
  border-radius: 3px;
  font-family: monospace;
}

/* Mobile */
@media (max-width: 768px) {
  .topbar__search {
    min-width: auto;
    margin: 0 6px;
    padding: 6px 10px;
  }
  .topbar__search-text,
  .topbar__search-kbd {
    display: none;
  }
  .cp-overlay {
    padding-top: 20px;
  }
  .cp-box {
    width: 96%;
  }
  .cp-footer {
    display: none;
  }
}
`;
  document.head.appendChild(s);
})();



// =======================
// STATIC NAV ITEMS
// =======================
const NAV_ITEMS = [
  { icon: '🏠', label_en: 'Dashboard', label_ar: 'الرئيسية', path: '/dashboard', category: 'page' },
  { icon: '💳', label_en: 'POS', label_ar: 'نقطة البيع', path: '/pos', category: 'page' },
  { icon: '🧾', label_en: 'Sales', label_ar: 'المبيعات', path: '/sales', category: 'page' },
  { icon: '📝', label_en: 'Quotations', label_ar: 'عروض الأسعار', path: '/quotations', category: 'page' },
  { icon: '👥', label_en: 'Customers', label_ar: 'العملاء', path: '/customers', category: 'page' },
  { icon: '↩️', label_en: 'Returns', label_ar: 'المرتجعات', path: '/returns', category: 'page' },
  { icon: '🎁', label_en: 'Loyalty Program', label_ar: 'برنامج الولاء', path: '/loyalty', category: 'page' },
  { icon: '🛒', label_en: 'Purchases', label_ar: 'المشتريات', path: '/purchases', category: 'page' },
  { icon: '📦', label_en: 'Purchase Orders', label_ar: 'أوامر الشراء', path: '/purchase_orders', category: 'page' },
  { icon: '🏭', label_en: 'Suppliers', label_ar: 'الموردين', path: '/suppliers', category: 'page' },
  { icon: '🏷️', label_en: 'Products', label_ar: 'المنتجات', path: '/products', category: 'page' },
  { icon: '📊', label_en: 'Inventory', label_ar: 'المخزون', path: '/inventory', category: 'page' },
  { icon: '🔁', label_en: 'Transfers', label_ar: 'التحويلات', path: '/transfers', category: 'page' },
  { icon: '🔔', label_en: 'Reorder', label_ar: 'إعادة الطلب', path: '/reorder', category: 'page' },
  { icon: '📋', label_en: 'Inventory Count', label_ar: 'جرد المخزون', path: '/inventory_count', category: 'page' },
  { icon: '🏷', label_en: 'Barcode Labels', label_ar: 'ملصقات الباركود', path: '/barcode_labels', category: 'page' },
  { icon: '💵', label_en: 'Payments', label_ar: 'المدفوعات', path: '/payments', category: 'page' },
  { icon: '💸', label_en: 'Expenses', label_ar: 'المصاريف', path: '/expenses', category: 'page' },
  { icon: '🏦', label_en: 'Cash Drawer', label_ar: 'الصندوق', path: '/cash_drawer', category: 'page' },
  { icon: '📒', label_en: 'Statements', label_ar: 'كشف الحساب', path: '/statements', category: 'page' },
  { icon: '👥', label_en: 'Employees', label_ar: 'الموظفين', path: '/employees', category: 'page' },
  { icon: '💰', label_en: 'Payroll', label_ar: 'الرواتب', path: '/payroll', category: 'page' },
  { icon: '📚', label_en: 'Chart of Accounts', label_ar: 'دليل الحسابات', path: '/coa', category: 'page' },
  { icon: '📓', label_en: 'Journal', label_ar: 'القيود اليومية', path: '/journal', category: 'page' },
  { icon: '📗', label_en: 'General Ledger', label_ar: 'دفتر الأستاذ', path: '/ledger', category: 'page' },
  { icon: '📊', label_en: 'Financial Statements', label_ar: 'القوائم المالية', path: '/statements_fin', category: 'page' },
  { icon: '📅', label_en: 'Aging Reports', label_ar: 'تقارير الأعمار', path: '/aging', category: 'page' },
  { icon: '💧', label_en: 'Cash Flow', label_ar: 'التدفق النقدي', path: '/cash_flow', category: 'page' },
  { icon: '🏢', label_en: 'Branch P&L', label_ar: 'أرباح الفروع', path: '/branch_pnl', category: 'page' },
  { icon: '🏛', label_en: 'Fixed Assets', label_ar: 'الأصول الثابتة', path: '/fixed_assets', category: 'page' },
  { icon: '🔄', label_en: 'Recurring Entries', label_ar: 'القيود الدورية', path: '/recurring', category: 'page' },
  { icon: '📈', label_en: 'Reports', label_ar: 'التقارير', path: '/reports', category: 'page' },
  { icon: '🔍', label_en: 'Audit Log', label_ar: 'سجل المراجعة', path: '/audit', category: 'page' },
  { icon: '🏢', label_en: 'Branches', label_ar: 'الفروع', path: '/branches', category: 'page' },
  { icon: '👤', label_en: 'Users', label_ar: 'المستخدمين', path: '/users', category: 'page' },
  { icon: '⚙️', label_en: 'Settings', label_ar: 'الإعدادات', path: '/settings', category: 'page' },
  { icon: '💱', label_en: 'Currencies', label_ar: 'العملات', path: '/currencies', category: 'page' },
  { icon: '🎨', label_en: 'Theme Editor', label_ar: 'محرر الثيمات', path: '/theme', category: 'page' },
  { icon: '🧭', label_en: 'Navigation', label_ar: 'التنقل', path: '/nav', category: 'page' },
  { icon: '📥', label_en: 'Import', label_ar: 'استيراد', path: '/import', category: 'page' },
  { icon: '💾', label_en: 'Backup', label_ar: 'النسخ الاحتياطي', path: '/backup', category: 'page' },
  { icon: '🧪', label_en: 'System Health', label_ar: 'فحص النظام', path: '/tests', category: 'page' },
];

let _overlay = null;
let _input = null;
let _results = null;
let _selectedIdx = 0;
let _currentResults = [];
let _searchTimeout = null;

function fuzzyMatch(text, query) {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  // Simple contains match
  if (t.includes(q)) return true;
  // Word start match
  const words = t.split(/[\s_\-\/]+/);
  if (words.some((w) => w.startsWith(q))) return true;
  return false;
}

function getLang() {
  try { return document.documentElement.lang || 'en'; } catch { return 'en'; }
}

function getNavLabel(item) {
  return getLang() === 'ar' ? item.label_ar : item.label_en;
}

async function searchAll(query) {
  const results = [];
  const lang = getLang();

  // 1. Match pages (fast, in-memory)
  for (const item of NAV_ITEMS) {
    const label = getNavLabel(item);
    if (fuzzyMatch(label + ' ' + item.label_en + ' ' + item.label_ar, query)) {
      results.push({ ...item, display: label });
    }
  }

  // If no query, return pages only
  if (!query || query.length < 2) return results;

  // 2. Search products (by SKU or name)
  try {
    const { data } = await productsApi.list({ search: query, limit: 10 });
    if (data?.length) {
      for (const p of data) {
        results.push({
          icon: '🏷️', display: `${p.sku || ''} — ${p.name}`,
          subtitle: (lang === 'ar' ? 'منتج' : 'Product'),
          category: 'product', path: `/products?id=${p.id}`,
        });
      }
    }
  } catch {}

  // 3. Search customers
  try {
    const { data } = await customersApi.list({ search: query, limit: 10 });
    if (data?.length) {
      for (const c of data.slice(0, 5)) {
        results.push({
          icon: '👥', display: c.name,
          subtitle: (lang === 'ar' ? 'عميل' : 'Customer') + (c.phone ? ' · ' + c.phone : ''),
          category: 'customer', path: `/customers?id=${c.id}`,
        });
      }
    }
  } catch {}

  // 4. Search suppliers
  try {
    const { data } = await suppliersApi.list({ search: query, limit: 10 });
    if (data?.length) {
      for (const s of data.slice(0, 5)) {
        results.push({
          icon: '🏭', display: s.name,
          subtitle: (lang === 'ar' ? 'مورد' : 'Supplier'),
          category: 'supplier', path: `/suppliers?id=${s.id}`,
        });
      }
    }
  } catch {}

  return results;
}

function renderResults(list) {
  _currentResults = list;
  _selectedIdx = 0;
  _results.innerHTML = '';

  if (!list.length) {
    _results.appendChild(el('div', { class: 'cp-empty' }, [
      el('div', { style: 'font-size:32px; opacity:0.3; margin-bottom:8px' }, '🔍'),
      el('div', {}, getLang() === 'ar' ? 'لا توجد نتائج' : 'No results'),
    ]));
    return;
  }

  // Group by category
  const grouped = {};
  for (const r of list) {
    const cat = r.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  }

  const catLabels = {
    page: getLang() === 'ar' ? 'الصفحات' : 'Pages',
    product: getLang() === 'ar' ? 'المنتجات' : 'Products',
    customer: getLang() === 'ar' ? 'العملاء' : 'Customers',
    supplier: getLang() === 'ar' ? 'الموردون' : 'Suppliers',
  };

  let globalIdx = 0;
  for (const cat of ['page', 'product', 'customer', 'supplier', 'other']) {
    if (!grouped[cat]) continue;
    _results.appendChild(el('div', { class: 'cp-category' },
      catLabels[cat] || cat));
    for (const r of grouped[cat]) {
      const idx = globalIdx++;
      const row = el('div', {
        class: 'cp-item' + (idx === _selectedIdx ? ' cp-item--active' : ''),
        'data-idx': idx,
        onclick: () => selectItem(idx),
      }, [
        el('span', { class: 'cp-item__icon' }, r.icon),
        el('div', { class: 'cp-item__text' }, [
          el('div', { class: 'cp-item__title' }, r.display),
          r.subtitle ? el('div', { class: 'cp-item__subtitle' }, r.subtitle) : '',
        ].filter(Boolean)),
        el('span', { class: 'cp-item__hint' }, '↵'),
      ]);
      _results.appendChild(row);
    }
  }
}

function updateActive() {
  _results.querySelectorAll('.cp-item').forEach((el) => {
    const idx = parseInt(el.dataset.idx, 10);
    el.classList.toggle('cp-item--active', idx === _selectedIdx);
    if (idx === _selectedIdx) el.scrollIntoView({ block: 'nearest' });
  });
}

function selectItem(idx) {
  const item = _currentResults[idx];
  if (!item) return;
  closeCommandPalette();
  if (item.path) {
    // Strip query for now, use plain hash navigation
    const clean = item.path.split('?')[0];
    location.hash = '#' + clean;
  }
}

function handleKey(e) {
  if (!_overlay || _overlay.style.display === 'none') return;
  if (e.key === 'Escape') { closeCommandPalette(); e.preventDefault(); return; }
  if (e.key === 'ArrowDown') {
    _selectedIdx = Math.min(_selectedIdx + 1, _currentResults.length - 1);
    updateActive(); e.preventDefault();
  }
  if (e.key === 'ArrowUp') {
    _selectedIdx = Math.max(_selectedIdx - 1, 0);
    updateActive(); e.preventDefault();
  }
  if (e.key === 'Enter') {
    selectItem(_selectedIdx); e.preventDefault();
  }
}

export function openCommandPalette() {
  if (!_overlay) buildOverlay();
  _overlay.style.display = 'flex';
  _input.value = '';
  _input.focus();
  // Initial: show all pages
  searchAll('').then(renderResults);
}

export function closeCommandPalette() {
  if (_overlay) _overlay.style.display = 'none';
}

function buildOverlay() {
  _overlay = el('div', { class: 'cp-overlay', onclick: (e) => {
    if (e.target === _overlay) closeCommandPalette();
  } });

  _input = el('input', {
    class: 'cp-input',
    type: 'text',
    placeholder: getLang() === 'ar'
      ? 'ابحث عن صفحة، منتج، عميل...'
      : 'Search pages, products, customers...',
    autocomplete: 'off',
    spellcheck: 'false',
    oninput: (e) => {
      if (_searchTimeout) clearTimeout(_searchTimeout);
      const q = e.target.value;
      _searchTimeout = setTimeout(async () => {
        const list = await searchAll(q);
        renderResults(list);
      }, 150);
    },
  });

  _results = el('div', { class: 'cp-results' });

  const box = el('div', { class: 'cp-box' }, [
    el('div', { class: 'cp-input-wrap' }, [
      el('span', { class: 'cp-input-icon' }, '🔍'),
      _input,
      el('span', { class: 'cp-kbd' }, 'ESC'),
    ]),
    _results,
    el('div', { class: 'cp-footer' }, [
      el('span', {}, '↑↓ ' + (getLang() === 'ar' ? 'للتنقل' : 'navigate')),
      el('span', {}, '↵ ' + (getLang() === 'ar' ? 'اختيار' : 'select')),
      el('span', {}, 'ESC ' + (getLang() === 'ar' ? 'إغلاق' : 'close')),
    ]),
  ]);
  _overlay.appendChild(box);
  document.body.appendChild(_overlay);
  document.addEventListener('keydown', handleKey);
}

// Global keyboard shortcut: Cmd+K / Ctrl+K
export function installCommandPaletteShortcut() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  });
}
