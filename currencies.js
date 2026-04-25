// frontend/currencies.js  (Phase 15)
import { supabase } from './api.js';
import { auth } from './auth.js';
import { i18n, t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  requireStr, errMsg, field, fmtDate,
} from './utils.js';

const currenciesApi = {
  async list() {
    const { data, error } = await supabase.from('currencies').select('*').order('is_base', { ascending: false }).order('code');
    return { data, error };
  },
  async setBase(code) {
    // Unset all, set one
    await supabase.from('currencies').update({ is_base: false }).neq('code', '__none__');
    const { error } = await supabase.from('currencies').update({ is_base: true }).eq('code', code);
    return { error };
  },
  async update(code, row) {
    const { data, error } = await supabase.from('currencies').update(row).eq('code', code).select().single();
    return { data, error };
  },
  async create(row) {
    const { data, error } = await supabase.from('currencies').insert(row).select().single();
    return { data, error };
  },
  async remove(code) {
    const { error } = await supabase.from('currencies').delete().eq('code', code);
    return { error };
  },
  async listRates(pair) {
    let q = supabase.from('exchange_rates').select('*').order('effective_date', { ascending: false }).limit(100);
    if (pair?.from) q = q.eq('from_currency', pair.from);
    if (pair?.to) q = q.eq('to_currency', pair.to);
    const { data, error } = await q;
    return { data, error };
  },
  async addRate(row) {
    const { data, error } = await supabase.from('exchange_rates').insert(row).select().single();
    return { data, error };
  },
  async removeRate(id) {
    const { error } = await supabase.from('exchange_rates').delete().eq('id', id);
    return { error };
  },
};

