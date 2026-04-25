// frontend/branches.js  (Phase 6)
import { branchesApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  requireStr, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary', onclick: () => openEditor(null) }, t('new_branch'));
  if (!isAdmin) newBtn.disabled = true;

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('branches')),
    el('div', { class: 'toolbar__spacer' }),
    newBtn,
  ]));

  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  async function refresh() {
    renderLoading(tableHost);
    const { data, error } = await branchesApi.list();
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_branches'));

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('branch_code')),
        el('th', {}, t('branch_name')),
        el('th', {}, t('address')),
        el('th', {}, t('phone')),
        el('th', {}, t('status')),
        el('th', {}, t('actions')),
      ])),
      el('tbody', {}, data.map((b) => el('tr', {}, [
        el('td', { class: 'mono strong' }, b.code),
        el('td', {}, b.name),
        el('td', {}, b.address || '—'),
        el('td', {}, b.phone || '—'),
        el('td', {}, el('span', { class: 'pill ' + (b.is_active ? 'pill--ok' : 'pill--danger') },
          b.is_active ? t('active') : t('inactive'))),
        el('td', { class: 'actions' }, [
          el('button', { class: 'btn btn--ghost', onclick: () => openEditor(b), disabled: !isAdmin }, t('edit')),
          el('button', { class: 'btn btn--danger', onclick: () => confirmDelete(b), disabled: !isAdmin }, t('delete')),
        ]),
      ]))),
    ]));
  }

  await refresh();

  function openEditor(br) {
    const isEdit = !!br;
    const dlg = el('dialog', { class: 'dialog' });

    const inCode = el('input', { class: 'input mono', required: true, value: br?.code || '' });
    const inName = el('input', { class: 'input', required: true, value: br?.name || '' });
    const inAddr = el('input', { class: 'input', value: br?.address || '' });
    const inPhone = el('input', { class: 'input', value: br?.phone || '' });
    const inActive = el('input', { type: 'checkbox', checked: br ? br.is_active : true });
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const row = {
            code: requireStr(inCode.value, t('branch_code')).toUpperCase(),
            name: requireStr(inName.value, t('branch_name')),
            address: inAddr.value.trim() || null,
            phone: inPhone.value.trim() || null,
            is_active: inActive.checked,
          };
          const res = isEdit ? await branchesApi.update(br.id, row) : await branchesApi.create(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, isEdit ? t('edit_branch') : t('new_branch')),
      el('div', { class: 'grid-2' }, [
        field(t('branch_code'), inCode),
        field(t('branch_name'), inName),
      ]),
      field(t('address'), inAddr),
      field(t('phone'), inPhone),
      el('label', { style: 'display:flex; gap:8px; align-items:center' }, [inActive, el('span', {}, t('active'))]),
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

  function confirmDelete(b) {
    if (!isAdmin) { toast(t('permission_denied'), 'error'); return; }
    if (!confirm(`${t('confirm_delete')}\n${b.name}`)) return;
    (async () => {
      const { error } = await branchesApi.remove(b.id);
      if (error) return toast(errMsg(error), 'error');
      toast('✓', 'success');
      refresh();
    })();
  }
}
