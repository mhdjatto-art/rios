// frontend/app.js  (Phase 11 — sidebar navigation)
import { auth } from './auth.js';
import { CONFIG } from './config.js';
import { i18n, t } from './i18n.js';
import { hasPermission } from './permissions.js';
import { openCommandPalette, installCommandPaletteShortcut } from './command_palette.js';
import { el, clear, toast, $ } from './utils.js';
import { branchesApi, settingsApi } from './api.js';
import { applyTheme, loadPreferences, themeFromPrefs, cachedPrefs } from './theme.js';

// ---------------------------------------------------------------------
const ROUTE_PERMS = {"/pos": "pos.access", "/sales": "sales.view", "/quotations": "quotations.manage", "/customers": "customers.view", "/customer_journey": "customers.view", "/returns": "returns.manage", "/purchases": "purchases.view", "/purchase_orders": "purchase_orders.manage", "/suppliers": "suppliers.manage", "/products": "products.view", "/inventory": "inventory.view", "/transfers": "inventory.transfer", "/reorder": "inventory.view", "/inventory_count": "inventory.count", "/barcode_labels": "products.view", "/payments": "payments.manage", "/expenses": "expenses.manage", "/cash_drawer": "pos.cash_session", "/statements": "reports.view", "/statements_fin": "accounting.view", "/coa": "accounting.view", "/journal": "accounting.view", "/ledger": "accounting.view", "/aging": "reports.view", "/cash_flow": "accounting.view", "/branch_pnl": "reports.view", "/fixed_assets": "assets.manage", "/recurring": "recurring.manage", "/employees": "employees.view", "/payroll": "payroll.view", "/loyalty": "customers.view", "/currencies": "currencies.manage", "/reports": "reports.view", "/audit": "users.manage", "/tests": "users.manage", "/branches": "branches.manage", "/users": "users.manage", "/settings": "settings.edit", "/theme": "theme.customize", "/nav": "theme.customize", "/import": "products.import", "/backup": "backup.restore", "/dashboard": "dashboard.view"};

