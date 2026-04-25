// frontend/import.js  (Phase 2)
// ---------------------------------------------------------------------
// Bulk-import products from a CSV file or a pasted CSV block.
// Required columns: sku, name. Optional: brand, category, selling_price, status.
// ---------------------------------------------------------------------

import { productsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);

  if (!auth.state.isManagerOrAdmin) {
    host.appendChild(el('div', { class: 'state state--error' }, t('permission_denied')));
    return;
  }

  host.appendChild(el('h1', { class: 'view-title' }, t('import_title')));
  host.appendChild(el('p', { class: 'muted' }, t('import_subtitle')));

  const card = el('div', { class: 'card', style: 'padding: 1rem' });
  host.appendChild(card);

  // Template download
  const templateBtn = el('a', {
    class: 'btn btn--ghost',
    href: 'data:text/csv;charset=utf-8,' + encodeURIComponent(
      'sku,name,brand,category,selling_price,status\nP001,Sample Product,BrandX,Category1,9.99,active\n'
    ),
    download: 'rios-products-template.csv',
  }, t('download_template'));

  // File upload
  const fileInput = el('input', { type: 'file', accept: '.csv,text/csv,application/vnd.ms-excel' });
  const fileBtn = el('button', { class: 'btn btn--ghost', type: 'button',
    onclick: () => fileInput.click() }, t('upload_csv'));
  const fileLabel = el('span', { class: 'hint' }, '');

  // Paste textarea
  const textarea = el('textarea', {
    class: 'input', rows: 8, placeholder: t('paste_placeholder'),
    style: 'font-family: monospace; direction: ltr; text-align: left;',
  });

  // Preview
  const previewBox = el('div');

  // Action buttons
  const previewBtn = el('button', { class: 'btn btn--ghost', type: 'button' }, t('preview'));
  const importBtn  = el('button', { class: 'btn btn--primary', type: 'button', disabled: true }, t('do_import'));

  card.append(
    el('div', { style: 'display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1rem' }, [
      templateBtn, fileBtn, fileLabel, fileInput,
    ]),
    field(t('or_paste_rows'), textarea),
    el('div', { style: 'display:flex; gap:.5rem; margin-top: .75rem' }, [previewBtn, importBtn]),
    previewBox,
  );

  let parsedRows = [];
  let invalidCount = 0;

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    fileLabel.textContent = f.name;
    const text = await f.text();
    textarea.value = text;
    doParse();
  });

  previewBtn.addEventListener('click', doParse);

  function doParse() {
    const result = parseCSV(textarea.value);
    parsedRows = result.valid;
    invalidCount = result.invalid;

    clear(previewBox);
    if (parsedRows.length === 0 && invalidCount === 0) {
      previewBox.appendChild(el('div', { class: 'state' }, t('no_data')));
      importBtn.disabled = true;
      return;
    }

    previewBox.appendChild(el('p', { class: 'hint', style: 'margin-top:1rem' }, [
      t('preview_count', { n: parsedRows.length }),
      invalidCount > 0 ? ' • ' + t('rows_invalid', { n: invalidCount }) : '',
    ].join('')));

    if (parsedRows.length > 0) {
      const table = el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', {}, t('sku')),
          el('th', {}, t('name')),
          el('th', {}, t('brand')),
          el('th', {}, t('category')),
          el('th', { class: 'num' }, t('selling_price')),
          el('th', {}, t('status')),
        ])),
        el('tbody', {}, parsedRows.slice(0, 50).map((r) => el('tr', {}, [
          el('td', { class: 'mono' }, r.sku),
          el('td', {}, r.name),
          el('td', {}, r.brand || '—'),
          el('td', {}, r.category || '—'),
          el('td', { class: 'num' }, r.selling_price ?? '—'),
          el('td', {}, r.status || 'active'),
        ]))),
      ]);
      previewBox.appendChild(el('div', { class: 'card', style: 'margin-top:.5rem' }, table));
      if (parsedRows.length > 50) {
        previewBox.appendChild(el('p', { class: 'hint' }, `… +${parsedRows.length - 50}`));
      }
      importBtn.disabled = false;
    } else {
      importBtn.disabled = true;
    }
  }

  importBtn.addEventListener('click', async () => {
    if (!parsedRows.length) return;
    importBtn.disabled = true;
    importBtn.textContent = t('loading');
    const { data, error } = await productsApi.bulkImport(parsedRows);
    importBtn.disabled = false;
    importBtn.textContent = t('do_import');
    if (error) { toast(errMsg(error), 'error'); return; }
    const msg = t('import_done', { ins: data.inserted, upd: data.updated, err: data.failed });
    toast(msg, data.failed ? 'info' : 'success');

    // Show errors if any
    if (data.failed && data.errors?.length) {
      const errBox = el('div', { class: 'state state--error', style: 'margin-top: .5rem' }, [
        el('strong', {}, msg),
        el('ul', { style: 'text-align: start; margin-top:.5rem' },
          data.errors.slice(0, 20).map((e) => el('li', {}, `${e.sku || '?'}: ${e.error}`)),
        ),
      ]);
      previewBox.appendChild(errBox);
    }
  });
}

// ---------------------------------------------------------------------
// Tiny CSV parser (handles quoted fields and the comma inside quotes).
// ---------------------------------------------------------------------
function parseCSV(text) {
  const out = { valid: [], invalid: 0 };
  if (!text) return out;
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return out;

  // Detect header
  const firstFields = splitLine(lines[0]);
  const looksHeader = firstFields.some((f) => /^(sku|name|brand|category|selling_price|status)$/i.test(f.trim()));
  const header = looksHeader
    ? firstFields.map((f) => f.trim().toLowerCase())
    : ['sku', 'name', 'brand', 'category', 'selling_price', 'status'];
  const dataLines = looksHeader ? lines.slice(1) : lines;

  for (const line of dataLines) {
    const fields = splitLine(line);
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (fields[i] ?? '').trim();
    if (!row.sku || !row.name) { out.invalid++; continue; }
    if (row.selling_price) {
      const n = Number(row.selling_price);
      if (!Number.isFinite(n) || n < 0) { out.invalid++; continue; }
      row.selling_price = n;
    }
    if (row.status && !['active', 'inactive', 'discontinued'].includes(row.status.toLowerCase())) {
      row.status = 'active';
    }
    out.valid.push(row);
  }
  return out;
}

function splitLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}
