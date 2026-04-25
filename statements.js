// frontend/statements.js  (Phase 4)
import { customersApi, suppliersApi, statementsApi } from './api.js';
import { t } from './i18n.js';
import {
  el, clear, renderLoading, renderError, renderEmpty, money, fmtDate,
} from './utils.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, t('statements')));

  const tabBar = el('div', { class: 'toolbar' });
  const tab1 = el('button', { class: 'btn btn--primary', onclick: () => switchTab('customer') }, t('customer_statement'));
  const tab2 = el('button', { class: 'btn btn--ghost',   onclick: () => switchTab('supplier') }, t('supplier_statement'));
  tabBar.append(tab1, tab2);
  host.appendChild(tabBar);

  const partyBar = el('div', { class: 'toolbar' });
  const partySel = el('select', { class: 'input', style: 'min-width: 280px' });
  partyBar.append(el('label', {}, t('select_party') + ': '), partySel);
  host.appendChild(partyBar);

  const summary = el('div', { class: 'state' });
  host.appendChild(summary);
  const content = el('div', { class: 'card' });
  host.appendChild(content);

  let currentTab = 'customer';
  await switchTab('customer');

  async function switchTab(kind) {
    currentTab = kind;
    tab1.className = (kind === 'customer') ? 'btn btn--primary' : 'btn btn--ghost';
    tab2.className = (kind === 'supplier') ? 'btn btn--primary' : 'btn btn--ghost';
    await loadParties();
  }

  async function loadParties() {
    clear(partySel);
    const api = currentTab === 'customer' ? customersApi : suppliersApi;
    const { data, error } = await api.list({});
    if (error) { renderError(content, error); return; }
    partySel.appendChild(el('option', { value: '' }, '— ' + t('select_party') + ' —'));
    for (const p of data) {
      partySel.appendChild(el('option', { value: p.id }, p.name));
    }
    partySel.onchange = loadStatement;
    summary.textContent = '';
    clear(content);
    content.appendChild(el('div', { class: 'state' }, t('select_party')));
  }

  async function loadStatement() {
    const partyId = partySel.value || null;
    if (!partyId) {
      clear(content);
      content.appendChild(el('div', { class: 'state' }, t('select_party')));
      summary.textContent = '';
      return;
    }
    renderLoading(content);
    const fn = currentTab === 'customer' ? statementsApi.customer : statementsApi.supplier;
    const { data, error } = await fn.call(statementsApi, partyId);
    if (error) return renderError(content, error);
    if (!data.length) { summary.textContent = ''; return renderEmpty(content, t('no_statement')); }

    // Sort by date asc and compute running balance.
    const sorted = [...data].sort((a, b) => new Date(a.txn_date) - new Date(b.txn_date));
    let balance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    const rows = sorted.map((r) => {
      const d = Number(r.debit || 0);
      const c = Number(r.credit || 0);
      balance += d - c;
      totalDebit += d;
      totalCredit += c;
      return el('tr', {}, [
        el('td', {}, fmtDate(r.txn_date)),
        el('td', {}, t(r.txn_type) || r.txn_type),
        el('td', { class: 'mono' }, r.ref_number || '—'),
        el('td', { class: 'num' }, d > 0 ? money(d) : '—'),
        el('td', { class: 'num' }, c > 0 ? money(c) : '—'),
        el('td', { class: 'num strong' }, el('span', { class: balance > 0 ? 'neg' : 'pos' }, money(balance))),
      ]);
    });

    summary.textContent = t('statement_summary', {
      d: money(totalDebit), c: money(totalCredit), b: money(balance),
    });

    clear(content);
    content.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('date')),
        el('th', {}, t('type')),
        el('th', {}, '#'),
        el('th', { class: 'num' }, t('debit')),
        el('th', { class: 'num' }, t('credit')),
        el('th', { class: 'num' }, t('running_balance')),
      ])),
      el('tbody', {}, rows),
    ]));
  }
}
