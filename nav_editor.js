// frontend/nav_editor.js  (Phase 9)
import { loadPreferences, savePreferences } from './theme.js';
import { t } from './i18n.js';
import { el, clear, toast, errMsg } from './utils.js';

// This must be kept in sync with app.js VIEWS keys.
const ALL_ITEMS = [
  '/dashboard', '/pos', '/products', '/purchases', '/sales', '/quotations',
  '/purchase_orders', '/payments', '/returns', '/transfers', '/expenses',
  '/cash_drawer', '/statements', '/reports', '/reorder', '/inventory',
  '/customers', '/suppliers', '/branches', '/import', '/backup', '/audit',
  '/settings', '/theme', '/nav', '/users',
];

const KEYS = {
  '/dashboard': 'dashboard', '/pos': 'pos', '/products': 'products',
  '/purchases': 'purchases', '/sales': 'sales', '/quotations': 'quotations',
  '/purchase_orders': 'purchase_orders', '/payments': 'payments',
  '/returns': 'returns', '/transfers': 'transfers', '/expenses': 'expenses',
  '/cash_drawer': 'cash_drawer', '/statements': 'statements',
  '/reports': 'reports', '/reorder': 'reorder', '/inventory': 'inventory',
  '/customers': 'customers', '/suppliers': 'suppliers', '/branches': 'branches',
  '/import': 'import', '/backup': 'backup', '/audit': 'audit',
  '/settings': 'settings', '/theme': 'theme_editor', '/nav': 'nav_editor', '/users': 'users',
};

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, '🧭 ' + t('nav_editor')));
  host.appendChild(el('p', { class: 'muted' }, t('nav_editor_hint')));

  const prefs = await loadPreferences();
  let order = prefs.nav?.order || ALL_ITEMS.slice();
  let hidden = new Set(prefs.nav?.hidden || []);

  // Include missing items at the end
  for (const it of ALL_ITEMS) if (!order.includes(it)) order.push(it);
  // Remove no-longer-existing items
  order = order.filter((p) => ALL_ITEMS.includes(p));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  function renderList() {
    clear(card);
    const list = el('ul', { class: 'nav-editor-list' });
    order.forEach((path, idx) => {
      const isHidden = hidden.has(path);
      const li = el('li', {
        class: 'nav-editor-item' + (isHidden ? ' nav-editor-item--hidden' : ''),
        draggable: 'true',
      }, [
        el('span', { class: 'drag-handle' }, '☰'),
        el('span', { style: 'flex:1; font-weight:600' }, t(KEYS[path]) + ` (${path})`),
        el('button', { class: 'btn btn--ghost', onclick: () => moveItem(idx, -1), title: 'Up' }, '↑'),
        el('button', { class: 'btn btn--ghost', onclick: () => moveItem(idx, +1), title: 'Down' }, '↓'),
        el('button', {
          class: 'btn ' + (isHidden ? 'btn--ghost' : 'btn--danger'),
          onclick: () => toggleHide(path),
        }, isHidden ? '👁️ ' + t('show') : '🚫 ' + t('hide')),
      ]);

      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(idx));
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        const srcIdx = Number(e.dataTransfer.getData('text/plain'));
        if (!isNaN(srcIdx) && srcIdx !== idx) {
          const [moved] = order.splice(srcIdx, 1);
          order.splice(idx, 0, moved);
          renderList();
        }
      });
      list.appendChild(li);
    });
    card.appendChild(list);

    card.appendChild(el('div', { class: 'form__actions', style: 'margin-top:16px' }, [
      el('button', { class: 'btn btn--primary', onclick: saveNav }, '💾 ' + t('save')),
      el('button', { class: 'btn btn--ghost',
        onclick: () => { if (confirm(t('reset_confirm'))) { order = ALL_ITEMS.slice(); hidden = new Set(); renderList(); } } }, '↺ ' + t('reset')),
    ]));
  }

  function moveItem(idx, delta) {
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= order.length) return;
    const [moved] = order.splice(idx, 1);
    order.splice(newIdx, 0, moved);
    renderList();
  }
  function toggleHide(path) {
    if (hidden.has(path)) hidden.delete(path); else hidden.add(path);
    renderList();
  }
  async function saveNav() {
    const newPrefs = { ...prefs, nav: { order, hidden: [...hidden] } };
    const { error } = await savePreferences(newPrefs);
    if (error) return toast(errMsg(error), 'error');
    toast('✅ ' + t('save_changes') + ' — ' + t('reload_to_apply'), 'success');
    setTimeout(() => window.location.reload(), 1200);
  }
  renderList();
}
