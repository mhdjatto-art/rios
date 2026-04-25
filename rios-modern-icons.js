/* RIOS Modern Icons — Lucide SVG icon set, replaces emoji icons across the UI */
(function () {
  'use strict';

  // Lucide-style 24x24 stroke icons (stroke="currentColor", strokeWidth=2)
  const I = (path) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ric">${path}</svg>`;

  const ICONS = {
    // Navigation / pages
    home:        I('<path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2h-3v-7h-8v7H5a2 2 0 0 1-2-2V9.5Z"/>'),
    pos:         I('<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M3 17h18"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8h10"/><path d="M7 12h6"/>'),
    receipt:     I('<path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-1V3Z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>'),
    quote:       I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/>'),
    map:         I('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15"/><path d="M15 6v15"/>'),
    users:       I('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    user:        I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    undo:        I('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
    cart:        I('<circle cx="9" cy="21" r="1.5"/><circle cx="18" cy="21" r="1.5"/><path d="M2.5 3h2L7 16h12l2-9H6"/>'),
    box:         I('<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>'),
    factory:     I('<path d="M2 21V11l6 4V11l6 4V8l8 4v9H2Z"/><path d="M6 17h2"/><path d="M12 17h2"/><path d="M18 17h2"/>'),
    tag:         I('<path d="M20 12 12.4 4.4A2 2 0 0 0 11 4H4v7a2 2 0 0 0 .6 1.4L12 20l8-8Z"/><circle cx="8" cy="8" r="1.5"/>'),
    chart:       I('<path d="M3 3v18h18"/><path d="M7 16V10"/><path d="M12 16V6"/><path d="M17 16v-4"/>'),
    transfer:    I('<path d="M3 7h13l-3-3"/><path d="M21 17H8l3 3"/>'),
    bell:        I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    cash:        I('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v.01"/><path d="M18 14v.01"/>'),
    expense:     I('<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    bank:        I('<path d="m3 10 9-6 9 6"/><path d="M5 10v9"/><path d="M19 10v9"/><path d="M9 10v9"/><path d="M15 10v9"/><path d="M3 21h18"/>'),
    book:        I('<path d="M4 19V5a2 2 0 0 1 2-2h14v17H6a2 2 0 0 0-2 2Z"/><path d="M4 19a2 2 0 0 0 2 2h14"/><path d="M9 7h7"/><path d="M9 11h7"/>'),
    trending:    I('<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>'),
    flask:       I('<path d="M9 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10V3"/><path d="M8 3h8"/><path d="M7 14h10"/>'),
    search:      I('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    library:     I('<path d="M4 4h4v16H4z"/><path d="M10 4h4v16h-4z"/><path d="m16 4 4 1-3 15-4-1Z"/>'),
    notebook:    I('<path d="M4 4h14a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Z"/><path d="M4 8h2"/><path d="M4 12h2"/><path d="M4 16h2"/>'),
    ledger:      I('<path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z"/><path d="M9 7h7"/><path d="M9 11h7"/><path d="M9 15h4"/>'),
    barchart3:   I('<path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="5" width="3" height="13"/>'),
    calendar:    I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>'),
    drop:        I('<path d="M12 3s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13Z"/>'),
    building:    I('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h.01"/><path d="M15 7h.01"/><path d="M9 11h.01"/><path d="M15 11h.01"/><path d="M9 15h6v6H9z"/>'),
    boxes:       I('<path d="M7 3h10v6H7z"/><path d="M3 12h8v8H3z"/><path d="M13 12h8v8h-8z"/>'),
    barcode:     I('<path d="M3 5v14"/><path d="M6 5v14"/><path d="M10 5v14"/><path d="M14 5v14"/><path d="M17 5v14"/><path d="M20 5v14"/>'),
    wallet:      I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14.5" r="1.2"/>'),
    landmark:    I('<path d="M3 22h18"/><path d="M5 10h14"/><path d="m12 3 9 5H3l9-5Z"/><path d="M6 14v5"/><path d="M10 14v5"/><path d="M14 14v5"/><path d="M18 14v5"/>'),
    ticket:      I('<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V8Z"/><path d="M9 6v12"/>'),
    refresh:     I('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
    settings:    I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
    coins:       I('<circle cx="9" cy="9" r="6"/><path d="M21 15a6 6 0 0 1-9 5.2"/><path d="M15 7a6 6 0 0 1 6 6"/>'),
    palette:     I('<path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h2a3 3 0 0 0 3-3 9 9 0 0 0-9-10Z"/><circle cx="7" cy="11" r="1"/><circle cx="9" cy="7" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="17" cy="10" r="1"/>'),
    compass:     I('<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6 6-2Z"/>'),
    upload:      I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5-5 5 5"/><path d="M12 5v12"/>'),
    save:        I('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>'),
    logout:      I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
    menu:        I('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>'),
    chevronL:    I('<path d="m15 18-6-6 6-6"/>'),
    chevronR:    I('<path d="m9 18 6-6-6-6"/>'),
    plus:        I('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    minus:       I('<path d="M5 12h14"/>'),
    trash:       I('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m6 6 1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>'),
    check:       I('<path d="m5 12 5 5L20 7"/>'),
    x:           I('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    creditcard:  I('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
    sparkles:    I('<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m6 6 2 2"/><path d="m16 16 2 2"/><path d="m6 18 2-2"/><path d="m16 8 2-2"/>'),
    print:       I('<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 17h12v4H6z"/>'),
    barcode2:    I('<path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14"/>'),
  };

  // Map page route -> icon name
  const ROUTE_ICONS = {
    '/dashboard': 'home',
    '/pos': 'pos',
    '/sales': 'receipt',
    '/quotations': 'quote',
    '/customer_journey': 'map',
    '/customers': 'users',
    '/returns': 'undo',
    '/purchases': 'cart',
    '/purchase_orders': 'box',
    '/suppliers': 'factory',
    '/products': 'tag',
    '/inventory': 'boxes',
    '/transfers': 'transfer',
    '/reorder': 'bell',
    '/payments': 'cash',
    '/expenses': 'expense',
    '/cash_drawer': 'bank',
    '/statements': 'book',
    '/reports': 'trending',
    '/tests': 'flask',
    '/audit': 'search',
    '/coa': 'library',
    '/journal': 'notebook',
    '/ledger': 'ledger',
    '/statements_fin': 'barchart3',
    '/aging': 'calendar',
    '/cash_flow': 'drop',
    '/branch_pnl': 'building',
    '/inventory_count': 'box',
    '/barcode_labels': 'barcode',
    '/employees': 'users',
    '/payroll': 'wallet',
    '/fixed_assets': 'landmark',
    '/loyalty': 'ticket',
    '/recurring': 'refresh',
    '/branches': 'building',
    '/users': 'user',
    '/settings': 'settings',
    '/currencies': 'coins',
    '/theme': 'palette',
    '/nav': 'compass',
    '/import': 'upload',
    '/backup': 'save',
  };

  // Map group title key -> icon name
  const GROUP_ICONS = {
    nav_group_overview: 'home',
    nav_group_sales: 'cash',
    nav_group_buying: 'cart',
    nav_group_stock: 'boxes',
    nav_group_finance: 'creditcard',
    nav_group_hr: 'users',
    nav_group_accounting: 'library',
    nav_group_reports: 'trending',
    nav_group_admin: 'settings',
  };

  function svgFor(name) {
    return ICONS[name] || ICONS.sparkles;
  }

  function replaceSidebarIcons() {
    document.querySelectorAll('.side-link[data-path]').forEach((a) => {
      const path = a.getAttribute('data-path');
      const iconName = ROUTE_ICONS[path];
      if (!iconName) return;
      const slot = a.querySelector('.side-link__icon');
      if (slot && !slot.querySelector('svg.ric')) {
        slot.innerHTML = svgFor(iconName);
      }
    });
    document.querySelectorAll('.side-group').forEach((g) => {
      const titleEl = g.querySelector('.side-group__title');
      const slot = g.querySelector('.side-group__icon');
      if (!slot || slot.querySelector('svg.ric')) return;
      // Find matching group via children paths
      const paths = Array.from(g.querySelectorAll('.side-link[data-path]'))
        .map((a) => a.getAttribute('data-path'));
      let iconName = 'sparkles';
      const guessByTitle = (titleEl?.textContent || '').toLowerCase();
      // Try to match through any of the children's first known route
      for (const k in GROUP_ICONS) {
        // crude heuristic via i18n text lengths fail; fallback uses children
      }
      // Use first child route's icon as group icon if known
      if (paths.length) {
        const firstName = ROUTE_ICONS[paths[0]];
        if (firstName) iconName = firstName;
      }
      slot.innerHTML = svgFor(iconName);
      // Replace chevron arrow with svg too
      const chev = g.querySelector('.side-group__chevron');
      if (chev && chev.textContent.trim() === '▾') {
        chev.innerHTML = svgFor('chevronR');
      }
    });
  }

  function replaceTopbarIcons() {
    const ham = document.querySelector('.topbar__hamburger');
    if (ham && !ham.querySelector('svg.ric')) ham.innerHTML = svgFor('menu');
    const col = document.querySelector('.topbar__collapse');
    if (col && !col.querySelector('svg.ric')) {
      col.innerHTML = svgFor(document.body.classList.contains('sidebar-collapsed') ? 'chevronR' : 'chevronL');
    }
    const lo = document.querySelector('.topbar__logout');
    if (lo && !lo.querySelector('svg.ric')) lo.innerHTML = svgFor('logout');
    const sb = document.querySelector('.topbar__search > span:first-child');
    if (sb && !sb.querySelector('svg.ric')) sb.innerHTML = svgFor('search');
  }

  function init() {
    replaceSidebarIcons();
    replaceTopbarIcons();
  }

  // Observe DOM changes (SPA re-renders)
  const obs = new MutationObserver(() => {
    // Throttle via rAF
    if (init._scheduled) return;
    init._scheduled = true;
    requestAnimationFrame(() => {
      init._scheduled = false;
      init();
    });
  });

  function start() {
    init();
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    }
    // Aggressive fallback: re-run every 500ms for the first 30s,
    // then every 2s forever. SPA re-renders sidebar on lang toggle / route change
    // and may replace icon slots faster than MutationObserver coalesces.
    let n = 0;
    const fast = setInterval(() => {
      init();
      if (++n > 60) {
        clearInterval(fast);
        setInterval(init, 2000);
      }
    }, 500);
    // Also re-apply on hash change (route navigation)
    window.addEventListener('hashchange', () => setTimeout(init, 50));
    // And on lang toggle (custom no-op safety)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.topbar__lang, .lang-toggle')) {
        setTimeout(init, 100);
        setTimeout(init, 400);
      }
    }, true);
  }

  // Expose for other scripts (e.g., POS modernizer)
  window.RIOSIcons = { svg: svgFor, ICONS };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
