// frontend/customers.js  (Phase 2)
import { customersApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty, debounce,
  requireStr, errMsg, field,
} from './utils.js';

export async function render(host) { renderParty(host, customersApi, {
  titleKey: 'customers', newKey: 'new_customer', editKey: 'edit_customer',
  emptyKey: 'no_customers',
  journeyRoute: '/customer_journey',  // Phase 24
}); }

export function renderParty(host, api, { titleKey, newKey, editKey, emptyKey, journeyRoute }) {
  clear(host);
  const { isManagerOrAdmin, isAdmin } = auth.state;

  const searchInput = el('input', { type: 'search', class: 'input', placeholder: t('search') });
  const newBtn = el('button', { class: 'btn btn--primary' }, t(newKey));
  if (!isManagerOrAdmin) newBtn.disabled = true;

  host.append(
    el('div', { class: 'toolbar' }, [
      el('h1', { class: 'view-title' }, t(titleKey)),
      el('div', { class: 'toolbar__spacer' }),
      searchInput, newBtn,
    ]),
  );
  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  const refresh = debounce(async () => {
    renderLoading(tableHost);
    const { data, error } = await api.list({ search: searchInput.value.trim() });
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t(emptyKey));

    const rows = data.map((p) => {
      const editBtn = el('button', { class: 'btn btn--ghost', onclick: () => openEditor(p) }, t('edit'));
      const delBtn  = el('button', { class: 'btn btn--danger', onclick: () => confirmDelete(p) }, t('delete'));
      const journeyBtn = journeyRoute
        ? el('button', { class: 'btn btn--ghost',
            onclick: () => { location.hash = '#' + journeyRoute + '?id=' + p.id; },
            title: t('customer_journey') || 'Journey',
          }, '🗺️')
        : null;
      if (!isManagerOrAdmin) editBtn.disabled = true;
      if (!isAdmin) delBtn.disabled = true;
      return el('tr', {}, [
        el('td', {}, [
          p.name,
          journeyBtn ? el('span', { style: 'margin-inline-start:8px; cursor:pointer',
            onclick: () => { location.hash = '#' + journeyRoute + '?id=' + p.id; },
            title: t('customer_journey') || 'View journey',
          }, '🗺️') : '',
        ].filter(Boolean)),
        el('td', { class: 'mono' }, p.phone || '—'),
        el('td', {}, p.email || '—'),
        el('td', {}, p.address || '—'),
        el('td', {}, el('span', { class: `pill pill--${p.is_active ? 'active' : 'inactive'}` },
          t(p.is_active ? 'active' : 'inactive'))),
        el('td', { class: 'actions' }, [editBtn, delBtn]),
      ]);
    });

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('name')),
        el('th', {}, t('phone')),
        el('th', {}, t('email')),
        el('th', {}, t('address')),
        el('th', {}, t('status')),
        el('th', {}, t('actions')),
      ])),
      el('tbody', {}, rows),
    ]));
  }, 200);

  searchInput.addEventListener('input', refresh);
  newBtn.addEventListener('click', () => openEditor(null));
  refresh();

  function openEditor(p) {
    const isEdit = !!p;
    const dlg = el('dialog', { class: 'dialog' });
    const inName    = el('input', { class: 'input', required: true, value: p?.name || '' });
    const inPhone   = el('input', { class: 'input', value: p?.phone || '' });
    const inEmail   = el('input', { type: 'email', class: 'input', value: p?.email || '' });
    const inAddress = el('textarea', { class: 'input', rows: 2 }, p?.address || '');
    const inNotes   = el('textarea', { class: 'input', rows: 2 }, p?.notes || '');
    const inWholesaleCust = el('input', { type: 'checkbox' });
    inWholesaleCust.checked = p ? (p.is_wholesale || false) : false;
    const inCreditLimit = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num',
      value: p?.credit_limit ?? '', placeholder: t('unlimited') });
    const inActive  = el('input', { type: 'checkbox' });
    inActive.checked = p ? p.is_active : true;
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const row = {
            name:      requireStr(inName.value, t('name')),
            phone:     inPhone.value.trim()   || null,
            email:     inEmail.value.trim()   || null,
            address:   inAddress.value.trim() || null,
            notes:     inNotes.value.trim()   || null,
            is_wholesale: inWholesaleCust.checked,
            credit_limit: inCreditLimit.value === '' ? null : Number(inCreditLimit.value),
            is_active: inActive.checked,
          };
          const res = isEdit ? await api.update(p.id, row) : await api.create(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast(isEdit ? t('save_changes') + ' ✓' : t('create') + ' ✓', 'success');
          dlg.close();
          refresh();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.hidden = false;
        }
      },
    }, [
      el('h2', {}, isEdit ? t(editKey) : t(newKey)),
      el('div', { class: 'grid-2' }, [
        field(t('name'),  inName),
        field(t('phone'), inPhone),
        field(t('email'), inEmail),
        el('label', { class: 'form__field' }, [
          el('span', { class: 'form__label' }, t('status')),
          el('label', { style: 'display:flex; gap:6px; margin-bottom:6px' }, [inWholesaleCust, el('span', {}, '💼 ' + t('wholesale_customer'))]),
      field('💳 ' + t('credit_limit'), inCreditLimit),
      el('label', { style: 'display:flex;gap:0.4rem;align-items:center' }, [inActive, el('span', {}, t('active'))]),
        ]),
      ]),
      field(t('address'), inAddress),
      field(t('notes'),   inNotes),
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

  function confirmDelete(p) {
    if (!isAdmin) { toast(t('permission_denied'), 'error'); return; }
    if (!confirm(`${t('confirm_delete')}\n${p.name}`)) return;
    (async () => {
      const { error } = await api.remove(p.id);
      if (error) return toast(errMsg(error), 'error');
      toast(t('delete') + ' ✓', 'success');
      refresh();
    })();
  }
}
