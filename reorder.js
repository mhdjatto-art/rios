// frontend/reorder.js  (Phase 8 — debug + null-safe)
import { reorderApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import { el, clear, toast, renderLoading, renderError, renderEmpty, qty } from './utils.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, t('reorder')));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  async function refresh() {
    renderLoading(card);
    const { data, error } = await reorderApi.list();
    if (error) return renderError(card, error);

    // Filter out COMPLETELY empty rows (where even sku is null)
    const rows = (data || []).filter((r) => r && (r.sku || r.name || r.product_id));

    if (!rows.length) return renderEmpty(card, '🎉 ' + t('no_reorder'));

    clear(card);

    // Header strip with count
    card.appendChild(el('div', {
      style: 'padding:12px; background: var(--rios-surface2); border-radius:6px; margin-bottom:12px; font-weight:500',
    }, `⚠️ ${rows.length} ` + (t('products_need_reorder') || 'products need reordering')));

    // Actions
    const actions = el('div', { style: 'margin-bottom:12px; display:flex; gap:8px' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => exportCSV(rows) }, '📋 CSV'),
    ]);
    card.appendChild(actions);

    // Table with explicit row heights
    const table = el('table', {
      class: 'table',
      style: 'width:100%; border-collapse: collapse; table-layout: auto',
    });
    table.appendChild(el('thead', {}, el('tr', {}, [
      el('th', { style: 'text-align:start; padding:8px' }, t('sku') || 'SKU'),
      el('th', { style: 'text-align:start; padding:8px' }, t('name') || 'Name'),
      el('th', { style: 'text-align:start; padding:8px' }, t('brand') || 'Brand'),
      el('th', { style: 'text-align:end; padding:8px' }, t('stock') || 'Stock'),
      el('th', { style: 'text-align:end; padding:8px' }, t('reorder_level') || 'Level'),
      el('th', { style: 'text-align:end; padding:8px' }, t('reorder_qty') || 'Reorder'),
      el('th', { style: 'text-align:end; padding:8px' }, t('suggested_order') || 'Suggest'),
    ])));

    const tbody = el('tbody', {});
    for (const r of rows) {
      const stock = Number(r.current_stock || 0);
      tbody.appendChild(el('tr', { style: 'border-top:1px solid var(--rios-border)' }, [
        el('td', { style: 'padding:8px', class: 'mono' }, r.sku || '—'),
        el('td', { style: 'padding:8px' }, r.name || '—'),
        el('td', { style: 'padding:8px' }, r.brand || '—'),
        el('td', { style: 'padding:8px; text-align:end; color:' + (stock <= 0 ? 'var(--rios-danger,#dc2626)' : 'inherit') },
          qty(stock)),
        el('td', { style: 'padding:8px; text-align:end' }, qty(r.reorder_level || 0)),
        el('td', { style: 'padding:8px; text-align:end' }, qty(r.reorder_qty || 0)),
        el('td', { style: 'padding:8px; text-align:end; font-weight:600; color: var(--rios-success,#16a34a)' },
          qty(r.suggested_order_qty || 0)),
      ]));
    }
    table.appendChild(tbody);
    card.appendChild(table);
  }

  await refresh();

  function exportCSV(rows) {
    const header = 'sku,name,brand,current_stock,suggested_order_qty\n';
    const body = rows.map((r) =>
      `"${r.sku || ''}","${r.name || ''}","${r.brand || ''}",${r.current_stock || 0},${r.suggested_order_qty || 0}`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'reorder_list.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('✓', 'success');
  }
}
