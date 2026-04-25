// frontend/recurring.js  (Phase 17)
import { recurringEntriesApi, accountingApi } from './api.js';
import { auth } from './auth.js';
import { i18n, t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  fmtDate, money, errMsg, field, requireStr,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary', disabled: !isAdmin,
    onclick: () => openEditor(null) }, '+ ' + t('new_recurring'));
  const runBtn = el('button', { class: 'btn btn--ghost', disabled: !isAdmin,
    onclick: async () => {
      const { data, error } = await recurringEntriesApi.runDue();
      if (error) return toast(errMsg(error), 'error');
      toast(`✅ ${t('processed')}: ${data}`, 'success');
      refresh();
    } }, '⚡ ' + t('run_due_now'));

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '🔄 ' + t('recurring_entries')),
    el('div', { class: 'toolbar__spacer' }),
    runBtn, newBtn,
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  async function refresh() {
    renderLoading(card);
    const { data, error } = await recurringEntriesApi.list();
    if (error) return renderError(card, error);
    if (!data.length) return renderEmpty(card, t('no_recurring'));

    clear(card);
    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('name')),
        el('th', {}, t('frequency')),
        el('th', {}, t('next_run')),
        el('th', {}, t('status')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, data.map((r) => el('tr', {}, [
        el('td', { class: 'strong' }, r.name),
        el('td', {}, el('span', { class: 'pill pill--info' }, t(r.frequency))),
        el('td', {}, fmtDate(r.next_run_date)),
        el('td', {}, el('span', { class: `pill pill--${r.is_active ? 'ok' : ''}` }, r.is_active ? t('active') : t('paused'))),
        el('td', {}, [
          el('button', { class: 'btn btn--ghost', onclick: () => openEditor(r), disabled: !isAdmin }, t('edit')),
          el('button', { class: 'btn btn--danger', disabled: !isAdmin,
            onclick: async () => {
              if (!confirm(t('confirm_delete'))) return;
              await recurringEntriesApi.remove(r.id);
              toast('✓', 'success'); refresh();
            } }, '×'),
        ]),
      ]))),
    ]));
  }

  async function openEditor(r) {
    const { data: accounts } = await accountingApi.listAccounts();
    const postable = (accounts || []).filter((a) => a.allow_posting && a.is_active);

    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    const inName = el('input', { class: 'input', required: true, value: r?.name || '' });
    const inFreq = el('select', { class: 'input' }, [
      el('option', { value: 'daily' }, t('daily')),
      el('option', { value: 'weekly' }, t('weekly')),
      el('option', { value: 'monthly' }, t('monthly')),
      el('option', { value: 'yearly' }, t('yearly')),
    ]);
    inFreq.value = r?.frequency || 'monthly';
    const inNext = el('input', { type: 'date', class: 'input', required: true,
      value: r?.next_run_date || new Date().toISOString().slice(0, 10) });
    const inEnd = el('input', { type: 'date', class: 'input', value: r?.end_date || '' });
    const inActive = el('input', { type: 'checkbox', checked: r ? r.is_active : true });
    const errBox = el('div', { class: 'form-error', hidden: true });
    const linesBody = el('tbody');
    let lines = r?.lines ? [...r.lines] : [
      { account_code: '', debit: 0, credit: 0, description: '' },
      { account_code: '', debit: 0, credit: 0, description: '' },
    ];

    function renderLines() {
      clear(linesBody);
      lines.forEach((line, idx) => {
        const accSel = el('select', { class: 'input' }, [
          el('option', { value: '' }, '—'),
          ...postable.map((a) => el('option', { value: a.code }, a.code + ' — ' + (i18n.lang === 'ar' ? a.name_ar : a.name_en))),
        ]);
        accSel.value = line.account_code || '';
        accSel.addEventListener('change', (e) => { line.account_code = e.target.value; });

        const dbIn = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num',
          value: line.debit || '', oninput: (e) => { line.debit = Number(e.target.value || 0); if (line.debit > 0) line.credit = 0; } });
        const crIn = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num',
          value: line.credit || '', oninput: (e) => { line.credit = Number(e.target.value || 0); if (line.credit > 0) line.debit = 0; } });
        const descIn = el('input', { class: 'input', value: line.description || '',
          oninput: (e) => { line.description = e.target.value; } });
        const rmBtn = el('button', { type: 'button', class: 'btn btn--danger',
          onclick: () => { lines.splice(idx, 1); renderLines(); } }, '×');

        linesBody.appendChild(el('tr', {}, [
          el('td', {}, accSel), el('td', {}, descIn),
          el('td', {}, dbIn), el('td', {}, crIn), el('td', {}, rmBtn),
        ]));
      });
    }
    renderLines();

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const validLines = lines
            .filter((l) => l.account_code && ((l.debit > 0) !== (l.credit > 0)))
            .map((l) => ({ ...l, debit: Number(l.debit || 0), credit: Number(l.credit || 0) }));
          if (validLines.length < 2) throw new Error(t('min_2_lines'));
          const td = validLines.reduce((s, l) => s + l.debit, 0);
          const tc = validLines.reduce((s, l) => s + l.credit, 0);
          if (Math.abs(td - tc) > 0.01) throw new Error(t('unbalanced') + ` (${money(td)} ≠ ${money(tc)})`);

          const row = {
            name: requireStr(inName.value, t('name')),
            frequency: inFreq.value,
            next_run_date: inNext.value,
            end_date: inEnd.value || null,
            is_active: inActive.checked,
            lines: validLines,
          };
          const res = r ? await recurringEntriesApi.update(r.id, row) : await recurringEntriesApi.create(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, r ? t('edit_recurring') : t('new_recurring')),
      el('div', { class: 'grid-2' }, [
        field(t('name'), inName), field(t('frequency'), inFreq),
        field(t('next_run'), inNext), field(t('end_date') + ' (' + t('optional') + ')', inEnd),
      ]),
      el('label', { style: 'display:flex; gap:6px; margin-top:8px' }, [inActive, el('span', {}, t('active'))]),
      el('h3', {}, '📔 ' + t('lines')),
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', { style: 'width:40%' }, t('account')), el('th', {}, t('description')),
          el('th', { class: 'num', style: 'width:120px' }, t('debit')),
          el('th', { class: 'num', style: 'width:120px' }, t('credit')),
          el('th', { style: 'width:40px' }, ''),
        ])),
        linesBody,
      ]),
      el('button', { type: 'button', class: 'btn btn--ghost',
        onclick: () => { lines.push({ account_code: '', debit: 0, credit: 0, description: '' }); renderLines(); } }, '+ ' + t('add_line')),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, r ? t('save_changes') : t('create')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  await refresh();
}
