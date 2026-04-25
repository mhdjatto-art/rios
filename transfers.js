// frontend/transfers.js  (Phase 6)
import { transfersApi, branchesApi, productsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  qty, fmtDate, isoDate, requireStr, requireNum, nextDocNumber, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary', onclick: () => openEditor() }, t('new_transfer'));
  if (!isManagerOrAdmin) newBtn.disabled = true;

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('transfers')),
    el('div', { class: 'toolbar__spacer' }),
    newBtn,
  ]));
  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  async function refresh() {
    renderLoading(tableHost);
    const { data, error } = await transfersApi.list();
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_transfers'));

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'),
        el('th', {}, t('from_branch')),
        el('th', {}, t('to_branch')),
        el('th', {}, t('date')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, data.map((tr) => el('tr', {}, [
        el('td', { class: 'mono' }, tr.transfer_number),
        el('td', {}, `${tr.from_branch?.code || ''} — ${tr.from_branch?.name || '—'}`),
        el('td', {}, `${tr.to_branch?.code || ''} — ${tr.to_branch?.name || '—'}`),
        el('td', {}, fmtDate(tr.transfer_date)),
        el('td', { class: 'actions' }, el('button', { class: 'btn btn--ghost', onclick: () => openDetail(tr.id) }, t('view'))),
      ]))),
    ]));
  }
  await refresh();

  async function openDetail(id) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('div', { class: 'state' }, t('loading')));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
    const { data, error } = await transfersApi.getDetail(id);
    clear(dlg);
    if (error) return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(error)));
    const { header, items } = data;
    dlg.appendChild(el('div', {}, [
      el('h2', {}, `${t('transfer_number')} ${header.transfer_number}`),
      el('div', { class: 'meta-grid' }, [
        meta(t('from_branch'), `${header.from_branch?.code || ''} — ${header.from_branch?.name || ''}`),
        meta(t('to_branch'), `${header.to_branch?.code || ''} — ${header.to_branch?.name || ''}`),
        meta(t('date'), fmtDate(header.transfer_date)),
      ]),
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('product')),
          el('th', { class: 'num' }, t('qty')),
        ])),
        el('tbody', {}, items.map((it) => el('tr', {}, [
          el('td', {}, `${it.products?.sku || ''} — ${it.products?.name || ''}`),
          el('td', { class: 'num' }, qty(it.qty)),
        ]))),
      ]),
      header.notes ? el('p', { class: 'muted' }, header.notes) : '',
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

    const [brRes, prodRes] = await Promise.all([
      branchesApi.list({ activeOnly: true }),
      productsApi.list({ status: 'active', limit: 1000 }),
    ]);
    if (brRes.error) { clear(dlg); return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(brRes.error))); }
    if (prodRes.error) { clear(dlg); return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(prodRes.error))); }
    const branches = brRes.data;
    const products = prodRes.data;

    if (branches.length < 2) {
      clear(dlg);
      dlg.appendChild(el('div', { class: 'state state--error' }, 'You need at least 2 branches to make a transfer.'));
      dlg.appendChild(el('button', { class: 'btn btn--primary', onclick: () => dlg.close() }, t('close')));
      return;
    }

    const inNumber = el('input', { class: 'input', value: nextDocNumber('TR'), required: true });
    const inFrom = el('select', { class: 'input' }, branches.map((b) => el('option', { value: b.id }, `${b.code} — ${b.name}`)));
    const inTo = el('select', { class: 'input' }, branches.map((b) => el('option', { value: b.id }, `${b.code} — ${b.name}`)));
    if (branches.length > 1) inTo.value = branches[1].id;
    const inDate = el('input', { type: 'date', class: 'input', value: isoDate() });
    const inNotes = el('textarea', { class: 'input', rows: 2 });
    const itemsHost = el('tbody');

    function addRow() {
      const productSel = el('select', { class: 'input' }, [
        el('option', { value: '' }, t('select_product')),
        ...products.map((p) => el('option', { value: p.id }, `${p.sku} — ${p.name}`)),
      ]);
      const inQty = el('input', { type: 'number', class: 'input num', min: '0.001', step: '0.001' });
      const row = el('tr', {}, [
        el('td', {}, productSel),
        el('td', {}, inQty),
        el('td', {}, el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => row.remove() }, '×')),
      ]);
      row.__get = () => ({ product_id: productSel.value, qty: Number(inQty.value || 0) });
      itemsHost.appendChild(row);
    }
    addRow();
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          if (inFrom.value === inTo.value) throw new Error('الفروع لازم تكون مختلفة');
          const payload = {
            transfer_number: requireStr(inNumber.value, t('transfer_number')),
            from_branch_id: inFrom.value,
            to_branch_id: inTo.value,
            transfer_date: inDate.value || isoDate(),
            notes: inNotes.value.trim() || null,
            items: [...itemsHost.children].map((row, idx) => {
              const v = row.__get();
              if (!v.product_id) throw new Error(`${idx + 1}: ${t('select_product')}`);
              requireNum(v.qty, `${idx + 1} ${t('qty')}`, { min: 0.001 });
              return v;
            }),
          };
          if (!payload.items.length) throw new Error(t('add_more'));
          const { error } = await transfersApi.create(payload);
          if (error) throw new Error(errMsg(error));
          toast('✓', 'success'); dlg.close(); refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, t('new_transfer')),
      el('div', { class: 'grid-2' }, [
        field(t('transfer_number'), inNumber),
        field(t('date'), inDate),
        field(t('from_branch'), inFrom),
        field(t('to_branch'), inTo),
      ]),
      field(t('notes'), inNotes),
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('product')),
          el('th', { class: 'num' }, t('qty')),
          el('th', {}, ''),
        ])),
        itemsHost,
      ]),
      el('div', {}, el('button', { type: 'button', class: 'btn btn--ghost', onclick: addRow }, t('add_more'))),
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