// Phase 19: Global error boundary
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error || e.message);
  // Don't crash the app — just log. The user sees the page still.
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// VIEWS — definition of each route
// ---------------------------------------------------------------------
const VIEWS = {
  '/dashboard':       { key: 'dashboard',       icon: '🏠', roles: null,                load: () => import('./dashboard.js') },
  '/pos':             { key: 'pos',             icon: '💳', roles: ['admin','manager'], load: () => import('./pos.js') },
  '/sales':           { key: 'sales',           icon: '🧾', roles: null,                load: () => import('./sales.js') },
  '/quotations':      { key: 'quotations',      icon: '📝', roles: null,                load: () => import('./quotations.js') },
  '/customer_journey':{ key: 'customer_journey', icon: '🗺️', roles: null,                load: () => import('./customer_journey.js') },
  '/customers':       { key: 'customers',       icon: '👥', roles: null,                load: () => import('./customers.js') },
  '/returns':         { key: 'returns',         icon: '↩️', roles: null,                load: () => import('./returns.js') },

  '/purchases':       { key: 'purchases',       icon: '🛒', roles: null,                load: () => import('./purchases.js') },
  '/purchase_orders': { key: 'purchase_orders', icon: '📦', roles: null,                load: () => import('./purchase_orders.js') },
  '/suppliers':       { key: 'suppliers',       icon: '🏭', roles: null,                load: () => import('./suppliers.js') },

  '/products':        { key: 'products',        icon: '🏷️', roles: null,                load: () => import('./products.js') },
  '/inventory':       { key: 'inventory',       icon: '📊', roles: null,                load: () => import('./inventory.js') },
  '/transfers':       { key: 'transfers',       icon: '🔁', roles: null,                load: () => import('./transfers.js') },
  '/reorder':         { key: 'reorder',         icon: '🔔', roles: null,                load: () => import('./reorder.js') },

  '/payments':        { key: 'payments',        icon: '💵', roles: null,                load: () => import('./payments.js') },
  '/expenses':        { key: 'expenses',        icon: '💸', roles: null,                load: () => import('./expenses.js') },
  '/cash_drawer':     { key: 'cash_drawer',     icon: '🏦', roles: null,                load: () => import('./cash_drawer.js') },
  '/statements':      { key: 'statements',      icon: '📒', roles: null,                load: () => import('./statements.js') },

  '/reports':         { key: 'reports',         icon: '📈', roles: null,                load: () => import('./reports.js') },
  '/tests':           { key: 'system_health',       icon: '🧪', roles: ['admin'],           load: () => import('./tests.js') },
  '/audit':           { key: 'audit',           icon: '🔍', roles: ['admin'],           load: () => import('./audit.js') },

  '/coa':             { key: 'chart_of_accounts',     icon: '📚', roles: null,                load: () => import('./chart_of_accounts.js') },
  '/journal':         { key: 'journal',               icon: '📔', roles: null,                load: () => import('./journal.js') },
  '/ledger':          { key: 'general_ledger',        icon: '📒', roles: null,                load: () => import('./general_ledger.js') },
  '/statements_fin':  { key: 'financial_statements',  icon: '📊', roles: null,                load: () => import('./financial_statements.js') },
  '/aging':           { key: 'aging_reports',         icon: '📅', roles: null,                load: () => import('./aging.js') },
  '/cash_flow':       { key: 'cash_flow_statement',   icon: '💧', roles: null,                load: () => import('./cash_flow.js') },
  '/branch_pnl':      { key: 'branch_pnl',            icon: '🏢', roles: null,                load: () => import('./branch_pnl.js') },

  '/inventory_count': { key: 'inventory_count',       icon: '📦', roles: ['admin','manager'], load: () => import('./inventory_count.js') },
  '/barcode_labels':  { key: 'barcode_labels',        icon: '🏷️', roles: null,                load: () => import('./barcode_labels.js') },
  '/employees':       { key: 'employees',             icon: '👥', roles: ['admin','manager'], load: () => import('./employees.js') },
  '/payroll':         { key: 'payroll',               icon: '💰', roles: ['admin','manager'], load: () => import('./payroll.js') },
  '/fixed_assets':    { key: 'fixed_assets',          icon: '🏛', roles: ['admin','manager'], load: () => import('./fixed_assets.js') },
  '/loyalty':         { key: 'loyalty_program',       icon: '🎟', roles: ['admin','manager'], load: () => import('./loyalty.js') },
  '/recurring':       { key: 'recurring_entries',     icon: '🔄', roles: ['admin'],           load: () => import('./recurring.js') },

  '/branches':        { key: 'branches',        icon: '🏢', roles: ['admin'],           load: () => import('./branches.js') },
  '/users':           { key: 'users',           icon: '👤', roles: ['admin'],           load: () => import('./users.js') },
  '/settings':        { key: 'settings',        icon: '⚙️', roles: ['admin'],           load: () => import('./settings.js') },
  '/currencies':      { key: 'currencies_title', icon: '💱', roles: null,                load: () => import('./currencies.js') },
  '/theme':           { key: 'theme_editor',    icon: '🎨', roles: null,                load: () => import('./theme_editor.js') },
  '/nav':             { key: 'nav_editor',      icon: '🧭', roles: null,                load: () => import('./nav_editor.js') },
  '/import':          { key: 'import',          icon: '📥', roles: ['admin','manager'], load: () => import('./import.js') },
  '/backup':          { key: 'backup',          icon: '💾', roles: ['admin'],           load: () => import('./backup.js') },
};
const DEFAULT_ROUTE = '/dashboard';

