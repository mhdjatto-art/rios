// frontend/aging.js  (Phase 14)
import { accountingApi } from './api.js';
import { t } from './i18n.js';
import { el, clear, renderLoading, renderError, renderEmpty, money } from './utils.js';
import { printReport } from './print_templates.js';
import { exportCSV } from './export.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, '📅 ' + t('aging_reports')));

  let activeTab = 'ar';
  const tabBar = el('div', { class: 'pos__mode-bar', style: 'max-width:500px; margin-bottom:16px' });
  host.appendChild(tabBar);

  function renderTabs() {
    clear(tabBar);
    for (const tab of ['ar', 'ap']) {
      tabBar.appendChild(el('button', {
        type: 'button',
        class: 'pos__mode-btn ' + (activeTab === tab ? 'pos__mode-btn--active' : ''),
        onclick: () => { activeTab = tab; renderTabs(); renderActive(); },
      }, tab === 'ar' ? '💰 ' + t('ar_aging') : '💳 ' + t('ap_aging')));
    }
  }

  const toolbar = el('div', { class: 'toolbar', style: 'margin-bottom:8px' }, [
    el('div', { class: 'toolbar__spacer' }),
    el('button', { class: 'btn btn--ghost', onclick: () => printActive() }, '🖨 ' + t('print')),
    el('button', { class: 'btn btn--ghost', onclick: () => exportActive() }, '📥 CSV'),
  ]);
  host.appendChild(toolbar);

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  let _currentRows = [];
  let _currentTitle = '';

  async function printActive() {
    const isAr = activeTab === 'ar';
    printReport({
      title: isAr ? t('ar_aging') : t('ap_aging'),
      subtitle: new Date().toLocaleDateString(),
      columns: [
        { key: 'name', label: isAr ? t('customer') : t('supplier') },
        { key: 'phone', label: t('phone') },
        { key: 'current_0_30', label: t('current'), numeric: true, render: (r) => money(r.current_0_30) },
        { key: 'days_31_60', label: '31-60', numeric: true, render: (r) => money(r.days_31_60) },
        { key: 'days_61_90', label: '61-90', numeric: true, render: (r) => money(r.days_61_90) },
        { key: 'days_over_90', label: '>90', numeric: true, render: (r) => money(r.days_over_90) },
        { key: 'total_outstanding', label: t('total'), numeric: true, render: (r) => money(r.total_outstanding) },
      ],
      rows: _currentRows.map((r) => ({ ...r, name: r.customer_name || r.supplier_name })),
    });
  }

  function exportActive() {
    exportCSV(_currentRows, activeTab + '_aging');
  }

  renderTabs();
  renderActive();

  async function renderActive() {
    renderLoading(card);
    const res = activeTab === 'ar' ? await accountingApi.arAging() : await accountingApi.apAging();
    if (res.error) return renderError(card, res.error);
    if (!res.data.length) return renderEmpty(card, activeTab === 'ar' ? t('no_receivables') : t('no_payables'));

    _currentRows = res.data;
    const nameField = activeTab === 'ar' ? 'customer_name' : 'supplier_name';
    const totals = { current: 0, d31: 0, d61: 0, d91: 0, all: 0 };
    for (const r of res.data) {
      totals.current += Number(r.current_0_30 || 0);
      totals.d31 += Number(r.days_31_60 || 0);
      totals.d61 += Number(r.days_61_90 || 0);
      totals.d91 += Number(r.days_over_90 || 0);
      totals.all += Number(r.total_outstanding || 0);
    }

    clear(card);

    // KPI summary
    card.appendChild(el('div', { class: 'kpi-row', style: 'margin-bottom:12px' }, [
      kpiCard(t('current'), totals.current, 'success'),
      kpiCard('31-60 ' + t('days'), totals.d31, ''),
      kpiCard('61-90 ' + t('days'), totals.d61, 'warn'),
      kpiCard('> 90 ' + t('days'), totals.d91, 'danger'),
      kpiCard(t('total'), totals.all, 'primary'),
    ]));

    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, activeTab === 'ar' ? t('customer') : t('supplier')),
        el('th', {}, t('phone')),
        el('th', { class: 'num' }, t('current')),
        el('th', { class: 'num' }, '31-60'),
        el('th', { class: 'num' }, '61-90'),
        el('th', { class: 'num' }, '> 90'),
        el('th', { class: 'num strong' }, t('total')),
        el('th', { class: 'num' }, t('invoices')),
      ])),
      el('tbody', {}, res.data.map((r) => el('tr', {}, [
        el('td', {}, r[nameField]),
        el('td', {}, r.phone || '—'),
        el('td', { class: 'num' }, money(r.current_0_30)),
        el('td', { class: 'num' }, money(r.days_31_60)),
        el('td', { class: 'num' + (Number(r.days_61_90) > 0 ? ' neg' : '') }, money(r.days_61_90)),
        el('td', { class: 'num' + (Number(r.days_over_90) > 0 ? ' neg strong' : '') }, money(r.days_over_90)),
        el('td', { class: 'num strong' }, money(r.total_outstanding)),
        el('td', { class: 'num' }, r.invoice_count),
      ]))),
    ]));
  }

  function kpiCard(label, value, tone = '') {
    const toneClass = tone === 'danger' ? 'neg' : tone === 'warn' ? '' : tone === 'success' ? 'pos' : '';
    return el('div', { class: 'kpi' }, [
      el('div', { class: 'kpi__label' }, label),
      el('div', { class: 'kpi__value ' + toneClass }, money(value)),
    ]);
  }
}
