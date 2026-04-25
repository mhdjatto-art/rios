// frontend/print_templates.js  (Phase 15)
// ---------------------------------------------------------------------
// Pre-built templates for every document type in the system.
// All call printDocument() from print.js with their specific bodyHtml.
// ---------------------------------------------------------------------

import { printDocument, formatMoney, formatDate, escapeHtml } from './print.js';
import { t, i18n } from './i18n.js';

// =====================================================================
// INVOICE (sale / purchase)
// =====================================================================
export function printInvoiceDoc({ kind, header, items, payments = [], party = null }) {
  const isSale = kind === 'sale';
  const title = isSale ? (t('sale_invoice') || 'Sales Invoice') : (t('purchase_invoice') || 'Purchase Invoice');
  const docNumber = header.sale_number || header.purchase_number || '';

  let subtotal = 0, totalVat = 0;
  const rows = items.map((it, i) => {
    const lineNet = Number(it.qty) * Number(it.unit_price || it.selling_price);
    const lineVat = lineNet * Number(it.vat_rate || 0) / 100;
    const lineTotal = lineNet + lineVat;
    subtotal += lineNet;
    totalVat += lineVat;
    return `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="mono">${escapeHtml(it.sku || it.product_sku || '')}</td>
        <td>${escapeHtml(it.name || it.product_name || '')}</td>
        <td class="num">${Number(it.qty).toFixed(3).replace(/\.?0+$/, '')}</td>
        <td class="num">${formatMoney(it.unit_price || it.selling_price)}</td>
        <td class="num">${Number(it.vat_rate || 0)}%</td>
        <td class="num strong">${formatMoney(lineTotal)}</td>
      </tr>`;
  }).join('');

  const discount = Number(header.invoice_discount || 0);
  const grand = Number(header.grand_total || subtotal + totalVat - discount);
  const paid = Number(header.paid_amount || 0);
  const balance = grand - paid;

  const body = `
    <div class="doc-meta">
      <div><div class="muted">${escapeHtml(t('invoice_number') || 'Invoice #')}</div>
        <div class="value mono">${escapeHtml(docNumber)}</div></div>
      <div><div class="muted">${escapeHtml(t('date'))}</div>
        <div class="value">${formatDate(header.sale_date || header.purchase_date)}</div></div>
      <div><div class="muted">${isSale ? escapeHtml(t('customer')) : escapeHtml(t('supplier'))}</div>
        <div class="value">${escapeHtml(party?.name || header.customer || header.supplier || t('walk_in'))}</div></div>
      ${party?.phone ? `<div><div class="muted">${escapeHtml(t('phone'))}</div><div class="value">${escapeHtml(party.phone)}</div></div>` : ''}
    </div>

    <table class="print-table">
      <thead><tr>
        <th>#</th>
        <th>${escapeHtml(t('sku') || 'SKU')}</th>
        <th>${escapeHtml(t('name') || 'Name')}</th>
        <th class="num">${escapeHtml(t('qty') || 'Qty')}</th>
        <th class="num">${escapeHtml(t('price') || 'Price')}</th>
        <th class="num">${escapeHtml(t('vat') || 'VAT')}</th>
        <th class="num">${escapeHtml(t('total') || 'Total')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals-box">
      <div class="row"><span>${escapeHtml(t('subtotal') || 'Subtotal')}</span><span>${formatMoney(subtotal)}</span></div>
      <div class="row"><span>${escapeHtml(t('total_vat') || 'VAT')}</span><span>${formatMoney(totalVat)}</span></div>
      ${discount > 0 ? `<div class="row"><span>${escapeHtml(t('discount') || 'Discount')}</span><span>- ${formatMoney(discount)}</span></div>` : ''}
      <div class="row grand"><span>${escapeHtml(t('grand_total') || 'Total')}</span><span>${formatMoney(grand)}</span></div>
      ${paid > 0 ? `<div class="row"><span>${escapeHtml(t('paid') || 'Paid')}</span><span>${formatMoney(paid)}</span></div>` : ''}
      ${balance > 0 ? `<div class="row" style="color:#b00020; font-weight:700"><span>${escapeHtml(t('balance_due') || 'Balance')}</span><span>${formatMoney(balance)}</span></div>` : ''}
    </div>

    ${payments.length ? `
      <h3>${escapeHtml(t('payments') || 'Payments')}</h3>
      <table class="print-table">
        <thead><tr>
          <th>${escapeHtml(t('date'))}</th>
          <th>${escapeHtml(t('method'))}</th>
          <th class="num">${escapeHtml(t('amount'))}</th>
          <th>${escapeHtml(t('notes') || 'Notes')}</th>
        </tr></thead>
        <tbody>${payments.map((p) => `
          <tr>
            <td>${formatDate(p.payment_date)}</td>
            <td>${escapeHtml(t(p.method) || p.method)}</td>
            <td class="num">${formatMoney(p.amount)}</td>
            <td class="small muted">${escapeHtml(p.notes || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : ''}

    <div class="signatures">
      <div class="signature-block">${escapeHtml(t('received_by') || 'Received by')}</div>
      <div class="signature-block">${escapeHtml(t('authorized_by') || 'Authorized by')}</div>
    </div>
  `;

  printDocument({ title, subtitle: `${docNumber}`, bodyHtml: body });
}

// =====================================================================
// PAYMENT RECEIPT (سند قبض) — used when customer pays us
// =====================================================================
export function printPaymentReceipt({ payment, party }) {
  const body = `
    <div class="doc-meta">
      <div><div class="muted">${escapeHtml(t('receipt_number') || 'Receipt #')}</div>
        <div class="value mono">${escapeHtml(payment.receipt_number || payment.id?.slice(0, 8))}</div></div>
      <div><div class="muted">${escapeHtml(t('date'))}</div>
        <div class="value">${formatDate(payment.payment_date)}</div></div>
      <div><div class="muted">${escapeHtml(t('method'))}</div>
        <div class="value"><span class="pill">${escapeHtml(t(payment.method) || payment.method)}</span></div></div>
      ${payment.reference ? `<div><div class="muted">${escapeHtml(t('reference') || 'Reference')}</div><div class="value mono">${escapeHtml(payment.reference)}</div></div>` : ''}
    </div>

    <div style="margin:20px 0; padding:16px; background:#f9f9f9; border-radius:6px; border-inline-start:4px solid var(--primary, #2453b8)">
      <div class="muted small">${escapeHtml(t('received_from') || 'Received from')}</div>
      <div class="strong" style="font-size:18px; margin:4px 0">${escapeHtml(party?.name || payment.party_name || '—')}</div>
      ${party?.phone ? `<div class="small muted">📞 ${escapeHtml(party.phone)}</div>` : ''}
    </div>

    <div style="margin:20px 0; padding:20px; border:2px solid var(--primary, #2453b8); border-radius:6px; text-align:center">
      <div class="muted small">${escapeHtml(t('amount_received') || 'Amount received')}</div>
      <div style="font-size:32px; font-weight:700; color:var(--primary, #2453b8); margin:6px 0">${formatMoney(payment.amount)}</div>
      <div class="small muted">${escapeHtml(t('in_words') || 'In words')}: ${escapeHtml(numberToWords(payment.amount))}</div>
    </div>

    ${payment.notes ? `
    <div style="margin:12px 0"><strong>${escapeHtml(t('notes') || 'Notes')}:</strong> ${escapeHtml(payment.notes)}</div>` : ''}

    <div class="signatures">
      <div class="signature-block">${escapeHtml(t('receiver') || 'Receiver')}</div>
      <div class="signature-block">${escapeHtml(t('payer') || 'Payer')}</div>
    </div>
  `;

  printDocument({ title: t('payment_receipt') || 'Payment Receipt', subtitle: t('for_collection') || 'Collection voucher', bodyHtml: body });
}

// =====================================================================
// PAYMENT VOUCHER (سند صرف) — used when we pay supplier/expense
// =====================================================================
export function printPaymentVoucher({ payment, party }) {
  const body = `
    <div class="doc-meta">
      <div><div class="muted">${escapeHtml(t('voucher_number') || 'Voucher #')}</div>
        <div class="value mono">${escapeHtml(payment.voucher_number || payment.id?.slice(0, 8))}</div></div>
      <div><div class="muted">${escapeHtml(t('date'))}</div>
        <div class="value">${formatDate(payment.payment_date)}</div></div>
      <div><div class="muted">${escapeHtml(t('method'))}</div>
        <div class="value"><span class="pill">${escapeHtml(t(payment.method) || payment.method)}</span></div></div>
      ${payment.reference ? `<div><div class="muted">${escapeHtml(t('reference') || 'Reference')}</div><div class="value mono">${escapeHtml(payment.reference)}</div></div>` : ''}
    </div>

    <div style="margin:20px 0; padding:16px; background:#fef3c7; border-radius:6px; border-inline-start:4px solid #f59e0b">
      <div class="muted small">${escapeHtml(t('paid_to') || 'Paid to')}</div>
      <div class="strong" style="font-size:18px; margin:4px 0">${escapeHtml(party?.name || payment.party_name || '—')}</div>
      ${party?.phone ? `<div class="small muted">📞 ${escapeHtml(party.phone)}</div>` : ''}
    </div>

    <div style="margin:20px 0; padding:20px; border:2px solid #f59e0b; border-radius:6px; text-align:center">
      <div class="muted small">${escapeHtml(t('amount_paid') || 'Amount paid')}</div>
      <div style="font-size:32px; font-weight:700; color:#b45309; margin:6px 0">${formatMoney(payment.amount)}</div>
      <div class="small muted">${escapeHtml(t('in_words') || 'In words')}: ${escapeHtml(numberToWords(payment.amount))}</div>
    </div>

    ${payment.notes ? `
    <div style="margin:12px 0"><strong>${escapeHtml(t('notes') || 'Notes')}:</strong> ${escapeHtml(payment.notes)}</div>` : ''}

    <div class="signatures">
      <div class="signature-block">${escapeHtml(t('payer') || 'Payer')}</div>
      <div class="signature-block">${escapeHtml(t('receiver') || 'Receiver')}</div>
    </div>
  `;

  printDocument({ title: t('payment_voucher') || 'Payment Voucher', subtitle: t('for_disbursement') || 'Disbursement voucher', bodyHtml: body });
}

// =====================================================================
// GENERIC REPORT (trial balance, income statement, etc.)
// =====================================================================
export function printReport({ title, subtitle = '', columns, rows, totals = null }) {
  const thead = columns.map((c) => `<th${c.numeric ? ' class="num"' : ''}>${escapeHtml(c.label)}</th>`).join('');
  const tbody = rows.map((r) => `<tr>${
    columns.map((c) => {
      const val = c.render ? c.render(r) : r[c.key];
      const cls = c.numeric ? ' class="num"' : (c.mono ? ' class="mono"' : '');
      return `<td${cls}>${val != null ? val : '—'}</td>`;
    }).join('')
  }</tr>`).join('');

  const tfoot = totals ? `<tfoot>${
    totals.map((r) => `<tr>${columns.map((c) => {
      const v = r[c.key];
      const cls = c.numeric ? ' class="num strong"' : ' class="strong"';
      return `<td${cls}>${v != null ? v : ''}</td>`;
    }).join('')}</tr>`).join('')
  }</tfoot>` : '';

  const body = `
    <table class="print-table">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
      ${tfoot}
    </table>`;

  printDocument({ title, subtitle, bodyHtml: body });
}

// =====================================================================
// BALANCE SHEET
// =====================================================================
export function printBalanceSheet({ assets, liabilities, equity, asOf }) {
  const sum = (rows) => rows.reduce((s, r) => s + Number(r.balance || 0), 0);
  const ta = sum(assets), tl = sum(liabilities), te = sum(equity);
  const diff = ta - (tl + te);

  const section = (rows) => rows.map((r) => `
    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dotted #ddd">
      <span><span class="mono small muted">${escapeHtml(r.account_code)}</span> ${escapeHtml(i18n.lang === 'ar' ? r.name_ar : r.name_en)}</span>
      <span class="mono">${formatMoney(r.balance)}</span>
    </div>`).join('');

  const body = `
    <div class="doc-meta">
      <div><div class="muted">${escapeHtml(t('as_of') || 'As of')}</div>
        <div class="value">${formatDate(asOf)}</div></div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:20px">
      <div>
        <h2>💰 ${escapeHtml(t('acct_asset') || 'Assets')}</h2>
        ${section(assets)}
        <div style="display:flex; justify-content:space-between; padding:10px; margin-top:10px; border-top:2px solid; font-weight:700">
          <span>${escapeHtml(t('total_assets') || 'Total Assets')}</span>
          <span>${formatMoney(ta)}</span>
        </div>
      </div>
      <div>
        <h2>💳 ${escapeHtml(t('acct_liability') || 'Liabilities')}</h2>
        ${section(liabilities)}
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px dashed">
          <strong>${escapeHtml(t('total') || 'Total')} ${escapeHtml(t('acct_liability') || 'Liab.')}</strong>
          <strong>${formatMoney(tl)}</strong>
        </div>

        <h2 style="margin-top:16px">🏦 ${escapeHtml(t('acct_equity') || 'Equity')}</h2>
        ${section(equity)}
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px dashed">
          <strong>${escapeHtml(t('total') || 'Total')} ${escapeHtml(t('acct_equity') || 'Equity')}</strong>
          <strong>${formatMoney(te)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:10px; margin-top:10px; border-top:2px solid; font-weight:700">
          <span>${escapeHtml(t('total_liab_equity') || 'Total L+E')}</span>
          <span>${formatMoney(tl + te)}</span>
        </div>
      </div>
    </div>

    <div style="margin-top:30px; padding:12px; text-align:center;
                background:${Math.abs(diff) < 0.01 ? '#d1fae5' : '#fee2e2'};
                border-radius:6px; font-weight:600">
      ${Math.abs(diff) < 0.01 ? `✅ ${escapeHtml(t('balanced') || 'Balanced')}` :
        `⚠️ ${escapeHtml(t('balance_sheet_diff') || 'Imbalance')}: ${formatMoney(diff)}`}
    </div>
  `;

  printDocument({ title: t('balance_sheet') || 'Balance Sheet', subtitle: formatDate(asOf), bodyHtml: body });
}

// =====================================================================
// INCOME STATEMENT
// =====================================================================
export function printIncomeStatement({ revenue, expenses, from, to }) {
  const sum = (rows) => rows.reduce((s, r) => s + Number(r.balance || 0), 0);
  const tr = sum(revenue), te = sum(expenses);
  const net = tr - te;

  const section = (rows) => rows.map((r) => `
    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dotted #ddd">
      <span><span class="mono small muted">${escapeHtml(r.account_code)}</span> ${escapeHtml(i18n.lang === 'ar' ? r.name_ar : r.name_en)}</span>
      <span class="mono">${formatMoney(r.balance)}</span>
    </div>`).join('');

  const body = `
    <div class="doc-meta">
      <div><div class="muted">${escapeHtml(t('period') || 'Period')}</div>
        <div class="value">${formatDate(from)} → ${formatDate(to)}</div></div>
    </div>

    <h2>💰 ${escapeHtml(t('revenue') || 'Revenue')}</h2>
    ${section(revenue)}
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px dashed; margin-bottom:16px">
      <strong>${escapeHtml(t('total_revenue') || 'Total Revenue')}</strong>
      <strong style="color:#059669">${formatMoney(tr)}</strong>
    </div>

    <h2>💸 ${escapeHtml(t('expenses') || 'Expenses')}</h2>
    ${section(expenses)}
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px dashed; margin-bottom:16px">
      <strong>${escapeHtml(t('total_expenses') || 'Total Expenses')}</strong>
      <strong style="color:#dc2626">(${formatMoney(te)})</strong>
    </div>

    <div style="display:flex; justify-content:space-between; padding:14px; margin-top:14px;
                border-top:3px double; font-size:18px; font-weight:700;
                color:${net >= 0 ? '#059669' : '#dc2626'}">
      <span>${net >= 0 ? '📈 ' : '📉 '} ${escapeHtml(net >= 0 ? (t('net_income') || 'Net Income') : (t('net_loss') || 'Net Loss'))}</span>
      <span>${formatMoney(net)}</span>
    </div>
  `;

  printDocument({ title: t('income_statement') || 'Income Statement',
    subtitle: `${formatDate(from)} → ${formatDate(to)}`, bodyHtml: body });
}

// =====================================================================
// Helper: convert number to words (simplified for IQD)
// =====================================================================
function numberToWords(n) {
  n = Math.abs(Number(n || 0));
  if (!n) return '';
  return Number(n).toLocaleString();  // keep simple — localized formatted number
}
