// frontend/print.js  (Phase 15 — unified print system)
// ---------------------------------------------------------------------
// Generic helper: opens a new window with a print-ready page using the
// company's print settings (logo, color, paper size, footer, etc.).
//
// Use from any page:
//   import { printDocument } from './print.js';
//   printDocument({ title: '...', bodyHtml: '...' });
// ---------------------------------------------------------------------

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadCompany() {
  try { return JSON.parse(localStorage.getItem('rios.company') || '{}'); }
  catch { return {}; }
}

const PAPER_CSS = {
  A4: `@page { size: A4; margin: 15mm; } body { max-width: 180mm; }`,
  A5: `@page { size: A5; margin: 10mm; } body { max-width: 128mm; font-size: 11px; }`,
  thermal_80: `@page { size: 80mm auto; margin: 3mm; } body { max-width: 74mm; font-size: 11px; }`,
};

export function printDocument({
  title = 'Document',
  subtitle = '',
  bodyHtml = '',
  showHeader = true,
  showFooter = true,
  autoPrint = true,
  lang = document.documentElement.lang || 'en',
  dir = document.documentElement.dir || 'ltr',
}) {
  const company = loadCompany();
  const paperCss = PAPER_CSS[company.print_paper_size || 'A4'] || PAPER_CSS.A4;
  const primary = company.print_color_primary || '#2453b8';
  const fontSize = company.print_font_size || 12;
  const showLogo = company.print_show_logo !== false;
  const showTaxNum = company.print_show_tax_num !== false;
  const showFooterSetting = company.print_show_footer !== false;

  const styles = `
    * { box-sizing: border-box; }
    ${paperCss}
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", "Cairo", "Tahoma", sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.5;
      color: #111;
      padding: 0;
    }
    h1 { font-size: ${fontSize + 10}px; margin: 0 0 4px; color: ${primary}; letter-spacing: -0.02em; }
    h2 { font-size: ${fontSize + 5}px; margin: 14px 0 6px; color: ${primary}; }
    h3 { font-size: ${fontSize + 2}px; margin: 10px 0 4px; }
    p { margin: 4px 0; }
    .muted { color: #666; }
    .small { font-size: ${fontSize - 2}px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .strong { font-weight: 700; }
    .num { text-align: end; font-variant-numeric: tabular-nums; }

    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid ${primary};
      margin-bottom: 20px;
    }
    .doc-header__logo img { max-height: 80px; max-width: 120px; }
    .doc-header__company { text-align: end; }
    .doc-header__company strong { font-size: ${fontSize + 4}px; color: ${primary}; }

    .doc-title {
      text-align: center;
      margin: 14px 0 20px;
      padding: 8px;
      background: ${primary}11;
      border: 1px solid ${primary};
      border-radius: 6px;
    }
    .doc-title h1 { margin: 0; }
    .doc-title .subtitle { color: #555; font-size: ${fontSize - 1}px; }

    .doc-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px 16px;
      margin-bottom: 16px;
      padding: 10px 12px;
      background: #f7f7f7;
      border-radius: 4px;
    }
    .doc-meta > div > .muted { font-size: ${fontSize - 2}px; }
    .doc-meta > div > .value { font-weight: 600; }

    table.print-table {
      width: 100%; border-collapse: collapse;
      margin: 10px 0;
    }
    table.print-table th {
      background: ${primary};
      color: white;
      padding: 8px 10px;
      text-align: start;
      font-weight: 600;
      font-size: ${fontSize - 1}px;
    }
    table.print-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #e5e5e5;
    }
    table.print-table tr:nth-child(even) td { background: #f9f9f9; }
    table.print-table tfoot td {
      background: #f0f0f0;
      font-weight: 700;
      border-top: 2px solid ${primary};
    }

    .totals-box {
      margin-top: 16px;
      padding: 12px 16px;
      background: #f9f9f9;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      max-width: 320px;
      margin-inline-start: auto;
    }
    .totals-box .row {
      display: flex; justify-content: space-between;
      padding: 4px 0;
    }
    .totals-box .grand {
      border-top: 2px solid ${primary};
      padding-top: 8px; margin-top: 6px;
      color: ${primary};
      font-size: ${fontSize + 4}px;
      font-weight: 700;
    }

    .signatures {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .signature-block {
      text-align: center;
      border-top: 1px solid #555;
      padding-top: 8px;
    }

    .doc-footer {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      text-align: center;
      color: #666;
      font-size: ${fontSize - 2}px;
    }

    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: ${primary}22;
      color: ${primary};
      font-weight: 600;
      font-size: ${fontSize - 2}px;
    }

    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }

    .toolbar-print {
      position: sticky; top: 0;
      background: #f0f0f0; padding: 10px; text-align: center;
      border-bottom: 1px solid #ccc; margin: -15mm -15mm 15mm -15mm;
    }
    .toolbar-print button {
      padding: 6px 16px; margin: 0 4px; font-size: 13px;
      border: 1px solid #888; background: white; border-radius: 4px; cursor: pointer;
    }
    .toolbar-print button.primary {
      background: ${primary}; color: white; border-color: ${primary};
    }
  `;

  const header = showHeader ? `
    <div class="doc-header">
      ${showLogo && company.logo_url ? `
        <div class="doc-header__logo">
          <img src="${escapeHtml(company.logo_url)}" alt="">
        </div>` : '<div></div>'}
      <div class="doc-header__company">
        <strong>${escapeHtml(company.name || 'RIOS')}</strong><br>
        ${company.phone ? `📞 ${escapeHtml(company.phone)}<br>` : ''}
        ${company.email ? `✉ ${escapeHtml(company.email)}<br>` : ''}
        ${company.address ? `<span class="small muted">${escapeHtml(company.address)}</span><br>` : ''}
        ${showTaxNum && company.tax_number ? `<span class="small">TAX#: ${escapeHtml(company.tax_number)}</span>` : ''}
      </div>
    </div>
  ` : '';

  const docTitle = title ? `
    <div class="doc-title">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
  ` : '';

  const footer = showFooter && showFooterSetting ? `
    <div class="doc-footer">
      ${escapeHtml(company.invoice_footer || 'Thank you for your business')}
      <br>${escapeHtml(company.name || 'RIOS')} • ${new Date().toLocaleString()}
    </div>
  ` : '';

  const toolbar = `
    <div class="toolbar-print no-print">
      <button class="primary" onclick="window.print()">🖨 Print</button>
      <button onclick="window.close()">Close</button>
    </div>
  `;

  const html = `<!doctype html>
    <html lang="${lang}" dir="${dir}">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>${styles}</style>
    </head>
    <body>
      ${toolbar}
      ${header}
      ${docTitle}
      ${bodyHtml}
      ${footer}
    </body>
    </html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Popup blocked — please allow popups'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (autoPrint) {
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 500);
  }
}

// Helpers --------------------------------------------------------------
export function formatMoney(n, symbol = null) {
  const company = loadCompany();
  const sym = symbol || company.currency_symbol || '';
  const v = Number(n || 0).toFixed(2);
  const withCommas = v.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sym ? `${withCommas} ${sym}` : withCommas;
}

export function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return String(d); }
}

export { escapeHtml };
