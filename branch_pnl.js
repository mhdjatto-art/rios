// frontend/branch_pnl.js  (Phase 14)
import { accountingApi } from './api.js';
import { t } from './i18n.js';
import { el, clear, renderLoading, renderError, renderEmpty, money } from './utils.js';
import { printReport } from './print_templates.js';
import { exportCSV } from './export.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, '🏢 ' + t('branch_pnl')));

  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const fromIn = el('input', { type: 'date', class: 'input', value: yearStart.toISOString().slice(0, 10) });
  const toIn = el('input', { type: 'date', class: 'input', value: today.toISOString().slice(0, 10) });

  let _rows = [];

  function printIt() {
    printReport({
      title: t('branch_pnl'),
      subtitle: fromIn.value + ' → ' + toIn.value,
      columns: [
        { key: 'branch_name', label: t('branch') },
        { key: 'revenue', label: t('revenue'), numeric: true, render: (r) => money(r.revenue) },
        { key: 'expenses', label: t('expenses'), numeric: true, render: (r) => money(r.expenses) },
        { key: 'net_income', label: t('net_income'), numeric: true, render: (r) => money(r.net_income) },
      ],
      rows: _rows,
    });
  }
  function exportIt() { exportCSV(_rows, 'branch_pnl'); }

  host.append(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
    el('label', {}, [t('period_from') + ':', fromIn]),
    el('label', {}, [t('period_to') + ':', toIn]),
    el('button', { class: 'btn btn--primary', onclick: refresh }, '🔍 ' + t('show')),
    el('button', { class: 'btn btn--ghost', onclick: printIt }, '🖨 ' + t('print')),
    el('button', { class: 'btn btn--ghost', onclick: exportIt }, '📥 CSV'),
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  await refresh();

  async function refresh() {
    renderLoading(card);
    const { data, error } = await accountingApi.branchPnl(fromIn.value, toIn.value);
    _rows = data || [];
    if (error) return renderError(card, error);
    if (!data.length) return renderEmpty(card, t('no_branch_activity'));

    clear(card);

    let totalRev = 0, totalExp = 0;
    for (const r of data) { totalRev += Number(r.revenue || 0); totalExp += Number(r.expenses || 0); }
    const totalNet = totalRev - totalExp;

    card.appendChild(el('div', { class: 'kpi-row', style: 'margin-bottom:16px' }, [
      el('div', { class: 'kpi' }, [
        el('div', { class: 'kpi__label' }, t('total_revenue')),
        el('div', { class: 'kpi__value pos' }, money(totalRev)),
      ]),
      el('div', { class: 'kpi' }, [
        el('div', { class: 'kpi__label' }, t('total_expenses')),
        el('div', { class: 'kpi__value neg' }, money(totalExp)),
      ]),
      el('div', { class: 'kpi kpi--success' }, [
        el('div', { class: 'kpi__label' }, t('total') + ' ' + t('net_income')),
        el('div', { class: 'kpi__value ' + (totalNet >= 0 ? 'pos' : 'neg') }, money(totalNet)),
      ]),
    ]));

    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '🏢 ' + t('branch')),
        el('th', { class: 'num' }, t('revenue')),
        el('th', { class: 'num' }, t('expenses')),
        el('th', { class: 'num strong' }, t('net_income')),
        el('th', { class: 'num' }, '%'),
      ])),
      el('tbody', {}, data.map((r) => {
        const net = Number(r.net_income || 0);
        const share = totalRev > 0 ? (Number(r.revenue || 0) / totalRev * 100).toFixed(1) + '%' : '—';
        return el('tr', {}, [
          el('td', { class: 'strong' }, r.branch_name),
          el('td', { class: 'num pos' }, money(r.revenue)),
          el('td', { class: 'num neg' }, money(r.expenses)),
          el('td', { class: 'num strong ' + (net >= 0 ? 'pos' : 'neg') }, money(net)),
          el('td', { class: 'num muted' }, share),
        ]);
      })),
    ]));
  }
}
