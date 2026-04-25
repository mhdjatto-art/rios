// frontend/customer_journey.js (Phase 24) — Customer 360° view
import { supabase, customersApi, salesApi, paymentsApi, returnsApi, statementsApi } from './api.js';
import { auth } from './auth.js';
import { t, i18n } from './i18n.js';
import { el, clear, toast, renderLoading, renderError, fmtDate, money, qty, errMsg } from './utils.js';
import { exportCSV } from './export.js';
import { printReport } from './print_templates.js';

export async function render(host, params = {}) {
  clear(host);

  // Get customerId from URL hash query or params
  const urlParams = new URLSearchParams(location.hash.split('?')[1] || '');
  const customerId = params.customerId || urlParams.get('id');

  if (!customerId) {
    // Show customer picker
    renderPicker(host);
    return;
  }

  await renderJourney(host, customerId);
}

async function renderPicker(host) {
  host.appendChild(el('h1', { class: 'view-title' }, '🗺️ ' + (t('customer_journey') || 'Customer Journey')));
  host.appendChild(el('p', { class: 'muted' },
    i18n.lang === 'ar' ? 'اختر عميلاً لعرض رحلته' : 'Select a customer to view their journey'));

  const card = el('div', { class: 'card' });
  host.appendChild(card);
  renderLoading(card);

  const { data, error } = await customersApi.list({ activeOnly: true });
  if (error) return renderError(card, error);

  clear(card);
  const search = el('input', { class: 'input', placeholder: t('search') || 'Search...',
    style: 'margin-bottom:12px; width:100%; max-width:400px',
    oninput: (e) => {
      const q = e.target.value.toLowerCase();
      card.querySelectorAll('.cj-picker-item').forEach((r) => {
        const txt = r.textContent.toLowerCase();
        r.style.display = txt.includes(q) ? '' : 'none';
      });
    },
  });
  card.appendChild(search);

  const list = el('div', { class: 'cj-picker-list' });
  for (const c of data) {
    list.appendChild(el('div', {
      class: 'cj-picker-item',
      style: 'display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--rios-border); border-radius:8px; margin-bottom:6px; cursor:pointer',
      onmouseenter: (e) => e.currentTarget.style.background = 'var(--rios-surface2)',
      onmouseleave: (e) => e.currentTarget.style.background = '',
      onclick: () => { location.hash = '#/customer_journey?id=' + c.id; },
    }, [
      el('div', {}, [
        el('div', { style: 'font-weight:600' }, c.name),
        c.phone ? el('div', { class: 'muted small' }, '📞 ' + c.phone) : '',
      ].filter(Boolean)),
      el('span', {}, '→'),
    ]));
  }
  card.appendChild(list);
}

