// frontend/cash_flow.js  (Phase 14)
import { accountingApi } from './api.js';
import { t } from './i18n.js';
import { el, clear, renderLoading, renderError, money } from './utils.js';
import { printReport } from './print_templates.js';
import { exportCSV } from './export.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, '💧 ' + t('cash_flow_statement')));

  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const fromIn = el('input', { type: 'date', class: 'input', value: yearStart.toISOString().slice(0, 10) });
  const toIn = el('input', { type: 'date', class: 'input', value: today.toISOString().slice(0, 10) });

  host.append(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
    el('label', {}, [t('period_from') + ':', fromIn]),
    el('label', {}, [t('period_to') + ':', toIn]),
    el('button', { class: 'btn btn--primary', onclick: refresh }, '🔍 ' + t('show')),
    el('button', { class: 'btn btn--ghost', onclick: printIt }, '🖨 ' + t('print')),
    el('button', { class: 'btn btn--ghost', onclick: exportIt }, '📥 CSV'),
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  let _rows = [];
  function printIt() {
    printReport({
      title: t('cash_flow_statement'),
      subtitle: fromIn.value + ' → ' + toIn.value,
      columns: [
        { key: 'category', label: t('category') },
        { key: 'description', label: t('description') },
        { key: 'amount', label: t('amount'), numeric: true, render: (r) => money(r.amount) },
      ],
      rows: _rows,
    });
  }
  function exportIt() { exportCSV(_rows, 'cash_flow'); }

  await refresh();

  async function refresh() {
    renderLoading(card);
    const { data, error } = await accountingApi.cashFlow(fromIn.value, toIn.value);
    _rows = data || [];
    if (error) return renderError(card, error);

    let totalOperating = 0;
    for (const r of data) {
      if (r.category === 'operating') totalOperating += Number(r.amount || 0);
    }

    clear(card);
    card.appendChild(el('h3', {}, '💵 ' + t('cash_flow_summary')));
    card.appendChild(el('p', { class: 'muted' },
      t('period') + ': ' + fromIn.value + ' → ' + toIn.value));

    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('category')),
        el('th', {}, t('description')),
        el('th', { class: 'num strong' }, t('amount')),
      ])),
      el('tbody', {}, data.length ? data.map((r) => el('tr', {}, [
        el('td', {}, el('span', { class: 'pill pill--info' }, t(r.category))),
        el('td', {}, r.description),
        el('td', { class: 'num strong ' + (Number(r.amount) >= 0 ? 'pos' : 'neg') }, money(r.amount)),
      ])) : [el('tr', {}, el('td', { colspan: 3, class: 'muted', style: 'text-align:center; padding:20px' }, t('no_data')))]),
      el('tfoot', {}, el('tr', {}, [
        el('td', { colspan: 2, class: 'strong' }, '💰 ' + t('net_cash_operating')),
        el('td', { class: 'num strong ' + (totalOperating >= 0 ? 'pos' : 'neg') }, money(totalOperating)),
      ])),
    ]));

    // Explanation
    card.appendChild(el('div', { class: 'muted', style: 'margin-top:20px; padding:12px; background:var(--rios-surface2); border-radius:var(--rios-radius)' }, [
      el('strong', {}, '📖 ' + t('how_to_read') + ':'),
      el('ul', { style: 'margin:8px 0 0; padding-inline-start:20px' }, [
        el('li', {}, '✅ ' + t('cash_inflow_desc')),
        el('li', {}, '❌ ' + t('cash_outflow_desc')),
      ]),
    ]));
  }
}
