/* RIOS POS modernizer — adds Lucide icons + active states to cashier UI */
(function () {
  'use strict';

  function svg(name) {
    return (window.RIOSIcons && window.RIOSIcons.svg(name)) || '';
  }

  function decorateButton(btn, iconName) {
    if (!btn || btn.dataset.ricDone) return;
    const txt = btn.textContent.trim().replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '');
    btn.innerHTML = '<span class="ric-prefix" style="display:inline-flex;align-items:center;">' +
      svg(iconName) + '</span>' + ' <span>' + txt + '</span>';
    btn.style.display = btn.style.display || 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '.45rem';
    btn.dataset.ricDone = '1';
  }

  function modernizePOS() {
    // Mode buttons (sale / return)
    document.querySelectorAll('.pos__mode-btn').forEach((b) => {
      const txt = b.textContent;
      if (/return|إرجاع|↩/i.test(txt)) decorateButton(b, 'undo');
      else if (/sale|بيع|🛒/i.test(txt)) decorateButton(b, 'cart');
    });

    // Pay action
    document.querySelectorAll('.pos__pay, button[data-action="pay"], .btn--pay, .pay-btn').forEach((b) => {
      decorateButton(b, 'check');
    });

    // Payment method buttons
    document.querySelectorAll('.pos__pay-btn').forEach((b) => {
      if (b.dataset.ricDone) return;
      const txt = b.textContent.toLowerCase();
      let icon = 'cash';
      if (/card|بطاق|visa|💳/.test(txt)) icon = 'creditcard';
      else if (/credit|آجل/.test(txt)) icon = 'wallet';
      else if (/transfer|حوال|bank|بنك/.test(txt)) icon = 'bank';
      decorateButton(b, icon);
    });

    // Empty cart
    document.querySelectorAll('.pos__empty').forEach((el) => {
      if (el.dataset.ricDone) return;
      el.dataset.ricDone = '1';
      const txt = el.textContent.trim().replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '');
      el.innerHTML = '<div style="font-size:3rem;opacity:.4;margin-bottom:.5rem;display:flex;justify-content:center;">' +
        svg('cart') + '</div><div>' + txt + '</div>';
    });

    // Search input — wrap with icon
    document.querySelectorAll('.pos__search:not([data-ric-wrapped])').forEach((inp) => {
      inp.dataset.ricWrapped = '1';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;flex:1;';
      inp.parentNode.insertBefore(wrap, inp);
      wrap.appendChild(inp);
      inp.style.paddingInlineStart = '2.5rem';
      const ic = document.createElement('span');
      ic.style.cssText = 'position:absolute;top:50%;inset-inline-start:.85rem;transform:translateY(-50%);color:#3b82f6;pointer-events:none;display:inline-flex;';
      ic.innerHTML = svg('search');
      wrap.appendChild(ic);
    });

    // Camera scan button
    document.querySelectorAll('.pos__searchbar button:not([data-ric-done])').forEach((b) => {
      if (b.dataset.ricDone) return;
      const txt = b.textContent.trim();
      if (/scan|camera|كامير|مسح|📷|📸/i.test(txt) || txt.length <= 2) {
        b.dataset.ricDone = '1';
        b.innerHTML = svg('barcode2');
        b.style.cssText += ';width:46px;height:46px;display:inline-flex;align-items:center;justify-content:center;';
      }
    });
  }

  function start() {
    modernizePOS();
    const obs = new MutationObserver(() => {
      if (start._sched) return;
      start._sched = true;
      requestAnimationFrame(() => { start._sched = false; modernizePOS(); });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
