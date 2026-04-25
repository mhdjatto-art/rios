// frontend/reports.js  (Phase 25 — Comprehensive reports + export)
import { supabase, salesApi, purchasesApi, paymentsApi, expensesApi, productsApi, inventoryApi, reportsApi } from './api.js';
import { auth } from './auth.js';
import { t, i18n } from './i18n.js';
import { el, clear, toast, renderLoading, renderError, fmtDate, money, qty, errMsg } from './utils.js';
import { exportCSV } from './export.js';
import { printReport } from './print_templates.js';

// Report definitions
const REPORTS = {
  sales: {
    icon: '🧾', label_en: 'Sales Detail', label_ar: 'تفاصيل المبيعات',
    fetch: async (from, to) => {
      const { data } = await salesApi.list({ from, to, limit: 1000 });
      return (data || []).map((s) => ({
        sale_number: s.sale_number,
        date: fmtDate(s.sale_date),
        customer: s.customers?.name || s.customer || 'Walk-in',
        subtotal: Number(s.subtotal || 0),
        vat: Number(s.total_vat || 0),
        discount: Number(s.discount_invoice || 0),
        grand_total: Number(s.grand_total || 0),
        paid: Number(s.paid_amount || 0),
        balance: Number(s.grand_total || 0) - Number(s.paid_amount || 0),
      }));
    },
    columns: [
      { key: 'sale_number', label: '#' },
      { key: 'date', label: 'Date' },
      { key: 'customer', label: 'Customer' },
      { key: 'subtotal', label: 'Subtotal', numeric: true, render: (r) => money(r.subtotal) },
      { key: 'vat', label: 'VAT', numeric: true, render: (r) => money(r.vat) },
      { key: 'discount', label: 'Discount', numeric: true, render: (r) => money(r.discount) },
      { key: 'grand_total', label: 'Total', numeric: true, render: (r) => money(r.grand_total) },
      { key: 'paid', label: 'Paid', numeric: true, render: (r) => money(r.paid) },
      { key: 'balance', label: 'Balance', numeric: true, render: (r) => money(r.balance) },
    ],
  },
  purchases: {
    icon: '🛒', label_en: 'Purchases Detail', label_ar: 'تفاصيل المشتريات',
    fetch: async (from, to) => {
      const { data } = await purchasesApi.list({ from, to, limit: 1000 });
      return (data || []).map((p) => ({
        purchase_number: p.purchase_number,
        date: fmtDate(p.purchase_date),
        supplier: p.suppliers?.name || p.supplier || '—',
        subtotal: Number(p.subtotal || 0),
        vat: Number(p.total_vat || 0),
        discount: Number(p.discount_invoice || 0),
        grand_total: Number(p.grand_total || 0),
        paid: Number(p.paid_amount || 0),
        balance: Number(p.grand_total || 0) - Number(p.paid_amount || 0),
      }));
    },
    columns: [
      { key: 'purchase_number', label: '#' },
      { key: 'date', label: 'Date' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'subtotal', label: 'Subtotal', numeric: true, render: (r) => money(r.subtotal) },
      { key: 'vat', label: 'VAT', numeric: true, render: (r) => money(r.vat) },
      { key: 'discount', label: 'Discount', numeric: true, render: (r) => money(r.discount) },
      { key: 'grand_total', label: 'Total', numeric: true, render: (r) => money(r.grand_total) },
      { key: 'paid', label: 'Paid', numeric: true, render: (r) => money(r.paid) },
      { key: 'balance', label: 'Balance', numeric: true, render: (r) => money(r.balance) },
    ],
  },
  inventory: {
    icon: '📦', label_en: 'Inventory Value', label_ar: 'قيمة المخزون',
    fetch: async () => {
      const { data } = await supabase.from('v_inventory_value').select('*').order('total_value', { ascending: false });
      return (data || []).map((r) => ({
        sku: r.sku,
        product_name: r.product_name || r.name,
        category: r.category || '',
        brand: r.brand || '',
        current_stock: Number(r.current_stock || r.stock || 0),
        avg_cost: Number(r.avg_cost || r.cost_price || 0),
        total_value: Number(r.total_value || 0),
      }));
    },
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'product_name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'brand', label: 'Brand' },
      { key: 'current_stock', label: 'Stock', numeric: true, render: (r) => qty(r.current_stock) },
      { key: 'avg_cost', label: 'Avg Cost', numeric: true, render: (r) => money(r.avg_cost) },
      { key: 'total_value', label: 'Total Value', numeric: true, render: (r) => money(r.total_value) },
    ],
  },
  expenses: {
    icon: '💸', label_en: 'Expenses Detail', label_ar: 'تفاصيل المصاريف',
    fetch: async (from, to) => {
      const { data } = await expensesApi.list({ from, to });
      return (data || []).map((e) => ({
        date: fmtDate(e.expense_date || e.date),
        category: e.category || '',
        description: e.description || '',
        amount: Number(e.amount || 0),
        payment_method: e.payment_method || e.method || '',
      }));
    },
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount', numeric: true, render: (r) => money(r.amount) },
      { key: 'payment_method', label: 'Method' },
    ],
  },
  payments: {
    icon: '💵', label_en: 'Payments Detail', label_ar: 'تفاصيل المدفوعات',
    fetch: async (from, to) => {
      const { data } = await paymentsApi.list({ from, to, limit: 500 });
      return (data || []).map((p) => ({
        date: fmtDate(p.payment_date),
        amount: Number(p.amount || 0),
        method: p.method || '',
        kind: p.kind || '',
        notes: p.notes || '',
      }));
    },
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'kind', label: 'Kind' },
      { key: 'method', label: 'Method' },
      { key: 'amount', label: 'Amount', numeric: true, render: (r) => money(r.amount) },
      { key: 'notes', label: 'Notes' },
    ],
  },
  top_customers: {
    icon: '🏆', label_en: 'Top Customers', label_ar: 'أفضل العملاء',
    fetch: async (from, to) => {
      const { data, error } = await supabase.rpc('report_top_customers', { p_from: from, p_to: to, p_limit: 100 });
      if (error) throw new Error(errMsg(error));
      return (data || []).map((r) => ({
        customer_name: r.customer_name,
        phone: r.phone || '',
        order_count: Number(r.order_count || 0),
        total_sales: Number(r.total_sales || 0),
        total_paid: Number(r.total_paid || 0),
        balance: Number(r.balance || 0),
        avg_order: Number(r.avg_order || 0),
        last_order: r.last_order ? fmtDate(r.last_order) : '—',
      }));
    },
    columns: [
      { key: 'customer_name', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'order_count', label: 'Orders', numeric: true },
      { key: 'total_sales', label: 'Total Sales', numeric: true, render: (r) => money(r.total_sales) },
      { key: 'total_paid', label: 'Paid', numeric: true, render: (r) => money(r.total_paid) },
      { key: 'balance', label: 'Balance', numeric: true, render: (r) => money(r.balance) },
      { key: 'avg_order', label: 'Avg Order', numeric: true, render: (r) => money(r.avg_order) },
      { key: 'last_order', label: 'Last Order' },
    ],
  },
  top_products: {
    icon: '🏅', label_en: 'Top Products', label_ar: 'أفضل المنتجات',
    fetch: async (from, to) => {
      const { data, error } = await supabase.rpc('report_top_products', { p_from: from, p_to: to, p_limit: 100 });
      if (error) throw new Error(errMsg(error));
      return (data || []).map((r) => ({
        sku: r.sku || '',
        product_name: r.product_name,
        brand: r.brand || '',
        category: r.category || '',
        total_qty: Number(r.total_qty || 0),
        total_revenue: Number(r.total_revenue || 0),
        avg_price: Number(r.avg_price || 0),
        times_sold: Number(r.times_sold || 0),
      }));
    },
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'product_name', label: 'Product' },
      { key: 'brand', label: 'Brand' },
      { key: 'category', label: 'Category' },
      { key: 'total_qty', label: 'Qty Sold', numeric: true, render: (r) => qty(r.total_qty) },
      { key: 'total_revenue', label: 'Revenue', numeric: true, render: (r) => money(r.total_revenue) },
      { key: 'avg_price', label: 'Avg Price', numeric: true, render: (r) => money(r.avg_price) },
      { key: 'times_sold', label: 'Times', numeric: true },
    ],
  },
  daily_pnl: {
    icon: '📈', label_en: 'Daily P&L', label_ar: 'الأرباح اليومية',
    fetch: async () => {
      const { data } = await reportsApi.daily();
      return (data || []).map((r) => ({
        date: r.day,
        sales: Number(r.sales_total || 0),
        expenses: Number(r.expenses_total || 0),
        net: Number(r.sales_total || 0) - Number(r.expenses_total || 0),
      }));
    },
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'sales', label: 'Sales', numeric: true, render: (r) => money(r.sales) },
      { key: 'expenses', label: 'Expenses', numeric: true, render: (r) => money(r.expenses) },
      { key: 'net', label: 'Net', numeric: true, render: (r) => money(r.net) },
    ],
  },
  monthly_pnl: {
    icon: '📊', label_en: 'Monthly P&L', label_ar: 'الأرباح الشهرية',
    fetch: async () => {
      const { data } = await reportsApi.monthly();
      return (data || []).map((r) => ({
        month: r.month,
        revenue: Number(r.revenue || 0),
        cogs: Number(r.cogs_estimate || 0),
        expenses: Number(r.expenses_total || 0),
        gross_profit: Number(r.revenue || 0) - Number(r.cogs_estimate || 0),
        net_profit: Number(r.revenue || 0) - Number(r.cogs_estimate || 0) - Number(r.expenses_total || 0),
      }));
    },
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'revenue', label: 'Revenue', numeric: true, render: (r) => money(r.revenue) },
      { key: 'cogs', label: 'COGS', numeric: true, render: (r) => money(r.cogs) },
      { key: 'gross_profit', label: 'Gross', numeric: true, render: (r) => money(r.gross_profit) },
      { key: 'expenses', label: 'Expenses', numeric: true, render: (r) => money(r.expenses) },
      { key: 'net_profit', label: 'Net', numeric: true, render: (r) => money(r.net_profit) },
    ],
  },
  branch_pnl: {
    icon: '🏢', label_en: 'Branch P&L', label_ar: 'ميزانية الفروع',
    fetch: async (from, to) => {
      const fromD = from || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const toD = to || new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc('branch_pnl', { p_from: fromD, p_to: toD });
      if (error) throw new Error(errMsg(error));
      return (data || []).map((r) => ({
        branch: r.branch_name,
        revenue: Number(r.revenue || 0),
        expenses: Number(r.expenses || 0),
        net: Number(r.net_income || 0),
      }));
    },
    columns: [
      { key: 'branch', label: 'Branch' },
      { key: 'revenue', label: 'Revenue', numeric: true, render: (r) => money(r.revenue) },
      { key: 'expenses', label: 'Expenses', numeric: true, render: (r) => money(r.expenses) },
      { key: 'net', label: 'Net', numeric: true, render: (r) => money(r.net) },
    ],
  },
  inventory_count: {
    icon: '📋', label_en: 'Inventory Count', label_ar: 'جرد المخزون',
    fetch: async () => {
      const { data } = await supabase.from('v_product_stock').select('*').order('name');
      return (data || []).map((r) => ({
        sku: r.sku || '',
        name: r.name,
        category: r.category || '',
        brand: r.brand || '',
        current_stock: Number(r.current_stock || 0),
        reorder_level: Number(r.reorder_level || 0),
        status: Number(r.current_stock) <= 0 ? 'Out' :
                Number(r.current_stock) <= Number(r.reorder_level || 0) ? 'Low' : 'OK',
      }));
    },
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'brand', label: 'Brand' },
      { key: 'current_stock', label: 'Stock', numeric: true, render: (r) => qty(r.current_stock) },
      { key: 'reorder_level', label: 'Reorder', numeric: true, render: (r) => qty(r.reorder_level) },
      { key: 'status', label: 'Status' },
    ],
  },
};

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, '📈 ' + t('reports')));

  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const fromIn = el('input', { type: 'date', class: 'input', value: yearStart.toISOString().slice(0, 10) });
  const toIn = el('input', { type: 'date', class: 'input', value: today.toISOString().slice(0, 10) });

  const reportSelect = el('select', { class: 'input' });
  for (const [key, def] of Object.entries(REPORTS)) {
    const opt = el('option', { value: key }, def.icon + ' ' + (i18n.lang === 'ar' ? def.label_ar : def.label_en));
    reportSelect.appendChild(opt);
  }

  const toolbar = el('div', { class: 'toolbar', style: 'gap:10px; margin-bottom:16px; flex-wrap:wrap' }, [
    el('label', {}, [
      el('span', { class: 'muted small', style: 'display:block' }, i18n.lang === 'ar' ? 'التقرير' : 'Report'),
      reportSelect,
    ]),
    el('label', {}, [
      el('span', { class: 'muted small', style: 'display:block' }, i18n.lang === 'ar' ? 'من' : 'From'),
      fromIn,
    ]),
    el('label', {}, [
      el('span', { class: 'muted small', style: 'display:block' }, i18n.lang === 'ar' ? 'إلى' : 'To'),
      toIn,
    ]),
    el('button', { class: 'btn btn--primary', onclick: runReport, style: 'align-self:flex-end' },
      '🔍 ' + (t('run_report') || 'Run report')),
  ]);
  host.appendChild(toolbar);

  const card = el('div', { class: 'card' });
  host.appendChild(card);
  card.appendChild(el('div', { class: 'state' }, t('press_run_to_start') || 'Select a report and press Run'));

  let _currentRows = [];

  async function runReport() {
    const key = reportSelect.value;
    const def = REPORTS[key];
    if (!def) return;

    renderLoading(card);
    try {
      const rows = await def.fetch(fromIn.value || null, toIn.value || null);
      _currentRows = rows;

      clear(card);
      if (!rows.length) {
        card.appendChild(el('div', { class: 'state' }, t('no_data') || 'No data'));
        return;
      }

      // Summary
      const sumFields = def.columns.filter((c) => c.numeric);
      if (sumFields.length) {
        const totals = {};
        for (const c of sumFields) {
          totals[c.key] = rows.reduce((s, r) => s + Number(r[c.key] || 0), 0);
        }
        const summary = el('div', { class: 'kpi-row', style: 'margin-bottom:16px' });
        for (const c of sumFields.slice(0, 4)) {
          summary.appendChild(el('div', { class: 'kpi' }, [
            el('div', { class: 'kpi__label' }, c.label),
            el('div', { class: 'kpi__value' }, money(totals[c.key])),
          ]));
        }
        card.appendChild(summary);
      }

      // Actions
      const actions = el('div', { class: 'toolbar', style: 'justify-content:flex-end; margin-bottom:12px' }, [
        el('button', {
          class: 'btn btn--ghost',
          onclick: () => exportCSV(rows, key + '_report'),
        }, '📥 CSV'),
        el('button', {
          class: 'btn btn--ghost',
          onclick: () => printReport({
            title: def.icon + ' ' + (i18n.lang === 'ar' ? def.label_ar : def.label_en),
            subtitle: (fromIn.value || '') + ' → ' + (toIn.value || ''),
            columns: def.columns,
            rows: rows,
          }),
        }, '🖨 ' + (t('print') || 'Print')),
      ]);
      card.appendChild(actions);

      // Table
      card.appendChild(el('div', { style: 'overflow-x:auto' }, el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, def.columns.map((c) =>
          el('th', { class: c.numeric ? 'num' : '' }, c.label)))),
        el('tbody', {}, rows.map((r) => el('tr', {},
          def.columns.map((c) => el('td', { class: c.numeric ? 'num' : '' },
            c.render ? c.render(r) : String(r[c.key] ?? '—')))))),
      ])));

      card.appendChild(el('div', { class: 'muted small', style: 'margin-top:8px' },
        `${rows.length} ${i18n.lang === 'ar' ? 'سجلات' : 'rows'}`));
    } catch (err) {
      clear(card);
      card.appendChild(el('div', { class: 'state state--error' }, err.message || String(err)));
    }
  }

}
