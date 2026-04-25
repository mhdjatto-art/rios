// frontend/chart_of_accounts.js  (Phase 13)
import { accountingApi } from './api.js';
import { auth } from './auth.js';
import { i18n, t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  requireStr, errMsg, field,
} from './utils.js';

const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export async function render(host) {
  clear(host);
  const { isAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary', onclick: () => openEditor(null), disabled: !isAdmin },
    '+ ' + t('new_account'));

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '📚 ' + t('chart_of_accounts')),
    el('div', { class: 'toolbar__spacer' }),
    newBtn,
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  async function refresh() {
    renderLoading(card);
    const { data, error } = await accountingApi.listAccounts();
    if (error) return renderError(card, error);
    if (!data.length) return renderEmpty(card, t('no_accounts'));
    clear(card);

    // Build tree
    const byParent = new Map();
    for (const a of data) {
      const k = a.parent_id || 'root';
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(a);
    }

    const tree = el('ul', { class: 'coa-tree' });
    renderNode(tree, 'root', 0);
    card.appendChild(tree);

    function renderNode(host, parentId, depth) {
      const children = byParent.get(parentId) || [];
      for (const a of children) {
        const li = el('li', { class: 'coa-node' }, [
          el('div', { class: 'coa-row', style: `padding-inline-start: ${depth * 20}px` }, [
            el('span', { class: 'coa-code' }, a.code),
            el('span', { class: 'coa-name' }, i18n.lang === 'ar' ? a.name_ar : a.name_en),
            el('span', { class: `pill pill--${typeClass(a.account_type)}` }, t('acct_' + a.account_type)),
            a.allow_posting ? '' : el('span', { class: 'pill pill--ghost' }, t('summary_account')),
            a.is_system ? el('span', { class: 'muted small' }, '🔒 ' + t('system')) : '',
            el('div', { class: 'coa-actions' }, [
              el('button', { class: 'btn btn--ghost', onclick: () => openEditor(a), disabled: !isAdmin }, t('edit')),
              el('button', { class: 'btn btn--danger', onclick: () => confirmDelete(a),
                disabled: !isAdmin || a.is_system }, t('delete')),
            ]),
          ]),
        ]);
        host.appendChild(li);
        if (byParent.has(a.id)) {
          const sub = el('ul');
          li.appendChild(sub);
          renderNode(sub, a.id, depth + 1);
        }
      }
    }
  }

  function typeClass(tp) {
    return { asset: 'ok', liability: 'warn', equity: 'info', revenue: 'ok', expense: 'danger' }[tp] || '';
  }

  async function openEditor(acc) {
    const isEdit = !!acc;
    const dlg = el('dialog', { class: 'dialog' });

    // Load all accounts for parent selector
    const { data: allAccs } = await accountingApi.listAccounts();

    const inCode = el('input', { class: 'input mono', required: true, value: acc?.code || '' });
    const inNameAr = el('input', { class: 'input', required: true, value: acc?.name_ar || '' });
    const inNameEn = el('input', { class: 'input', required: true, value: acc?.name_en || '' });
    const inType = el('select', { class: 'input' },
      TYPES.map((tp) => el('option', { value: tp }, t('acct_' + tp))));
    inType.value = acc?.account_type || 'asset';
    const inNormal = el('select', { class: 'input' }, [
      el('option', { value: 'debit' }, t('debit')),
      el('option', { value: 'credit' }, t('credit')),
    ]);
    inNormal.value = acc?.normal_balance || 'debit';
    const inParent = el('select', { class: 'input' }, [
      el('option', { value: '' }, '— ' + t('none') + ' —'),
      ...(allAccs || []).filter((a) => !a.allow_posting && a.id !== acc?.id)
        .map((a) => el('option', { value: a.id }, a.code + ' — ' + (i18n.lang === 'ar' ? a.name_ar : a.name_en))),
    ]);
    inParent.value = acc?.parent_id || '';
    const inAllowPosting = el('input', { type: 'checkbox', checked: acc ? acc.allow_posting : true });
    const inActive = el('input', { type: 'checkbox', checked: acc ? acc.is_active : true });
    const errBox = el('div', { class: 'form-error', hidden: true });

    // Auto-set normal balance based on type
    inType.addEventListener('change', () => {
      inNormal.value = ['asset', 'expense'].includes(inType.value) ? 'debit' : 'credit';
    });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const row = {
            code: requireStr(inCode.value, t('code')),
            name_ar: requireStr(inNameAr.value, t('name_ar')),
            name_en: requireStr(inNameEn.value, t('name_en')),
            account_type: inType.value,
            normal_balance: inNormal.value,
            parent_id: inParent.value || null,
            allow_posting: inAllowPosting.checked,
            is_active: inActive.checked,
          };
          const res = isEdit ?
            await accountingApi.updateAccount(acc.id, row) :
            await accountingApi.createAccount(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, isEdit ? t('edit_account') : t('new_account')),
      el('div', { class: 'grid-2' }, [
        field(t('code'), inCode),
        field(t('account_type'), inType),
        field(t('name_ar'), inNameAr),
        field(t('name_en'), inNameEn),
        field(t('normal_balance'), inNormal),
        field(t('parent_account'), inParent),
      ]),
      el('div', { style: 'display:flex; gap:16px; margin-top:8px' }, [
        el('label', { style: 'display:flex; gap:6px' }, [inAllowPosting, el('span', {}, t('allow_posting'))]),
        el('label', { style: 'display:flex; gap:6px' }, [inActive, el('span', {}, t('active'))]),
      ]),
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

  function confirmDelete(a) {
    if (a.is_system) { toast(t('cannot_delete_system'), 'error'); return; }
    if (!confirm(`${t('confirm_delete')}\n${a.code} — ${a.name_ar}`)) return;
    (async () => {
      const { error } = await accountingApi.removeAccount(a.id);
      if (error) return toast(errMsg(error), 'error');
      toast('✓', 'success'); refresh();
    })();
  }

  await refresh();
}