async function renderJourney(host, customerId) {
  renderLoading(host);

  try {
    // Fetch everything in parallel
    const [
      { data: customer },
      { data: statement },
      { data: balance },
      { data: sales },
      { data: payments },
      { data: returns },
      { data: loyalty },
    ] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).single(),
      statementsApi.customer(customerId),
      supabase.from('v_customer_balance').select('*').eq('customer_id', customerId).maybeSingle(),
      salesApi.list({ limit: 500 }).then((r) => ({ data: (r.data || []).filter((s) => s.customer_id === customerId) })),
      paymentsApi.list({ limit: 200 }).then((r) => ({ data: (r.data || []).filter((p) => p.customer_id === customerId) })),
      returnsApi.list({ limit: 100 }).then((r) => ({ data: (r.data || []).filter((rt) => rt.customer_id === customerId) })),
      supabase.from('loyalty_transactions').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(50),
    ]);

    if (!customer) {
      clear(host);
      host.appendChild(el('div', { class: 'state state--error' }, t('customer_not_found') || 'Customer not found'));
      return;
    }

    clear(host);

    // ============ HEADER ============
    const header = el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => { location.hash = '#/customer_journey'; } }, '← ' + (t('back') || 'Back')),
      el('h1', { class: 'view-title' }, '🗺️ ' + customer.name),
      el('div', { class: 'toolbar__spacer' }),
      el('button', { class: 'btn btn--ghost',
        onclick: () => printJourney(customer, { sales, payments, returns, loyalty, balance, statement }),
      }, '🖨 ' + (t('print') || 'Print')),
      el('button', { class: 'btn btn--ghost',
        onclick: () => exportCSV(statement || [], `journey_${customer.name}`),
      }, '📥 CSV'),
    ]);
    host.appendChild(header);

    // ============ CUSTOMER INFO ============
    if (customer.phone || customer.email || customer.address) {
      const info = el('div', { class: 'card', style: 'margin-bottom:12px; padding:12px 16px' });
      const parts = [];
      if (customer.phone) parts.push('📞 ' + customer.phone);
      if (customer.email) parts.push('✉️ ' + customer.email);
      if (customer.address) parts.push('📍 ' + customer.address);
      info.appendChild(el('div', { class: 'muted', style: 'display:flex; gap:16px; flex-wrap:wrap' },
        parts.map((p) => el('span', {}, p))));
      host.appendChild(info);
    }

    // ============ KPI CARDS ============
    const totalSpent = (sales || []).reduce((s, r) => s + Number(r.grand_total || 0), 0);
    const totalPaid = (payments || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalReturns = (returns || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const balanceAmt = Number(balance?.balance || (totalSpent - totalPaid) || 0);
    const loyaltyPoints = (loyalty || []).reduce((s, r) => s + Number(r.points || 0), 0);
    const lastSale = (sales || []).sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))[0];
    const firstSale = (sales || []).sort((a, b) => new Date(a.sale_date) - new Date(b.sale_date))[0];

    const kpiRow = el('div', {
      style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:16px',
    });

    function kpi(icon, label, value, tone = '') {
      return el('div', { class: 'card', style: 'padding:14px' }, [
        el('div', { class: 'muted small', style: 'margin-bottom:4px' }, icon + ' ' + label),
        el('div', { class: 'strong ' + tone, style: 'font-size:20px' }, value),
      ]);
    }

    kpiRow.append(
      kpi('💰', t('total_sales') || 'Total sales', money(totalSpent), 'pos'),
      kpi('💵', t('total_paid') || 'Total paid', money(totalPaid)),
      kpi('📊', t('balance') || 'Balance', money(balanceAmt), balanceAmt > 0 ? 'neg' : 'pos'),
      kpi('↩️', t('returns') || 'Returns', money(totalReturns), 'neg'),
      kpi('🎁', t('loyalty_points') || 'Loyalty points', qty(loyaltyPoints)),
      kpi('🛒', t('orders') || 'Orders', qty((sales || []).length)),
    );
    host.appendChild(kpiRow);

    // ============ DATES ROW ============
    if (firstSale || lastSale) {
      const datesCard = el('div', { class: 'card', style: 'padding:10px 16px; margin-bottom:16px; display:flex; gap:24px; flex-wrap:wrap' });
      if (firstSale) {
        datesCard.appendChild(el('div', {}, [
          el('span', { class: 'muted small' }, (t('first_order') || 'First order') + ': '),
          el('span', { class: 'strong' }, fmtDate(firstSale.sale_date)),
        ]));
      }
      if (lastSale) {
        const daysAgo = Math.floor((new Date() - new Date(lastSale.sale_date)) / (1000 * 60 * 60 * 24));
        datesCard.appendChild(el('div', {}, [
          el('span', { class: 'muted small' }, (t('last_order') || 'Last order') + ': '),
          el('span', { class: 'strong' }, fmtDate(lastSale.sale_date) + ` (${daysAgo} ${t('days_ago') || 'days ago'})`),
        ]));
      }
      host.appendChild(datesCard);
    }

    // ============ TABS: Timeline | Top Products | Loyalty ============
    const tabBar = el('div', { class: 'toolbar', style: 'gap:8px; margin-bottom:12px; border-bottom:1px solid var(--rios-border); padding-bottom:4px' });
    const timelineTab = tabEl('⏱ ' + (t('timeline') || 'Timeline'), true);
    const productsTab = tabEl('🏆 ' + (t('top_products') || 'Top products'), false);
    const loyaltyTab = tabEl('🎁 ' + (t('loyalty') || 'Loyalty'), false);
    tabBar.append(timelineTab, productsTab, loyaltyTab);
    host.appendChild(tabBar);

    const content = el('div');
    host.appendChild(content);

    function tabEl(label, active) {
      return el('button', {
        class: 'btn ' + (active ? 'btn--primary' : 'btn--ghost'),
        onclick: () => {
          [timelineTab, productsTab, loyaltyTab].forEach((t) => t.className = 'btn btn--ghost');
          event.currentTarget.className = 'btn btn--primary';
          const which = label;
          clear(content);
          if (which.includes(t('timeline') || 'Timeline')) renderTimeline(content, statement || [], sales, payments, returns);
          else if (which.includes(t('top_products') || 'Top products')) renderTopProducts(content, customerId);
          else if (which.includes(t('loyalty') || 'Loyalty')) renderLoyalty(content, loyalty || []);
        },
      }, label);
    }

    // Initial render
    renderTimeline(content, statement || [], sales, payments, returns);
  } catch (err) {
    clear(host);
    host.appendChild(el('div', { class: 'state state--error' }, err.message || String(err)));
  }
}

