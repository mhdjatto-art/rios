// frontend/payments.js  (Phase 3)
// ---------------------------------------------------------------------
// Two-tab view:
//   - Receivables: customers who owe us (sales with balance > 0)
//   - Payables: suppliers we owe (purchases with balance > 0)
// Click a row → record a payment against it.
// ---------------------------------------------------------------------

import { paymentsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import { printPaymentReceipt, printPaymentVoucher } from './print_templates.js';
import { exportCSV } from './export.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, fmtDate, isoDate, requireNum, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  // Toolbar with export
  const exportBtn = el('button', { class: 'btn btn--ghost',
    onclick: async () => {
      const { data } = await paymentsApi.list({ limit: 200 });
      exportCSV(data || [], 'payments');
    } }, '📥 CSV');

  host.appendChild(el('h1', { class: 'view-title' }, t('payments')));

  const tabBar = el('div', { class: 'toolbar' });
  const tab1 = el('button', { class: 'btn btn--primary', onclick: () => switchTab('sales') }, t('receivables'));
  const tab2 = el('button', { class: 'btn btn--ghost',   onclick: () => switchTab('purchases') }, t('payables'));
  tabBar.append(tab1, tab2);
  host.appendChild(tabBar);

  const content = el('div', { class: 'card' });
  host.appendChild(content);

  let currentTab = 'sales';
  switchTab('sales');

  function switchTab(kind) {
    currentTab = kind;
    tab1.className = (kind === 'sales')     ? 'btn btn--primary' : 'btn btn--ghost';
    tab2.className = (kind === 'purchases') ? 'btn btn--primary' : 'btn btn--ghost';
    load();
  }

  async function load() {
    renderLoading(content);
    const { data, error } = await paymentsApi.balanceList(currentTab);
    if (error) return renderError(content, error);
    if (!data.length) return renderEmpty(content, t('no_data'));

    const isSales = currentTab === 'sales';
    const rows = data.map((r) => {
      const partyName = isSales ? r.customer : r.supplier;
      const docNumber = isSales ? r.sale_number : r.purchase_number;
      const docDate   = isSales ? r.sale_date   : r.purchase_date;
      const refKind   = isSales ? 'sale_collect' : 'purchase_pay';
      return el('tr', {}, [
        el('td', { class: 'mono' }, docNumber),
        el('td', {}, partyName || '—'),
        el('td', {}, fmtDate(docDate)),
        el('td', { class: 'num' }, money(r.grand_total)),
        el('td', { class: 'num' }, money(r.paid_amount)),
        el('td', { class: 'num' }, el('span', { class: 'neg' }, money(r.balance_due))),
        el('td', { class: 'num' }, `${r.age_days} ${t('day') || 'd'}`),
        el('td', { class: 'actions' }, el('button', {
          class: 'btn btn--primary',
          onclick: () => openPaymentDialog({
            kind: refKind, refId: r.id, balance: Number(r.balance_due),
            label: docNumber + ' / ' + (partyName || '—'),
          }),
          disabled: !auth.state.isManagerOrAdmin,
        }, t('add_payment'))),
      ]);
    });

    clear(content);
    content.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'),
        el('th', {}, isSales ? t('customer') : t('supplier')),
        el('th', {}, t('date')),
        el('th', { class: 'num' }, t('total')),
        el('th', { class: 'num' }, t('paid')),
        el('th', { class: 'num' }, t('balance_due')),
        el('th', { class: 'num' }, 'Age'),
        el('th', {}, ''),
      ])),
      el('tbody', {}, rows),
    ]));
  }

  function openPaymentDialog({ kind, refId, balance, label }) {
    const pdlg = el('dialog', { class: 'dialog' });
    const inAmt = el('input', { type: 'number', step: '0.01', min: '0.01', max: balance, class: 'input num', value: balance });
    const inMethod = el('select', { class: 'input' }, [
      el('option', { value: 'cash' }, t('cash')),
      el('option', { value: 'card' }, t('card')),
      el('option', { value: 'bank_transfer' }, t('bank_transfer')),
      el('option', { value: 'cheque' }, t('cheque')),
      el('option', { value: 'other' }, t('other')),
    ]);
    const inDate = el('input', { type: 'date', class: 'input', value: isoDate() });
    const inNotes = el('input', { class: 'input' });
    const errBox = el('div', { class: 'form-error', hidden: true });

    const f = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const amt = requireNum(inAmt.value, t('paid_amount'), { min: 0.01, max: balance });
          const { error } = await paymentsApi.record({
            kind, reference_id: refId, amount: amt,
            method: inMethod.value, payment_date: inDate.value || isoDate(),
            notes: inNotes.value.trim() || null,
          });
          if (error) throw new Error(errMsg(error));
          toast(t('record_payment') + ' ✓', 'success');
          pdlg.close();
          await load();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, t('record_payment')),
      el('p', { class: 'muted' }, label),
      el('div', { class: 'grid-2' }, [
        field(t('paid_amount'), inAmt),
        field(t('payment_method'), inMethod),
        field(t('payment_date'), inDate),
        field(t('notes'), inNotes),
      ]),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => pdlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, t('save')),
      ]),
    ]);
    pdlg.appendChild(f);
    document.body.appendChild(pdlg);
    pdlg.addEventListener('close', () => pdlg.remove());
    pdlg.showModal();
  }
}
