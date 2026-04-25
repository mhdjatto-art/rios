// frontend/expenses.js  (Phase 4)
import { expensesApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty, debounce,
  money, isoDate, fmtDate, requireStr, requireNum, nextDocNumber, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin, isAdmin } = auth.state;

  const fromInput = el('input', { type: 'date', class: 'input' });
  const toInput = el('input', { type: 'date', class: 'input' });
  const catInput = el('input', { type: 'search', class: 'input', placeholder: t('expense_category') });
  const newBtn = el('button', { class: 'btn btn--primary' }, t('new_expense'));
  if (!isManagerOrAdmin) newBtn.disabled = true;

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('expenses')),
    el('div', { class: 'toolbar__spacer' }),
    el('label', { class: 'inline-field' }, [el('span', {}, t('from')), fromInput]),
    el('label', { class: 'inline-field' }, [el('span', {}, t('to')), toInput]),
    catInput,
    newBtn,
  ]));

  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  const refresh = debounce(async () => {
    renderLoading(tableHost);
    const { data, error } = await expensesApi.list({
      from: fromInput.value || null, to: toInput.value || null,
      category: catInput.value.trim() || null,
    });
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_expenses'));

    const total = data.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const rows = data.map((e) => {
      const editBtn = el('button', { class: 'btn btn--ghost', onclick: () => openEditor(e) }, t('edit'));
      const delBtn = el('button', { class: 'btn btn--danger', onclick: () => confirmDelete(e) }, t('delete'));
      if (!isManagerOrAdmin) editBtn.disabled = true;
      if (!isAdmin) delBtn.disabled = true;
      return el('tr', {}, [
        el('td', { class: 'mono' }, e.expense_number),
        el('td', {}, fmtDate(e.expense_date)),
        el('td', {}, e.category),
        el('td', {}, e.vendor || '—'),
        el('td', {}, t(e.method) || e.method),
        el('td', { class: 'num' }, money(e.amount)),
        el('td', { class: 'num' }, money(e.vat_amount)),
        el('td', { class: 'num strong' }, money(e.total_amount)),
        el('td', { class: 'actions' }, [editBtn, delBtn]),
      ]);
    });

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'), el('th', {}, t('date')), el('th', {}, t('expense_category')),
        el('th', {}, t('expense_vendor')), el('th', {}, t('payment_method')),
        el('th', { class: 'num' }, t('expense_amount')),
        el('th', { class: 'num' }, t('vat_amount')),
        el('th', { class: 'num' }, t('total')),
        el('th', {}, t('actions')),
      ])),
      el('tbody', {}, rows),
      el('tfoot', {}, el('tr', {}, [
        el('td', { colspan: '7', class: 'num strong' }, t('total')),
        el('td', { class: 'num strong' }, money(total)),
        el('td', {}, ''),
      ])),
    ]));
  }, 200);

  fromInput.addEventListener('change', refresh);
  toInput.addEventListener('change', refresh);
  catInput.addEventListener('input', refresh);
  newBtn.addEventListener('click', () => openEditor(null));
  await refresh();

  function openEditor(exp) {
    const isEdit = !!exp;
    const dlg = el('dialog', { class: 'dialog' });

    const inNumber = el('input', { class: 'input', required: true, value: exp?.expense_number || nextDocNumber('EXP') });
    const inCategory = el('input', { class: 'input', required: true, value: exp?.category || '', placeholder: t('expense_categories_hint') });
    const inVendor = el('input', { class: 'input', value: exp?.vendor || '' });
    const inAmount = el('input', { type: 'number', step: '0.01', min: '0.01', class: 'input num', required: true, value: exp?.amount ?? '' });
    const inVat = el('input', { type: 'number', step: '0.01', min: '0', max: '100', class: 'input num', value: exp?.vat_rate ?? '0' });
    const inMethod = el('select', { class: 'input' }, [
      el('option', { value: 'cash' }, t('cash')),
      el('option', { value: 'card' }, t('card')),
      el('option', { value: 'bank_transfer' }, t('bank_transfer')),
      el('option', { value: 'cheque' }, t('cheque')),
      el('option', { value: 'other' }, t('other')),
    ]);
    inMethod.value = exp?.method || 'cash';
    const inDate = el('input', { type: 'date', class: 'input', value: exp?.expense_date || isoDate() });
    const inNotes = el('textarea', { class: 'input', rows: 2 }, exp?.notes || '');
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const row = {
            expense_number: requireStr(inNumber.value, t('expense_number')),
            category: requireStr(inCategory.value, t('expense_category')),
            vendor: inVendor.value.trim() || null,
            amount: requireNum(inAmount.value, t('expense_amount'), { min: 0.01 }),
            vat_rate: Number(inVat.value || 0),
            method: inMethod.value,
            expense_date: inDate.value || isoDate(),
            notes: inNotes.value.trim() || null,
          };
          const res = isEdit ? await expensesApi.update(exp.id, row) : await expensesApi.create(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, isEdit ? t('edit_expense') : t('new_expense')),
      el('div', { class: 'grid-2' }, [
        field(t('expense_number'), inNumber),
        field(t('expense_date'), inDate),
        field(t('expense_category'), inCategory),
        field(t('expense_vendor'), inVendor),
        field(t('expense_amount'), inAmount),
        field(t('vat_rate'), inVat),
        field(t('payment_method'), inMethod),
      ]),
      field(t('notes'), inNotes),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, isEdit ? t('save_changes') : t('create')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  function confirmDelete(e) {
    if (!isAdmin) { toast(t('permission_denied'), 'error'); return; }
    if (!confirm(`${t('confirm_delete')}\n${e.expense_number}`)) return;
    (async () => {
      const { error } = await expensesApi.remove(e.id);
      if (error) return toast(errMsg(error), 'error');
      toast(t('delete') + ' ✓', 'success');
      refresh();
    })();
  }
}
