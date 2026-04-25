// frontend/employees.js  (Phase 17)
import { employeesApi, branchesApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  requireStr, money, fmtDate, errMsg, field, nextDocNumber,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary', disabled: !isAdmin,
    onclick: () => openEditor(null) }, '+ ' + t('new_employee'));

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '👥 ' + t('employees')),
    el('div', { class: 'toolbar__spacer' }),
    newBtn,
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  let branches = [];
  const brRes = await branchesApi.list();
  if (!brRes.error) branches = brRes.data;

  async function refresh() {
    renderLoading(card);
    const { data, error } = await employeesApi.list();
    if (error) return renderError(card, error);
    if (!data.length) return renderEmpty(card, t('no_employees'));

    clear(card);
    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'),
        el('th', {}, t('name')),
        el('th', {}, t('position')),
        el('th', {}, t('phone')),
        el('th', { class: 'num' }, t('base_salary')),
        el('th', {}, t('status')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, data.map((e) => el('tr', {}, [
        el('td', { class: 'mono' }, e.employee_number),
        el('td', { class: 'strong' }, e.name),
        el('td', {}, e.position || '—'),
        el('td', {}, e.phone || '—'),
        el('td', { class: 'num strong' }, money(e.base_salary)),
        el('td', {}, el('span', { class: `pill pill--${e.is_active ? 'ok' : ''}` }, e.is_active ? t('active') : t('inactive'))),
        el('td', {}, [
          el('button', { class: 'btn btn--ghost', onclick: () => openEditor(e), disabled: !isAdmin }, t('edit')),
          el('button', { class: 'btn btn--danger', disabled: !isAdmin,
            onclick: async () => {
              if (!confirm(t('confirm_delete'))) return;
              await employeesApi.remove(e.id);
              toast('✓', 'success'); refresh();
            } }, '×'),
        ]),
      ]))),
    ]));
  }

  async function openEditor(e) {
    const dlg = el('dialog', { class: 'dialog' });
    const inNum = el('input', { class: 'input mono', required: true, value: e?.employee_number || nextDocNumber('EMP'), disabled: !!e });
    const inName = el('input', { class: 'input', required: true, value: e?.name || '' });
    const inPos = el('input', { class: 'input', value: e?.position || '' });
    const inPhone = el('input', { class: 'input', value: e?.phone || '' });
    const inEmail = el('input', { type: 'email', class: 'input', value: e?.email || '' });
    const inNId = el('input', { class: 'input mono', value: e?.national_id || '' });
    const inHire = el('input', { type: 'date', class: 'input', value: e?.hire_date || new Date().toISOString().slice(0, 10) });
    const inSalary = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: e?.base_salary ?? 0 });
    const inBranch = el('select', { class: 'input' }, [
      el('option', { value: '' }, '—'),
      ...branches.map((b) => el('option', { value: b.id }, `${b.code} — ${b.name}`)),
    ]);
    if (e?.branch_id) inBranch.value = e.branch_id;
    const inBank = el('input', { class: 'input', value: e?.bank_account || '' });
    const inActive = el('input', { type: 'checkbox', checked: e ? e.is_active : true });
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (ev) => {
        ev.preventDefault();
        errBox.hidden = true;
        try {
          const row = {
            employee_number: requireStr(inNum.value, t('employee_number')),
            name: requireStr(inName.value, t('name')),
            position: inPos.value.trim() || null,
            phone: inPhone.value.trim() || null,
            email: inEmail.value.trim() || null,
            national_id: inNId.value.trim() || null,
            hire_date: inHire.value,
            base_salary: Number(inSalary.value || 0),
            branch_id: inBranch.value || null,
            bank_account: inBank.value.trim() || null,
            is_active: inActive.checked,
          };
          const res = e ? await employeesApi.update(e.id, row) : await employeesApi.create(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, e ? t('edit_employee') : t('new_employee')),
      el('div', { class: 'grid-2' }, [
        field(t('employee_number'), inNum),
        field(t('hire_date'), inHire),
        field(t('name'), inName),
        field(t('position'), inPos),
        field(t('phone'), inPhone),
        field(t('email'), inEmail),
        field(t('national_id'), inNId),
        field(t('branch'), inBranch),
        field(t('base_salary'), inSalary),
        field(t('bank_account'), inBank),
      ]),
      el('label', { style: 'display:flex; gap:6px; margin-top:8px' }, [inActive, el('span', {}, t('active'))]),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, e ? t('save_changes') : t('create')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  await refresh();
}