export async function render(host) {
  clear(host);
  const { isAdmin } = auth.state;

  host.appendChild(el('h1', { class: 'view-title' }, '💱 ' + t('currencies_title')));

  let activeTab = 'list';
  const tabBar = el('div', { class: 'pos__mode-bar', style: 'max-width:500px; margin-bottom:16px' });
  host.appendChild(tabBar);

  function renderTabs() {
    clear(tabBar);
    for (const tab of [['list', '💰 ' + t('currencies')], ['rates', '📈 ' + t('exchange_rates')]]) {
      tabBar.appendChild(el('button', {
        type: 'button',
        class: 'pos__mode-btn ' + (activeTab === tab[0] ? 'pos__mode-btn--active' : ''),
        onclick: () => { activeTab = tab[0]; renderTabs(); renderActive(); },
      }, tab[1]));
    }
  }

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  renderTabs();
  renderActive();

  async function renderActive() {
    if (activeTab === 'list') await renderList();
    else await renderRates();
  }

  async function renderList() {
    renderLoading(card);
    const { data, error } = await currenciesApi.list();
    if (error) return renderError(card, error);
    clear(card);

    const newBtn = el('button', { class: 'btn btn--primary', onclick: () => openCurrencyEditor(null), disabled: !isAdmin },
      '+ ' + t('new_currency'));
    card.appendChild(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
      el('div', { class: 'toolbar__spacer' }), newBtn,
    ]));

    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('code')),
        el('th', {}, t('name')),
        el('th', {}, t('symbol')),
        el('th', {}, t('decimals')),
        el('th', {}, t('status')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, data.map((c) => el('tr', {}, [
        el('td', { class: 'mono strong' }, c.code),
        el('td', {}, i18n.lang === 'ar' ? c.name_ar : c.name_en),
        el('td', { style: 'font-size:18px' }, c.symbol),
        el('td', {}, c.decimal_places),
        el('td', {}, c.is_base ? el('span', { class: 'pill pill--ok' }, '⭐ ' + t('base_currency')) :
          c.is_active ? el('span', { class: 'pill pill--ok' }, t('active')) :
          el('span', { class: 'pill' }, t('inactive'))),
        el('td', {}, [
          !c.is_base && isAdmin ? el('button', { class: 'btn btn--ghost',
            onclick: async () => {
              if (!confirm(t('set_base_confirm', { code: c.code }))) return;
              const { error } = await currenciesApi.setBase(c.code);
              if (error) return toast(errMsg(error), 'error');
              toast('✓', 'success'); renderList();
            },
          }, '⭐ ' + t('set_base')) : '',
          el('button', { class: 'btn btn--ghost', onclick: () => openCurrencyEditor(c), disabled: !isAdmin }, t('edit')),
          el('button', { class: 'btn btn--danger', disabled: !isAdmin || c.is_base,
            onclick: async () => {
              if (!confirm(t('confirm_delete') + ' ' + c.code)) return;
              const { error } = await currenciesApi.remove(c.code);
              if (error) return toast(errMsg(error), 'error');
              toast('✓', 'success'); renderList();
            } }, t('delete')),
        ]),
      ]))),
    ]));
  }

  async function openCurrencyEditor(c) {
    const dlg = el('dialog', { class: 'dialog' });
    const inCode = el('input', { class: 'input mono', required: true, value: c?.code || '',
      maxlength: '5', placeholder: 'USD', disabled: !!c });
    const inAr = el('input', { class: 'input', required: true, value: c?.name_ar || '' });
    const inEn = el('input', { class: 'input', required: true, value: c?.name_en || '' });
    const inSym = el('input', { class: 'input', required: true, value: c?.symbol || '', maxlength: '5' });
    const inDec = el('input', { type: 'number', min: '0', max: '6', class: 'input num',
      value: c?.decimal_places ?? 2 });
    const inActive = el('input', { type: 'checkbox', checked: c ? c.is_active : true });
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const row = {
            code: requireStr(inCode.value, 'Code').toUpperCase(),
            name_ar: requireStr(inAr.value, t('name_ar')),
            name_en: requireStr(inEn.value, t('name_en')),
            symbol: requireStr(inSym.value, t('symbol')),
            decimal_places: Number(inDec.value || 2),
            is_active: inActive.checked,
          };
          const res = c ? await currenciesApi.update(c.code, row) : await currenciesApi.create(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          renderList();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, c ? t('edit_currency') : t('new_currency')),
      el('div', { class: 'grid-2' }, [
        field(t('code'), inCode), field(t('symbol'), inSym),
        field(t('name_ar'), inAr), field(t('name_en'), inEn),
        field(t('decimals'), inDec),
      ]),
      el('label', { style: 'display:flex; gap:6px; margin-top:8px' }, [inActive, el('span', {}, t('active'))]),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, c ? t('save_changes') : t('create')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  async function renderRates() {
    renderLoading(card);
    const [rateRes, curRes] = await Promise.all([currenciesApi.listRates(), currenciesApi.list()]);
    if (rateRes.error) return renderError(card, rateRes.error);
    clear(card);

    const currencies = curRes.data || [];
    const newRateBtn = el('button', { class: 'btn btn--primary', onclick: openRateEditor, disabled: !auth.state.isManagerOrAdmin },
      '+ ' + t('new_rate'));

    card.appendChild(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
      el('div', { class: 'toolbar__spacer' }), newRateBtn,
    ]));

    if (!rateRes.data.length) return renderEmpty(card, t('no_rates'));

    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('date')),
        el('th', {}, t('from')),
        el('th', {}, '→'),
        el('th', {}, t('to')),
        el('th', { class: 'num' }, t('rate')),
        el('th', {}, t('notes')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, rateRes.data.map((r) => el('tr', {}, [
        el('td', {}, fmtDate(r.effective_date)),
        el('td', { class: 'mono strong' }, r.from_currency),
        el('td', {}, '→'),
        el('td', { class: 'mono strong' }, r.to_currency),
        el('td', { class: 'num mono strong' }, Number(r.rate).toFixed(6)),
        el('td', { class: 'small muted' }, r.notes || ''),
        el('td', {}, el('button', { class: 'btn btn--danger', disabled: !isAdmin,
          onclick: async () => {
            if (!confirm(t('confirm_delete'))) return;
            await currenciesApi.removeRate(r.id);
            toast('✓', 'success'); renderRates();
          } }, '×')),
      ]))),
    ]));

    async function openRateEditor() {
      const dlg = el('dialog', { class: 'dialog' });
      const inFrom = el('select', { class: 'input' }, currencies.map((c) => el('option', { value: c.code }, `${c.code} — ${c.symbol}`)));
      const inTo = el('select', { class: 'input' }, currencies.map((c) => el('option', { value: c.code }, `${c.code} — ${c.symbol}`)));
      const baseCurrency = currencies.find((c) => c.is_base);
      if (baseCurrency) inTo.value = baseCurrency.code;
      const inRate = el('input', { type: 'number', step: '0.000001', min: '0', class: 'input num', required: true });
      const inDate = el('input', { type: 'date', class: 'input', value: new Date().toISOString().slice(0, 10) });
      const inNotes = el('input', { class: 'input' });
      const errBox = el('div', { class: 'form-error', hidden: true });

      const form = el('form', {
        class: 'form',
        onsubmit: async (e) => {
          e.preventDefault();
          errBox.hidden = true;
          try {
            if (inFrom.value === inTo.value) throw new Error(t('same_currency_err'));
            const { error } = await currenciesApi.addRate({
              from_currency: inFrom.value, to_currency: inTo.value,
              rate: Number(inRate.value), effective_date: inDate.value,
              notes: inNotes.value.trim() || null,
            });
            if (error) throw new Error(errMsg(error));
            toast('✓', 'success');
            dlg.close();
            renderRates();
          } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
        },
      }, [
        el('h2', {}, '💱 ' + t('new_rate')),
        el('p', { class: 'muted small' }, t('rate_hint')),
        el('div', { class: 'grid-2' }, [
          field(t('from'), inFrom), field(t('to'), inTo),
          field(t('rate'), inRate), field(t('date'), inDate),
        ]),
        field(t('notes'), inNotes),
        errBox,
        el('div', { class: 'form__actions' }, [
          el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
          el('button', { type: 'submit', class: 'btn btn--primary' }, t('create')),
        ]),
      ]);
      dlg.appendChild(form);
      document.body.appendChild(dlg);
      dlg.addEventListener('close', () => dlg.remove());
      dlg.showModal();
    }
  }
}
