// frontend/widgets.js (Phase 19 — strict lookup fix)
import { dashboardApi, reportsApi, reorderApi, expensesApi, salesApi, purchasesApi, paymentsApi, settingsApi } from './api.js';
import { t } from './i18n.js';
import { el, money, qty, fmtDate } from './utils.js';
import { logError } from './logger.js';

let Chart;
async function ensureChart() {
  if (Chart) return Chart;
  const mod = await import('https://esm.sh/chart.js@4.4.0/auto');
  Chart = mod.default || mod.Chart;
  return Chart;
}

function currencySymbol() {
  try {
    const c = JSON.parse(localStorage.getItem('rios.company') || '{}');
    return c.currency_symbol || '';
  } catch { return ''; }
}

function kpi(label, value, tone = '') {
  return el('div', { class: `kpi ${tone ? 'kpi--' + tone : ''}` }, [
    el('div', { class: 'kpi__label' }, label),
    el('div', { class: 'kpi__value' }, value),
  ]);
}

const DATA_SOURCES = {
  kpis:        async () => (await dashboardApi.kpis()).data || {},
  daily_30:    async () => ((await reportsApi.daily()).data || []).slice(0, 30).reverse(),
  monthly_12:  async () => ((await reportsApi.monthly()).data || []).slice(0, 12).reverse(),
  top_selling: async () => (await dashboardApi.topSellingProducts(10)).data || [],
  top_brands:  async () => (await dashboardApi.aggregateBy('brand', 6)).data || [],
  top_cats:    async () => (await dashboardApi.aggregateBy('category', 6)).data || [],
  low_stock:   async () => (await dashboardApi.lowStock(10)).data || [],
  out_of_stock:async () => (await dashboardApi.outOfStock(10)).data || [],
  reorder:     async () => (await reorderApi.list()).data || [],
  slow_movers: async () => (await dashboardApi.slowProducts(10)).data || [],
};

export const WIDGET_CATALOG = [
  // KPIs
  { type: 'kpi', title_key: 'total_sales',     icon: '💰', source: 'kpis', field: 'total_sales',          kind: 'money' },
  { type: 'kpi', title_key: 'total_purchases', icon: '🛒', source: 'kpis', field: 'total_purchases',      kind: 'money' },
  { type: 'kpi', title_key: 'total_expenses',  icon: '💸', source: 'kpis', field: 'total_expenses',       kind: 'money', tone: 'warn' },
  { type: 'kpi', title_key: 'gross_profit',    icon: '📈', source: 'kpis', field: 'total_gross_profit',   kind: 'money' },
  { type: 'kpi', title_key: 'net_profit',      icon: '🏆', source: 'kpis', field: '__net_profit',         kind: 'money' },
  { type: 'kpi', title_key: 'receivables',     icon: '💵', source: 'kpis', field: 'receivables',          kind: 'money', tone: 'warn' },
  { type: 'kpi', title_key: 'payables',        icon: '💳', source: 'kpis', field: 'payables',             kind: 'money', tone: 'warn' },
  { type: 'kpi', title_key: 'stock_value',     icon: '📦', source: 'kpis', field: 'total_stock_value',    kind: 'money' },
  { type: 'kpi', title_key: 'active_products', icon: '🏷️', source: 'kpis', field: 'active_products',      kind: 'qty' },
  { type: 'kpi', title_key: 'low_stock',       icon: '⚠️', source: 'kpis', field: 'low_stock_count',      kind: 'qty', tone: 'warn' },
  { type: 'kpi', title_key: 'out_of_stock',    icon: '❌', source: 'kpis', field: 'out_of_stock_count',   kind: 'qty', tone: 'danger' },

  // Charts
  { type: 'line',     title_key: 'daily_report',         icon: '📊', source: 'daily_30',   chart_config: 'daily_sales_vs_expenses', size: 2 },
  { type: 'bar',      title_key: 'monthly_report',       icon: '📊', source: 'monthly_12', chart_config: 'monthly_pnl',             size: 2 },
  { type: 'bar_h',    title_key: 'top_selling',          icon: '🏆', source: 'top_selling',chart_config: 'top_selling_bar',         size: 2 },
  { type: 'doughnut', title_key: 'revenue_by_category',  icon: '🥧', source: 'top_cats',   chart_config: 'category_doughnut',       size: 1 },
  { type: 'doughnut', title_key: 'revenue_by_brand',     icon: '🥧', source: 'top_brands', chart_config: 'brand_doughnut',          size: 1 },

  // Lists
  { type: 'list', title_key: 'low_stock',     icon: '📋', source: 'low_stock',     size: 1 },
  { type: 'list', title_key: 'out_of_stock',  icon: '📋', source: 'out_of_stock',  size: 1 },
  { type: 'list', title_key: 'reorder',       icon: '🔔', source: 'reorder',       size: 1 },
  { type: 'list', title_key: 'top_selling',   icon: '📋', source: 'top_selling',   size: 1 },
  { type: 'list', title_key: 'slow_movers',   icon: '📋', source: 'slow_movers',   size: 1 },
];

