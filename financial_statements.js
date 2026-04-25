// frontend/financial_statements.js  (Phase 14 — period-based)
import { accountingApi } from './api.js';
import { auth } from './auth.js';
import { i18n, t } from './i18n.js';
import { el, clear, toast, renderLoading, renderError, money, errMsg } from './utils.js';
import { printReport, printBalanceSheet, printIncomeStatement } from './print_templates.js';
import { exportCSV } from './export.js';

const TABS = ['trial_balance', 'balance_sheet', 'income_statement'];

export async function render(host) {
  clear(host);
  const { isAdmin } = auth.state;

  host.appendChild(el('h1', { class: 'view-title' }, '📊 ' + t('financial_statements')));

  // Period filters
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const fromIn = el('input', { type: 'date', class: 'input', value: yearStart.toISOString().slice(0, 10) });
  const toIn = el('input', { type: 'date', class: 'input', value: today.toISOString().slice(0, 10) });

  const filters = el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
    el('label', {}, [t('period_from') + ':', fromIn]),
    el('label', {}, [t('period_to') + ':', toIn]),
    el('button', { class: 'btn btn--primary', onclick: () => renderActive() }, '🔍 ' + t('apply')),
    el('button', { class: 'btn btn--ghost', onclick: () => printCurrent() }, '🖨 ' + t('print')),
    el('button', { class: 'btn btn--ghost', onclick: () => exportCurrent() }, '📥 CSV'),
    el('div', { class: 'toolbar__spacer' }),
    el('button', { class: 'btn btn--danger', onclick: yearEndClose, disabled: !isAdmin },
      '📅 ' + t('year_end_closing')),
  ]);
  host.appendChild(filters);

  let active = 'trial_balance';
  const tabBar = el('div', { class: 'pos__mode-bar', style: 'max-width:600px; margin-bottom:16px' });
  host.appendChild(tabBar);

  function renderTabs() {
    clear(tabBar);
    for (const tab of TABS) {
      tabBar.appendChild(el('button', {
        type: 'button',
        class: 'pos__mode-btn ' + (active === tab ? 'pos__mode-btn--active' : ''),
        onclick: () => { active = tab; renderTabs(); renderActive(); },
      }, t(tab)));
    }
  }

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  renderTabs();
  renderActive();

  async function renderActive() {
    if (active === 'trial_balance') await renderTrialBalance();
    else if (active === 'balance_sheet') await renderBalanceSheet();
    else if (active === 'income_statement') await renderIncomeStatement();
  }

  async function renderTrialBalance() {
    renderLoading(card);
    const { data, error } = await accountingApi.trialBalancePeriod(fromIn.value, toIn.value);
    if (error) return renderError(card, error);

    let totalDr = 0, totalCr = 0;
    for (const r of data) { totalDr += Number(r.total_debit || 0); totalCr += Number(r.total_credit || 0); }
    const balanced = Math.abs(totalDr - totalCr) < 0.01;

    clear(card);
    card.appendChild(el('h3', {}, '⚖️ ' + t('trial_balance')));
    card.appendChild(el('p', { class: 'muted' }, t('period') + ': ' + fromIn.value + ' → ' + toIn.value));
    card.appendChild(el('div', {
      class: balanced ? 'state' : 'state state--error',
      style: balanced ? 'background:#d1fae5; border:1px solid #10b981; color:#064e3b; padding:12px; margin:12px 0' : 'margin:12px 0',
    }, balanced ? `✅ ${t('balanced')} — ${money(totalDr)}` :
       `❌ ${t('unbalanced')} — ${money(totalDr)} ≠ ${money(totalCr)}`));

    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('code')), el('th', {}, t('account')), el('th', {}, t('type')),
        el('th', { class: 'num' }, t('debit')), el('th', { class: 'num' }, t('credit')),
        el('th', { class: 'num strong' }, t('balance')),
      ])),
      el('tbody', {}, data.map((r) => el('tr', {}, [
        el('td', { class: 'mono strong' }, r.account_code),
        el('td', {}, i18n.lang === 'ar' ? r.name_ar : r.name_en),
        el('td', {}, el('span', { class: `pill pill--${typeClass(r.account_type)}` }, t('acct_' + r.account_type))),
        el('td', { class: 'num' }, Number(r.total_debit) > 0 ? money(r.total_debit) : '—'),
        el('td', { class: 'num' }, Number(r.total_credit) > 0 ? money(r.total_credit) : '—'),
        el('td', { class: 'num strong' }, money(r.balance)),
      ]))),
      el('tfoot', {}, el('tr', {}, [
        el('td', { colspan: 3, class: 'strong' }, t('totals')),
        el('td', { class: 'num strong' }, money(totalDr)),
        el('td', { class: 'num strong' }, money(totalCr)),
        el('td', {}, ''),
      ])),
    ]));
  }

  async function renderBalanceSheet() {
    renderLoading(card);
    const { data, error } = await accountingApi.balanceSheetAsOf(toIn.value);
    if (error) return renderError(card, error);

    const assets = data.filter((r) => r.account_type === 'asset');
    const liabilities = data.filter((r) => r.account_type === 'liability');
    const equity = data.filter((r) => r.account_type === 'equity');
    const sum = (rows) => rows.reduce((s, r) => s + Number(r.balance || 0), 0);
    const totalAssets = sum(assets);
    const totalLiab = sum(liabilities);
    const totalEquity = sum(equity);
    const diff = totalAssets - (totalLiab + totalEquity);

    clear(card);
    card.appendChild(el('h3', {}, '📋 ' + t('balance_sheet')));
    card.appendChild(el('p', { class: 'muted' }, t('as_of') + ': ' + toIn.value));

    card.appendChild(el('div', { class: 'grid-2', style: 'gap:20px; margin-top:20px' }, [
      el('div', {}, [
        el('h3', {}, '💰 ' + t('acct_asset')),
        section(assets),
        rowTotal(t('total_assets'), totalAssets, 'primary'),
      ]),
      el('div', {}, [
        el('h3', {}, '💳 ' + t('acct_liability')),
        section(liabilities),
        rowTotal(t('total') + ' ' + t('acct_liability'), totalLiab),
        el('h3', { style: 'margin-top:16px' }, '🏦 ' + t('acct_equity')),
        section(equity),
        rowTotal(t('total') + ' ' + t('acct_equity'), totalEquity),
        rowTotal(t('total_liab_equity'), totalLiab + totalEquity, 'primary'),
      ]),
    ]));

    if (Math.abs(diff) > 0.01) {
      card.appendChild(el('div', { class: 'state state--warn', style: 'margin-top:16px' },
        `⚠️ ${t('balance_sheet_diff')}: ${money(diff)}`));
    } else {
      card.appendChild(el('div', { class: 'state',
        style: 'background:#d1fae5; border:1px solid #10b981; color:#064e3b; padding:12px; margin-top:16px' },
        `✅ ${t('balance_sheet_balanced')}`));
    }

    function rowTotal(label, value, cls = '') {
      return el('div', {
        class: 'pos__row ' + (cls === 'primary' ? 'pos__grand' : ''),
        style: 'padding:10px; border-top:' + (cls === 'primary' ? '2px solid' : '1px dashed') + '; margin-top:6px',
      }, [el('strong', {}, label), el('strong', {}, money(value))]);
    }
    function section(rows) {
      if (!rows.length) return el('div', { class: 'muted small' }, '—');
      return el('ul', { class: 'bar-list' }, rows.map((r) => el('li', {}, [
        el('span', {}, [
          el('span', { class: 'mono small muted' }, r.account_code + ' '),
          el('span', {}, i18n.lang === 'ar' ? r.name_ar : r.name_en),
        ]),
        el('span', { class: 'bar-list__value' }, money(r.balance)),
      ])));
    }
  }

  async function renderIncomeStatement() {
    renderLoading(card);
    const { data, error } = await accountingApi.incomeStatementPeriod(fromIn.value, toIn.value);
    if (error) return renderError(card, error);

    const revenue = data.filter((r) => r.account_type === 'revenue');
    const expenses = data.filter((r) => r.account_type === 'expense');
    const sum = (rows) => rows.reduce((s, r) => s + Number(r.balance || 0), 0);
    const totalRev = sum(revenue);
    const totalExp = sum(expenses);
    const netIncome = totalRev - totalExp;

    clear(card);
    card.appendChild(el('h3', {}, '📈 ' + t('income_statement')));
    card.appendChild(el('p', { class: 'muted' }, t('period') + ': ' + fromIn.value + ' → ' + toIn.value));

    card.appendChild(el('div', { style: 'max-width:700px' }, [
      el('h3', {}, '💰 ' + t('revenue')),
      section(revenue),
      el('div', { class: 'pos__row', style: 'padding:8px; border-top:1px dashed; margin-bottom:20px' }, [
        el('strong', {}, t('total_revenue')),
        el('strong', { class: 'pos' }, money(totalRev)),
      ]),
      el('h3', {}, '💸 ' + t('expenses')),
      section(expenses),
      el('div', { class: 'pos__row', style: 'padding:8px; border-top:1px dashed; margin-bottom:20px' }, [
        el('strong', {}, t('total_expenses')),
        el('strong', { class: 'neg' }, '(' + money(totalExp) + ')'),
      ]),
      el('div', {
        class: 'pos__row pos__grand',
        style: 'padding:14px; border-top:3px double; font-size:20px',
      }, [
        el('span', {}, netIncome >= 0 ? '📈 ' + t('net_income') : '📉 ' + t('net_loss')),
        el('span', { class: netIncome >= 0 ? 'pos' : 'neg' }, money(netIncome)),
      ]),
    ]));

    function section(rows) {
      if (!rows.length) return el('div', { class: 'muted small' }, '—');
      return el('ul', { class: 'bar-list' }, rows.map((r) => el('li', {}, [
        el('span', {}, [
          el('span', { class: 'mono small muted' }, r.account_code + ' '),
          el('span', {}, i18n.lang === 'ar' ? r.name_ar : r.name_en),
        ]),
        el('span', { class: 'bar-list__value' }, money(r.balance)),
      ])));
    }
  }

  async function yearEndClose() {
    const year = prompt(t('year_to_close') + ' (e.g. 2024):');
    if (!year || isNaN(year)) return;
    if (!confirm(t('year_end_confirm', { year }))) return;
    const { data, error } = await accountingApi.yearEndClosing(parseInt(year));
    if (error) return toast(errMsg(error), 'error');
    if (data.error === 'YEAR_ALREADY_CLOSED') {
      toast('⚠️ ' + t('year_already_closed'), 'warn');
      return;
    }
    toast(`✅ ${t('year_closed')} ${year} — ${t('net_income')}: ${money(data.net_income)}`, 'success');
    renderActive();
  }

  let _lastData = { type: null, data: null };

  async function printCurrent() {
    if (active === 'trial_balance') {
      const { data } = await accountingApi.trialBalancePeriod(fromIn.value, toIn.value);
      printReport({
        title: t('trial_balance'),
        subtitle: fromIn.value + ' → ' + toIn.value,
        columns: [
          { key: 'account_code', label: t('code'), mono: true },
          { key: 'name', label: t('account') },
          { key: 'total_debit', label: t('debit'), numeric: true, render: (r) => money(r.total_debit) },
          { key: 'total_credit', label: t('credit'), numeric: true, render: (r) => money(r.total_credit) },
          { key: 'balance', label: t('balance'), numeric: true, render: (r) => money(r.balance) },
        ],
        rows: data.map((r) => ({ ...r, name: r.name_ar || r.name_en })),
      });
    } else if (active === 'balance_sheet') {
      const { data } = await accountingApi.balanceSheetAsOf(toIn.value);
      printBalanceSheet({
        assets: data.filter((r) => r.account_type === 'asset'),
        liabilities: data.filter((r) => r.account_type === 'liability'),
        equity: data.filter((r) => r.account_type === 'equity'),
        asOf: toIn.value,
      });
    } else if (active === 'income_statement') {
      const { data } = await accountingApi.incomeStatementPeriod(fromIn.value, toIn.value);
      printIncomeStatement({
        revenue: data.filter((r) => r.account_type === 'revenue'),
        expenses: data.filter((r) => r.account_type === 'expense'),
        from: fromIn.value, to: toIn.value,
      });
    }
  }

  async function exportCurrent() {
    let rows;
    if (active === 'trial_balance') {
      const r = await accountingApi.trialBalancePeriod(fromIn.value, toIn.value);
      rows = r.data;
    } else if (active === 'balance_sheet') {
      const r = await accountingApi.balanceSheetAsOf(toIn.value);
      rows = r.data;
    } else {
      const r = await accountingApi.incomeStatementPeriod(fromIn.value, toIn.value);
      rows = r.data;
    }
    exportCSV(rows, active);
  }

  function typeClass(tp) {
    return { asset: 'ok', liability: 'warn', equity: 'info', revenue: 'ok', expense: 'danger' }[tp] || '';
  }
}
