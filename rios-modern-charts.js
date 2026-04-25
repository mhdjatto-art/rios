/* RIOS Dashboard & Chart modernizer
   - Adds Lucide icons to Add/Edit/Save/Reset buttons
   - Hooks Chart.js to inject modern blue/cyan palette + soft grid
*/
(function () {
  'use strict';

  function svg(name) {
    return (window.RIOSIcons && window.RIOSIcons.svg(name)) || '';
  }

  function decorateBtn(btn, iconName) {
    if (!btn || btn.dataset.ricBtn) return;
    const txt = btn.textContent.trim().replace(/^[+✏️💾↺👁️\u200D\uFE0F\s]+/, '').trim();
    btn.innerHTML = '<span style="display:inline-flex;align-items:center;">' + svg(iconName) + '</span>' +
      '<span>' + txt + '</span>';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '.45rem';
    btn.dataset.ricBtn = '1';
  }

  function modernizeDashboard() {
    document.querySelectorAll('.toolbar .btn, .panel__head .btn').forEach((b) => {
      const txt = b.textContent.trim();
      if (b.dataset.ricBtn) return;
      if (/^\+|add|إضاف/i.test(txt))         decorateBtn(b, 'plus');
      else if (/edit|تعديل|✏/i.test(txt))    decorateBtn(b, 'palette');
      else if (/save|حفظ|💾/i.test(txt))     decorateBtn(b, 'save');
      else if (/reset|إعادة|↺/i.test(txt))   decorateBtn(b, 'refresh');
      else if (/view|عرض|👁/i.test(txt))     decorateBtn(b, 'search');
      else if (/delete|حذف|🗑/i.test(txt))   decorateBtn(b, 'trash');
    });

    // Move/up/down buttons in dash-edit-overlay
    document.querySelectorAll('.dash-edit-overlay .btn').forEach((b) => {
      if (b.dataset.ricBtn) return;
      const txt = b.textContent.trim();
      if (txt === '◀') { b.innerHTML = svg('chevronL'); b.dataset.ricBtn = '1'; }
      else if (txt === '▶') { b.innerHTML = svg('chevronR'); b.dataset.ricBtn = '1'; }
      else if (/×|x|delete|حذف/i.test(txt)) { b.innerHTML = svg('trash'); b.dataset.ricBtn = '1'; }
    });
  }

  // Modern Chart.js defaults — patch when Chart loads
  function patchChartDefaults() {
    const Chart = window.Chart;
    if (!Chart || Chart.__ricPatched) return;
    Chart.__ricPatched = true;

    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
    const grid = () => isDark() ? 'rgba(148,163,184,.10)' : 'rgba(15,23,42,.06)';
    const tickColor = () => isDark() ? '#94a3b8' : '#64748b';
    const fontFamily = "'Cairo','Inter',ui-sans-serif,system-ui,sans-serif";

    Chart.defaults.font.family = fontFamily;
    Chart.defaults.font.size = 11;
    Chart.defaults.color = tickColor();
    Chart.defaults.borderColor = grid();
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.legend.labels.font = { size: 11, weight: '600', family: fontFamily };

    if (Chart.defaults.plugins.tooltip) {
      Object.assign(Chart.defaults.plugins.tooltip, {
        backgroundColor: 'rgba(15,23,42,.92)',
        titleColor: '#f1f5f9',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(59,130,246,.4)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 6,
        titleFont: { size: 12, weight: '700', family: fontFamily },
        bodyFont:  { size: 12, weight: '500', family: fontFamily },
      });
    }

    if (Chart.defaults.scale) {
      Chart.defaults.scale.grid = Object.assign({}, Chart.defaults.scale.grid || {}, {
        color: grid(),
        drawBorder: false,
        borderDash: [4, 4],
      });
      Chart.defaults.scale.ticks = Object.assign({}, Chart.defaults.scale.ticks || {}, {
        color: tickColor(),
        font: { size: 10, family: fontFamily },
        padding: 8,
      });
    }

    // Modern color palette
    const PALETTE = ['#3b82f6', '#22d3ee', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];

    // Apply gradients to bar/line datasets via beforeUpdate hook
    Chart.register({
      id: 'riosColorize',
      beforeUpdate: (chart) => {
        const ctx = chart.ctx;
        const ds = chart.data?.datasets || [];
        const type = chart.config.type;
        ds.forEach((d, i) => {
          if (d.__ricColored) return;
          const base = PALETTE[i % PALETTE.length];

          if (type === 'doughnut' || type === 'pie') {
            d.backgroundColor = (d.data || []).map((_, idx) => PALETTE[idx % PALETTE.length]);
            d.borderColor = isDark() ? '#0b1226' : '#ffffff';
            d.borderWidth = 3;
            d.hoverOffset = 8;
          } else if (type === 'line') {
            const grad = ctx.createLinearGradient(0, 0, 0, 280);
            grad.addColorStop(0, base + '55');
            grad.addColorStop(1, base + '00');
            d.borderColor = base;
            d.backgroundColor = grad;
            d.fill = true;
            d.tension = d.tension ?? 0.4;
            d.borderWidth = 2.5;
            d.pointRadius = 0;
            d.pointHoverRadius = 5;
            d.pointHoverBackgroundColor = base;
            d.pointHoverBorderColor = '#fff';
            d.pointHoverBorderWidth = 2;
          } else if (type === 'bar') {
            const grad = ctx.createLinearGradient(0, 0, 0, 280);
            grad.addColorStop(0, base);
            grad.addColorStop(1, base + '70');
            d.backgroundColor = grad;
            d.borderRadius = 8;
            d.borderSkipped = false;
            d.maxBarThickness = 36;
          }
          d.__ricColored = true;
        });
      },
    });
  }

  // Poll for Chart.js (it's lazy-loaded via esm.sh)
  let tries = 0;
  const poll = setInterval(() => {
    if (window.Chart) { patchChartDefaults(); clearInterval(poll); }
    if (++tries > 200) clearInterval(poll); // ~60s
  }, 300);

  // Watch DOM for dashboard buttons
  function start() {
    modernizeDashboard();
    const obs = new MutationObserver(() => {
      if (start._sched) return;
      start._sched = true;
      requestAnimationFrame(() => { start._sched = false; modernizeDashboard(); });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
