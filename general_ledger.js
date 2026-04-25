// frontend/general_ledger.js  (Phase 13)
import { accountingApi } from './api.js';
import { i18n, t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, fmtDate, errMsg,
} from './utils.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, '📒 ' + t('general_ledger')));

  const accSel = el('select', { class: 'input' });
  const fromIn = el('input', { type: 'date', class: 'input' });
  const toIn = el('input', { type: 'date', class: 'input' });

  host.append(el('div', { class: 'toolbar', style: 'margin-bottom:12px; flex-wrap:wrap' }, [
    el('label', {}, [t('account') + ':', accSel]),
    el('label', {}, [t('period_from') + ':', fromIn]),
    el('label', {}, [t('period_to') + ':', toIn]),
    el('button', { class: 'btn btn--primary', onclick: refresh }, '🔍 ' + t('show')),
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  // Load accounts
  const { data: accounts, error: accErr } = await accountingApi.listAccounts();
  if (accErr) return renderError(card, accErr);

  const postable = accounts.filter((a) => a.allow_posting && a.is_active);
  clear(accSel);
  accSel.appendChild(el('option', { value: '' }, '— ' + t('select_account') + ' —'));
  for (const a of postable) {
    accSel.appendChild(el('option', { value: a.id },
      a.code + ' — ' + (i18n.lang === 'ar' ? a.name_ar : a.name_en)));
  }

  renderEmpty(card, t('select_account_hint'));

  async function refresh() {
    if (!accSel.value) { toast(t('select_account'), 'error'); return; }
    renderLoading(card);
    const { data, error } = await accountingApi.accountLedger(
      accSel.value, fromIn.value || null, toIn.value || null);
    if (error) return renderError(card, error);

    const acc = postable.find((a) => a.id === accSel.value);
    clear(card);

    card.appendChild(el('h3', {}, [
      el('span', { class: 'mono strong' }, acc.code),
      ' — ',
      el('span', {}, i18n.lang === 'ar' ? acc.name_ar : acc.name_en),
      el('span', { class: 'pill pill--info', style: 'margin-inline-start:8px' }, t(acc.normal_balance)),
    ]));

    if (!data.length) { renderEmpty(card, t('no_movements')); return; }

    let totalDr = 0, totalCr = 0;
    for (const r of data) { totalDr += Number(r.debit || 0); totalCr += Number(r.credit || 0); }
    const finalBal = data[data.length - 1]?.running_balance || 0;

    card.appendChild(el('div', { class: 'kpi-row', style: 'margin-bottom:12px' }, [
      el('div', { class: 'kpi' }, [
        el('div', { class: 'kpi__label' }, t('total_debits')),
        el('div', { class: 'kpi__value' }, money(totalDr)),
      ]),
      el('div', { class: 'kpi' }, [
        el('div', { class: 'kpi__label' }, t('total_credits')),
        el('div', { class: 'kpi__value' }, money(totalCr)),
      ]),
      el('div', { class: 'kpi kpi--success' }, [
        el('div', { class: 'kpi__label' }, t('final_balance')),
        el('div', { class: 'kpi__value' }, money(finalBal)),
      ]),
    ]));

    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('date')),
        el('th', {}, t('entry_number')),
        el('th', {}, t('description')),
        el('th', { class: 'num' }, t('debit')),
        el('th', { class: 'num' }, t('credit')),
        el('th', { class: 'num strong' }, t('running_balance')),
      ])),
      el('tbody', {}, data.map((r) => el('tr', {}, [
        el('td', {}, fmtDate(r.entry_date)),
        el('td', { class: 'mono' }, r.entry_number),
        el('td', {}, r.description || '—'),
        el('td', { class: 'num' }, Number(r.debit) > 0 ? money(r.debit) : '—'),
        el('td', { class: 'num' }, Number(r.credit) > 0 ? money(r.credit) : '—'),
        el('td', { class: 'num strong' }, money(r.running_balance)),
      ]))),
    ]));
  }
}
