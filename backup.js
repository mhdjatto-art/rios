// frontend/backup.js (Phase 4)
// ---------------------------------------------------------------------
// Downloads all main tables as CSV files. Uses JSZip from a CDN for the
// zip packaging — the CSV conversion is in-house.
// ---------------------------------------------------------------------

import { exportApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import { el, clear, toast, errMsg } from './utils.js';
import { logError, logWarning } from './logger.js';

const TABLES = [
  'products', 'customers', 'suppliers',
  'purchases', 'purchase_items',
  'sales', 'sale_items', 'stock_movements',
  'payments', 'returns', 'return_items',
  'expenses', 'quotations', 'quotation_items',
  'purchase_orders', 'po_items',
  'cash_sessions', 'audit_log',
  'branches', 'stock_transfers', 'stock_transfer_items',
  'company_settings', 'profiles',
];

export async function render(host) {
  clear(host);
  if (!auth.state.isAdmin) {
    host.appendChild(el('div', { class: 'state state--error' }, t('permission_denied')));
    return;
  }

  host.appendChild(el('h1', { class: 'view-title' }, t('backup_title')));
  host.appendChild(el('p', { class: 'muted' }, t('backup_subtitle')));

  const card = el('div', { class: 'card', style: 'padding:1.5rem; text-align:center' });
  host.appendChild(card);

  const btn = el('button', { class: 'btn btn--primary', style: 'font-size:16px; padding:.8rem 1.5rem' }, '⬇️ ' + t('backup_btn'));
  card.appendChild(btn);

  const status = el('div', { class: 'state', style: 'margin-top:1rem' });
  card.appendChild(status);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.textContent = t('backup_running');

    try {
      // Lazy-load JSZip (small library) from CDN.
      const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
      const zip = new JSZip();
      const skippedTables = [];

      for (const table of TABLES) {
        status.textContent = t('backup_running') + ' — ' + table;
        const { data, error } = await exportApi.fetchAll(table);
        if (error) {
          const msg = error.message || String(error);
          skippedTables.push({ table, error: msg });
          logWarning('Backup skipped table', { source: 'backup.fetchAll', table, error: msg });
          continue;
        }
        zip.file(`${table}.csv`, toCSV(data || []));
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      zip.file(
        'README.txt',
        `RIOS Backup\nGenerated: ${new Date().toISOString()}\nTables: ${TABLES.join(', ')}\nSkipped: ${skippedTables.length}\n`
      );
      if (skippedTables.length > 0) {
        zip.file('skipped_tables.json', JSON.stringify(skippedTables, null, 2));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rios-backup-${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (skippedTables.length > 0) {
        status.textContent = t('backup_done') + ' (' + skippedTables.length + ' skipped)';
        toast(
          t('backup_done') + ' — ' + skippedTables.length + ' table(s) skipped. See skipped_tables.json inside the zip.',
          'warning'
        );
      } else {
        status.textContent = t('backup_done');
        toast(t('backup_done'), 'success');
      }
    } catch (err) {
      logError(err, { source: 'backup.run' });
      status.textContent = t('something_wrong');
      toast(errMsg({ message: err.message }), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// Tiny CSV exporter (handles strings with commas and quotes).
function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return '';
    if (typeof v ===
