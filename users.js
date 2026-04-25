// frontend/users.js  (Phase 18 — with add user + fixed layout)
import { usersApi, supabase } from './api.js';
import { auth } from './auth.js';
import { i18n, t } from './i18n.js';
import { el, clear, toast, renderLoading, renderError, renderEmpty, fmtDate, errMsg, field, requireStr } from './utils.js';
import { PERMISSION_GROUPS, setUserPermissions } from './permissions.js';

export async function render(host) {
  clear(host);
  if (!auth.state.isAdmin) {
    host.appendChild(el('div', { class: 'state state--error' }, t('permission_denied')));
    return;
  }

  const addBtn = el('button', { class: 'btn btn--primary', onclick: openNewUser },
    '+ ' + (t('new_user') || 'New user'));

  host.appendChild(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '👤 ' + t('users')),
    el('div', { class: 'toolbar__spacer' }),
    addBtn,
  ]));

  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  async function refresh() {
    renderLoading(tableHost);
    const { data, error } = await usersApi.list();
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost);

    const { data: profiles } = await supabase.from('profiles').select('id, permissions');
    const permsMap = new Map((profiles || []).map((p) => [p.id, p.permissions || []]));

    const rows = data.map((u) => {
      const userPerms = permsMap.get(u.id) || [];
      const grantCount = userPerms.filter((p) => !p.startsWith('deny:')).length;
      const denyCount = userPerms.filter((p) => p.startsWith('deny:')).length;
      const permsBadge = userPerms.length
        ? el('span', { class: 'pill', style: 'background:#fef3c7; color:#92400e' },
            `+${grantCount}${denyCount ? ' / -' + denyCount : ''}`)
        : el('span', { class: 'muted small' }, t('defaults') || 'defaults');

      return el('tr', {}, [
        el('td', {}, u.email),
        el('td', {}, u.full_name || '—'),
        el('td', {}, el('span', { class: `pill pill--${u.role}` }, u.role)),
        el('td', {}, permsBadge),
        el('td', {}, fmtDate(u.created_at)),
        el('td', { style: 'white-space: nowrap' }, [
          el('button', {
            class: 'btn btn--ghost',
            onclick: () => openEditUser(u),
          }, '✏️ ' + (t('edit') || 'Edit')),
          el('button', {
            class: 'btn btn--ghost',
            style: 'margin-inline-start:4px',
            onclick: () => openPermissionsEditor(u, permsMap.get(u.id) || []),
          }, '🔐'),
        ]),
      ]);
    });

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('email')),
        el('th', {}, t('name')),
        el('th', {}, 'Role'),
        el('th', {}, t('custom_perms') || 'Perms'),
        el('th', {}, t('created')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, rows),
    ]));
  }

  async function openNewUser() {
    const dlg = el('dialog', { class: 'dialog' });
    const inEmail = el('input', { type: 'email', class: 'input', required: true });
    const inPassword = el('input', { type: 'password', class: 'input', required: true, minlength: 6 });
    const inName = el('input', { class: 'input' });
    const inRole = el('select', { class: 'input' }, [
      el('option', { value: 'staff' }, 'staff'),
      el('option', { value: 'manager' }, 'manager'),
      el('option', { value: 'admin' }, 'admin'),
    ]);
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const email = requireStr(inEmail.value, 'Email');
          const password = requireStr(inPassword.value, 'Password');

          // Use signUp — creates user; admin stays logged in via new session
          const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: inName.value.trim() || null } },
          });
          if (error) throw new Error(errMsg(error));

          // Wait briefly for profile to be created via trigger, then set role
          if (data.user?.id) {
            await new Promise((r) => setTimeout(r, 800));
            await supabase.rpc('set_user_role', { p_user_id: data.user.id, p_role: inRole.value });
            if (inName.value.trim()) {
              await supabase.from('profiles').update({ full_name: inName.value.trim() }).eq('id', data.user.id);
            }
          }

          toast('✅ ' + (t('user_created') || 'User created'), 'success');
          dlg.close();
          refresh();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.hidden = false;
        }
      },
    }, [
      el('h2', {}, '+ ' + (t('new_user') || 'New user')),
      el('p', { class: 'muted small' },
        t('new_user_hint') || 'User will be created. They may need to confirm email before login.'),
      field('Email', inEmail),
      field(t('password') || 'Password', inPassword),
      field(t('name') || 'Name (optional)', inName),
      field('Role', inRole),
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

  async function openEditUser(u) {
    const dlg = el('dialog', { class: 'dialog' });
    const inName = el('input', { class: 'input', value: u.full_name || '' });
    const inRole = el('select', { class: 'input' }, [
      el('option', { value: 'staff' }, 'staff'),
      el('option', { value: 'manager' }, 'manager'),
      el('option', { value: 'admin' }, 'admin'),
    ]);
    inRole.value = u.role;
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          // Update role
          if (inRole.value !== u.role) {
            const r = await usersApi.setRole(u.id, inRole.value);
            if (r.error) throw new Error(errMsg(r.error));
          }
          // Update name
          if (inName.value.trim() !== (u.full_name || '')) {
            const { error } = await supabase.from('profiles').update({ full_name: inName.value.trim() || null }).eq('id', u.id);
            if (error) throw new Error(errMsg(error));
          }
          toast('✓', 'success');
          dlg.close();
          refresh();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.hidden = false;
        }
      },
    }, [
      el('h2', {}, '✏️ ' + u.email),
      field(t('name') || 'Name', inName),
      field('Role', inRole),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, t('save')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  async function openPermissionsEditor(user, currentPerms) {
    const dlg = el('dialog', { class: 'dialog dialog--wide' });
    dlg.appendChild(el('h2', {}, '🔐 ' + user.email));
    dlg.appendChild(el('p', { class: 'muted small' }, t('perms_hint') || 'Tap to cycle: Default → Granted → Denied.'));

    dlg.appendChild(el('div', { class: 'toolbar', style: 'gap:12px; margin-bottom:12px; flex-wrap:wrap' }, [
      el('span', { class: 'muted small' }, (t('states') || 'States') + ':'),
      el('span', { class: 'pill' }, '○ ' + (t('default') || 'Default')),
      el('span', { class: 'pill pill--ok' }, '✓ ' + (t('granted') || 'Granted')),
      el('span', { class: 'pill pill--danger' }, '✕ ' + (t('denied') || 'Denied')),
    ]));

    const state = new Map();
    for (const p of currentPerms) {
      if (p.startsWith('deny:')) state.set(p.slice(5), 'deny');
      else state.set(p, 'grant');
    }

    const groupsHost = el('div', { style: 'max-height:60vh; overflow-y:auto' });
    dlg.appendChild(groupsHost);

    function renderGroups() {
      clear(groupsHost);
      for (const group of PERMISSION_GROUPS) {
        const groupDiv = el('div', { class: 'card', style: 'margin-bottom:12px; padding:12px' });
        groupDiv.appendChild(el('h3', { style: 'margin:0 0 8px' }, group.icon + ' ' + t(group.key)));
        const grid = el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:8px' });
        for (const perm of group.perms) {
          const current = state.get(perm.key) || 'default';
          const label = i18n.lang === 'ar' ? perm.label_ar : perm.label_en;
          const cycle = () => {
            const order = ['default', 'grant', 'deny'];
            const cur = state.get(perm.key) || 'default';
            const next = order[(order.indexOf(cur) + 1) % order.length];
            if (next === 'default') state.delete(perm.key);
            else state.set(perm.key, next);
            renderGroups();
          };
          const iconMap = { default: '○', grant: '✓', deny: '✕' };
          const clsMap = { default: '', grant: 'pill--ok', deny: 'pill--danger' };
          grid.appendChild(el('button', {
            type: 'button', class: 'btn btn--ghost',
            style: 'justify-content:flex-start; text-align:start; padding:8px 10px',
            onclick: cycle,
          }, [
            el('span', { class: 'pill ' + clsMap[current], style: 'min-width:24px; padding:1px 6px' }, iconMap[current]),
            el('span', { style: 'margin-inline-start:8px; font-size:12px' }, label),
          ]));
        }
        groupDiv.appendChild(grid);
        groupsHost.appendChild(groupDiv);
      }
    }
    renderGroups();

    dlg.appendChild(el('div', { class: 'form__actions', style: 'margin-top:16px' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
      el('button', { class: 'btn btn--danger', onclick: async () => {
        if (!confirm(t('reset_perms_confirm') || 'Reset all permissions?')) return;
        const { error } = await setUserPermissions(user.id, []);
        if (error) return toast(errMsg(error), 'error');
        toast('✓', 'success');
        dlg.close(); refresh();
      } }, '↺ ' + (t('reset_to_defaults') || 'Reset')),
      el('button', { class: 'btn btn--primary', onclick: async () => {
        const perms = [];
        for (const [key, action] of state.entries()) {
          if (action === 'grant') perms.push(key);
          else if (action === 'deny') perms.push('deny:' + key);
        }
        const { error } = await setUserPermissions(user.id, perms);
        if (error) return toast(errMsg(error), 'error');
        toast('✓', 'success');
        dlg.close(); refresh();
      } }, t('save')),
    ]));

    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  refresh();
}
