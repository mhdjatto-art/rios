// frontend/barcode_labels.js  (Phase 17)
// Generates printable barcode labels — supports Code 128 using a simple library.
import { productsApi } from './api.js';
import { t } from './i18n.js';
import { el, clear, toast, renderLoading, renderError } from './utils.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, '🏷️ ' + t('barcode_labels')));

  const card = el('div', { class: 'card' });
  host.appendChild(card);
  renderLoading(card);

  const { data: products, error } = await productsApi.list({ status: 'active', limit: 500 });
  if (error) return renderError(card, error);
  clear(card);

  const state = new Map();  // product_id -> qty to print

  card.appendChild(el('p', { class: 'muted' }, t('barcode_labels_intro')));

  const searchIn = el('input', { class: 'input', placeholder: '🔍 ' + t('search'),
    oninput: (e) => {
      const f = e.target.value.toLowerCase();
      for (const row of document.querySelectorAll('.bl-row')) {
        const txt = (row.dataset.search || '').toLowerCase();
        row.style.display = txt.includes(f) ? '' : 'none';
      }
    } });

  const sizeSel = el('select', { class: 'input' }, [
    el('option', { value: 'small' }, t('label_small') + ' (40×30mm)'),
    el('option', { value: 'medium' }, t('label_medium') + ' (60×40mm)'),
    el('option', { value: 'large' }, t('label_large') + ' (80×50mm)'),
  ]);

  const toolbar = el('div', { class: 'toolbar', style: 'margin-bottom:12px; gap:10px; align-items:center' }, [
    searchIn,
    el('label', { style: 'display:flex; gap:6px; align-items:center' }, [
      el('span', { class: 'muted small' }, t('size') + ':'), sizeSel,
    ]),
    el('div', { class: 'toolbar__spacer' }),
    el('button', { class: 'btn btn--primary', onclick: () => printLabels(sizeSel.value) }, '🖨 ' + t('print')),
  ]);
  card.appendChild(toolbar);

  const tbl = el('table', { class: 'table' }, [
    el('thead', {}, el('tr', {}, [
      el('th', {}, t('sku')),
      el('th', {}, t('barcode')),
      el('th', {}, t('name')),
      el('th', { class: 'num' }, t('price')),
      el('th', { class: 'num' }, t('qty_to_print')),
    ])),
    el('tbody', {}, products.map((p) => {
      const qtyInput = el('input', {
        type: 'number', min: '0', max: '100', class: 'input num', style: 'max-width:80px',
        value: state.get(p.id) || 0,
        oninput: (e) => state.set(p.id, Number(e.target.value || 0)),
      });
      return el('tr', { class: 'bl-row', 'data-search': `${p.sku} ${p.name} ${p.barcode || ''}` }, [
        el('td', { class: 'mono' }, p.sku),
        el('td', { class: 'mono small muted' }, p.barcode || p.sku),
        el('td', {}, p.name),
        el('td', { class: 'num' }, (p.selling_price ?? 0).toFixed(2)),
        el('td', { class: 'num' }, qtyInput),
      ]);
    })),
  ]);
  card.appendChild(tbl);

  function printLabels(size = 'medium') {
    const selected = [];
    for (const p of products) {
      const q = state.get(p.id) || 0;
      for (let i = 0; i < q; i++) selected.push(p);
    }
    if (!selected.length) { toast(t('select_products_first'), 'error'); return; }

    let company = {};
    try { company = JSON.parse(localStorage.getItem('rios.company') || '{}'); } catch {}
    const currency = company.currency_symbol || '';

    const dims = {
      small: { w: 40, h: 30, fsName: 9, fsPrice: 10, fsSku: 7 },
      medium: { w: 60, h: 40, fsName: 11, fsPrice: 13, fsSku: 9 },
      large: { w: 80, h: 50, fsName: 13, fsPrice: 16, fsSku: 10 },
    }[size];

    const labels = selected.map((p) => `
      <div class="label">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">${(p.selling_price ?? 0).toFixed(2)} ${escapeHtml(currency)}</div>
        <div class="barcode-wrap">
          <svg class="barcode" jsbarcode-value="${escapeHtml(p.barcode || p.sku)}"
            jsbarcode-format="CODE128" jsbarcode-width="1.2" jsbarcode-height="30"
            jsbarcode-fontsize="10" jsbarcode-margin="0"></svg>
        </div>
        <div class="sku mono">${escapeHtml(p.sku)}</div>
        ${company.name ? `<div class="co">${escapeHtml(company.name)}</div>` : ''}
      </div>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>${t('barcode_labels')}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      <style>
        @page { size: A4; margin: 10mm; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, Cairo, sans-serif; }
        .sheet { display: grid; grid-template-columns: repeat(auto-fill, ${dims.w}mm); gap: 2mm; padding: 5mm; }
        .label {
          width: ${dims.w}mm; height: ${dims.h}mm;
          border: 0.5pt dashed #ccc; padding: 2mm;
          display: flex; flex-direction: column; justify-content: space-between;
          break-inside: avoid; overflow: hidden; text-align: center;
        }
        .name { font-size: ${dims.fsName}px; font-weight: 600; line-height: 1.1;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .price { font-size: ${dims.fsPrice}px; font-weight: 700; color: #2453b8; }
        .barcode-wrap { display: flex; justify-content: center; align-items: center; flex: 1; }
        .barcode { max-width: 100%; max-height: 100%; }
        .sku { font-size: ${dims.fsSku}px; color: #666; }
        .co { font-size: 7px; color: #888; }
        .toolbar-print { padding: 10px; background: #eee; text-align: center; }
        .toolbar-print button { padding: 6px 16px; }
        @media print { .toolbar-print { display: none; } }
      </style>
      </head><body>
      <div class="toolbar-print"><button onclick="window.print()">🖨 Print</button> <button onclick="window.close()">Close</button></div>
      <div class="sheet">${labels}</div>
      <script>
        setTimeout(() => { JsBarcode('.barcode').init(); setTimeout(() => window.print(), 400); }, 300);
      </script>
      </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Popup blocked'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
