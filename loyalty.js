// frontend/loyalty.js  (Phase 17)
import { loyaltyApi, customersApi, settingsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, fmtDate, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  host.appendChild(el('h1', { class: 'view-title' }, '🎟 ' + t('loyalty_program')));

  // Load customers + settings
  const [custRes, settRes] = await Promise.all([customersApi.list({}), settingsApi.get()]);
  if (custRes.error) return renderError(host, custRes.error);
  const customers = custRes.data || [];
  const settings = settRes.data || {};

  // Settings card
  const settingsCard = el('div', { class: 'card' });
  host.appendChild(settingsCard);
  settingsCard.appendChild(el('h3', {}, '⚙️ ' + t('loyalty_settings')));
  const enabledChk = el('input', { type: 'checkbox', checked: settings.loyalty_enabled || false });
  const earnPerIn = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num',
    value: settings.loyalty_earn_per ?? 10 });
  const redeemValIn = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num',
    value: settings.loyalty_redeem_value ?? 1 });
  const saveSettBtn = el('button', { class: 'btn btn--primary',
    onclick: async () => {
      const { error } = await settingsApi.save({
        loyalty_enabled: enabledChk.checked,
        loyalty_earn_per: Number(earnPerIn.value),
        loyalty_redeem_value: Number(redeemValIn.value),
      });
      if (error) return toast(errMsg(error), 'error');
      toast('✓', 'success');
    } }, t('save'));
  settingsCard.appendChild(el('div', { class: 'grid-2', style: 'margin-top:8px' }, [
    el('div', {}, el('label', { style: 'display:flex; gap:6px' }, [enabledChk, el('span', {}, t('loyalty_enabled'))])),
    el('div', {}),
    field('💰 ' + t('earn_per_amount') + ' (1 ' + t('point') + ')', earnPerIn),
    field('🎁 ' + t('point_value'), redeemValIn),
  ]));
  settingsCard.appendChild(el('div', { style: 'margin-top:8px' }, saveSettBtn));
  settingsCard.appendChild(el('p', { class: 'muted small', style: 'margin-top:12px' }, t('loyalty_hint')));

  // Customers list with points
  host.appendChild(el('h3', { style: 'margin-top:24px' }, '👥 ' + t('customer_points')));
  const card = el('div', { class: 'card' });
  host.appendChild(card);

  async function refresh() {
    renderLoading(card);
    const { data, error } = await customersApi.list({});
    if (error) return renderError(card, error);
    const withPoints = data.filter((c) => (c.loyalty_points || 0) !== 0);
    if (!withPoints.length) {
      renderEmpty(card, t('no_customer_points'));
      const allBtn = el('button', { class: 'btn btn--ghost',
        onclick: () => openManual(data) }, '+ ' + t('manual_adjust'));
      card.appendChild(el('div', { style: 'margin-top:12px; text-align:center' }, allBtn));
      return;
    }
    clear(card);
    card.appendChild(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
      el('div', { class: 'toolbar__spacer' }),
      el('button', { class: 'btn btn--ghost', onclick: () => openManual(data) }, '+ ' + t('manual_adjust')),
    ]));
    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('customer')),
        el('th', {}, t('phone')),
        el('th', { class: 'num' }, '🎟 ' + t('points')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, withPoints.sort((a, b) => b.loyalty_points - a.loyalty_points).map((c) => el('tr', {}, [
        el('td', { class: 'strong' }, c.name),
        el('td', {}, c.phone || '—'),
        el('td', { class: 'num strong' }, Number(c.loyalty_points).toFixed(2)),
        el('td', {}, [
          el('button', { class: 'btn btn--ghost', onclick: () => openHistory(c) }, '📜 ' + t('history')),
          el('button', { class: 'btn btn--ghost', onclick: () => openManual(data, c) }, '⚙️'),
        ]),
      ]))),
    ]));
  }

  async function openHistory(customer) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('h2', {}, '📜 ' + customer.name + ' — ' + t('points_history')));
    const body = el('div');
    dlg.appendChild(body);
    renderLoading(body);

    const { data, error } = await loyaltyApi.history(customer.id);
    if (error) { body.innerHTML = ''; renderError(body, error); return; }
    clear(body);

    body.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('date')), el('th', {}, t('type')),
        el('th', { class: 'num' }, t('points')), el('th', {}, t('notes')),
      ])),
      el('tbody', {}, data.map((txn) => el('tr', {}, [
        el('td', {}, fmtDate(txn.created_at)),
        el('td', {}, el('span', { class: `pill pill--${txn.kind === 'earn' ? 'ok' : txn.kind === 'redeem' ? 'danger' : 'warn'}` }, t(txn.kind))),
        el('td', { class: 'num ' + (txn.kind === 'earn' || txn.kind === 'adjust' ? 'pos' : 'neg') },
          (txn.kind === 'redeem' || txn.kind === 'expire' ? '-' : '+') + Math.abs(Number(txn.points)).toFixed(2)),
        el('td', { class: 'muted small' }, txn.notes || '—'),
      ]))),
    ]));

    dlg.appendChild(el('div', { class: 'form__actions' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => dlg.close() }, t('close')),
    ]));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  async function openManual(allCustomers, preset = null) {
    const dlg = el('dialog', { class: 'dialog' });
    const inCust = el('select', { class: 'input', required: true }, [
      el('option', { value: '' }, '— ' + t('select') + ' —'),
      ...allCustomers.map((c) => el('option', { value: c.id }, `${c.name}${c.loyalty_points ? ' (' + c.loyalty_points + ')' : ''}`)),
    ]);
    if (preset) inCust.value = preset.id;
    const inKind = el('select', { class: 'input' }, [
      el('option', { value: 'earn' }, '+ ' + t('earn')),
      el('option', { value: 'redeem' }, '- ' + t('redeem')),
      el('option', { value: 'adjust' }, t('adjust')),
      el('option', { value: 'expire' }, t('expire')),
    ]);
    const inPts = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', required: true });
    const inNotes = el('input', { class: 'input', placeholder: t('notes') });
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          if (!inCust.value) throw new Error(t('select_customer'));
          const { data, error } = await loyaltyApi.adjust(inCust.value, inKind.value, Number(inPts.value), null, inNotes.value.trim());
          if (error) throw new Error(errMsg(error));
          toast(`✓ ${t('new_balance')}: ${data}`, 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, '⚙️ ' + t('manual_adjust')),
      field(t('customer'), inCust),
      el('div', { class: 'grid-2' }, [field(t('type'), inKind), field(t('points'), inPts)]),
      field(t('notes'), inNotes),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, t('apply')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  await refresh();
}
