// frontend/pos.js  (Phase 16 — currency + wholesale + discount)
import {
  productsApi, inventoryApi, salesApi, customersApi,
  returnsApi, supabase,
} from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, money, qty, isoDate,
  nextDocNumber, errMsg,
} from './utils.js';
import { attachUSBScanner, openCameraScanner } from './scanner.js';
import { printInvoice } from './invoice.js';

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'cheque', 'credit'];

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin } = auth.state;
  if (!isManagerOrAdmin) {
    host.appendChild(el('div', { class: 'state state--error' }, t('permission_denied')));
    return;
  }

  renderLoading(host);

  // Fetch data
  const [prodRes, invRes, custRes, curRes, rateRes] = await Promise.all([
    productsApi.list({ status: 'active', limit: 1000 }),
    inventoryApi.list({}),
    customersApi.list({ activeOnly: true }),
    supabase.from('currencies').select('*').eq('is_active', true).order('is_base', { ascending: false }),
    supabase.from('exchange_rates').select('*').order('effective_date', { ascending: false }),
  ]);
  if (prodRes.error) return renderError(host, prodRes.error);

  const products = prodRes.data;
  const inv = invRes.data || [];
  const customers = custRes.data || [];
  const currencies = curRes.data || [];
  const rates = rateRes.data || [];
  const baseCurrency = currencies.find((c) => c.is_base) || { code: 'IQD', symbol: '', decimal_places: 2 };
  const stockMap = new Map(inv.map((r) => [r.product_id, Number(r.current_stock)]));

  function latestRate(from, to) {
    if (from === to) return 1;
    const r = rates.find((x) => x.from_currency === from && x.to_currency === to);
    if (r) return Number(r.rate);
    const inv = rates.find((x) => x.from_currency === to && x.to_currency === from);
    if (inv) return 1 / Number(inv.rate);
    return null;
  }

  clear(host);

  // --- STATE ---
  let mode = 'sale';
  let paymentMethod = 'cash';
  let amountReceived = 0;
  let currencyCode = baseCurrency.code;
  let exchangeRate = 1;
  let isWholesale = false;
  let invoiceDiscount = 0;              // amount in transaction currency
  let invoiceDiscountType = 'amount';   // 'amount' | 'percent'
  const cart = new Map();
  let originalSaleId = null;

  // --- SHELL ---
  const root = el('div', { class: 'pos' });
  host.appendChild(root);
  const leftPane = el('div', { class: 'pos__left' });
  const rightPane = el('div', { class: 'pos__right' });
  root.append(leftPane, rightPane);

  // --- LEFT: mode tabs + search + grid ---
  const modeBar = el('div', { class: 'pos__mode-bar' }, [
    modeBtn('sale', '🛒 ' + t('pos_mode_sale')),
    modeBtn('return', '↩️ ' + t('pos_mode_return')),
  ]);
  leftPane.appendChild(modeBar);

  function modeBtn(m, label) {
    return el('button', {
      class: 'pos__mode-btn ' + (mode === m ? 'pos__mode-btn--active' : ''),
      type: 'button', 'data-mode': m,
      onclick: () => setMode(m),
    }, label);
  }
  function setMode(m) {
    mode = m; cart.clear(); originalSaleId = null;
    for (const b of modeBar.querySelectorAll('.pos__mode-btn'))
      b.classList.toggle('pos__mode-btn--active', b.dataset.mode === m);
    renderRight();
    renderGrid();
    renderCart();
    if (m === 'return') setTimeout(() => openSalePicker(), 50);
  }

  const searchInput = el('input', { class: 'input pos__search',
    placeholder: '🔍 ' + t('search') + ' / SKU / Barcode', autofocus: true });
  const camBtn = el('button', { class: 'scan-btn', style: 'font-size:24px; padding:10px 16px',
    onclick: () => openCameraScanner(handleScan) }, '📷');
  leftPane.appendChild(el('div', { class: 'pos__searchbar' }, [searchInput, camBtn]));

  const grid = el('div', { class: 'pos__grid' });
  leftPane.appendChild(grid);

  // --- RIGHT ---
  renderRight();
  renderGrid();

  function getDisplayPrice(product) {
    // Wholesale if enabled and available, else retail
    const retail = Number(product.selling_price || 0);
    const wholesale = Number(product.wholesale_price || 0);
    return (isWholesale && wholesale > 0) ? wholesale : retail;
  }

  function renderRight() {
    clear(rightPane);

    // 1. Customer + Wholesale toggle
    const custRow = el('div', { class: 'pos__customer-row' });
    const custSel = el('select', { class: 'input pos__customer', id: 'posCust',
      onchange: (e) => {
        const c = customers.find((x) => x.id === e.target.value);
        isWholesale = c?.is_wholesale || false;
        // Re-price cart
        for (const item of cart.values()) {
          item.price = getDisplayPrice(item.product);
        }
        renderRight(); renderCart(); renderGrid(searchInput.value);
      },
    }, [
      el('option', { value: '' }, '👤 ' + t('walk_in')),
      ...customers.map((c) => el('option', { value: c.id },
        c.name + (c.is_wholesale ? ' 💼' : '') + (c.phone ? ` — ${c.phone}` : ''))),
    ]);
    custRow.appendChild(el('label', {}, t('customer') + ':'));
    custRow.appendChild(custSel);
    rightPane.appendChild(custRow);

    // Wholesale toggle
    const wholesaleRow = el('div', { class: 'pos__wholesale-row' }, [
      el('label', { style: 'display:flex; gap:6px; align-items:center; font-weight:600' }, [
        el('input', { type: 'checkbox', checked: isWholesale,
          onchange: (e) => {
            isWholesale = e.target.checked;
            for (const item of cart.values()) item.price = getDisplayPrice(item.product);
            renderCart(); renderGrid(searchInput.value);
          } }),
        el('span', {}, '💼 ' + t('wholesale_pricing')),
      ]),
    ]);
    rightPane.appendChild(wholesaleRow);

    // 2. Currency selector (only if more than 1 currency)
    if (currencies.length > 1) {
      const curRow = el('div', { class: 'pos__currency-row' });
      const curSel = el('select', { class: 'input', id: 'posCur',
        onchange: (e) => {
          currencyCode = e.target.value;
          exchangeRate = latestRate(currencyCode, baseCurrency.code) || 1;
          renderRight(); renderCart();
        },
      }, currencies.map((c) => el('option', { value: c.code },
        `${c.code} ${c.symbol}${c.is_base ? ' ⭐' : ''}`)));
      curSel.value = currencyCode;
      curRow.appendChild(el('label', {}, '💱 ' + t('currency') + ':'));
      curRow.appendChild(curSel);

      // Exchange rate input (only when not base)
      if (currencyCode !== baseCurrency.code) {
        exchangeRate = exchangeRate || latestRate(currencyCode, baseCurrency.code) || 1;
        const rateIn = el('input', { type: 'number', step: '0.000001', min: '0',
          class: 'input num', value: exchangeRate,
          oninput: (e) => { exchangeRate = Number(e.target.value || 1); renderCart(); },
          style: 'width: 110px',
        });
        curRow.appendChild(el('span', { class: 'muted small' },
          `1 ${currencyCode} =`));
        curRow.appendChild(rateIn);
        curRow.appendChild(el('span', { class: 'muted small' }, baseCurrency.code));
      }
      rightPane.appendChild(curRow);
    }

    // If return mode, show ref box
    if (mode === 'return') {
      const refBox = el('div', { class: 'pos__ref-box' });
      const updateRefBox = () => {
        clear(refBox);
        if (originalSaleId) {
          refBox.appendChild(el('span', {}, '🧾 ' + t('original_doc') + ': '));
          refBox.appendChild(el('strong', { class: 'mono' }, originalSaleId.slice(0, 8) + '...'));
          refBox.appendChild(el('button', { class: 'btn btn--ghost', style: 'margin-inline-start:8px',
            onclick: () => openSalePicker() }, t('change')));
        } else {
          refBox.appendChild(el('button', { class: 'btn btn--primary',
            onclick: () => openSalePicker() }, '📋 ' + t('select_sale_to_return')));
        }
      };
      refBox.__update = updateRefBox;
      updateRefBox();
      rightPane.appendChild(refBox);
    }

    // Cart
    const cartList = el('div', { class: 'pos__cart', id: 'posCart' });
    rightPane.appendChild(cartList);

    // Invoice Discount (sale mode only)
    if (mode === 'sale') {
      const discRow = el('div', { class: 'pos__discount-row' });
      const typeSel = el('select', { class: 'input', style: 'width:70px',
        onchange: (e) => { invoiceDiscountType = e.target.value; updateTotals(); } }, [
        el('option', { value: 'amount' }, '💰'),
        el('option', { value: 'percent' }, '%'),
      ]);
      typeSel.value = invoiceDiscountType;
      const discIn = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num',
        value: invoiceDiscount || '', placeholder: '0',
        oninput: (e) => { invoiceDiscount = Number(e.target.value || 0); updateTotals(); } });
      discRow.appendChild(el('label', { style: 'font-weight:600' }, '🏷️ ' + t('invoice_discount')));
      discRow.appendChild(typeSel);
      discRow.appendChild(discIn);
      rightPane.appendChild(discRow);
    }

    // Totals
    const totalsBox = el('div', { class: 'pos__totals', id: 'posTotals' });
    rightPane.appendChild(totalsBox);

    // Payment methods (sale mode)
    if (mode === 'sale') {
      const payMethodBar = el('div', { class: 'pos__pay-methods' }, PAYMENT_METHODS.map((m) => {
        const lbl = m === 'cash' ? '💵 ' + t('cash') :
                    m === 'card' ? '💳 ' + t('card') :
                    m === 'bank_transfer' ? '🏦 ' + t('bank_transfer') :
                    m === 'cheque' ? '📄 ' + t('cheque') :
                    '📋 ' + t('credit');
        return el('button', {
          type: 'button',
          class: 'pos__pay-btn' + (paymentMethod === m ? ' pos__pay-btn--active' : ''),
          'data-method': m,
          onclick: () => { paymentMethod = m; renderRight(); renderCart(); },
        }, lbl);
      }));
      rightPane.appendChild(payMethodBar);

      if (paymentMethod === 'cash' || paymentMethod === 'credit') {
        const amtRow = el('div', { class: 'pos__amt-row' });
        const label = paymentMethod === 'credit' ? '💰 ' + t('paid_now') : '💵 ' + t('amount_received');
        const inAmt = el('input', {
          type: 'number', step: '0.01', min: '0', class: 'input num pos__amt',
          value: amountReceived || '', placeholder: '0.00',
          oninput: (e) => { amountReceived = Number(e.target.value || 0); updateTotals(); },
        });
        amtRow.appendChild(el('label', {}, label));
        amtRow.appendChild(inAmt);
        rightPane.appendChild(amtRow);
      }
    }

    // Actions
    const actions = el('div', { class: 'pos__actions' });
    const completeBtn = el('button', {
      class: 'btn btn--primary pos__pay', id: 'posComplete',
      onclick: completeTransaction,
    }, mode === 'sale' ? '✅ ' + t('complete_sale') : '↩️ ' + t('complete_return'));
    const clearBtn = el('button', { class: 'btn btn--ghost', onclick: clearCart }, '🗑 ' + t('clear'));
    actions.append(clearBtn, completeBtn);
    rightPane.appendChild(actions);
  }

  function renderGrid(filter = '') {
    clear(grid);
    const f = filter.toLowerCase().trim();
    const matches = f ? products.filter((p) =>
      (p.sku || '').toLowerCase().includes(f) ||
      (p.name || '').toLowerCase().includes(f) ||
      (p.brand || '').toLowerCase().includes(f) ||
      (p.barcode || '').toLowerCase() === f
    ) : products;

    if (!matches.length) {
      grid.appendChild(el('div', { class: 'state' }, t('no_products')));
      return;
    }

    for (const p of matches.slice(0, 80)) {
      const stock = stockMap.get(p.id) || 0;
      const disabled = mode === 'sale' && stock <= 0;
      const displayPrice = getDisplayPrice(p);
      const isWholesaleShown = isWholesale && Number(p.wholesale_price || 0) > 0;

      const card = el('button', {
        class: 'pos__tile ' + (disabled ? 'pos__tile--out' : ''),
        type: 'button', disabled,
        onclick: () => addToCart(p),
      }, [
        el('div', { class: 'pos__tile-name' }, p.name),
        el('div', { class: 'pos__tile-sku' }, p.sku),
        el('div', { class: 'pos__tile-price' + (isWholesaleShown ? ' pos__tile-price--wholesale' : '') },
          (isWholesaleShown ? '💼 ' : '') + money(displayPrice)),
        mode === 'sale' ?
          el('div', { class: 'pos__tile-stock' },
            stock > 0 ? `${qty(stock)} ${t('left')}` : t('out')) :
          el('div', { class: 'pos__tile-stock' }, '↩️ ' + t('return_in')),
      ]);
      grid.appendChild(card);
    }
  }
  searchInput.addEventListener('input', (e) => renderGrid(e.target.value));

  function handleScan(code) {
    const p = products.find((pr) => pr.sku === code || pr.barcode === code);
    if (!p) {
      searchInput.value = code; renderGrid(code);
      toast('؟ ' + code, 'info');
      return;
    }
    addToCart(p);
    searchInput.value = ''; searchInput.focus(); renderGrid();
  }
  attachUSBScanner(searchInput, handleScan);

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const f = searchInput.value.toLowerCase().trim();
      if (!f) return;
      const exact = products.find((p) => p.sku === f || p.barcode === f);
      if (exact) { handleScan(f); return; }
      const matches = products.filter((p) =>
        (p.name || '').toLowerCase().includes(f) || (p.sku || '').toLowerCase().includes(f));
      if (matches.length === 1) { addToCart(matches[0]); searchInput.value = ''; renderGrid(); }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (mode === 'sale') {
      if (e.key === 'F1') { e.preventDefault(); paymentMethod = 'cash'; renderRight(); renderCart(); }
      if (e.key === 'F2') { e.preventDefault(); paymentMethod = 'card'; renderRight(); renderCart(); }
      if (e.key === 'F3') { e.preventDefault(); paymentMethod = 'credit'; renderRight(); renderCart(); }
    }
  });

  function addToCart(p) {
    if (mode === 'sale') {
      const stock = stockMap.get(p.id) || 0;
      if (stock <= 0) { toast(t('insufficient_stock'), 'error'); return; }
      const existing = cart.get(p.id);
      if (existing) {
        if (existing.qty + 1 > stock) { toast(t('only_n_in_stock', { n: qty(stock) }), 'error'); return; }
        existing.qty += 1;
      } else {
        cart.set(p.id, {
          product: p, qty: 1,
          price: getDisplayPrice(p),
          vat: Number(p.vat_rate || 0),
          discount: 0,  // per-line discount amount
        });
      }
    } else {
      const existing = cart.get(p.id);
      if (existing) { existing.qty += 1; }
      else {
        cart.set(p.id, { product: p, qty: 1, price: getDisplayPrice(p), vat: Number(p.vat_rate || 0), discount: 0 });
      }
    }
    renderCart();
  }

  function setQty(productId, newQty) {
    const item = cart.get(productId);
    if (!item) return;
    newQty = Math.max(0, Number(newQty) || 0);
    if (newQty === 0) { cart.delete(productId); renderCart(); return; }
    if (mode === 'sale') {
      const stock = stockMap.get(productId) || 0;
      if (newQty > stock) { toast(t('only_n_in_stock', { n: qty(stock) }), 'error'); newQty = stock; }
    }
    item.qty = newQty;
    renderCart();
  }

  function setPrice(productId, newPrice) {
    const item = cart.get(productId);
    if (!item) return;
    item.price = Math.max(0, Number(newPrice) || 0);
    renderCart();
  }

  function setLineDiscount(productId, newDisc) {
    const item = cart.get(productId);
    if (!item) return;
    item.discount = Math.max(0, Number(newDisc) || 0);
    renderCart();
  }

  function clearCart() {
    cart.clear(); amountReceived = 0; originalSaleId = null; invoiceDiscount = 0;
    renderRight(); renderCart();
  }

  function renderCart() {
    const cartList = document.getElementById('posCart');
    if (!cartList) return;
    clear(cartList);

    if (!cart.size) {
      cartList.appendChild(el('div', { class: 'pos__empty' },
        mode === 'sale' ? '🛒 ' + t('empty_cart') : '↩️ ' + t('empty_return')));
      updateTotals();
      return;
    }
    for (const [pid, item] of cart.entries()) {
      const lineNet = item.qty * item.price - item.discount;
      const lineTotal = lineNet * (1 + item.vat / 100);
      const line = el('div', { class: 'pos__line' }, [
        el('div', { class: 'pos__line-name' }, [
          el('div', {}, item.product.name),
          el('div', { class: 'muted small' }, item.product.sku +
            (isWholesale && Number(item.product.wholesale_price) > 0 ? ' • 💼' : '')),
        ]),
        el('input', {
          type: 'number', step: '0.001', min: '0', class: 'input num pos__line-qty-input',
          value: item.qty, onchange: (e) => setQty(pid, e.target.value),
        }),
        el('input', {
          type: 'number', step: '0.01', min: '0', class: 'input num pos__line-price-input',
          value: item.price.toFixed(2), onchange: (e) => setPrice(pid, e.target.value),
        }),
        el('input', {
          type: 'number', step: '0.01', min: '0', class: 'input num pos__line-disc-input',
          value: item.discount || '', placeholder: '0',
          title: t('line_discount'),
          onchange: (e) => setLineDiscount(pid, e.target.value),
        }),
        el('div', { class: 'pos__line-total' }, money(lineTotal)),
        el('button', { class: 'btn btn--danger', onclick: () => setQty(pid, 0) }, '×'),
      ]);
      cartList.appendChild(line);
    }
    updateTotals();
  }

  function computeInvoiceDiscount(subtotal) {
    if (invoiceDiscountType === 'percent') {
      return subtotal * (invoiceDiscount || 0) / 100;
    }
    return invoiceDiscount || 0;
  }

  function updateTotals() {
    const totalsBox = document.getElementById('posTotals');
    if (!totalsBox) return;
    let sub = 0, vat = 0, lineDisc = 0;
    for (const item of cart.values()) {
      const lineNet = item.qty * item.price - item.discount;
      lineDisc += item.discount;
      sub += lineNet;
      vat += lineNet * item.vat / 100;
    }
    const invDisc = computeInvoiceDiscount(sub);
    const subAfterDisc = sub - invDisc;
    const vatAfterDisc = subAfterDisc * (sub ? vat / sub : 0);
    const grand = subAfterDisc + vatAfterDisc;
    const grandInBase = grand * (exchangeRate || 1);

    const curSym = currencies.find((c) => c.code === currencyCode)?.symbol || '';

    clear(totalsBox);
    totalsBox.append(...[
      row(t('subtotal'), moneyWithSym(sub, curSym)),
      lineDisc > 0 ? row('💸 ' + t('line_discounts'), '- ' + moneyWithSym(lineDisc, curSym)) : null,
      invDisc > 0 ? row('🏷️ ' + t('invoice_discount'), '- ' + moneyWithSym(invDisc, curSym)) : null,
      row(t('vat'), moneyWithSym(vatAfterDisc, curSym)),
      row(t('grand_total'), moneyWithSym(grand, curSym), 'pos__grand'),
    ].filter(Boolean));

    // Show base currency conversion if different
    if (currencyCode !== baseCurrency.code && exchangeRate !== 1) {
      totalsBox.append(el('div', { class: 'pos__row muted small' }, [
        el('span', {}, '≈ ' + baseCurrency.code),
        el('span', {}, moneyWithSym(grandInBase, baseCurrency.symbol)),
      ]));
    }

    if (mode === 'sale' && paymentMethod === 'cash' && amountReceived > 0) {
      const change = amountReceived - grand;
      if (change >= 0) totalsBox.append(row('💰 ' + t('change_due'), moneyWithSym(change, curSym), 'pos__change'));
      else totalsBox.append(row('⚠️ ' + t('short_by'), moneyWithSym(-change, curSym), 'pos__short'));
    }
    if (mode === 'sale' && paymentMethod === 'credit') {
      const paidNow = amountReceived || 0;
      const remaining = grand - paidNow;
      totalsBox.append(row('📋 ' + t('credit_remaining'), moneyWithSym(remaining, curSym), 'pos__credit'));
    }

    const completeBtn = document.getElementById('posComplete');
    if (completeBtn) completeBtn.disabled = !cart.size || (mode === 'return' && !originalSaleId);
  }

  function row(label, value, cls = '') {
    if (value == null) return null;
    return el('div', { class: 'pos__row ' + cls }, [
      el('span', {}, label), el('span', {}, value),
    ]);
  }
  function moneyWithSym(n, sym) {
    const v = Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sym ? `${v} ${sym}` : v;
  }

  // --- Sale picker for returns (unchanged) ---
  async function openSalePicker() {
    const dlg = el('dialog', { class: 'dialog' });
    dlg.appendChild(el('h2', {}, '🧾 ' + t('select_sale_to_return')));
    const searchIn = el('input', { class: 'input', placeholder: t('sale_number') + ' / ' + t('customer'),
      oninput: () => refresh() });
    dlg.appendChild(searchIn);
    const listHost = el('div', { style: 'max-height: 400px; overflow-y: auto; margin-top: 12px' });
    dlg.appendChild(listHost);
    dlg.appendChild(el('div', { class: 'form__actions' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
    ]));
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();

    const { data: salesList, error } = await salesApi.list({ limit: 50 });
    if (error) { listHost.appendChild(el('div', { class: 'state state--error' }, errMsg(error))); return; }

    let filtered = salesList;
    async function refresh() {
      const f = searchIn.value.toLowerCase().trim();
      filtered = salesList.filter((s) =>
        (s.sale_number || '').toLowerCase().includes(f) ||
        (s.customer || s.customers?.name || '').toLowerCase().includes(f));
      clear(listHost);
      if (!filtered.length) { listHost.appendChild(el('div', { class: 'state' }, t('no_data'))); return; }
      for (const s of filtered.slice(0, 30)) {
        listHost.appendChild(el('button', {
          class: 'btn btn--ghost',
          style: 'width:100%; text-align:start; justify-content:flex-start; margin-bottom:4px; padding:10px !important',
          onclick: () => selectSaleForReturn(s, dlg),
        }, [
          el('strong', { class: 'mono' }, s.sale_number),
          el('span', { class: 'muted', style: 'margin-inline-start:12px' }, s.customers?.name || s.customer || t('walk_in')),
          el('span', { class: 'muted', style: 'margin-inline-start:auto; float:right' }, money(s.grand_total)),
        ]));
      }
    }
    refresh();
  }

  async function selectSaleForReturn(sale, dlg) {
    const { data, error } = await salesApi.getDetail(sale.id);
    if (error) { toast(errMsg(error), 'error'); return; }
    originalSaleId = sale.id;
    cart.clear();
    for (const it of data.items) {
      const prod = products.find((p) => p.id === it.product_id);
      if (!prod) continue;
      cart.set(prod.id, {
        product: prod, qty: Number(it.qty),
        price: Number(it.selling_price), vat: Number(it.vat_rate || 0),
        discount: Number(it.discount_amount || 0),
      });
    }
    const custSel = document.getElementById('posCust');
    if (custSel && data.header.customer_id) custSel.value = data.header.customer_id;
    toast('✓ ' + sale.sale_number, 'success');
    dlg.close(); renderRight(); renderCart();
    const refBox = document.querySelector('.pos__ref-box');
    if (refBox && refBox.__update) refBox.__update();
  }

  async function completeTransaction() {
    if (!cart.size) return;
    if (mode === 'sale') await completeSale();
    else await completeReturn();
  }

  async function completeSale() {
    const completeBtn = document.getElementById('posComplete');
    completeBtn.disabled = true;

    try {
      const custSel = document.getElementById('posCust');
      let sub = 0;
      for (const item of cart.values()) sub += item.qty * item.price - item.discount;
      const invDisc = computeInvoiceDiscount(sub);

      const items = [...cart.values()].map((item) => ({
        product_id: item.product.id,
        qty: item.qty,
        selling_price: item.price,
        vat_rate: item.vat,
        discount_amount: item.discount || 0,
      }));

      const subAfterDisc = sub - invDisc;
      const vatTotal = [...cart.values()].reduce((s, i) => {
        const lineNet = i.qty * i.price - i.discount;
        return s + lineNet * i.vat / 100;
      }, 0);
      const vatAdjusted = subAfterDisc * (sub ? vatTotal / sub : 0);
      const grand = subAfterDisc + vatAdjusted;

      let paid = grand;
      if (paymentMethod === 'credit') paid = amountReceived || 0;
      else if (paymentMethod === 'cash') paid = Math.min(grand, amountReceived || grand);

      const payload = {
        sale_number: nextDocNumber('POS'),
        customer_id: custSel?.value || null,
        sale_date: isoDate(),
        items,
        paid_amount: paid,
        invoice_discount: invDisc,
        currency_code: currencyCode,
        exchange_rate: exchangeRate || 1,
        is_wholesale: isWholesale,
      };

      const { data: saleId, error } = await salesApi.create(payload);
      if (error) throw new Error(errMsg(error));

      // Apply currency/wholesale/discount metadata (create_sale RPC doesn't handle these)
      if (currencyCode !== baseCurrency.code || isWholesale || invDisc > 0) {
        const metaRes = await supabase.rpc('update_sale_metadata', {
          p_sale_id: saleId,
          p_currency: currencyCode,
          p_rate: exchangeRate || 1,
          p_wholesale: isWholesale,
          p_invoice_discount: invDisc,
        });
        if (metaRes.error) {
          // Non-fatal: metadata update failed but don't block the sale
        }
      }

      const change = paymentMethod === 'cash' ? Math.max(0, (amountReceived || 0) - grand) : 0;
      toast('✅ ' + t('sale_complete') + (change > 0 ? ' • 💰 ' + money(change) : ''), 'success');

      const det = await salesApi.getDetail(saleId);
      if (!det.error) {
        printInvoice({ kind: 'sale', header: det.data.header, items: det.data.items, payments: det.data.payments });
      }

      // Reset
      cart.clear(); amountReceived = 0; paymentMethod = 'cash';
      invoiceDiscount = 0;
      if (custSel) custSel.value = '';
      searchInput.focus();

      const inv2 = await inventoryApi.list({});
      if (!inv2.error) {
        stockMap.clear();
        for (const r of inv2.data) stockMap.set(r.product_id, Number(r.current_stock));
      }
      renderRight(); renderCart(); renderGrid(searchInput.value);
    } catch (err) {
      toast(err.message || t('something_wrong'), 'error');
    } finally {
      completeBtn.disabled = false;
    }
  }

  async function completeReturn() {
    if (!originalSaleId) { toast(t('select_sale_to_return'), 'error'); return; }
    const completeBtn = document.getElementById('posComplete');
    completeBtn.disabled = true;

    try {
      const items = [...cart.values()].map((item) => ({
        product_id: item.product.id, qty: item.qty,
        unit_price: item.price, vat_rate: item.vat,
      }));
      const payload = {
        return_number: nextDocNumber('RTN'),
        kind: 'return_in',
        reference_id: originalSaleId,
        party_name: null, return_date: isoDate(),
        items,
      };
      const { error } = await returnsApi.create(payload);
      if (error) throw new Error(errMsg(error));

      toast('✅ ' + t('return_complete'), 'success');
      cart.clear(); originalSaleId = null; searchInput.focus();
      renderRight(); renderCart();

      const inv2 = await inventoryApi.list({});
      if (!inv2.error) {
        stockMap.clear();
        for (const r of inv2.data) stockMap.set(r.product_id, Number(r.current_stock));
      }
      renderGrid(searchInput.value);
    } catch (err) {
      toast(err.message || t('something_wrong'), 'error');
    } finally {
      completeBtn.disabled = false;
    }
  }
}
