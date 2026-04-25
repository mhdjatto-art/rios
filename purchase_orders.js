// frontend/purchase_orders.js  (Phase 5)
import { posApi, productsApi, suppliersApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, qty, isoDate, fmtDate, requireStr, requireNum, nextDocNumber, errMsg, field,
} from './utils.js';

const STATUSES = ['draft', 'sent', 'received', 'partial', 'cancelled', 'converted'];

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin, isAdmin } = auth.state;

  const statusSel = el('select', { class: 'input' }, [
    el('option', { value: '' }, t('all_statuses')),
    ...STATUSES.map((s) => el('option', { value: s }, t('status_' + s))),
  ]);
  const newBtn = el('button', { class: 'btn btn--primary', onclick: () => openEditor() }, t('new_po'));
  if (!isManagerOrAdmin) newBtn.disabled = true;

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('purchase_orders')),
    el('div', { class: 'toolbar__spacer' }),
    el('label', { class: 'inline-field' }, [el('span', {}, t('status')), statusSel]),
    newBtn,
  ]));
  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  async function refresh() {
    renderLoading(tableHost);
    const { data, error } = await posApi.list({ status: statusSel.value || null });
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_pos'));

    const rows = data.map((p) => {
      const pillCls = p.status === 'converted' || p.status === 'received' ? 'pill--ok' :
        p.status === 'cancelled' ? 'pill--danger' : 'pill--warn';
      return el('tr', {}, [
        el('td', { class: 'mono' }, p.po_number),
        el('td', {}, p.suppliers?.name || p.supplier || '—'),
        el('td', {}, fmtDate(p.po_date)),
        el('td', {}, p.expected_date ? fmtDate(p.expected_date) : '—'),
        el('td', { class: 'num' }, money(p.grand_total)),
        el('td', {}, el('span', { class: `pill ${pillCls}` }, t('status_' + p.status))),
        el('td', { class: 'actions' }, el('button', { class: 'btn btn--ghost', onclick: () => openDetail(p.id) }, t('view'))),
      ]);
    });

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'), el('th', {}, t('supplier')),
        el('th', {}, t('po_date')), el('th', {}, t('expected_date')),
        el('th', { class: 'num' }, t('grand_total')),
        el('th', {}, t('status')), el('th', {}, ''),
      ])),
      el('tbody', {}, rows),
    ]));
  }
  statusSel.addEventListener('change', refresh);
  await refresh();

  async function openDetail(id) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('div', { class: 'state' }, t('loading')));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
    const { data, error } = await posApi.getDetail(id);
    clear(dlg);
    if (error) return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(error)));
    const { header, items } = data;

    const statusChangeSel = el('select', { class: 'input', style: 'width:auto' },
      STATUSES.filter((s) => s !== 'converted').map((s) => el('option', { value: s }, t('status_' + s))));
    statusChangeSel.value = header.status === 'converted' ? 'received' : header.status;
    const saveStatusBtn = el('button', { class: 'btn btn--ghost',
      onclick: async () => {
        const { error } = await posApi.setStatus(id, statusChangeSel.value);
        if (error) return toast(errMsg(error), 'error');
        toast('✓', 'success'); dlg.close(); refresh();
      } }, t('change_status'));
    if (header.status === 'converted' || !isManagerOrAdmin) { saveStatusBtn.disabled = true; statusChangeSel.disabled = true; }

    const convertBtn = el('button', { class: 'btn btn--primary',
      disabled: header.status === 'converted' || !isManagerOrAdmin,
      onclick: async () => {
        const pNo = prompt(t('purchase_number') + '?', nextDocNumber('PO'));
        if (!pNo) return;
        const { error } = await posApi.convertToPurchase(id, pNo);
        if (error) return toast(errMsg(error), 'error');
        toast(t('convert_to_purchase') + ' ✓ → ' + pNo, 'success');
        dlg.close(); refresh();
      } }, '➡ ' + t('convert_to_purchase'));

    const delBtn = el('button', { class: 'btn btn--danger',
      disabled: !isAdmin,
      onclick: async () => {
        if (!confirm(t('confirm_delete') + '\n' + header.po_number)) return;
        const { error } = await posApi.remove(id);
        if (error) return toast(errMsg(error), 'error');
        toast('✓', 'success'); dlg.close(); refresh();
      } }, t('delete'));

    dlg.appendChild(el('div', {}, [
      el('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px' }, [
        el('h2', {}, `${t('po_number')} ${header.po_number}`),
        el('div', { style: 'display:flex; gap:6px; flex-wrap:wrap' }, [statusChangeSel, saveStatusBtn, convertBtn, delBtn]),
      ]),
      el('div', { class: 'meta-grid' }, [
        meta(t('supplier'), header.suppliers?.name || header.supplier),
        meta(t('po_date'), fmtDate(header.po_date)),
        header.expected_date ? meta(t('expected_date'), fmtDate(header.expected_date)) : '',
        meta(t('status'), t('status_' + header.status)),
        meta(t('subtotal'), money(header.subtotal)),
        meta(t('vat'), money(header.total_vat)),
        meta(t('grand_total'), money(header.grand_total)),
      ].filter(Boolean)),
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('product')),
          el('th', { class: 'num' }, t('qty')),
          el('th', { class: 'num' }, t('cost_price')),
          el('th', { class: 'num' }, t('discount')),
          el('th', { class: 'num' }, t('vat_rate')),
          el('th', { class: 'num' }, t('line_total')),
        ])),
        el('tbody', {}, items.map((it) => el('tr', {}, [
          el('td', {}, `${it.products?.sku || ''} — ${it.products?.name || ''}`),
          el('td', { class: 'num' }, qty(it.qty)),
          el('td', { class: 'num' }, money(it.cost_price)),
          el('td', { class: 'num' }, money(it.discount_amount || 0)),
          el('td', { class: 'num' }, (Number(it.vat_rate || 0)) + '%'),
          el('td', { class: 'num' }, money(it.line_total)),
        ]))),
      ]),
      header.converted_to_purchase_id ? el('p', { class: 'muted' }, `→ ${t('converted_purchase')}: ${header.converted_to_purchase_id}`) : '',
      el('div', { class: 'form__actions' }, [
        el('button', { class: 'btn btn--primary', onclick: () => dlg.close() }, t('close')),
      ]),
    ]));
  }

  async function openEditor() {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('div', { class: 'state' }, t('loading')));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();

    const [prodRes, supRes] = await Promise.all([
      productsApi.list({ status: 'active', limit: 1000 }),
      suppliersApi.list({ activeOnly: true }),
    ]);
    if (prodRes.error) { clear(dlg); return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(prodRes.error))); }
    if (supRes.error) { clear(dlg); return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(supRes.error))); }
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
    const inExpected = el('input', { type: 'date', class: 'input' });
    const inStatus = el('select', { class: 'input' },
      STATUSES.filter((s) => s !== 'converted').map((s) => el('option', { value: s }, t('status_' + s))));
    const inNotes = el('textarea', { class: 'input', rows: 2 });
    const inInvDisc = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: '0' });
    const itemsHost = el('tbody');
    const subCell = el('td', { class: 'num' }, money(0));
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
        const q = Number(inQty.value || 0), c = Number(inCost.value || 0);
        const d = Number(inDisc.value || 0), v = Number(inVatR.value || 0);
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
        qty: Number(inQty.value || 0), cost_price: Number(inCost.value || 0),
        discount_amount: Number(inDisc.value || 0), vat_rate: Number(inVatR.value || 0),
      });
      itemsHost.appendChild(row);
    }
    function recalcGrand() {
      let sub = 0, vat = 0;
      for (const r of itemsHost.children) {
        const v = r.__get();
        const net = Math.max(0, (v.qty || 0) * (v.cost_price || 0) - (v.discount_amount || 0));
        sub += net; vat += net * (v.vat_rate || 0) / 100;
      }
      const invDisc = Math.min(Number(inInvDisc.value || 0), sub);
      const finalSub = sub - invDisc;
      subCell.textContent = money(finalSub);
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
            po_number: requireStr(inNumber.value, t('po_number')),
            supplier_id: inSupSel.value || null,
            supplier: inSupTxt.value.trim() || null,
            po_date: inDate.value || isoDate(),
            expected_date: inExpected.value || null,
            status: inStatus.value,
            notes: inNotes.value.trim() || null,
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
          const { error } = await posApi.create(payload);
          if (error) throw new Error(errMsg(error));
          toast(t('create') + ' ✓', 'success');
          dlg.close(); refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, t('new_po')),
      el('div', { class: 'grid-2' }, [
        field(t('po_number'), inNumber),
        field(t('supplier'), inSupSel),
        field(t('supplier') + ' (' + t('optional') + ')', inSupTxt),
        field(t('po_date'), inDate),
        field(t('expected_date'), inExpected),
        field(t('status'), inStatus),
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
          el('tr', {}, [el('td', { colspan: '5', class: 'num' }, t('vat')), vatCell, el('td', {}, '')]),
          el('tr', {}, [el('td', { colspan: '5', class: 'num strong' }, t('grand_total')), grandCell, el('td', {}, '')]),
        ]),
      ]),
      el('div', {}, el('button', { type: 'button', class: 'btn btn--ghost', onclick: addRow }, t('add_more'))),
      field(t('invoice_discount'), inInvDisc),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, t('create')),
      ]),
    ]);
    clear(dlg); dlg.appendChild(form);
  }
}

function meta(label, value) {
  return el('div', { class: 'meta' }, [
    el('span', { class: 'meta__label' }, label),
    el('span', { class: 'meta__value' }, value),
  ]);
}
