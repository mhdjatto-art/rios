// frontend/audit.js  (Phase 5)
import { auditApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import { el, clear, renderLoading, renderError, renderEmpty, fmtDate } from './utils.js';

const TABLES = ['products', 'customers', 'suppliers', 'purchases', 'sales', 'expenses', 'returns', 'quotations', 'purchase_orders'];

export async function render(host) {
  clear(host);
  if (!auth.state.isAdmin) {
    host.appendChild(el('div', { class: 'state state--error' }, t('permission_denied')));
    return;
  }
  host.appendChild(el('h1', { class: 'view-title' }, t('audit_title')));

  const tableSel = el('select', { class: 'input' }, [
    el('option', { value: '' }, t('all_statuses')),
    ...TABLES.map((tbl) => el('option', { value: tbl }, tbl)),
  ]);
  host.appendChild(el('div', { class: 'toolbar' }, [
    el('label', {}, t('audit_table') + ': '), tableSel,
  ]));

  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  async function refresh() {
    renderLoading(tableHost);
    const { data, error } = await auditApi.list({ table: tableSel.value || null, limit: 300 });
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_audit'));

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('audit_time')),
        el('th', {}, t('audit_user')),
        el('th', {}, t('audit_table')),
        el('th', {}, t('audit_operation')),
        el('th', {}, t('audit_record')),
        el('th', {}, t('actions')),
      ])),
      el('tbody', {}, data.map((r) => {
        const opColor = r.operation === 'INSERT' ? 'pill--ok' :
          r.operation === 'DELETE' ? 'pill--danger' : 'pill--warn';
        return el('tr', {}, [
          el('td', {}, new Date(r.changed_at).toLocaleString()),
          el('td', {}, r.user_email || '—'),
          el('td', { class: 'mono' }, r.table_name),
          el('td', {}, el('span', { class: `pill ${opColor}` }, r.operation)),
          el('td', { class: 'mono', style: 'font-size:11px; word-break:break-all' }, r.record_id || '—'),
          el('td', {}, el('button', { class: 'btn btn--ghost', onclick: () => showDiff(r) }, t('show_diff'))),
        ]);
      })),
    ]));
  }

  tableSel.addEventListener('change', refresh);
  await refresh();

  function showDiff(row) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('h2', {}, `${row.table_name} / ${row.operation}`));
    dlg.appendChild(el('p', { class: 'muted' }, `${new Date(row.changed_at).toLocaleString()} • ${row.user_email || '?'}`));
    const beforeBox = el('pre', { style: 'background:#fef5f5; padding:12px; border-radius:6px; overflow:auto; max-height:300px; font-size:11px' },
      JSON.stringify(row.old_data || '—', null, 2));
    const afterBox = el('pre', { style: 'background:#eefaf0; padding:12px; border-radius:6px; overflow:auto; max-height:300px; font-size:11px' },
      JSON.stringify(row.new_data || '—', null, 2));
    dlg.appendChild(el('div', { class: 'grid-2' }, [
      el('div', {}, [el('h4', {}, t('audit_before')), beforeBox]),
      el('div', {}, [el('h4', {}, t('audit_after')), afterBox]),
    ]));
    dlg.appendChild(el('div', { class: 'form__actions' }, [
      el('button', { class: 'btn btn--primary', onclick: () => dlg.close() }, t('close')),
    ]));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
}