// ---------------------------------------------------------------------
// NAV GROUPS — international ERP standard grouping
// ---------------------------------------------------------------------
const NAV_GROUPS = [
  { id: 'overview', title_key: 'nav_group_overview', icon: '🏠', paths: ['/dashboard'] },
  { id: 'sales',    title_key: 'nav_group_sales',    icon: '💰', paths: ['/pos', '/sales', '/quotations', '/customers', '/customer_journey', '/returns', '/loyalty'] },
  { id: 'buying',   title_key: 'nav_group_buying',   icon: '🛒', paths: ['/purchases', '/purchase_orders', '/suppliers'] },
  { id: 'stock',    title_key: 'nav_group_stock',    icon: '📦', paths: ['/products', '/inventory', '/transfers', '/reorder', '/inventory_count', '/barcode_labels'] },
  { id: 'finance',  title_key: 'nav_group_finance',  icon: '💳', paths: ['/payments', '/expenses', '/cash_drawer', '/statements'] },
  { id: 'hr',         title_key: 'nav_group_hr',         icon: '👥', paths: ['/employees', '/payroll'] },
  { id: 'accounting', title_key: 'nav_group_accounting', icon: '📚', paths: ['/coa', '/journal', '/ledger', '/statements_fin', '/aging', '/cash_flow', '/branch_pnl', '/fixed_assets', '/recurring'] },
  { id: 'reports',  title_key: 'nav_group_reports',  icon: '📈', paths: ['/reports', '/audit'] },
  { id: 'admin',    title_key: 'nav_group_admin',    icon: '⚙️', paths: ['/branches', '/users', '/settings', '/currencies', '/theme', '/nav', '/import', '/backup', '/tests'] },
];

// ---------------------------------------------------------------------
let branches = [];
let currentBranchId = null;
let userPrefs = {};
let sidebarCollapsed = (() => { try { return localStorage.getItem('rios.sidebar.collapsed') === '1'; } catch { return false; } })();
let mobileOpen = false;

// ---------------------------------------------------------------------
(async function main() {
  document.title = CONFIG.APP_NAME;
  try { applyTheme(themeFromPrefs(cachedPrefs())); } catch {}
  installCommandPaletteShortcut();  // Phase 22: Cmd+K global shortcut
  await auth.init();
  auth.subscribe(async (s) => {
    if (!s.ready) return;
    if (s.isAuthenticated) {
      await loadBranches();
      await cacheCompanySettings();
      userPrefs = await loadPreferences();
      // If user has no saved theme in DB, clear old localStorage and apply dark default
      if (!userPrefs?.theme) {
        try { localStorage.removeItem('rios.prefs'); } catch {}
      }
      applyTheme(themeFromPrefs(userPrefs));
    }
    renderShell(s);
  });
  i18n.subscribe(() => { if (auth.state.ready) renderShell(auth.state); });
})();

async function cacheCompanySettings() {
  const { data, error } = await settingsApi.get();
  if (!error && data) {
    try { localStorage.setItem('rios.company', JSON.stringify(data)); } catch {}
  }
}

async function loadBranches() {
  const [brRes, curRes] = await Promise.all([
    branchesApi.list({ activeOnly: true }),
    branchesApi.getCurrent(),
  ]);
  branches = brRes.error ? [] : brRes.data;
  currentBranchId = curRes.error ? null : curRes.data;
  if (!currentBranchId && branches.length) currentBranchId = branches[0].id;
}

// ---------------------------------------------------------------------
// SHELL
// ---------------------------------------------------------------------
function renderShell(authState) {
  const root = $('#app');
  clear(root);
  if (!authState.isAuthenticated) { root.appendChild(renderLogin()); return; }

  root.classList.add('shell');
  root.classList.toggle('shell--collapsed', sidebarCollapsed);

  const topbar = renderTopbar(authState);
  const sidebar = renderSidebar(authState);
  const main = el('main', { class: 'main', id: 'main' });
  const backdrop = el('div', { class: 'mobile-backdrop', onclick: () => toggleMobile() });

  root.append(sidebar, topbar, main, backdrop);

  window.onhashchange = () => {
    if (mobileOpen) toggleMobile();
    routeTo(main, authState);
    updateActive();
  };
  routeTo(main, authState);
  updateActive();
}

function updateActive() {
  const path = (location.hash || '#' + DEFAULT_ROUTE).slice(1);
  for (const link of document.querySelectorAll('.side-link'))
    link.classList.toggle('side-link--active', link.dataset.path === path);
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  try { localStorage.setItem('rios.sidebar.collapsed', sidebarCollapsed ? '1' : '0'); } catch {}
  const root = $('#app');
  root.classList.toggle('shell--collapsed', sidebarCollapsed);
}

function toggleMobile() {
  mobileOpen = !mobileOpen;
  const root = $('#app');
  root.classList.toggle('shell--mobile-open', mobileOpen);
}

