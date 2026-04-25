// frontend/products.js  (Phase 3)
import { productsApi } from './api.js';
import { auth } from './auth.js';
import { t } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, renderEmpty, debounce,
  requireStr, fmtDate, money, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  const { isManagerOrAdmin, isAdmin } = auth.state;

  const searchInput = el('input', { type: 'search', class: 'input', placeholder: t('search') });
  const statusSelect = el('select', { class: 'input' }, [
    el('option', { value: '' }, t('all_statuses')),
    el('option', { value: 'active' }, t('active')),
    el('option', { value: 'inactive' }, t('inactive')),
    el('option', { value: 'discontinued' }, t('discontinued')),
  ]);
  const newBtn = el('button', { class: 'btn btn--primary' }, t('new_product'));
  if (!isManagerOrAdmin) newBtn.disabled = true;

  host.append(el('div', { class: 'toolbar' }, [
    el('h1', { class: 'view-title' }, t('products')),
    el('div', { class: 'toolbar__spacer' }),
    searchInput, statusSelect, newBtn,
  ]));
  const tableHost = el('div', { class: 'card' });
  host.appendChild(tableHost);

  const refresh = debounce(async () => {
    renderLoading(tableHost);
    const { data, error } = await productsApi.list({
      search: searchInput.value.trim(), status: statusSelect.value || null,
    });
    if (error) return renderError(tableHost, error);
    if (!data.length) return renderEmpty(tableHost, t('no_products'));

    const rows = data.map((p) => {
      const editBtn = el('button', { class: 'btn btn--ghost', onclick: () => openEditor(p) }, t('edit'));
      const delBtn = el('button', { class: 'btn btn--danger', onclick: () => confirmDelete(p) }, t('delete'));
      if (!isManagerOrAdmin) editBtn.disabled = true;
      if (!isAdmin) delBtn.disabled = true;
      return el('tr', {}, [
        el('td', {}, p.image_url
          ? el('img', { class: 'thumb', src: p.image_url, alt: p.name })
          : el('div', { class: 'thumb' })),
        el('td', { class: 'mono' }, p.sku),
        el('td', {}, p.name),
        el('td', {}, p.brand || '—'),
        el('td', { class: 'num' }, money(p.selling_price || 0)),
        el('td', { class: 'num' }, (Number(p.vat_rate || 0)) + '%'),
        el('td', {}, el('span', { class: `pill pill--${p.status}` }, t(p.status))),
        el('td', { class: 'actions' }, [editBtn, delBtn]),
      ]);
    });

    clear(tableHost);
    tableHost.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, t('image')), el('th', {}, t('sku')), el('th', {}, t('name')),
        el('th', {}, t('brand')), el('th', { class: 'num' }, t('selling_price')),
        el('th', { class: 'num' }, t('vat_rate')), el('th', {}, t('status')),
        el('th', {}, t('actions')),
      ])),
      el('tbody', {}, rows),
    ]));
  }, 200);

  searchInput.addEventListener('input', refresh);
  statusSelect.addEventListener('change', refresh);
  newBtn.addEventListener('click', () => openEditor(null));
  await refresh();

  function openEditor(product) {
    const isEdit = !!product;
    const dlg = el('dialog', { class: 'dialog' });
    const inSku = el('input', { class: 'input', required: true, value: product?.sku || '' });
    const inName = el('input', { class: 'input', required: true, value: product?.name || '' });
    const inBrand = el('input', { class: 'input', value: product?.brand || '' });
    const inCategory = el('input', { class: 'input', value: product?.category || '' });
    const inBarcode = el('input', { class: 'input', value: product?.barcode || '' });
    const inPrice = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: product?.selling_price ?? '0' });
    const inVat = el('input', { type: 'number', step: '0.01', min: '0', max: '100', class: 'input num', value: product?.vat_rate ?? '0' });
    const inWholesale = el('input', { type: 'number', step: '0.01', min: '0', class: 'input num', value: product?.wholesale_price ?? '' });
    const inReorderLevel = el('input', { type: 'number', step: '0.001', min: '0', class: 'input num', value: product?.reorder_level ?? '10' });
    const inReorderQty = el('input', { type: 'number', step: '0.001', min: '0', class: 'input num', value: product?.reorder_qty ?? '20' });
    const inDesc = el('textarea', { class: 'input', rows: 3 }, product?.description || '');
    const inStatus = el('select', { class: 'input' }, [
      el('option', { value: 'active' }, t('active')),
      el('option', { value: 'inactive' }, t('inactive')),
      el('option', { value: 'discontinued' }, t('discontinued')),
    ]);
    inStatus.value = product?.status || 'active';

    const previewSrc = product?.image_url || '';
    const preview = el('img', { class: 'image-upload__preview', src: previewSrc, alt: '' });
    const fileInput = el('input', { type: 'file', accept: 'image/*' });
    const pickBtn = el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => fileInput.click() }, t('upload_image'));
    let uploadedUrl = previewSrc;
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      preview.src = URL.createObjectURL(f);
      pickBtn.disabled = true; pickBtn.textContent = t('loading');
      const { data, error } = await productsApi.uploadImage(f, inSku.value || product?.sku);
      pickBtn.disabled = false; pickBtn.textContent = t('upload_image');
      if (error) { toast(errMsg(error), 'error'); return; }
      uploadedUrl = data; preview.src = data;
    });

    const errBox = el('div', { class: 'form-error', hidden: true });
    const form = el('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        try {
          const row = {
            sku: requireStr(inSku.value, t('sku')),
            name: requireStr(inName.value, t('name')),
            brand: inBrand.value.trim() || null,
            category: inCategory.value.trim() || null,
            barcode: inBarcode.value.trim() || null,
            description: inDesc.value.trim() || null,
            selling_price: Number(inPrice.value || 0),
            vat_rate: Number(inVat.value || 0),
            wholesale_price: inWholesale.value === '' ? null : Number(inWholesale.value),
            reorder_level: Number(inReorderLevel.value || 0),
            reorder_qty: Number(inReorderQty.value || 0),
            image_url: uploadedUrl || null,
            status: inStatus.value,
          };
          const res = isEdit ? await productsApi.update(product.id, row) : await productsApi.create(row);
          if (res.error) throw new Error(errMsg(res.error));
          toast('✓', 'success');
          dlg.close();
          await refresh();
        } catch (err) { errBox.textContent = err.message; errBox.hidden = false; }
      },
    }, [
      el('h2', {}, isEdit ? t('edit_product') : t('new_product')),
      el('div', { class: 'image-upload' }, [preview, pickBtn, fileInput]),
      el('div', { class: 'grid-2' }, [
        field(t('sku'), inSku),
        field(t('name'), inName),
        field(t('brand'), inBrand),
        field(t('category'), inCategory),
        field(t('barcode'), inBarcode),
        field(t('selling_price'), inPrice),
        field(t('vat_rate'), inVat),
        field(t('wholesale_price'), inWholesale),
        field(t('reorder_level'), inReorderLevel),
        field(t('reorder_qty'), inReorderQty),
        field(t('status'), inStatus),
      ]),
      field(t('description'), inDesc),
      errBox,
      el('div', { class: 'form__actions' }, [
        el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { type: 'submit', class: 'btn btn--primary' }, isEdit ? t('save_changes') : t('create')),
      ]),
    ]);

    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  function confirmDelete(p) {
    if (!isAdmin) { toast(t('permission_denied'), 'error'); return; }
    if (!confirm(`${t('confirm_delete')}\n${p.name} (${p.sku})`)) return;
    (async () => {
      const { error } = await productsApi.remove(p.id);
      if (error) return toast(errMsg(error), 'error');
      toast(t('delete') + ' ✓', 'success');
      await refresh();
    })();
  }
}
