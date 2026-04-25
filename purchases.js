// frontend/purchases.js  (Phase 4)
import { purchasesApi, productsApi, suppliersApi, paymentsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, qty, isoDate, fmtDate, requireStr, requireNum, nextDocNumber, errMsg, field,
} from './utils.js';
import { printInvoice } from './invoice.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  const fromInput = el('input', { type: 'date', class: 'input' });
  const toInput = el('input', { type: 'date', class: 'input' });
  const newBtn = el('button', { class: 'btn btn--primary' }, t('new_purchase'));
  if (!isManagerOrAdmin) newBtn.disabled = true;

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('purchases')),
    el('div', { class: 'toolbar__spacer' }),
    el('label', { class: 'inline-field' }, [el('span', {}, t('from')), fromInput]),
    el('label', { class: 'inline-field' }, [el('span', {}, t('to')), toInput]),
    newBtn,
  ]));
  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  async function refresh() {
    renderLoading(tableHost);
    const { data, error } = await purchasesApi.list({ from: fromInput.value || null, to: toInput.value || null });
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_purchases'));

    const rows = data.map((p) => {
      const balance = Number(p.grand_total || 0) - Number(p.paid_amount || 0);
      const status = balance <= 0 ? 'fully_paid' : (Number(p.paid_amount) > 0 ? 'partial' : 'unpaid');
      const pillCls = status === 'fully_paid' ? 'pill--ok' : status === 'partial' ? 'pill--warn' : 'pill--danger';
      return el('tr', {}, [
        el('td', { class: 'mono' }, p.purchase_number),
        el('td', {}, p.suppliers?.name || p.supplier),
        el('td', {}, fmtDate(p.purchase_date)),
        el('td', { class: 'num' }, money(p.grand_total)),
        el('td', { class: 'num' }, money(p.paid_amount)),
        el('td', { class: 'num' }, balance > 0
          ? el('span', { class: 'neg' }, money(balance))
          : el('span', { class: 'pos' }, money(0))),
        el('td', {}, el('span', { class: `pill ${pillCls}` }, t(status))),
        el('td', { class: 'actions' }, el('button', { class: 'btn btn--ghost', onclick: () => openDetail(p.id) }, t('view'))),
      ]);
    });

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'), el('th', {}, t('supplier')), el('th', {}, t('date')),
        el('th', { class: 'num' }, t('total')), el('th', { class: 'num' }, t('paid')),
        el('th', { class: 'num' }, t('balance_due')), el('th', {}, t('status')), el('th', {}, ''),
      ])),
      el('tbody', {}, rows),
    ]));
  }

  fromInput.addEventListener('change', refresh);
  toInput.addEventListener('change', refresh);
  newBtn.addEventListener('click', openEditor);
  await refresh();

  async function openDetail(id) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('div', { class: 'state' }, t('loading')));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();

    async function redraw() {
      clear(dlg);
      dlg.appendChild(el('div', { class: 'state' }, t('loading')));
      const { data, error } = await purchasesApi.getDetail(id);
      clear(dlg);
      if (error) return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(error)));
      const { header, items, payments } = data;
      const balance = Number(header.grand_total || 0) - Number(header.paid_amount || 0);
      const totalLineDisc = items.reduce((s, it) => s + Number(it.discount_amount || 0), 0);

      const printBtn = el('button', { class: 'btn btn--ghost', onclick: () => printInvoice({
        kind: 'purchase', header, items, payments,
      }) }, '🖨 ' + t('print_receipt'));

      const payBtn = el('button', { class: 'btn btn--primary', onclick: () => openPaymentDialog(),
        disabled: balance <= 0 || !isManagerOrAdmin }, t('add_payment'));

      function openPaymentDialog() {
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
                kind: 'purchase_pay', reference_id: id, amount: amt,
                method: inMethod.value, payment_date: inDate.value || isoDate(),
                notes: inNotes.value.trim() || null,
              });
              if (error) throw new Error(errMsg(error));
              toast(t('record_payment') + ' ✓', 'success');
              pdlg.close();
              await redraw();
              await refresh();
            } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
          },
        }, [
          el('h2', {}, t('record_payment')),
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

      const metaItems = [
        meta(t('supplier'), header.suppliers?.name || header.supplier),
        meta(t('date'), fmtDate(header.purchase_date)),
        meta(t('subtotal'), money(header.subtotal)),
      ];
      if (totalLineDisc > 0)         metaItems.push(meta(t('line_discount'), money(totalLineDisc)));
      if (header.discount_invoice > 0) metaItems.push(meta(t('invoice_discount'), money(header.discount_invoice)));
      metaItems.push(
        meta(t('vat'), money(header.total_vat)),
        meta(t('grand_total'), money(header.grand_total)),
        meta(t('paid'), money(header.paid_amount)),
        meta(t('balance_due'), money(balance)),
      );

      dlg.appendChild(el('div', {}, [
        el('div', { style: 'display:flex; justify-content:space-between; align-items:center' }, [
          el('h2', {}, `${t('purchase_number')} ${header.purchase_number}`),
          el('div', {}, [printBtn, ' ', payBtn]),
        ]),
        el('div', { class: 'meta-grid' }, metaItems),
        el('table', { class: 'table' }, [
          el('thead', {}, el('tr', {}, [
            el('th', {}, t('product')), el('th', { class: 'num' }, t('qty')),
            el('th', { class: 'num' }, t('cost_price')),
            el('th', { class: 'num' }, t('discount')),
            el('th', { class: 'num' }, t('vat_rate')),
            el('th', { class: 'num' }, t('vat_amount')),
            el('th', { class: 'num' }, t('line_total')),
          ])),
          el('tbody', {}, items.map((it) => el('tr', {}, [
            el('td', {}, `${it.products?.sku || ''} — ${it.products?.name || ''}`),
            el('td', { class: 'num' }, qty(it.qty)),
            el('td', { class: 'num' }, money(it.cost_price)),
            el('td', { class: 'num' }, money(it.discount_amount || 0)),
            el('td', { class: 'num' }, (Number(it.vat_rate || 0)) + '%'),
            el('td', { class: 'num' }, money(it.vat_amount)),
            el('td', { class: 'num' }, money(it.line_total)),
          ]))),
        ]),
        payments.length ? el('div', { style: 'margin-top:1rem' }, [
          el('h3', {}, t('payments')),
          el('table', { class: 'table' }, [
            el('thead', {}, el('tr', {}, [
              el('th', {}, t('date')), el('th', {}, t('payment_method')),
              el('th', { class: 'num' }, t('paid_amount')), el('th', {}, t('notes')),
            ])),
            el('tbody', {}, payments.map((p) => el('tr', {}, [
              el('td', {}, fmtDate(p.payment_date)),
              el('td', {}, t(p.method) || p.method),
              el('td', { class: 'num' }, money(p.amount)),
              el('td', {}, p.notes || '—'),
            ]))),
          ]),
        ]) : el('div', { class: 'state' }, t('no_payments')),
        el('div', { class: 'form__actions' }, [
          el('button', { class: 'btn btn--primary', onclick: () => dlg.close() }, t('close')),
        ]),
      ]));
    }
    redraw();
  }

  async function openEditor() {
    if (!isManagerOrAdmin) { toast(t('permission_denied'), 'error'); return; }
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('div', { class: 'state' }, t('loading')));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();

    const [prodRes, supRes] = await Promise.all([
      productsApi.list({ status: 'active', limit: 1000 }),
      suppliersApi.list({ activeOnly: true }),
    ]);
    if (prodRes.error) { clear(dlg); dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(prodRes.error))); return; }
    if (supRes.error) { clear(dlg); dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(supRes.error))); return; }
    const products = prodRes.data;
    const suppliers = supRes.data;
    const productMap = new Map(products.map((p) => [p.id, p]));

    const inNumber = el('input', { class: 'input', value: nextDocNumber('PO'), required: true });
    const inSupSel = el('select', { class: 'input' }, [
      el('option', { value: '' }, t('select_supplier')),
      ...suppliers.map((s) => el('option', { value: s.id }, s.name)),
    ]);
    const inSupTxt = el('input', { class: 'input', placeholder: t('supplier') });
    const inDate = el('input', { type: 'date', class: 'input', value: isoDate() });
    const inNotes = el('textarea', { class: 'input', rows: 2 });
    const inInvDisc = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: '0' });
    const inPaid = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: '0' });
    const itemsHost = el('tbody');
    const subCell = el('td', { class: 'num' }, money(0));
    const discCell = el('td', { class: 'num' }, money(0));
    const vatCell = el('td', { class: 'num' }, money(0));
    const grandCell = el('td', { class: 'num strong' }, money(0));

    function addRow() {
      const productSel = el('select', { class: 'input' }, [
        el('option', { value: '' }, t('select_product')),
        ...products.map((p) => el('option', { value: p.id }, `${p.sku} — ${p.name}`)),
      ]);
      const inQty = el('input', { type: 'number', class: 'input num', min: '0.001', step: '0.001' });
      const inCost = el('input', { type: 'number', class: 'input num', min: '0', step: '0.0001' });
      const inDisc = el('input', { type: 'number', class: 'input num', min: '0', step: '0.01', value: '0' });
      const inVatR = el('input', { type: 'number', class: 'input num', min: '0', max: '100', step: '0.01', value: '0' });
      const lineTotalCell = el('td', { class: 'num' }, money(0));

      function recalc() {
        const q = Number(inQty.value || 0);
        const c = Number(inCost.value || 0);
        const d = Number(inDisc.value || 0);
        const v = Number(inVatR.value || 0);
        const net = Math.max(0, q * c - d);
        lineTotalCell.textContent = money(net + (net * v / 100));
        recalcGrand();
      }
      productSel.addEventListener('change', () => {
        const pr = productMap.get(productSel.value);
        if (pr && (!inVatR.value || Number(inVatR.value) === 0)) inVatR.value = pr.vat_rate || 0;
        recalc();
      });
      [inQty, inCost, inDisc, inVatR].forEach((i) => i.addEventListener('input', recalc));

      const row = el('tr', {}, [
        el('td', {}, productSel), el('td', {}, inQty), el('td', {}, inCost),
        el('td', {}, inDisc), el('td', {}, inVatR), lineTotalCell,
        el('td', {}, el('button', { type: 'button', class: 'btn btn--ghost',
          onclick: () => { row.remove(); recalcGrand(); } }, '×')),
      ]);
      row.__get = () => ({
        product_id: productSel.value,
        qty: Number(inQty.value || 0),
        cost_price: Number(inCost.value || 0),
        discount_amount: Number(inDisc.value || 0),
        vat_rate: Number(inVatR.value || 0),
      });
      itemsHost.appendChild(row);
    }
    function recalcGrand() {
      let sub = 0, disc = 0, vat = 0;
      for (const r of itemsHost.children) {
        const v = r.__get();
        const net = Math.max(0, (v.qty || 0) * (v.cost_price || 0) - (v.discount_amount || 0));
        sub += net; disc += (v.discount_amount || 0); vat += net * (v.vat_rate || 0) / 100;
      }
      const invDisc = Math.min(Number(inInvDisc.value || 0), sub);
      const finalSub = sub - invDisc;
      subCell.textContent = money(finalSub);
      discCell.textContent = money(disc + invDisc);
      vatCell.textContent = money(vat);
      grandCell.textContent = money(finalSub + vat);
    }
    addRow();
    inInvDisc.addEventListener('input', recalcGrand);
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const payload = {
            purchase_number: requireStr(inNumber.value, t('purchase_number')),
            supplier_id: inSupSel.value || null,
            supplier: inSupTxt.value.trim() || null,
            purchase_date: inDate.value || isoDate(),
            notes: inNotes.value.trim() || null,
            paid_amount: Number(inPaid.value || 0),
            discount_invoice: Number(inInvDisc.value || 0),
            items: [...itemsHost.children].map((row, idx) => {
              const v = row.__get();
              if (!v.product_id) throw new Error(`${idx + 1}: ${t('select_product')}`);
              requireNum(v.qty, `${idx + 1} ${t('qty')}`, { min: 0.001 });
              requireNum(v.cost_price, `${idx + 1} ${t('cost_price')}`, { min: 0 });
              return v;
            }),
          };
          if (!payload.supplier_id && !payload.supplier) throw new Error(t('supplier'));
          if (!payload.items.length) throw new Error(t('add_more'));
          const { error } = await purchasesApi.create(payload);
          if (error) throw new Error(errMsg(error));
          toast(t('create') + ' ✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, t('new_purchase')),
      el('div', { class: 'grid-2' }, [
        field(t('purchase_number'), inNumber),
        field(t('supplier'), inSupSel),
        field(t('supplier') + ' (' + t('optional') + ')', inSupTxt),
        field(t('date'), inDate),
      ]),
      field(t('notes'), inNotes),
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('product')),
          el('th', { class: 'num' }, t('qty')),
          el('th', { class: 'num' }, t('cost_price')),
          el('th', { class: 'num' }, t('discount')),
          el('th', { class: 'num' }, t('vat_rate')),
          el('th', { class: 'num' }, t('line_total')),
          el('th', {}, ''),
        ])),
        itemsHost,
        el('tfoot', {}, [
          el('tr', {}, [el('td', { colspan: '5', class: 'num' }, t('subtotal')), subCell, el('td', {}, '')]),
          el('tr', {}, [el('td', { colspan: '5', class: 'num' }, t('total_discount')), discCell, el('td', {}, '')]),
          el('tr', {}, [el('td', { colspan: '5', class: 'num' }, t('vat')), vatCell, el('td', {}, '')]),
          el('tr', {}, [el('td', { colspan: '5', class: 'num strong' }, t('grand_total')), grandCell, el('td', {}, '')]),
        ]),
      ]),
      el('div', {}, el('button', { type: 'button', class: 'btn btn--ghost', onclick: addRow }, t('add_more'))),
      el('div', { class: 'grid-2' }, [
        field(t('invoice_discount'), inInvDisc),
        field(t('paid_amount'), inPaid),
      ]),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, t('create')),
      ]),
    ]);
    clear(dlg);
    dlg.appendChild(form);
  }
}

function meta(label, value) {
  return el('div', { class: 'meta' }, [
    el('span', { class: 'meta__label' }, label),
    el('span', { class: 'meta__value' }, value),
  ]);
}