// ============ TIMELINE ============
function renderTimeline(host, statement, sales, payments, returns) {
  // Merge all events into a timeline
  const events = [];

  for (const s of (sales || [])) {
    events.push({
      type: 'sale', icon: '🧾', date: s.sale_date || s.created_at,
      title: (s.sale_number || 'Sale') + ' · ' + money(s.grand_total),
      subtitle: `Paid: ${money(s.paid_amount || 0)}`,
      tone: 'pos',
    });
  }
  for (const p of (payments || [])) {
    events.push({
      type: 'payment', icon: '💵', date: p.payment_date || p.created_at,
      title: money(p.amount) + ' · ' + (p.method || ''),
      subtitle: p.notes || '',
      tone: 'pos',
    });
  }
  for (const r of (returns || [])) {
    events.push({
      type: 'return', icon: '↩️', date: r.return_date || r.created_at,
      title: (r.return_number || 'Return') + ' · ' + money(r.total_amount),
      subtitle: r.reason || '',
      tone: 'neg',
    });
  }

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!events.length) {
    host.appendChild(el('div', { class: 'state' }, t('no_data') || 'No events yet'));
    return;
  }

  const list = el('div', { style: 'position:relative; padding-inline-start:24px' });
  // Vertical line
  list.appendChild(el('div', {
    style: 'position:absolute; inset-inline-start:8px; top:8px; bottom:8px; width:2px; background:var(--rios-border)',
  }));

  for (const ev of events) {
    const item = el('div', { style: 'position:relative; margin-bottom:14px; padding:10px 14px; background:var(--rios-surface2); border-radius:8px' });
    // Dot
    item.appendChild(el('div', {
      style: `position:absolute; inset-inline-start:-20px; top:14px; width:14px; height:14px; border-radius:50%; background:var(--rios-surface); border:2px solid ${ev.tone === 'neg' ? 'var(--rios-danger)' : 'var(--rios-primary)'}; display:flex; align-items:center; justify-content:center; font-size:8px`,
    }));
    item.appendChild(el('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap' }, [
      el('div', {}, [
        el('div', { class: 'strong' }, ev.icon + ' ' + ev.title),
        ev.subtitle ? el('div', { class: 'muted small' }, ev.subtitle) : '',
      ].filter(Boolean)),
      el('div', { class: 'muted small' }, fmtDate(ev.date)),
    ]));
    list.appendChild(item);
  }

  host.appendChild(list);
}

