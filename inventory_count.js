// frontend/inventory_count.js  (Phase 17)
import { inventoryCountApi, productsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, qty, fmtDate, nextDocNumber, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary', disabled: !isManagerOrAdmin,
    onclick: () => openNewCount() }, '+ ' + t('new_count'));

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '📦 ' + t('inventory_count')),
    el('div', { class: 'toolbar__spacer' }),
    newBtn,
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);
  await refresh();

  async function refresh() {
    renderLoading(card);
    const { data, error } = await inventoryCountApi.list();
    if (error) return renderError(card, error);
    if (!data.length) return renderEmpty(card, t('no_counts_yet'));

    clear(card);
    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('count_number')),
        el('th', {}, t('date')),
        el('th', {}, t('status')),
        el('th', {}, t('notes')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, data.map((c) => el('tr', { style: 'cursor:pointer', onclick: () => openDetail(c.id) }, [
        el('td', { class: 'mono strong' }, c.count_number),
        el('td', {}, fmtDate(c.count_date)),
        el('td', {}, el('span', { class: `pill pill--${c.status === 'posted' ? 'ok' : 'warn'}` }, t(c.status))),
        el('td', { class: 'muted small' }, c.notes || '—'),
        el('td', {}, '↗'),
      ]))),
    ]));
  }

  async function openNewCount() {
    const dlg = el('dialog', { class: 'dialog' });
    const inDate = el('input', { type: 'date', class: 'input', value: new Date().toISOString().slice(0, 10) });
    const inNotes = el('input', { class: 'input', placeholder: t('notes') });
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const res = await inventoryCountApi.create({
            count_number: nextDocNumber('CNT'),
            count_date: inDate.value,
            notes: inNotes.value.trim() || null,
          });
          if (res.error) throw new Error(errMsg(res.error));
          // Snapshot stock
          await inventoryCountApi.snapshot(res.data.id);
          toast('✓', 'success');
          dlg.close();
          openDetail(res.data.id);
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, '+ ' + t('new_count')),
      el('p', { class: 'muted' }, t('count_intro')),
      field(t('date'), inDate), field(t('notes'), inNotes),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, t('start_count')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  async function openDetail(id) {
    clear(host);
    const { data, error } = await inventoryCountApi.get(id);
    if (error) return renderError(host, error);
    const { header, items } = data;

    const backBtn = el('button', { class: 'btn btn--ghost', onclick: () => render(host) }, '← ' + t('back'));
    host.append(el('div', { class: 'toolbar' }, [
      backBtn,
      el('h1', { class: 'view-title' }, '📦 ' + header.count_number),
      el('div', { class: 'toolbar__spacer' }),
      el('span', { class: `pill pill--${header.status === 'posted' ? 'ok' : 'warn'}` }, t(header.status)),
    ]));

    if (header.status === 'posted') {
      // Read-only summary
      const card = el('div', { class: 'card' });
      host.appendChild(card);
      renderItemsTable(card, items, /* readOnly */ true);
      return;
    }

    // Editable: enter counted quantities
    const filterIn = el('input', { class: 'input', placeholder: '🔍 ' + t('search'),
      oninput: (e) => {
        const f = e.target.value.toLowerCase();
        for (const row of document.querySelectorAll('.ic-row')) {
          const txt = (row.dataset.search || '').toLowerCase();
          row.style.display = txt.includes(f) ? '' : 'none';
        }
      } });
    host.appendChild(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
      el('span', { class: 'muted' }, t('total_items') + ': ' + items.length),
      el('div', { class: 'toolbar__spacer' }),
      filterIn,
    ]));

    const card = el('div', { class: 'card' });
    host.appendChild(card);
    renderItemsTable(card, items, false);

    // Action bar at bottom
    host.appendChild(el('div', { class: 'toolbar', style: 'margin-top:16px' }, [
      el('button', { class: 'btn btn--danger',
        onclick: async () => {
          if (!confirm(t('confirm_delete_count'))) return;
          await inventoryCountApi.remove(id);
          toast('✓', 'success'); render(host);
        } }, '🗑 ' + t('delete')),
      el('div', { class: 'toolbar__spacer' }),
      el('button', { class: 'btn btn--primary',
        onclick: async () => {
          if (!confirm(t('confirm_post_count'))) return;
          const res = await inventoryCountApi.post(id);
          if (res.error) return toast(errMsg(res.error), 'error');
          toast(`✅ ${t('count_posted')} • ${t('shortage')}: ${money(res.data.shortage)} • ${t('excess')}: ${money(res.data.excess)}`, 'success');
          render(host);
        } }, '✅ ' + t('post_count')),
    ]));
  }

  function renderItemsTable(host, items, readOnly) {
    host.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('sku')),
        el('th', {}, t('name')),
        el('th', { class: 'num' }, t('system_qty')),
        el('th', { class: 'num' }, t('counted_qty')),
        el('th', { class: 'num' }, t('variance')),
      ])),
      el('tbody', {}, items.map((it) => {
        const varClass = it.variance > 0 ? 'pos' : it.variance < 0 ? 'neg' : 'muted';
        const qtyInput = readOnly
          ? el('span', { class: 'mono' }, qty(it.counted_qty))
          : el('input', {
              type: 'number', step: '0.001', min: '0', class: 'input num',
              style: 'max-width:120px; text-align:end',
              value: it.counted_qty,
              onchange: async (e) => {
                const newQ = Number(e.target.value || 0);
                await inventoryCountApi.updateItem(it.id, newQ);
                // Update variance cell
                const row = e.target.closest('tr');
                const cell = row.querySelector('td:last-child');
                const diff = newQ - Number(it.system_qty);
                cell.textContent = qty(diff);
                cell.className = 'num ' + (diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'muted');
              },
            });

        return el('tr', { class: 'ic-row', 'data-search': `${it.products?.sku} ${it.products?.name}` }, [
          el('td', { class: 'mono' }, it.products?.sku || ''),
          el('td', {}, it.products?.name || ''),
          el('td', { class: 'num mono' }, qty(it.system_qty)),
          el('td', { class: 'num' }, qtyInput),
          el('td', { class: 'num ' + varClass }, qty(it.variance)),
        ]);
      })),
    ]));
  }
}
