// frontend/cash_drawer.js  (Phase 5)
import { cashApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, money, errMsg, field, requireNum,
} from './utils.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, t('cash_title')));

  const sessionBox = el('div', { class: 'card' });
  const historyBox = el('div', { class: 'card', style: 'margin-top:1rem' });
  host.append(sessionBox, historyBox);

  await refresh();

  async function refresh() {
    renderLoading(sessionBox);
    const [current, history] = await Promise.all([cashApi.currentSession(), cashApi.history()]);
    if (current.error) return renderError(sessionBox, current.error);
    clear(sessionBox);

    if (current.data) {
      renderOpenSession(current.data);
    } else {
      renderOpenButton();
    }

    clear(historyBox);
    historyBox.appendChild(el('h2', {}, t('session_history')));
    if (history.error) { historyBox.appendChild(el('div', { class: 'state state--error' }, errMsg(history.error))); return; }
    if (!history.data.length) { historyBox.appendChild(el('div', { class: 'state' }, t('no_session'))); return; }

    historyBox.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'), el('th', {}, t('status')),
        el('th', {}, t('session_open_since')),
        el('th', { class: 'num' }, t('opening_balance')),
        el('th', { class: 'num' }, t('expected_balance')),
        el('th', { class: 'num' }, t('closing_balance')),
        el('th', { class: 'num' }, t('variance')),
      ])),
      el('tbody', {}, history.data.map((s) => {
        const v = Number(s.variance || 0);
        const vCls = s.status === 'open' ? '' : Math.abs(v) < 0.01 ? 'pos' : 'neg';
        return el('tr', {}, [
          el('td', { class: 'mono' }, s.session_number),
          el('td', {}, el('span', { class: 'pill ' + (s.status === 'open' ? 'pill--warn' : 'pill--ok') },
            s.status === 'open' ? '🟢 ' + t('status_draft') : '🔒 ' + t('session_closed'))),
          el('td', {}, new Date(s.opened_at).toLocaleString()),
          el('td', { class: 'num' }, money(s.opening_balance)),
          el('td', { class: 'num' }, s.expected_balance != null ? money(s.expected_balance) : '—'),
          el('td', { class: 'num' }, s.closing_balance != null ? money(s.closing_balance) : '—'),
          el('td', { class: 'num ' + vCls }, s.variance != null ? money(v) : '—'),
        ]);
      })),
    ]));
  }

  function renderOpenButton() {
    const { isManagerOrAdmin } = auth.state;
    sessionBox.appendChild(el('h2', {}, t('no_session')));

    const inOpening = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: '0' });
    const inNotes = el('input', { class: 'input' });
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const opening = requireNum(inOpening.value, t('opening_balance'), { min: 0 });
          const { error } = await cashApi.open(opening, inNotes.value.trim());
          if (error) throw new Error(errMsg(error));
          toast('🟢 ' + t('open_session') + ' ✓', 'success');
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('div', { class: 'grid-2' }, [
        field(t('opening_balance'), inOpening),
        field(t('notes'), inNotes),
      ]),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'submit', class: 'btn btn--primary', disabled: !isManagerOrAdmin },
          '🟢 ' + t('open_session')),
      ]),
    ]);
    sessionBox.appendChild(form);
  }

  function renderOpenSession(s) {
    sessionBox.appendChild(el('div', { style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap' }, [
      el('h2', {}, '🟢 ' + s.session_number),
      el('span', { class: 'muted' }, t('session_open_since') + ': ' + new Date(s.opened_at).toLocaleString()),
    ]));
    sessionBox.appendChild(el('div', { class: 'meta-grid' }, [
      meta(t('opening_balance'), money(s.opening_balance)),
      meta(t('cash_sales'), money(s.cash_sales || 0), 'pos'),
      meta(t('cash_purchases'), money(s.cash_purchases || 0), 'neg'),
      meta(t('cash_expenses'), money(s.cash_expenses || 0), 'neg'),
    ]));

    // Close form
    const inClosing = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: '0' });
    const inNotes = el('input', { class: 'input' });
    const errBox = el('div', { class: 'form-error', hidden: true });
    const { isManagerOrAdmin } = auth.state;

    const form = el('form', {
      class: 'form',
      style: 'margin-top:1rem',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        if (!confirm(t('confirm_close'))) return;
        try {
          const closing = requireNum(inClosing.value, t('closing_balance'), { min: 0 });
          const { error } = await cashApi.close(s.id, closing, inNotes.value.trim());
          if (error) throw new Error(errMsg(error));
          toast(t('session_closed'), 'success');
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h3', {}, t('close_session')),
      el('div', { class: 'grid-2' }, [
        field(t('actual_balance'), inClosing),
        field(t('notes'), inNotes),
      ]),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'submit', class: 'btn btn--danger', disabled: !isManagerOrAdmin },
          '🔒 ' + t('close_session')),
      ]),
    ]);
    sessionBox.appendChild(form);
  }
}

function meta(label, value, cls = '') {
  return el('div', { class: 'meta' }, [
    el('span', { class: 'meta__label' }, label),
    el('span', { class: 'meta__value ' + cls }, value),
  ]);
}
