// frontend/inventory.js  (Phase 2)
import { inventoryApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty, debounce,
  money, qty, fmtDate, requireStr, requireNum, errMsg,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  const searchInput   = el('input', { type: 'search', class: 'input', placeholder: t('search') });
  const brandInput    = el('input', { type: 'text', class: 'input', placeholder: t('brand') });
  const categoryInput = el('input', { type: 'text', class: 'input', placeholder: t('category') });

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('inventory')),
    el('div', { class: 'toolbar__spacer' }),
    searchInput, brandInput, categoryInput,
  ]));
  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  const refresh = debounce(async () => {
    renderLoading(tableHost);
    const { data, error } = await inventoryApi.list({
      search: searchInput.value.trim(),
      brand:  brandInput.value.trim() || null,
      category: categoryInput.value.trim() || null,
    });
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_inventory'));

    const rows = data.map((r) => {
      const stock = Number(r.current_stock);
      const pill = stock <= 0 ? 'pill pill--danger' : stock < 10 ? 'pill pill--warn' : 'pill pill--ok';
      return el('tr', {}, [
        el('td', { class: 'mono' }, r.sku),
        el('td', {}, r.name),
        el('td', {}, r.brand || '—'),
        el('td', {}, r.category || '—'),
        el('td', { class: 'num' }, el('span', { class: pill }, qty(stock))),
        el('td', { class: 'num' }, money(r.wac)),
        el('td', { class: 'num' }, money(r.stock_value)),
        el('td', { class: 'actions' }, el('button', {
          class: 'btn btn--ghost', onclick: () => openDrawer(r),
        }, t('movements'))),
      ]);
    });

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('sku')), el('th', {}, t('name')), el('th', {}, t('brand')),
        el('th', {}, t('category')), el('th', { class: 'num' }, t('stock')),
        el('th', { class: 'num' }, t('wac')), el('th', { class: 'num' }, t('value')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, rows),
    ]));
  }, 200);

  searchInput.addEventListener('input', refresh);
  brandInput.addEventListener('input', refresh);
  categoryInput.addEventListener('input', refresh);
  await refresh();

  async function openDrawer(item) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();

    async function redraw() {
      clear(dlg);
      dlg.appendChild(el('div', { class: 'state' }, t('loading')));
      const { data, error } = await inventoryApi.movementsForProduct(item.product_id);
      clear(dlg);
      if (error) return dlg.appendChild(el('div', { class: 'state state--error' }, errMsg(error)));

      dlg.appendChild(el('h2', {}, `${item.sku} — ${item.name}`));
      dlg.appendChild(el('div', { class: 'meta-grid' }, [
        meta(t('stock'), qty(item.current_stock)),
        meta(t('wac'), money(item.wac)),
        meta(t('value'), money(item.stock_value)),
      ]));

      if (isManagerOrAdmin) {
        const adjQty = el('input', { type: 'number', class: 'input num', step: '0.001' });
        const adjReason = el('input', { type: 'text', class: 'input', placeholder: t('reason') });
        const adjErr = el('div', { class: 'form-error', hidden: true });
        const adjForm = el('form', {
          class: 'form form--inline',
          onsubmit: async (e) => {
            e.preventDefault();
            adjErr.hidden = true;
            try {
              const q = requireNum(adjQty.value, t('qty_pos_or_neg'));
              if (q === 0) throw new Error(t('qty_pos_or_neg'));
              const reason = requireStr(adjReason.value, t('reason'));
              const { error } = await inventoryApi.adjust(item.product_id, q, reason);
              if (error) throw new Error(errMsg(error));
              toast(t('adjust_stock') + ' ✓', 'success');
              redraw();
            } catch (err) { adjErr.textContent = err.message; adjErr.hidden = false; }
          },
        }, [
          el('strong', {}, t('adjust_stock') + ': '), adjQty, adjReason,
          el('button', { class: 'btn btn--primary' }, t('apply')),
          adjErr,
        ]);
        dlg.appendChild(adjForm);
      }

      if (!data.length) {
        dlg.appendChild(el('div', { class: 'state' }, t('no_movements')));
      } else {
        dlg.appendChild(el('table', { class: 'table' }, [
          el('thead', {}, el('tr', {}, [
            el('th', {}, t('date')), el('th', {}, t('type')),
            el('th', { class: 'num' }, t('qty')),
            el('th', {}, t('reference')), el('th', {}, t('notes')),
          ])),
          el('tbody', {}, data.map((m) => el('tr', {}, [
            el('td', {}, fmtDate(m.movement_date)),
            el('td', {}, el('span', { class: `pill pill--${m.movement_type}` }, m.movement_type)),
            el('td', { class: 'num' }, el('span', {
              class: Number(m.qty) >= 0 ? 'pos' : 'neg',
            }, qty(m.qty))),
            el('td', { class: 'mono' }, m.reference_table || '—'),
            el('td', {}, m.notes || '—'),
          ]))),
        ]));
      }
      dlg.appendChild(el('div', { class: 'form__actions' }, [
        el('button', { class: 'btn btn--primary', onclick: () => dlg.close() }, t('close')),
      ]));
    }
    redraw();
  }
}

function meta(label, value) {
  return el('div', { class: 'meta' }, [
    el('span', { class: 'meta__label' }, label),
    el('span', { class: 'meta__value' }, value),
  ]);
}
