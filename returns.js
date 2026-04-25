// frontend/returns.js  (Phase 3)
import { returnsApi, productsApi, inventoryApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, qty, isoDate, fmtDate, requireStr, requireNum, nextDocNumber, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary' }, t('new_return'));
  if (!isManagerOrAdmin) newBtn.disabled = true;

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('returns')),
    el('div', { class: 'toolbar__spacer' }),
    newBtn,
  ]));

  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  async function refresh() {
    renderLoading(tableHost);
    const { data, error } = await returnsApi.list({});
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_returns'));

    const rows = data.map((r) => el('tr', {}, [
      el('td', { class: 'mono' }, r.return_number),
      el('td', {}, el('span', { class: `pill pill--${r.kind}` },
        r.kind === 'return_in' ? t('return_in') : t('return_out'))),
      el('td', {}, r.party_name || '—'),
      el('td', {}, fmtDate(r.return_date)),
      el('td', { class: 'num' }, money(r.grand_total)),
      el('td', { class: 'actions' }, el('button', {
        class: 'btn btn--ghost', onclick: () => openDetail(r.id),
      }, t('view'))),
    ]));

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'), el('th', {}, t('return_kind')),
        el('th', {}, t('return_party')), el('th', {}, t('date')),
        el('th', { class: 'num' }, t('total')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, rows),
    ]));
  }

  newBtn.addEventListener('click', openEditor);
  await refresh();

  async function openDetail(id) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('div', { class: 'state' }, t('loading')));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();

    const { data, error } = await returnsApi.getDetail(id);
    clear(dlg);
    if (error) return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(error)));
    const { header, items } = data;

    dlg.appendChild(el('div', {}, [
      el('h2', {}, `${t('return_number')} ${header.return_number}`),
      el('div', { class: 'meta-grid' }, [
        meta(t('return_kind'), header.kind === 'return_in' ? t('return_in') : t('return_out')),
        meta(t('return_party'), header.party_name || '—'),
        meta(t('date'), fmtDate(header.return_date)),
        meta(t('subtotal'), money(header.subtotal)),
        meta(t('vat'), money(header.total_vat)),
        meta(t('grand_total'), money(header.grand_total)),
      ]),
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('product')),
          el('th', { class: 'num' }, t('qty')),
          el('th', { class: 'num' }, t('unit_price')),
          el('th', { class: 'num' }, t('vat_rate')),
          el('th', { class: 'num' }, t('vat_amount')),
          el('th', { class: 'num' }, t('line_total')),
        ])),
        el('tbody', {}, items.map((it) => el('tr', {}, [
          el('td', {}, `${it.products?.sku || ''} — ${it.products?.name || ''}`),
          el('td', { class: 'num' }, qty(it.qty)),
          el('td', { class: 'num' }, money(it.unit_price)),
          el('td', { class: 'num' }, (Number(it.vat_rate || 0)) + '%'),
          el('td', { class: 'num' }, money(it.vat_amount)),
          el('td', { class: 'num' }, money(it.line_total)),
        ]))),
      ]),
      header.notes ? el('p', { class: 'muted', style: 'margin-top:1rem' }, header.notes) : null,
      el('div', { class: 'form__actions' }, [
        el('button', { class: 'btn btn--primary', onclick: () => dlg.close() }, t('close')),
      ]),
    ]));
  }

  async function openEditor() {
    if (!isManagerOrAdmin) { toast(t('permission_denied'), 'error'); return; }
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('div', { class: 'state' }, t('loading')));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();

    const [prodRes, invRes] = await Promise.all([
      productsApi.list({ limit: 200 }),
      inventoryApi.list({}),
    ]);
    if (prodRes.error) { clear(dlg); dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(prodRes.error))); return; }
    const products = prodRes.data;
    const inv = invRes.data || [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    const stockMap = new Map(inv.map((r) => [r.product_id, Number(r.current_stock)]));

    const inNumber = el('input', { class: 'input', value: nextDocNumber('RT'), required: true });
    const inKind = el('select', { class: 'input' }, [
      el('option', { value: 'return_in' }, t('return_in')),
      el('option', { value: 'return_out' }, t('return_out')),
    ]);
    const inParty = el('input', { class: 'input', placeholder: t('return_party') });
    const inDate = el('input', { type: 'date', class: 'input', value: isoDate() });
    const inNotes = el('textarea', { class: 'input', rows: 2 });
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
      const inPrice = el('input', { type: 'number', class: 'input num', min: '0', step: '0.0001' });
      const inVatR = el('input', { type: 'number', class: 'input num', min: '0', max: '100', step: '0.01', value: '0' });
      const lineTotalCell = el('td', { class: 'num' }, money(0));
      const stockHint = el('div', { class: 'hint' }, '');

      function recalc() {
        const q = Number(inQty.value || 0);
        const p = Number(inPrice.value || 0);
        const v = Number(inVatR.value || 0);
        const net = q * p;
        lineTotalCell.textContent = money(net + (net * v / 100));
        // Show stock warning only for return_out (we're removing stock)
        if (inKind.value === 'return_out' && productSel.value) {
          const avail = stockMap.get(productSel.value) || 0;
          if (q > avail) {
            stockHint.textContent = t('only_n_in_stock', { n: qty(avail) });
            stockHint.className = 'hint hint--bad';
          } else {
            stockHint.textContent = `${qty(avail)} ${t('in_stock')}`;
            stockHint.className = 'hint';
          }
        } else stockHint.textContent = '';
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
      inQty.addEventListener('input', recalc);
      inPrice.addEventListener('input', recalc);
      inVatR.addEventListener('input', recalc);
      inKind.addEventListener('change', recalc);

      const row = el('tr', {}, [
        el('td', {}, [productSel, stockHint]),
        el('td', {}, inQty), el('td', {}, inPrice),
        el('td', {}, inVatR), lineTotalCell,
        el('td', {}, el('button', { type: 'button', class: 'btn btn--ghost',
          onclick: () => { row.remove(); recalcGrand(); } }, '×')),
      ]);
      row.__get = () => ({
        product_id: productSel.value,
        qty: Number(inQty.value || 0),
        unit_price: Number(inPrice.value || 0),
        vat_rate: Number(inVatR.value || 0),
      });
      itemsHost.appendChild(row);
    }
    function recalcGrand() {
      let sub = 0, vat = 0;
      for (const r of itemsHost.children) {
        const v = r.__get();
        const net = (v.qty || 0) * (v.unit_price || 0);
        sub += net; vat += net * (v.vat_rate || 0) / 100;
      }
      subCell.textContent = money(sub);
      vatCell.textContent = money(vat);
      grandCell.textContent = money(sub + vat);
    }
    addRow();
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const payload = {
            return_number: requireStr(inNumber.value, t('return_number')),
            kind: inKind.value,
            party_name: inParty.value.trim() || null,
            return_date: inDate.value || isoDate(),
            notes: inNotes.value.trim() || null,
            items: [...itemsHost.children].map((row, idx) => {
              const v = row.__get();
              if (!v.product_id) throw new Error(`${idx + 1}: ${t('select_product')}`);
              requireNum(v.qty, `${idx + 1} ${t('qty')}`, { min: 0.001 });
              requireNum(v.unit_price, `${idx + 1} ${t('unit_price')}`, { min: 0 });
              return v;
            }),
          };
          if (!payload.items.length) throw new Error(t('add_more'));
          const { error } = await returnsApi.create(payload);
          if (error) throw new Error(errMsg(error));
          toast(t('create') + ' ✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, t('new_return')),
      el('div', { class: 'grid-2' }, [
        field(t('return_number'), inNumber),
        field(t('return_kind'), inKind),
        field(t('return_party'), inParty),
        field(t('date'), inDate),
      ]),
      field(t('notes'), inNotes),
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('product')),
          el('th', { class: 'num' }, t('qty')),
          el('th', { class: 'num' }, t('unit_price')),
          el('th', { class: 'num' }, t('vat_rate')),
          el('th', { class: 'num' }, t('line_total')),
          el('th', {}, ''),
        ])),
        itemsHost,
        el('tfoot', {}, [
          el('tr', {}, [el('td', { colspan: '4', class: 'num' }, t('subtotal')), subCell, el('td', {}, '')]),
          el('tr', {}, [el('td', { colspan: '4', class: 'num' }, t('vat')), vatCell, el('td', {}, '')]),
          el('tr', {}, [el('td', { colspan: '4', class: 'num strong' }, t('grand_total')), grandCell, el('td', {}, '')]),
        ]),
      ]),
      el('div', {}, el('button', { type: 'button', class: 'btn btn--ghost', onclick: addRow }, t('add_more'))),
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
