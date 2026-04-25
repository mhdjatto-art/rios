// frontend/utils.js  (Phase 2)
import { t } from './i18n.js';

const nfMoney = new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfQty   = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });

export function money(n) { return nfMoney.format(Number(n || 0)); }
export function qty(n)   { return nfQty.format(Number(n || 0)); }
export function isoDate(d) { const dt = d ? new Date(d) : new Date(); return dt.toISOString().slice(0,10); }
export function fmtDate(d) { if (!d) return ''; return (typeof d === 'string' ? new Date(d) : d).toLocaleDateString(); }

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function')
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
export function $(sel, root = document) { return root.querySelector(sel); }
export function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

export function toast(msg, kind = 'info') {
  const host = $('#toast-host') || (() => { const h = el('div', { id: 'toast-host' }); document.body.appendChild(h); return h; })();
  const tEl = el('div', { class: `toast toast--${kind}` }, msg);
  host.appendChild(tEl);
  setTimeout(() => tEl.classList.add('toast--show'), 10);
  setTimeout(() => { tEl.classList.remove('toast--show'); setTimeout(() => tEl.remove(), 250); }, 3500);
}

// Map normalized API error -> localized text.
export function errMsg(err) {
  if (!err) return t('something_wrong');
  switch (err.message) {
    case 'INSUFFICIENT_STOCK': return t('insufficient_stock');
    case 'FORBIDDEN':          return t('permission_denied');
    case 'AUTH_REQUIRED':      return t('auth_required');
    default:                   return err.message || t('something_wrong');
  }
}

export function renderLoading(host, label) {
  clear(host); host.appendChild(el('div', { class: 'state' }, label || t('loading')));
}
export function renderEmpty(host, label) {
  clear(host); host.appendChild(el('div', { class: 'state' }, label || t('no_data')));
}
export function renderError(host, err) {
  clear(host); host.appendChild(el('div', { class: 'state state--error' }, [
    el('strong', {}, t('something_wrong') + ' '),
    document.createTextNode(errMsg(err)),
  ]));
}

export function requireStr(v, label) {
  if (v == null || String(v).trim() === '') throw new Error(`${label}: ${t('required')}`);
  return String(v).trim();
}
export function requireNum(v, label, { min = null, max = null } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${label}: ${t('required')}`);
  if (min != null && n < min) throw new Error(`${label} >= ${min}`);
  if (max != null && n > max) throw new Error(`${label} <= ${max}`);
  return n;
}
export function debounce(fn, wait = 250) {
  let tm; return (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), wait); };
}
export function nextDocNumber(prefix) {
  const y = new Date().getFullYear();
  // Use crypto.randomUUID for guaranteed uniqueness, take last 8 hex chars
  const uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(-8).toUpperCase()
    : Math.floor(Math.random() * 90000000 + 10000000).toString();
  return `${prefix}-${y}-${uid}`;
}

export function field(label, input) {
  return el('label', { class: 'form__field' }, [
    el('span', { class: 'form__label' }, label),
    input,
  ]);
}
