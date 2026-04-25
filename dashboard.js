// frontend/dashboard.js  (Phase 19 — dedup fix)
import { loadPreferences, savePreferences } from './theme.js';
import { reorderApi } from './api.js';
import { t } from './i18n.js';
import { el, clear, toast, renderLoading, renderError, errMsg } from './utils.js';
import { WIDGET_CATALOG, DEFAULT_DASHBOARD, renderWidget } from './widgets.js';

export async function render(host) {
  clear(host);
  const prefs = await loadPreferences();
  // Phase 19: dedupe + ensure unique IDs
  let widgets = (prefs.dashboard?.widgets?.length ? prefs.dashboard.widgets : DEFAULT_DASHBOARD).slice();
  const seen = new Set();
  widgets = widgets.map((w, i) => {
    let id = w.id || `w${i+1}`;
    while (seen.has(id)) id = `${id}_${Math.random().toString(36).slice(2,6)}`;
    seen.add(id);
    return { ...w, id };
  });
  const keySet = new Set();
  widgets = widgets.filter((w) => {
    const key = `${w.type}:${w.source}:${w.field || ''}:${w.chart_config || ''}`;
    if (keySet.has(key)) return false;
    keySet.add(key);
    return true;
  });
  let editMode = false;

  const header = el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('dashboard')),
    el('div', { class: 'toolbar__spacer' }),
  ]);
  host.appendChild(header);

  const editBtn = el('button', { class: 'btn btn--ghost',
    onclick: () => { editMode = !editMode; renderAll(); } }, '✏️ ' + t('edit'));
  const addBtn = el('button', { class: 'btn btn--primary',
    onclick: () => openCatalog() }, '+ ' + t('add_widget'));
  const saveBtn = el('button', { class: 'btn btn--primary',
    onclick: saveLayout }, '💾 ' + t('save'));
  const resetBtn = el('button', { class: 'btn btn--danger',
    onclick: () => { if (confirm(t('reset_confirm'))) { widgets = DEFAULT_DASHBOARD.slice(); renderAll(); } } }, '↺ ' + t('reset'));

  const alertHost = el('div');
  host.appendChild(alertHost);
  (async () => {
    const rc = await reorderApi.count();
    if (!rc.error && rc.data > 0) {
      alertHost.appendChild(el('div', {
        class: 'state',
        style: 'cursor:pointer; background:#fef3c7; border:1px solid #f59e0b; color:#92400e; margin-bottom:12px; padding:12px; border-radius:6px; font-weight:600',
        onclick: () => location.hash = '#/reorder',
      }, `⚠️ ${t('reorder_alert', { n: rc.data })} — ${t('view')} →`));
    }
  })();

  const gridHost = el('div', { class: 'dash-grid' });
  host.appendChild(gridHost);

  renderAll();

  function renderAll() {
    clear(header);
    header.appendChild(el('h1', { class: 'view-title' }, t('dashboard') + (editMode ? ' • ' + t('edit_mode') : '')));
    header.appendChild(el('div', { class: 'toolbar__spacer' }));
    if (editMode) {
      header.append(addBtn, saveBtn);
    }
    header.appendChild(resetBtn);
    header.appendChild(editBtn);
    editBtn.textContent = editMode ? '👁️ ' + t('view_mode') : '✏️ ' + t('edit');

    clear(gridHost);
    widgets.forEach((w, idx) => {
      const cell = el('div', { class: 'dash-cell', draggable: editMode ? 'true' : 'false' });

      if (editMode) {
        const overlay = el('div', { class: 'dash-edit-overlay' }, [
          el('button', { class: 'btn btn--ghost', onclick: () => moveWidget(idx, -1), title: 'Move up/left' }, '◀'),
          el('button', { class: 'btn btn--ghost', onclick: () => moveWidget(idx, +1), title: 'Move down/right' }, '▶'),
          el('button', { class: 'btn btn--danger', onclick: () => removeWidget(idx), title: 'Remove' }, '×'),
        ]);
        cell.appendChild(overlay);
        cell.classList.add('dash-cell--edit');

        cell.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(idx)); cell.classList.add('dragging'); });
        cell.addEventListener('dragend', () => cell.classList.remove('dragging'));
        cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', (e) => {
          e.preventDefault();
          cell.classList.remove('drag-over');
          const srcIdx = Number(e.dataTransfer.getData('text/plain'));
          if (!isNaN(srcIdx) && srcIdx !== idx) {
            const [moved] = widgets.splice(srcIdx, 1);
            widgets.splice(idx, 0, moved);
            renderAll();
          }
        });
      }

      const content = el('div', { class: 'dash-content' });
      cell.appendChild(content);
      renderWidget(w, content);

      gridHost.appendChild(cell);
    });
  }

  function moveWidget(idx, delta) {
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= widgets.length) return;
    const [moved] = widgets.splice(idx, 1);
    widgets.splice(newIdx, 0, moved);
    renderAll();
  }

  function removeWidget(idx) {
    if (!confirm(t('confirm_delete'))) return;
    widgets.splice(idx, 1);
    renderAll();
  }

  async function saveLayout() {
    const newPrefs = { ...prefs, dashboard: { widgets } };
    const { error } = await savePreferences(newPrefs);
    if (error) return toast(errMsg(error), 'error');
    toast('✅ ' + t('save_changes'), 'success');
    editMode = false;
    renderAll();
  }

  function openCatalog() {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('h2', {}, '+ ' + t('add_widget')));
    const catalogGrid = el('div', { class: 'widget-catalog' });
    WIDGET_CATALOG.forEach((w) => {
      const card = el('button', {
        type: 'button',
        class: 'widget-catalog-card',
        onclick: () => {
          widgets.push({ id: 'w_' + Math.random().toString(36).slice(2, 8), ...w });
          dlg.close();
          renderAll();
        },
      }, [
        el('div', { style: 'font-size: 28px' }, w.icon),
        el('div', { class: 'strong' }, t(w.title_key)),
        el('div', { class: 'muted small' }, w.type),
      ]);
      catalogGrid.appendChild(card);
    });
    dlg.appendChild(catalogGrid);
    dlg.appendChild(el('div', { class: 'form__actions' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => dlg.close() }, t('close')),
    ]));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
}
