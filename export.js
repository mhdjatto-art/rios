// frontend/export.js  (Phase 15 — unified export helpers)
// ---------------------------------------------------------------------
// Export any dataset to CSV (with Arabic-safe BOM) or printable HTML.
// ---------------------------------------------------------------------

/**
 * exportCSV(rows, filename, columns?)
 *   rows    : array of plain objects
 *   filename: string (without .csv)
 *   columns : optional [{ key, label }] — order + headers
 */
export function exportCSV(rows, filename = 'export', columns = null) {
  if (!rows || !rows.length) return;
  const keys = columns ? columns.map((c) => c.key) : Object.keys(rows[0]);
  const labels = columns ? columns.map((c) => c.label) : keys;

  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const header = labels.map(escape).join(',');
  const body = rows.map((r) => keys.map((k) => escape(r[k])).join(',')).join('\n');
  const BOM = '\uFEFF';  // UTF-8 BOM for Excel to recognize Arabic
  const csv = BOM + header + '\n' + body;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * exportJSON - quick JSON export
 */
export function exportJSON(data, filename = 'export') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