// ============ TOP PRODUCTS ============
async function renderTopProducts(host, customerId) {
  renderLoading(host);
  try {
    // Query sales_items joined with sales for this customer
    const { data, error } = await supabase.rpc('customer_top_products', { p_customer_id: customerId, p_limit: 20 });

    if (error) {
      // Fallback: show message if RPC not installed yet
      clear(host);
      host.appendChild(el('div', { class: 'state' },
        (i18n.lang === 'ar' ? 'شغّل phase24_migration.sql في Supabase لتفعيل هذه الميزة' : 'Run phase24_migration.sql in Supabase to enable this view')));
      return;
    }

    clear(host);
    if (!data?.length) {
      host.appendChild(el('div', { class: 'state' }, t('no_data') || 'No data'));
      return;
    }

    const table = el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('product') || 'Product'),
        el('th', {}, t('sku') || 'SKU'),
        el('th', { class: 'num' }, t('qty') || 'Qty'),
        el('th', { class: 'num' }, t('revenue') || 'Revenue'),
      ])),
      el('tbody', {}, data.map((r) => el('tr', {}, [
        el('td', {}, r.product_name),
        el('td', { class: 'mono small' }, r.sku || ''),
        el('td', { class: 'num' }, qty(r.total_qty)),
        el('td', { class: 'num strong pos' }, money(r.total_revenue)),
      ]))),
    ]);
    host.appendChild(table);
  } catch (err) {
    clear(host);
    host.appendChild(el('div', { class: 'state state--error' }, err.message));
  }
}

// ============ LOYALTY HISTORY ============
function renderLoyalty(host, loyalty) {
  if (!loyalty.length) {
    host.appendChild(el('div', { class: 'state' }, t('no_data') || 'No loyalty activity'));
    return;
  }

  const table = el('table', { class: 'table' }, [
    el('thead', {}, el('tr', {}, [
      el('th', {}, t('date') || 'Date'),
      el('th', {}, t('description') || 'Description'),
      el('th', { class: 'num' }, t('points') || 'Points'),
    ])),
    el('tbody', {}, loyalty.map((r) => el('tr', {}, [
      el('td', {}, fmtDate(r.created_at)),
      el('td', {}, r.description || r.reason || '—'),
      el('td', { class: 'num strong ' + (Number(r.points) >= 0 ? 'pos' : 'neg') },
        (Number(r.points) >= 0 ? '+' : '') + qty(r.points)),
    ]))),
  ]);
  host.appendChild(table);
}

// ============ PRINT ============
function printJourney(customer, data) {
  const { sales, payments, returns, balance } = data;
  const totalSpent = (sales || []).reduce((s, r) => s + Number(r.grand_total || 0), 0);
  const totalPaid = (payments || []).reduce((s, r) => s + Number(r.amount || 0), 0);

  printReport({
    title: '🗺️ Customer Journey — ' + customer.name,
    subtitle: (customer.phone || '') + (customer.email ? ' · ' + customer.email : ''),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type' },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount', numeric: true },
    ],
    rows: [
      ...(sales || []).map((s) => ({
        date: fmtDate(s.sale_date), type: '🧾 Sale',
        description: s.sale_number, amount: money(s.grand_total),
      })),
      ...(payments || []).map((p) => ({
        date: fmtDate(p.payment_date), type: '💵 Payment',
        description: p.method || '', amount: money(p.amount),
      })),
      ...(returns || []).map((r) => ({
        date: fmtDate(r.return_date), type: '↩️ Return',
        description: r.return_number || '', amount: money(r.total_amount),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
    footer: `Total spent: ${money(totalSpent)} | Total paid: ${money(totalPaid)} | Balance: ${money(Number(balance?.balance || 0))}`,
  });
}
