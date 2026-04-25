// frontend/payroll.js  (Phase 17)
import { payrollApi, employeesApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty,
  money, fmtDate, isoDate, nextDocNumber, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;

  const newBtn = el('button', { class: 'btn btn--primary', disabled: !isManagerOrAdmin,
    onclick: () => openNewRun() }, '+ ' + t('new_payroll_run'));

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '💰 ' + t('payroll')),
    el('div', { class: 'toolbar__spacer' }),
    newBtn,
  ]));

  const card = el('div', { class: 'card' });
  host.appendChild(card);

  async function refresh() {
    renderLoading(card);
    const { data, error } = await payrollApi.listRuns();
    if (error) return renderError(card, error);
    if (!data.length) return renderEmpty(card, t('no_payroll_runs'));

    clear(card);
    card.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('run_number')),
        el('th', {}, t('pay_date')),
        el('th', {}, t('period')),
        el('th', {}, t('status')),
        el('th', {}, ''),
      ])),
      el('tbody', {}, data.map((r) => el('tr', { style: 'cursor:pointer', onclick: () => openRun(r.id) }, [
        el('td', { class: 'mono strong' }, r.run_number),
        el('td', {}, fmtDate(r.pay_date)),
        el('td', {}, `${fmtDate(r.period_start)} → ${fmtDate(r.period_end)}`),
        el('td', {}, el('span', { class: `pill pill--${r.status === 'posted' ? 'ok' : 'warn'}` }, t(r.status))),
        el('td', {}, '↗'),
      ]))),
    ]));
  }

  async function openNewRun() {
    const dlg = el('dialog', { class: 'dialog' });
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const inStart = el('input', { type: 'date', class: 'input', value: startOfMonth.toISOString().slice(0, 10) });
    const inEnd = el('input', { type: 'date', class: 'input', value: endOfMonth.toISOString().slice(0, 10) });
    const inPay = el('input', { type: 'date', class: 'input', value: isoDate() });
    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const res = await payrollApi.createRun({
            run_number: nextDocNumber('PAY'),
            period_start: inStart.value,
            period_end: inEnd.value,
            pay_date: inPay.value,
          });
          if (res.error) throw new Error(errMsg(res.error));

          // Auto-populate with active employees
          const empRes = await employeesApi.list({ activeOnly: true });
          if (!empRes.error) {
            for (const e of empRes.data) {
              await payrollApi.addItem({
                run_id: res.data.id,
                employee_id: e.id,
                base_salary: e.base_salary,
                net_pay: e.base_salary,
              });
            }
          }
          toast('✓', 'success');
          dlg.close();
          openRun(res.data.id);
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, '+ ' + t('new_payroll_run')),
      el('div', { class: 'grid-2' }, [
        field(t('period_start'), inStart),
        field(t('period_end'), inEnd),
        field(t('pay_date'), inPay),
      ]),
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

  async function openRun(id) {
    clear(host);
    const { data, error } = await payrollApi.getRun(id);
    if (error) return renderError(host, error);
    const { header, items } = data;

    const backBtn = el('button', { class: 'btn btn--ghost', onclick: () => render(host) }, '← ' + t('back'));
    host.append(el('div', { class: 'toolbar' }, [
      backBtn,
      el('h1', { class: 'view-title' }, '💰 ' + header.run_number),
      el('div', { class: 'toolbar__spacer' }),
      el('span', { class: `pill pill--${header.status === 'posted' ? 'ok' : 'warn'}` }, t(header.status)),
    ]));

    const card = el('div', { class: 'card' });
    host.appendChild(card);
    const readOnly = header.status === 'posted';

    const render_items = () => {
      clear(card);
      let totalGross = 0, totalNet = 0;
      card.appendChild(el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('employee')),
          el('th', { class: 'num' }, t('base_salary')),
          el('th', { class: 'num' }, t('bonuses')),
          el('th', { class: 'num' }, t('overtime')),
          el('th', { class: 'num' }, t('deductions')),
          el('th', { class: 'num' }, t('advances')),
          el('th', { class: 'num strong' }, t('net_pay')),
          el('th', {}, ''),
        ])),
        el('tbody', {}, items.map((it) => {
          totalGross += Number(it.base_salary) + Number(it.bonuses) + Number(it.overtime);
          totalNet += Number(it.net_pay);
          const fields = ['base_salary', 'bonuses', 'overtime', 'deductions', 'advances'];
          const inputs = fields.map((f) => readOnly ?
            el('td', { class: 'num mono' }, money(it[f])) :
            el('td', { class: 'num' }, el('input', {
              type: 'number', step: '0.01', min: '0', class: 'input num', style: 'max-width:100px',
              value: it[f], onchange: async (e) => {
                const updates = { [f]: Number(e.target.value || 0) };
                // Recompute net
                const newIt = { ...it, ...updates };
                updates.net_pay = Number(newIt.base_salary) + Number(newIt.bonuses) + Number(newIt.overtime) - Number(newIt.deductions) - Number(newIt.advances);
                await payrollApi.updateItem(it.id, updates);
                openRun(id);
              },
            })));
          return el('tr', {}, [
            el('td', { class: 'strong' }, it.employees?.name || '—'),
            ...inputs,
            el('td', { class: 'num strong' }, money(it.net_pay)),
            readOnly ? '' : el('td', {}, el('button', { class: 'btn btn--danger',
              onclick: async () => {
                await payrollApi.removeItem(it.id);
                openRun(id);
              } }, '×')),
          ]);
        })),
        el('tfoot', {}, el('tr', {}, [
          el('td', { class: 'strong' }, t('totals')),
          el('td', { class: 'num strong', colspan: 3 }, 'Gross: ' + money(totalGross)),
          el('td', { class: 'num' }, ''),
          el('td', { class: 'num' }, ''),
          el('td', { class: 'num strong' }, 'Net: ' + money(totalNet)),
          el('td', {}, ''),
        ])),
      ]));

      if (!readOnly) {
        host.appendChild(el('div', { class: 'toolbar', style: 'margin-top:16px' }, [
          el('div', { class: 'toolbar__spacer' }),
          el('button', { class: 'btn btn--primary',
            onclick: async () => {
              if (!confirm(t('confirm_post_payroll'))) return;
              const res = await payrollApi.post(id);
              if (res.error) return toast(errMsg(res.error), 'error');
              toast(`✅ ${t('posted')} • ${t('net_pay')}: ${money(res.data.net)}`, 'success');
              render(host);
            } }, '✅ ' + t('post_payroll')),
        ]));
      }
    };
    render_items();
  }

  await refresh();
}