export async function renderWidget(widget, host) {
  // Phase 19: stricter lookup to prevent wrong matches
  const spec = WIDGET_CATALOG.find((w) => {
    if (w.type !== widget.type) return false;
    if (w.type === 'kpi') return w.field === widget.field;
    if (w.chart_config) return w.chart_config === widget.chart_config;
    return w.source === widget.source && w.title_key === widget.title_key;
  }) || widget;

  const size = spec.size || 1;
  host.style.gridColumn = `span ${size}`;
  host.appendChild(el('div', { class: 'state' }, t('loading')));

  try {
    const data = await DATA_SOURCES[spec.source]?.();
    host.innerHTML = '';

    if (spec.type === 'kpi') {
      let value = data?.[spec.field];
      if (spec.field === '__net_profit') {
        value = Number(data?.total_gross_profit || 0) - Number(data?.total_expenses || 0);
      }
      const display = spec.kind === 'money' ? money(value) : qty(value);
      host.appendChild(kpi(spec.icon + ' ' + t(spec.title_key), display, spec.tone || ''));
      return;
    }

    const panel = el('section', { class: 'panel' });
    panel.appendChild(el('header', { class: 'panel__head' }, [
      el('h3', {}, spec.icon + ' ' + t(spec.title_key)),
    ]));

    if (spec.type === 'line' || spec.type === 'bar' || spec.type === 'bar_h' || spec.type === 'doughnut') {
      await ensureChart();
      const canvas = el('canvas');
      const wrap = el('div', { style: 'position:relative; height:260px; padding:8px' }, canvas);
      panel.appendChild(wrap);
      host.appendChild(panel);
      setTimeout(() => {
        try {
          buildChart(spec, canvas, data);
        } catch (e) {
          logError(e, {
            source: 'widgets.renderWidget.buildChart',
            widgetId: widget?.id || null,
            widgetType: widget?.type || null,
          });
        }
      }, 50);
      return;
    }

    if (spec.type === 'list') {
      const rows = data || [];
      if (!rows.length) {
        panel.appendChild(el('div', { class: 'state' }, t('no_data')));
      } else {
        panel.appendChild(el('ul', { class: 'bar-list' },
          rows.slice(0, 8).map((r) => el('li', {}, [
            el('span', {}, `${r.sku || ''} ${r.name || r.brand || r.category || ''}`.trim()),
            el('span', { class: 'bar-list__value' },
              r.revenue != null ? money(r.revenue)
                : r.current_stock != null ? qty(r.current_stock) + ' ' + t('left')
                : r.suggested_order_qty != null ? qty(r.suggested_order_qty)
                : ''),
          ]))
        ));
      }
      host.appendChild(panel);
      return;
    }
  } catch (err) {
    logError(err, { source: 'widgets.renderWidget', widgetType: widget?.type, widgetId: widget?.id });
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'state state--error' }, err.message || String(err)));
  }
}

