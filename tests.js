// frontend/tests.js  (Phase 20 — System Health Tests)
import { supabase } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import { el, clear, toast, renderLoading, renderError, errMsg } from './utils.js';

export async function render(host) {
  clear(host);
  if (!auth.state.isAdmin) {
    host.appendChild(el('div', { class: 'state state--error' }, t('permission_denied')));
    return;
  }

  const runBtn = el('button', { class: 'btn btn--primary', onclick: runTests }, '▶ ' + (t('run_tests') || 'Run tests'));
  host.appendChild(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, '🧪 ' + (t('system_health') || 'System Health Tests')),
    el('div', { class: 'toolbar__spacer' }),
    runBtn,
  ]));

  host.appendChild(el('p', { class: 'muted' },
    t('tests_intro') || 'Run integrity checks on accounting, inventory, permissions, and data consistency.'));

  const card = el('div', { class: 'card' });
  host.appendChild(card);
  card.appendChild(el('div', { class: 'state' }, t('press_run_to_start') || 'Press "Run tests" to start'));

  async function runTests() {
    runBtn.disabled = true;
    runBtn.textContent = '⏳ ' + (t('running') || 'Running...');
    renderLoading(card);

    try {
      const { data, error } = await supabase.rpc('run_all_tests');
      if (error) throw new Error(errMsg(error));

      const passed = data.filter((r) => r.status === 'PASS').length;
      const failed = data.filter((r) => r.status === 'FAIL').length;
      const skipped = data.filter((r) => r.status === 'SKIP').length;
      const total = data.length;

      clear(card);

      const allPassed = failed === 0;
      card.appendChild(el('div', {
        class: 'state',
        style: `padding:16px; text-align:center; font-size:18px; font-weight:600; margin-bottom:16px;
                background: ${allPassed ? '#d1fae5' : '#fee2e2'};
                color: ${allPassed ? '#065f46' : '#991b1b'};
                border: 2px solid ${allPassed ? '#10b981' : '#ef4444'};
                border-radius: 12px`,
      }, allPassed
        ? `✅ ${t('all_tests_passed') || 'All tests passed'}: ${passed}/${total}${skipped ? ' (' + skipped + ' skipped)' : ''}`
        : `❌ ${t('tests_failed') || 'Tests failed'}: ${failed}/${total}${skipped ? ' (' + skipped + ' skipped)' : ''}`));

      card.appendChild(el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('test') || 'Test'),
          el('th', {}, t('status') || 'Status'),
          el('th', {}, t('details') || 'Details'),
        ])),
        el('tbody', {}, data.map((r) => el('tr', {}, [
          el('td', {}, r.test_name),
          el('td', {}, el('span', {
            class: 'pill ' + (r.status === 'PASS' ? 'pill--ok' :
                              r.status === 'SKIP' ? '' : 'pill--danger'),
            style: r.status === 'SKIP' ? 'background:#e5e7eb; color:#6b7280' : '',
          }, r.status === 'PASS' ? '✓ PASS' :
             r.status === 'SKIP' ? '⊘ SKIP' : '✕ FAIL')),
          el('td', { class: 'muted small' }, r.details || '—'),
        ]))),
      ]));

      toast(allPassed ? `✅ ${passed}/${total}` : `❌ ${failed} failed`, allPassed ? 'success' : 'error');
    } catch (err) {
      clear(card);
      card.appendChild(el('div', { class: 'state state--error' },
        '❌ ' + (err.message || String(err)) + '\n\n' +
        (t('run_phase20_sql') || 'Did you run phase20_tests.sql in Supabase?')));
      toast(err.message, 'error');
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = '▶ ' + (t('run_tests') || 'Run tests');
    }
  }
}
