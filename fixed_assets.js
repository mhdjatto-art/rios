// frontend/fixed_assets.js  (Phase 17)
import { fixedAssetsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  requireStr, money, fmtDate, errMsg, field, nextDocNumber,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary', disabled: !isManagerOrAdmin,
    onclick: () => openEditor(null) }, '+ ' + t('new_asset'));
  const deprecBtn = el('button', { class: 'btn btn--ghost', disabled: !isManagerOrAdmin,
    onclick: runDepreciation }, '🕐 ' + t('run_monthly_depreciation'));

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '🏛 ' + t('fixed_assets')),
    el('div', { class: 'toolbar__spacer' }),
    deprecBtn, newBtn,
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  async function refresh() {
    renderLoading(card);
    const { data, error } = await fixedAssetsApi.list();
    if (error) return renderError(card, error);
    if (!data.length) return renderEmpty(card, t('no_assets'));

    clear(card);
    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'),
        el('th', {}, t('name')),
        el('th', {}, t('category')),
        el('th', {}, t('purchase_date')),
        el('th', { class: 'num' }, t('purchase_cost')),
        el('th', { class: 'num' }, t('accumulated_depreciation')),
        el('th', { class: 'num' }, t('net_book_value')),
        el('th', {}, t('status')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, data.map((a) => {
        const nbv = Number(a.purchase_cost) - Number(a.accumulated_depreciation);
        return el('tr', {}, [
          el('td', { class: 'mono' }, a.asset_number),
          el('td', { class: 'strong' }, a.name),
          el('td', {}, a.category || '—'),
          el('td', {}, fmtDate(a.purchase_date)),
          el('td', { class: 'num' }, money(a.purchase_cost)),
          el('td', { class: 'num neg' }, '(' + money(a.accumulated_depreciation) + ')'),
          el('td', { class: 'num strong' }, money(nbv)),
          el('td', {}, el('span', { class: `pill pill--${a.status === 'active' ? 'ok' : ''}` }, t(a.status))),
          el('td', {}, [
            el('button', { class: 'btn btn--ghost', onclick: () => openEditor(a), disabled: !isManagerOrAdmin }, t('edit')),
            el('button', { class: 'btn btn--danger', disabled: !isManagerOrAdmin,
              onclick: async () => {
                if (!confirm(t('confirm_delete'))) return;
                await fixedAssetsApi.remove(a.id);
                toast('✓', 'success'); refresh();
              } }, '×'),
          ]),
        ]);
      })),
    ]));
  }

  async function openEditor(a) {
    const dlg = el('dialog', { class: 'dialog' });
    const inNum = el('input', { class: 'input mono', required: true, value: a?.asset_number || nextDocNumber('FA'), disabled: !!a });
    const inName = el('input', { class: 'input', required: true, value: a?.name || '' });
    const inCat = el('select', { class: 'input' }, [
      el('option', { value: 'equipment' }, t('equipment')),
      el('option', { value: 'furniture' }, t('furniture')),
      el('option', { value: 'vehicle' }, t('vehicle')),
      el('option', { value: 'other' }, t('other')),
    ]);
    inCat.value = a?.category || 'equipment';
    const inDate = el('input', { type: 'date', class: 'input', value: a?.purchase_date || new Date().toISOString().slice(0, 10) });
    const inCost = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', required: true, value: a?.purchase_cost ?? 0 });
    const inSalv = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: a?.salvage_value ?? 0 });
    const inLife = el('input', { type: 'number', min: '1', class: 'input num', required: true, value: a?.useful_life_months ?? 60 });
    const inAcc = el('select', { class: 'input' }, [
      el('option', { value: '1210' }, '1210 — ' + t('equipment_account')),
      el('option', { value: '1220' }, '1220 — ' + t('furniture_account')),
      el('option', { value: '1230' }, '1230 — ' + t('vehicles_account')),
    ]);
    inAcc.value = a?.account_code || '1210';
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const row = {
            asset_number: requireStr(inNum.value, t('asset_number')),
            name: requireStr(inName.value, t('name')),
            category: inCat.value, purchase_date: inDate.value,
            purchase_cost: Number(inCost.value), salvage_value: Number(inSalv.value),
            useful_life_months: Number(inLife.value), account_code: inAcc.value,
          };
          const res = a ? await fixedAssetsApi.update(a.id, row) : await fixedAssetsApi.create(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, a ? t('edit_asset') : t('new_asset')),
      el('div', { class: 'grid-2' }, [
        field(t('asset_number'), inNum), field(t('name'), inName),
        field(t('category'), inCat), field(t('purchase_date'), inDate),
        field(t('purchase_cost'), inCost), field(t('salvage_value'), inSalv),
        field(t('useful_life_months'), inLife), field(t('depreciation_account'), inAcc),
      ]),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, a ? t('save_changes') : t('create')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  async function runDepreciation() {
    if (!confirm(t('confirm_run_depreciation'))) return;
    deprecBtn.disabled = true;
    const { data, error } = await fixedAssetsApi.runDepreciation(new Date().toISOString().slice(0, 10));
    deprecBtn.disabled = false;
    if (error) return toast(errMsg(error), 'error');
    toast(`✅ ${t('depreciated')}: ${data.assets_depreciated} — ${t('total')}: ${money(data.total_depreciation)}`, 'success');
    refresh();
  }

  await refresh();
}