function buildChart(spec, canvas, data) {
  const palette = ['#2453b8', '#0f7a3d', '#f59e0b', '#b00020', '#7c3aed', '#0891b2'];

  if (spec.chart_config === 'daily_sales_vs_expenses') {
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((r) => (r.day || '').slice(5)),
        datasets: [
          { label: t('total_sales'),    data: data.map((r) => Number(r.sales_total || 0)),    borderColor: palette[0], backgroundColor: palette[0] + '20', fill: true, tension: 0.3 },
          { label: t('total_expenses'), data: data.map((r) => Number(r.expenses_total || 0)), borderColor: palette[3], backgroundColor: palette[3] + '20', fill: true, tension: 0.3 },
        ],
      },
      options: chartOpts(),
    });
  } else if (spec.chart_config === 'monthly_pnl') {
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map((r) => r.month),
        datasets: [
          { label: t('revenue'),        data: data.map((r) => Number(r.revenue || 0)),         backgroundColor: palette[0] },
          { label: t('cogs'),           data: data.map((r) => Number(r.cogs_estimate || 0)),   backgroundColor: palette[2] },
          { label: t('total_expenses'), data: data.map((r) => Number(r.expenses_total || 0)),  backgroundColor: palette[3] },
        ],
      },
      options: chartOpts(),
    });
  } else if (spec.chart_config === 'top_selling_bar') {
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map((r) => r.name),
        datasets: [{ label: t('sales_revenue'), data: data.map((r) => Number(r.revenue || 0)), backgroundColor: palette[1] }],
      },
      options: { ...chartOpts(), indexAxis: 'y' },
    });
  } else if (spec.chart_config?.endsWith('_doughnut')) {
    const keyField = spec.chart_config === 'category_doughnut' ? 'category' : 'brand';
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.map((r) => r[keyField] || '—'),
        datasets: [{ data: data.map((r) => Number(r.revenue || 0)), backgroundColor: palette }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    });
  }
}

function chartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
    scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } },
  };
}

export const DEFAULT_DASHBOARD = [
  { id: 'w1',  type: 'kpi',      source: 'kpis',        field: 'total_sales',       title_key: 'total_sales' },
  { id: 'w2',  type: 'kpi',      source: 'kpis',        field: 'total_expenses',    title_key: 'total_expenses' },
  { id: 'w3',  type: 'kpi',      source: 'kpis',        field: '__net_profit',      title_key: 'net_profit' },
  { id: 'w4',  type: 'kpi',      source: 'kpis',        field: 'receivables',       title_key: 'receivables' },
  { id: 'w5',  type: 'kpi',      source: 'kpis',        field: 'payables',          title_key: 'payables' },
  { id: 'w6',  type: 'kpi',      source: 'kpis',        field: 'low_stock_count',   title_key: 'low_stock' },
  { id: 'w7',  type: 'line',     source: 'daily_30',    chart_config: 'daily_sales_vs_expenses', title_key: 'daily_report' },
  { id: 'w8',  type: 'bar',      source: 'monthly_12',  chart_config: 'monthly_pnl',             title_key: 'monthly_report' },
  { id: 'w9',  type: 'bar_h',    source: 'top_selling', chart_config: 'top_selling_bar',         title_key: 'top_selling' },
  { id: 'w10', type: 'doughnut', source: 'top_cats',    chart_config: 'category_doughnut',       title_key: 'revenue_by_category' },
  { id: 'w11', type: 'doughnut', source: 'top_brands',  chart_config: 'brand_doughnut',          title_key: 'revenue_by_brand' },
  { id: 'w12', type: 'list',     source: 'reorder',     title_key: 'reorder' },
];
