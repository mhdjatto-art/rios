// frontend/journal.js  (Phase 13)
import { accountingApi } from './api.js';
import { auth } from './auth.js';
import { i18n, t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, fmtDate, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isAdmin } = auth.state;

  const fromIn = el('input', { type: 'date', class: 'input' });
  const toIn = el('input', { type: 'date', class: 'input' });
  const sourceSel = el('select', { class: 'input' }, [
    el('option', { value: '' }, t('all') + ' — ' + t('all_sources')),
    el('option', { value: 'sale' }, t('sale')),
    el('option', { value: 'purchase' }, t('purchase')),
    el('option', { value: 'payment' }, t('payment')),
    el('option', { value: 'expense' }, t('expense')),
    el('option', { value: 'return' }, t('return')),
    el('option', { value: 'manual' }, t('manual_entry')),
  ]);

  const newBtn = el('button', { class: 'btn btn--primary', onclick: () => openManualEntry(), disabled: !isAdmin },
    '+ ' + t('manual_entry'));
  const backfillBtn = el('button', { class: 'btn btn--ghost', onclick: doBackfill, disabled: !isAdmin },
    '⚡ ' + t('backfill_ledger'));
  const rebuildBtn = el('button', { class: 'btn btn--danger', onclick: doRebuild, disabled: !isAdmin },
    '🔄 ' + t('rebuild_ledger'));

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '📔 ' + t('journal')),
    el('div', { class: 'toolbar__spacer' }),
    rebuildBtn, backfillBtn, newBtn,
  ]));

  host.append(el('div', { class: 'toolbar', style: 'margin-bottom:12px' }, [
    el('label', {}, [t('period_from') + ':', fromIn]),
    el('label', {}, [t('period_to') + ':', toIn]),
    el('label', {}, [t('source') + ':', sourceSel]),
    el('button', { class: 'btn btn--ghost', onclick: refresh }, '🔍 ' + t('filter')),
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  async function refresh() {
    renderLoading(card);
    const { data, error } = await accountingApi.listEntries({
      from: fromIn.value || null,
      to: toIn.value || null,
      source: sourceSel.value || null,
      limit: 200,
    });
    if (error) return renderError(card, error);
    if (!data.length) return renderEmpty(card, t('no_entries'));
    clear(card);

    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('entry_number')),
        el('th', {}, t('date')),
        el('th', {}, t('description')),
        el('th', {}, t('source')),
        el('th', {}, t('status')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, data.map((je) => el('tr', { style: 'cursor:pointer', onclick: () => openDetail(je.id) }, [
        el('td', { class: 'mono strong' }, je.entry_number),
        el('td', {}, fmtDate(je.entry_date)),
        el('td', {}, je.description || '—'),
        el('td', {}, el('span', { class: 'pill pill--info' }, t(je.source_type))),
        el('td', {}, el('span', { class: `pill pill--${je.status === 'posted' ? 'ok' : 'warn'}` }, t(je.status))),
        el('td', {}, '↗'),
      ]))),
    ]));
  }

  async function openDetail(id) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('h2', {}, '📔 ' + t('entry_details')));
    const body = el('div');
    dlg.appendChild(body);
    renderLoading(body);

    const { data, error } = await accountingApi.getEntry(id);
    if (error) { body.innerHTML = ''; renderError(body, error); return; }
    const { header, lines } = data;
    clear(body);

    body.appendChild(el('div', { class: 'grid-2', style: 'margin-bottom:12px' }, [
      el('div', {}, [el('div', { class: 'muted small' }, t('entry_number')), el('strong', {}, header.entry_number)]),
      el('div', {}, [el('div', { class: 'muted small' }, t('date')), el('strong', {}, fmtDate(header.entry_date))]),
      el('div', {}, [el('div', { class: 'muted small' }, t('source')), el('strong', {}, t(header.source_type))]),
      el('div', {}, [el('div', { class: 'muted small' }, t('status')), el('strong', {}, t(header.status))]),
    ]));
    if (header.description) body.appendChild(el('p', { class: 'muted' }, header.description));

    let totalDr = 0, totalCr = 0;
    for (const l of lines) { totalDr += Number(l.debit || 0); totalCr += Number(l.credit || 0); }

    body.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('account')),
        el('th', {}, t('description')),
        el('th', { class: 'num' }, t('debit')),
        el('th', { class: 'num' }, t('credit')),
      ])),
      el('tbody', {}, lines.map((l) => el('tr', {}, [
        el('td', {}, [
          el('span', { class: 'mono strong' }, l.chart_of_accounts?.code),
          ' — ',
          el('span', {}, i18n.lang === 'ar' ? l.chart_of_accounts?.name_ar : l.chart_of_accounts?.name_en),
        ]),
        el('td', { class: 'muted small' }, l.description || '—'),
        el('td', { class: 'num' + (Number(l.debit) > 0 ? ' strong' : '') }, Number(l.debit) > 0 ? money(l.debit) : '—'),
        el('td', { class: 'num' + (Number(l.credit) > 0 ? ' strong' : '') }, Number(l.credit) > 0 ? money(l.credit) : '—'),
      ]))),
      el('tfoot', {}, el('tr', {}, [
        el('td', { colspan: 2, class: 'strong' }, t('totals')),
        el('td', { class: 'num strong' }, money(totalDr)),
        el('td', { class: 'num strong' }, money(totalCr)),
      ])),
    ]));

    dlg.appendChild(el('div', { class: 'form__actions' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => dlg.close() }, t('close')),
    ]));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  async function openManualEntry() {
    const { data: accounts } = await accountingApi.listAccounts();
    const postable = (accounts || []).filter((a) => a.allow_posting && a.is_active);

    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    const inDate = el('input', { type: 'date', class: 'input', value: new Date().toISOString().slice(0, 10) });
    const inDesc = el('input', { class: 'input', required: true, placeholder: t('description') });
    const errBox = el('div', { class: 'form-error', hidden: true });
    const totalsBox = el('div', { class: 'muted', style: 'text-align:end; padding:8px; font-weight:600' });
    const linesBody = el('tbody');

    const lines = [];

    function addLine(accountCode = '', debit = 0, credit = 0, desc = '') {
      const line = { accountCode, debit, credit, desc };
      lines.push(line);
      renderLines();
    }

    function renderLines() {
      clear(linesBody);
      let td = 0, tc = 0;
      lines.forEach((line, idx) => {
        const accSel = el('select', { class: 'input' }, [
          el('option', { value: '' }, '—'),
          ...postable.map((a) => el('option', { value: a.code }, a.code + ' — ' + (i18n.lang === 'ar' ? a.name_ar : a.name_en))),
        ]);
        accSel.value = line.accountCode || '';
        accSel.addEventListener('change', (e) => { line.accountCode = e.target.value; });

        const dbIn = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num',
          value: line.debit || '',
          oninput: (e) => { line.debit = Number(e.target.value || 0); if (line.debit > 0) { line.credit = 0; crIn.value = ''; } renderTotals(); },
        });
        const crIn = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num',
          value: line.credit || '',
          oninput: (e) => { line.credit = Number(e.target.value || 0); if (line.credit > 0) { line.debit = 0; dbIn.value = ''; } renderTotals(); },
        });
        const descIn = el('input', { class: 'input', value: line.desc || '',
          oninput: (e) => { line.desc = e.target.value; } });
        const rmBtn = el('button', { type: 'button', class: 'btn btn--danger',
          onclick: () => { lines.splice(idx, 1); renderLines(); } }, '×');

        linesBody.appendChild(el('tr', {}, [
          el('td', {}, accSel),
          el('td', {}, descIn),
          el('td', {}, dbIn),
          el('td', {}, crIn),
          el('td', {}, rmBtn),
        ]));

        td += Number(line.debit || 0);
        tc += Number(line.credit || 0);
      });
      renderTotals();
    }

    function renderTotals() {
      let td = 0, tc = 0;
      for (const l of lines) { td += Number(l.debit || 0); tc += Number(l.credit || 0); }
      const balanced = Math.abs(td - tc) < 0.01;
      clear(totalsBox);
      totalsBox.append(
        el('span', {}, `${t('total_debits')}: `), el('strong', {}, money(td)),
        ' • ',
        el('span', {}, `${t('total_credits')}: `), el('strong', {}, money(tc)),
        ' • ',
        el('span', { class: balanced ? 'pos' : 'neg' }, balanced ? '✓ ' + t('balanced') : '⚠ ' + t('unbalanced'))
      );
    }

    addLine(); addLine();

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const validLines = lines
            .filter((l) => l.accountCode && ((l.debit > 0) !== (l.credit > 0)))
            .map((l) => ({
              account_code: l.accountCode,
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0),
              description: l.desc || null,
            }));
          if (validLines.length < 2) throw new Error(t('min_2_lines'));
          const td = validLines.reduce((s, l) => s + l.debit, 0);
          const tc = validLines.reduce((s, l) => s + l.credit, 0);
          if (Math.abs(td - tc) > 0.01) throw new Error(t('unbalanced') + ` (${money(td)} ≠ ${money(tc)})`);

          const res = await accountingApi.postEntry({
            source_type: 'manual',
            source_id: null,
            entry_date: inDate.value,
            description: inDesc.value.trim(),
            branch_id: null,
            lines: validLines,
          });
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, '📔 ' + t('manual_entry')),
      el('div', { class: 'grid-2' }, [field(t('date'), inDate), field(t('description'), inDesc)]),
      el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', { style: 'width:40%' }, t('account')),
          el('th', {}, t('description')),
          el('th', { class: 'num', style: 'width:120px' }, t('debit')),
          el('th', { class: 'num', style: 'width:120px' }, t('credit')),
          el('th', { style: 'width:40px' }, ''),
        ])),
        linesBody,
      ]),
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => addLine() }, '+ ' + t('add_line')),
      totalsBox,
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, '✅ ' + t('post_entry')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  async function doRebuild() {
    if (!confirm(t('rebuild_confirm'))) return;
    rebuildBtn.disabled = true;
    rebuildBtn.textContent = '⏳ ...';
    try {
      const { data, error } = await accountingApi.rebuildLedger();
      if (error) throw new Error(errMsg(error));
      toast(`✅ ${t('deleted')}: ${data.deleted} • ${t('sales')}: ${data.sales} • ${t('purchases')}: ${data.purchases} • ${t('returns')}: ${data.returns} • ${t('payments')}: ${data.payments} • ${t('expenses')}: ${data.expenses}`, 'success');
      refresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { rebuildBtn.disabled = false; rebuildBtn.textContent = '🔄 ' + t('rebuild_ledger'); }
  }

  async function doBackfill() {
    if (!confirm(t('backfill_confirm'))) return;
    backfillBtn.disabled = true;
    backfillBtn.textContent = '⏳ ' + t('loading');
    try {
      const { data, error } = await accountingApi.backfillLedger();
      if (error) throw new Error(errMsg(error));
      toast(`✅ ${t('sales')}: ${data.sales} • ${t('purchases')}: ${data.purchases} • ${t('payments')}: ${data.payments} • ${t('expenses')}: ${data.expenses}`, 'success');
      refresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { backfillBtn.disabled = false; backfillBtn.textContent = '⚡ ' + t('backfill_ledger'); }
  }

  await refresh();
}