// ---------------------------------------------------------------------
// TOP BAR — brand, branch, user
// ---------------------------------------------------------------------
function renderTopbar(s) {
  const company = (() => {
    try { return JSON.parse(localStorage.getItem('rios.company') || '{}'); }
    catch { return {}; }
  })();

  const hamburger = el('button', { class: 'topbar__hamburger', onclick: () => toggleMobile(),
    title: 'Menu' }, '☰');
  const collapseBtn = el('button', { class: 'topbar__collapse', onclick: () => toggleSidebar(),
    title: sidebarCollapsed ? 'Expand' : 'Collapse' },
    sidebarCollapsed ? '▶' : '◀');

  const brand = el('div', { class: 'topbar__brand' }, [
    company.logo_url ? el('img', { src: company.logo_url, class: 'topbar__logo' }) : '',
    el('strong', {}, company.name || t('app_name')),
  ].filter(Boolean));

  // Branch selector
  const branchArea = el('div', { class: 'topbar__branch' });
  if (branches.length > 1) {
    const branchSel = el('select', { class: 'branch-select',
      onchange: async (e) => {
        const { error } = await branchesApi.setCurrent(e.target.value);
        if (error) return toast(error.message, 'error');
        toast('🏢 ' + t('switch_branch') + ' ✓', 'success');
        setTimeout(() => window.location.reload(), 400);
      } }, branches.map((b) => el('option', { value: b.id }, `🏢 ${b.code} — ${b.name}`)));
    if (currentBranchId) branchSel.value = currentBranchId;
    branchArea.appendChild(branchSel);
  } else if (branches.length === 1) {
    branchArea.appendChild(el('span', { class: 'branch-label' }, `🏢 ${branches[0].name}`));
  }

  const langBtn = el('button', { class: 'topbar__lang', onclick: () => i18n.toggle(),
    title: t('switch_lang') || 'Language' }, i18n.lang === 'ar' ? 'EN' : 'ع');

  const user = el('div', { class: 'topbar__user' }, [
    el('span', { class: `topbar__role topbar__role--${s.role}` }, s.role || '—'),
    el('span', { class: 'topbar__email' }, s.profile?.email || ''),
    el('button', { class: 'btn btn--ghost topbar__logout',
      onclick: () => auth.signOut(), title: t('sign_out') }, '⇥'),
  ]);

  // Phase 22: Global search button (Cmd+K)
  const searchBtn = el('button', {
    class: 'topbar__search',
    onclick: () => openCommandPalette(),
    title: 'Search (Ctrl+K / Cmd+K)',
  }, [
    el('span', {}, '🔍'),
    el('span', { class: 'topbar__search-text' }, i18n.lang === 'ar' ? 'ابحث...' : 'Search...'),
    el('span', { class: 'topbar__search-kbd' }, '⌘K'),
  ]);

  return el('header', { class: 'topbar' }, [
    hamburger, collapseBtn, brand,
    searchBtn,
    el('div', { class: 'topbar__spacer' }),
    branchArea, langBtn, user,
  ]);
}

