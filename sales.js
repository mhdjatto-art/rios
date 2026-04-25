// frontend/sales.js  (Phase 4)
import { salesApi, inventoryApi, productsApi, customersApi, paymentsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, qty, isoDate, fmtDate, requireStr, requireNum, nextDocNumber, errMsg, field,
} from './utils.js';
import { printInvoice } from './invoice.js';
import { attachUSBScanner, openCameraScanner } from './scanner.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  const fromInput = el('input', { type: 'date', class: 'input' });
  const toInput = el('input', { type: 'date', class: 'input' });
  const newBtn = el('button', { class: 'btn btn--primary' }, t('new_sale'));
  if (!isManagerOrAdmin) newBtn.disabled = true;

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('sales')),
    el('div', { class: 'toolbar__spacer' }),
    el('label', { class: 'inline-field' }, [el('span', {}, t('from')), fromInput]),
    el('label', { class: 'inline-field' }, [el('span', {}, t('to')), toInput]),
    newBtn,
  ]));
  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  async function refresh() {
    renderLoading(tableHost);
    const { data, error } = await salesApi.list({ from: fromInput.value || null, to: toInput.value || null });
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_sales'));

    const rows = data.map((s) => {
      const balance = Number(s.grand_total || 0) - Number(s.paid_amount || 0);
      const status = balance <= 0 ? 'fully_paid' : (Number(s.paid_amount) > 0 ? 'partial' : 'unpaid');
      const pillCls = status === 'fully_paid' ? 'pill--ok' : status === 'partial' ? 'pill--warn' : 'pill--danger';
      return el('tr', {}, [
        el('td', { class: 'mono' }, s.sale_number),
        el('td', {}, s.customers?.name || s.customer || t('walk_in')),
        el('td', {}, fmtDate(s.sale_date)),
        el('td', { class: 'num' }, money(s.grand_total)),
        el('td', { class: 'num' }, money(s.paid_amount)),
        el('td', { class: 'num' }, balance > 0
          ? el('span', { class: 'neg' }, money(balance))
          : el('span', { class: 'pos' }, money(0))),
        el('td', {}, el('span', { class: `pill ${pillCls}` }, t(status))),
        el('td', { class: 'actions' }, el('button', {
          class: 'btn btn--ghost', onclick: () => openDetail(s.id),
        }, t('view'))),
      ]);
    });

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'), el('th', {}, t('customer')), el('th', {}, t('date')),
        el('th', { class: 'num' }, t('total')),
        el('th', { class: 'num' }, t('paid')),
        el('th', { class: 'num' }, t('balance_due')),
        el('th', {}, t('status')),
        el('th', {}, ''),
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
      const { data, error } = await salesApi.getDetail(id);
      clear(dlg);
      if (error) return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(error)));
      const { header, items, payments } = data;
      const balance = Number(header.grand_total || 0) - Number(header.paid_amount || 0);
      const totalLineDisc = items.reduce((s, it) => s + Number(it.discount_amount || 0), 0);

      const printBtn = el('button', { class: 'btn btn--ghost', onclick: () => printInvoice({
        kind: 'sale', header, items, payments,
      }) }, '🖨 ' + t('print_invoice'));

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
                kind: 'sale_collect', reference_id: id, amount: amt,
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
        meta(t('customer'), header.customers?.name || header.customer || t('walk_in')),
        meta(t('date'), fmtDate(header.sale_date)),
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
          el('h2', {}, `${t('sale_number')} ${header.sale_number}`),
          el('div', {}, [printBtn, ' ', payBtn]),
        ]),
        el('div', { class: 'meta-grid' }, metaItems),
        el('table', { class: 'table' }, [
          el('thead', {}, el('tr', {}, [
            el('th', {}, t('product')),
            el('th', { class: 'num' }, t('qty')),
            el('th', { class: 'num' }, t('price')),
            el('th', { class: 'num' }, t('discount')),
            el('th', { class: 'num' }, t('vat_rate')),
            el('th', { class: 'num' }, t('vat_amount')),
            el('th', { class: 'num' }, t('line_total')),
          ])),
          el('tbody', {}, items.map((it) => el('tr', {}, [
            el('td', {}, `${it.products?.sku || ''} — ${it.products?.name || ''}`),
            el('td', { class: 'num' }, qty(it.qty)),
            el('td', { class: 'num' }, money(it.selling_price)),
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

    const [invRes, prodRes, custRes] = await Promise.all([
      inventoryApi.list({}), productsApi.list({ limit: 1000 }), customersApi.list({ activeOnly: true }),
    ]);
    if (invRes.error) { clear(dlg); dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(invRes.error))); return; }
    if (custRes.error) { clear(dlg); dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(custRes.error))); return; }

    const inv = invRes.data;
    const products = prodRes.data || [];
    const customers = custRes.data;
    const stockMap = new Map(inv.map((r) => [r.product_id, Number(r.current_stock)]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    const inNumber = el('input', { class: 'input', value: nextDocNumber('SO'), required: true });
    const inCustSel = el('select', { class: 'input' }, [
      el('option', { value: '' }, t('select_customer')),
      ...customers.map((c) => el('option', { value: c.id }, c.name)),
    ]);
    const inCustTxt = el('input', { class: 'input', placeholder: t('walk_in') });
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
        ...inv.filter((p) => Number(p.current_stock) > 0)
          .map((p) => el('option', { value: p.product_id },
            `${p.sku} — ${p.name} (${qty(p.current_stock)})`)),
      ]);
      const inQty = el('input', { type: 'number', class: 'input num', min: '0.001', step: '0.001' });
      const inPrice = el('input', { type: 'number', class: 'input num', min: '0', step: '0.0001' });
      const inDisc = el('input', { type: 'number', class: 'input num', min: '0', step: '0.01', value: '0' });
      const inVatR = el('input', { type: 'number', class: 'input num', min: '0', max: '100', step: '0.01', value: '0' });
      const lineTotalCell = el('td', { class: 'num' }, money(0));
      const stockHint = el('div', { class: 'hint' }, '');

      function recalc() {
        const q = Number(inQty.value || 0);
        const p = Number(inPrice.value || 0);
        const d = Number(inDisc.value || 0);
        const v = Number(inVatR.value || 0);
        const net = Math.max(0, q * p - d);
        const vatAmt = net * v / 100;
        lineTotalCell.textContent = money(net + vatAmt);
        const pid = productSel.value;
        if (pid) {
          const avail = stockMap.get(pid) || 0;
          if (q > avail) { stockHint.textContent = t('only_n_in_stock', { n: qty(avail) }); stockHint.className = 'hint hint--bad'; }
          else { stockHint.textContent = `${qty(avail)} ${t('in_stock')}`; stockHint.className = 'hint'; }
        }
        recalcGrand();
      }
      productSel.addEventListener('change', () => {
        const pr = productMap.get(productSel.value);
        if (pr) {
          if (!inPrice.value || Number(inPrice.value) === 0) inPrice.value = pr.selling_price || '';
          if (!inVatR.value || Number(inVatR.value) === 0) inVatR.value = pr.vat_rate || 0;
        }
        recalc();
      });
      [inQty, inPrice, inDisc, inVatR].forEach((i) => i.addEventListener('input', recalc));

      const row = el('tr', {}, [
        el('td', {}, [productSel, stockHint]),
        el('td', {}, inQty), el('td', {}, inPrice),
        el('td', {}, inDisc), el('td', {}, inVatR), lineTotalCell,
        el('td', {}, el('button', { type: 'button', class: 'btn btn--ghost',
          onclick: () => { row.remove(); recalcGrand(); } }, '×')),
      ]);
      row.__get = () => ({
        product_id: productSel.value,
        qty: Number(inQty.value || 0),
        selling_price: Number(inPrice.value || 0),
        discount_amount: Number(inDisc.value || 0),
        vat_rate: Number(inVatR.value || 0),
      });
      itemsHost.appendChild(row);
    }
    function recalcGrand() {
      let sub = 0, disc = 0, vat = 0;
      for (const r of itemsHost.children) {
        const v = r.__get();
        const net = Math.max(0, (v.qty || 0) * (v.selling_price || 0) - (v.discount_amount || 0));
        sub += net;
        disc += (v.discount_amount || 0);
        vat += net * (v.vat_rate || 0) / 100;
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

    // Barcode scan handling
    function onScan(code) {
      const prod = products.find((p) => p.sku === code || p.barcode === code);
      if (!prod) { toast('✗ ' + code, 'error'); return; }
      const invRow = inv.find((r) => r.product_id === prod.id);
      if (!invRow || Number(invRow.current_stock) <= 0) {
        toast(t('insufficient_stock') + ' ' + prod.name, 'error'); return;
      }
      // Check if already in list — bump qty
      for (const r of itemsHost.children) {
        const v = r.__get();
        if (v.product_id === prod.id) {
          const qtyInput = r.querySelectorAll('input')[0];
          qtyInput.value = Number(qtyInput.value || 0) + 1;
          qtyInput.dispatchEvent(new Event('input'));
          toast('+1 ' + prod.name, 'success');
          return;
        }
      }
      // Otherwise, add a new row pre-filled
      addRow();
      const row = itemsHost.lastElementChild;
      const selects = row.querySelectorAll('select');
      const inputs = row.querySelectorAll('input');
      selects[0].value = prod.id;
      selects[0].dispatchEvent(new Event('change'));
      inputs[0].value = 1;
      inputs[0].dispatchEvent(new Event('input'));
      toast('✓ ' + prod.name, 'success');
    }
    const scanInput = el('input', { class: 'input mono', placeholder: '📷 ' + t('scan_barcode') + ' / SKU / Barcode', autofocus: true });
    attachUSBScanner(scanInput, onScan);
    const cameraBtn = el('button', { type: 'button', class: 'scan-btn', onclick: () => openCameraScanner(onScan) }, '📷');
    const scanBar = el('div', { class: 'inline-field', style: 'gap: 8px' }, [scanInput, cameraBtn]);

    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const payload = {
            sale_number: requireStr(inNumber.value, t('sale_number')),
            customer_id: inCustSel.value || null,
            customer: inCustTxt.value.trim() || null,
            sale_date: inDate.value || isoDate(),
            notes: inNotes.value.trim() || null,
            paid_amount: Number(inPaid.value || 0),
            discount_invoice: Number(inInvDisc.value || 0),
            items: [...itemsHost.children].map((row, idx) => {
              const v = row.__get();
              if (!v.product_id) throw new Error(`${idx + 1}: ${t('select_product')}`);
              requireNum(v.qty, `${idx + 1} ${t('qty')}`, { min: 0.001 });
              requireNum(v.selling_price, `${idx + 1} ${t('price')}`, { min: 0 });
              return v;
            }),
          };
          if (!payload.items.length) throw new Error(t('add_more'));
          const { error } = await salesApi.create(payload);
          if (error) throw new Error(errMsg(error));
          toast(t('create') + ' ✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, t('new_sale')),
      el('div', { class: 'grid-2' }, [
        field(t('sale_number'), inNumber),
        field(t('customer'), inCustSel),
        field(t('customer') + ' (' + t('optional') + ')', inCustTxt),
        field(t('date'), inDate),
      ]),
      field(t('notes'), inNotes),
      scanBar,
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('product')),
          el('th', { class: 'num' }, t('qty')),
          el('th', { class: 'num' }, t('price')),
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