// ---------------------------------------------------------------------
// SIDEBAR — grouped navigation
// ---------------------------------------------------------------------
function renderSidebar(s) {
  const order = userPrefs.nav?.order || Object.keys(VIEWS);
  const hidden = new Set(userPrefs.nav?.hidden || []);
  const allowed = (path) => {
    const v = VIEWS[path];
    if (!v) return false;
    if (v.roles && !v.roles.includes(s.role)) return false;
    if (hidden.has(path)) return false;
    return true;
  };

  const collapsedState = (() => { try { return JSON.parse(localStorage.getItem('rios.groups') || '{}'); } catch { return {}; } })();

  const sidebar = el('aside', { class: 'sidebar' });

  for (const group of NAV_GROUPS) {
    const items = group.paths.filter(allowed);
    if (!items.length) continue;

    const isCollapsed = !!collapsedState[group.id];
    const groupEl = el('div', { class: 'side-group' + (isCollapsed ? ' side-group--collapsed' : '') });

    const header = el('button', {
      class: 'side-group__header',
      onclick: () => {
        collapsedState[group.id] = !collapsedState[group.id];
        try { localStorage.setItem('rios.groups', JSON.stringify(collapsedState)); } catch {}
        groupEl.classList.toggle('side-group--collapsed');
      },
    }, [
      el('span', { class: 'side-group__icon' }, group.icon),
      el('span', { class: 'side-group__title' }, t(group.title_key)),
      el('span', { class: 'side-group__chevron' }, '▾'),
    ]);
    groupEl.appendChild(header);

    // Phase 19: filter by permission
    const allowedItems = items.filter((path) => {
      const permKey = ROUTE_PERMS[path];
      if (permKey && !hasPermission(permKey)) return false;
      return true;
    });
    if (!allowedItems.length) continue;  // skip empty groups

    const list = el('nav', { class: 'side-list' });
    for (const path of allowedItems) {
      const v = VIEWS[path];
      const link = el('a', {
        href: '#' + path, class: 'side-link', 'data-path': path,
        title: t(v.key),
      }, [
        el('span', { class: 'side-link__icon' }, v.icon || '•'),
        el('span', { class: 'side-link__label' }, t(v.key)),
      ]);
      list.appendChild(link);
    }
    groupEl.appendChild(list);
    sidebar.appendChild(groupEl);
  }

  return sidebar;
}

// ---------------------------------------------------------------------
async function routeTo(main, authState) {
  // master_admin belongs in /master panel — redirect immediately
  if (authState.role === 'master_admin') {
    window.location.href = '/master';
    return;
  }

  const path = (location.hash || '#' + DEFAULT_ROUTE).slice(1);
  const view = VIEWS[path];
  if (!view) { location.hash = '#' + DEFAULT_ROUTE; return; }
  // Phase 19: check granular permission (admin bypasses all)
  const permKey = ROUTE_PERMS[path];
  if (permKey && !hasPermission(permKey)) {
    clear(main); main.appendChild(el('div', { class: 'state state--error' }, t('permission_denied'))); return;
  }
  if (view.roles && !view.roles.includes(authState.role)) {
    clear(main); main.appendChild(el('div', { class: 'state state--error' }, t('permission_denied'))); return;
  }
  clear(main);
  main.appendChild(el('div', { class: 'state' }, t('loading')));
  try {
    const mod = await view.load();
    await mod.render(main);
  } catch (err) {
    console.error(err);
    clear(main);
    main.appendChild(el('div', { class: 'state state--error' }, t('something_wrong') + ' ' + (err?.message || err)));
  }
}

// ---------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------
function renderLogin() {
  const emailIn = el('input', { type: 'email', class: 'input', required: true, autocomplete: 'email' });
  const passIn = el('input', { type: 'password', class: 'input', required: true, autocomplete: 'current-password' });
  const errBox = el('div', { class: 'form-error', hidden: true });
  const btn = el('button', { type: 'submit', class: 'btn btn--primary' }, t('sign_in'));
  const langBtn = el('button', { type: 'button', class: 'lang-toggle',
    onclick: () => i18n.toggle() }, i18n.lang === 'ar' ? 'EN' : 'عربي');
  const form = el('form', {
    class: 'login__form',
    onsubmit: async (e) => {
      e.preventDefault();
      errBox.hidden = true; btn.disabled = true; btn.textContent = t('signing_in');
      const { error } = await auth.signIn(emailIn.value.trim(), passIn.value);
      btn.disabled = false; btn.textContent = t('sign_in');
      if (error) { errBox.textContent = error.message || t('something_wrong'); errBox.hidden = false; return; }
      toast(t('sign_in') + ' ✓', 'success');
    },
  }, [
    el('div', { class: 'lang-row' }, langBtn),
    el('h1', {}, t('app_name')),
    el('p', { class: 'muted' }, t('sign_in_subtitle')),
    el('label', { class: 'form__field' }, [el('span', { class: 'form__label' }, t('email')), emailIn]),
    el('label', { class: 'form__field' }, [el('span', { class: 'form__label' }, t('password')), passIn]),
    errBox, btn,
    el('p', { class: 'muted small' }, t('accounts_admin_only')),
  ]);
  return el('div', { class: 'login' }, el('div', { class: 'login__card' }, form));
}
