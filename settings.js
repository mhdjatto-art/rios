// frontend/settings.js  (Phase 8)
import { settingsApi, supabase } from './api.js';
import { auth } from './auth.js';
import { t, i18n } from './i18n.js';
import {
  el, clear, toast, renderLoading, renderError, errMsg, field,
} from './utils.js';

export async function render(host) {
  clear(host);
  if (!auth.state.isAdmin) {
    host.appendChild(el('div', { class: 'state state--error' }, t('permission_denied')));
    return;
  }
  host.appendChild(el('h1', { class: 'view-title' }, t('settings')));

  const card = el('div', { class: 'card' });
  host.appendChild(card);
  renderLoading(card);

  const { data: cs, error } = await settingsApi.get();
  if (error) return renderError(card, error);
  clear(card);

  const inName     = el('input', { class: 'input', value: cs.name || '' });
  const inTax      = el('input', { class: 'input', value: cs.tax_number || '' });
  const inPhone    = el('input', { class: 'input', value: cs.phone || '' });
  const inEmail    = el('input', { type: 'email', class: 'input', value: cs.email || '' });
  const inAddress  = el('input', { class: 'input', value: cs.address || '' });
  const inWebsite  = el('input', { class: 'input', value: cs.website || '' });
  const inCurrency = el('input', { class: 'input', value: cs.currency_symbol || '', maxlength: '10' });
  const inPaperSize = el('select', { class: 'input' }, [
    el('option', { value: 'A4' }, 'A4'),
    el('option', { value: 'A5' }, 'A5'),
    el('option', { value: 'thermal_80' }, '80mm Thermal'),
  ]);
  inPaperSize.value = cs.print_paper_size || 'A4';
  const inPrintColor = el('input', { type: 'color', class: 'input', value: cs.print_color_primary || '#2453b8' });
  const inPrintFontSize = el('input', { type: 'number', class: 'input num', min: '9', max: '18', value: cs.print_font_size || 12 });
  const inShowLogo = el('input', { type: 'checkbox', checked: cs.print_show_logo !== false });
  const inShowVat = el('input', { type: 'checkbox', checked: cs.print_show_vat !== false });
  const inShowTaxNum = el('input', { type: 'checkbox', checked: cs.print_show_tax_num !== false });
  const inShowFooter = el('input', { type: 'checkbox', checked: cs.print_show_footer !== false });
  const inReceiptPrefix = el('input', { class: 'input', value: cs.receipt_prefix || 'REC-' });
  const inVoucherPrefix = el('input', { class: 'input', value: cs.voucher_prefix || 'VCH-' });
  const inFooter   = el('textarea', { class: 'input', rows: 2 }, cs.invoice_footer || '');
  const errBox    = el('div', { class: 'form-error', hidden: true });

  let logoUrl = cs.logo_url || null;
  const logoImg = el('img', {
    style: 'max-width:200px; max-height:100px; border:1px solid #ddd; border-radius:4px; display:' + (logoUrl ? 'block' : 'none'),
    src: logoUrl || '',
  });
  const inLogo = el('input', { type: 'file', accept: 'image/*', class: 'input' });
  const removeLogoBtn = el('button', { type: 'button', class: 'btn btn--ghost',
    onclick: () => { logoUrl = null; logoImg.style.display = 'none'; logoImg.src = ''; toast('✗ logo', 'info'); } },
    '×');

  inLogo.addEventListener('change', async () => {
    const f = inLogo.files[0];
    if (!f) return;
    const { data: url, error } = await settingsApi.uploadLogo(f);
    if (error) { toast(errMsg(error), 'error'); return; }
    logoUrl = url;
    logoImg.src = url;
    logoImg.style.display = 'block';
    toast('✓', 'success');
  });

  const form = el('form', {
    class: 'form',
    onsubmit: async (e) => {
      e.preventDefault();
      errBox.hidden = true;
      const row = {
        name: inName.value.trim() || null,
        tax_number: inTax.value.trim() || null,
        phone: inPhone.value.trim() || null,
        email: inEmail.value.trim() || null,
        address: inAddress.value.trim() || null,
        website: inWebsite.value.trim() || null,
        currency_symbol: inCurrency.value.trim() || null,
        invoice_footer: inFooter.value.trim() || null,
        logo_url: logoUrl,
        print_paper_size: inPaperSize.value,
        print_color_primary: inPrintColor.value,
        print_font_size: Number(inPrintFontSize.value || 12),
        print_show_logo: inShowLogo.checked,
        print_show_vat: inShowVat.checked,
        print_show_tax_num: inShowTaxNum.checked,
        print_show_footer: inShowFooter.checked,
        receipt_prefix: inReceiptPrefix.value.trim() || 'REC-',
        voucher_prefix: inVoucherPrefix.value.trim() || 'VCH-',
      };
      const { error } = await settingsApi.save(row);
      if (error) { errBox.textContent = errMsg(error); errBox.hidden = false; return; }
      toast(t('save_changes') + ' ✓', 'success');
    },
  }, [
    el('h2', {}, t('company_info')),
    el('div', { class: 'grid-2' }, [
      field(t('company_name'), inName),
      field(t('tax_number'), inTax),
      field(t('phone'), inPhone),
      field(t('email'), inEmail),
      field(t('website'), inWebsite),
      field(t('currency'), inCurrency),
    ]),
    field(t('address'), inAddress),
    field(t('invoice_footer'), inFooter),
    el('h3', {}, t('logo')),
    el('div', { style: 'display:flex; gap:12px; align-items:center' }, [inLogo, logoImg, removeLogoBtn]),

    el('h2', { style: 'margin-top:24px' }, '🖨 ' + t('print_options')),
    el('div', { class: 'grid-2' }, [
      field(t('paper_size'), inPaperSize),
      field(t('print_color'), inPrintColor),
      field(t('font_size') + ' (px)', inPrintFontSize),
      field(t('receipt_prefix'), inReceiptPrefix),
      field(t('voucher_prefix'), inVoucherPrefix),
    ]),
    el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:8px' }, [
      el('label', { style: 'display:flex; gap:6px; align-items:center' }, [inShowLogo, el('span', {}, t('show_logo_on_print'))]),
      el('label', { style: 'display:flex; gap:6px; align-items:center' }, [inShowTaxNum, el('span', {}, t('show_tax_number'))]),
      el('label', { style: 'display:flex; gap:6px; align-items:center' }, [inShowVat, el('span', {}, t('show_vat_breakdown'))]),
      el('label', { style: 'display:flex; gap:6px; align-items:center' }, [inShowFooter, el('span', {}, t('show_footer'))]),
    ]),
    errBox,
    el('div', { class: 'form__actions' }, [
      el('button', { type: 'submit', class: 'btn btn--primary' }, t('save_changes')),
    ]),
  ]);
  card.appendChild(form);

  // Phase 25: System Reset (Admin Tools)
  const adminSection = el('div', { class: 'card', style: 'margin-top:24px; border-color: var(--rios-danger, #dc2626)' });
  adminSection.appendChild(el('h2', { style: 'color: var(--rios-danger, #dc2626); margin-top:0' },
    '⚠️ ' + (i18n.lang === 'ar' ? 'منطقة الخطر' : 'Danger Zone')));
  adminSection.appendChild(el('p', { class: 'muted' },
    i18n.lang === 'ar'
      ? 'هذه الأدوات تحذف البيانات بشكل دائم. استخدمها بحذر.'
      : 'These tools permanently delete data. Use with caution.'));

  const resetBtn = el('button', {
    class: 'btn btn--danger',
    style: 'margin-top:8px',
    onclick: openResetDialog,
  }, '🗑️ ' + (i18n.lang === 'ar' ? 'تهيئة النظام (حذف البيانات)' : 'System Reset (Delete Data)'));

  adminSection.appendChild(resetBtn);
  host.appendChild(adminSection);

  function openResetDialog() {
    const dlg = el('dialog', { class: 'dialog', style: 'max-width:500px' });

    const scopeRadio = (value, labelEn, labelAr, hint) => {
      const r = el('input', { type: 'radio', name: 'scope', value });
      if (value === 'transactions') r.checked = true;
      return el('label', {
        style: 'display:flex; gap:8px; padding:10px; border:1px solid var(--rios-border); border-radius:8px; cursor:pointer; margin-bottom:6px',
      }, [
        r,
        el('div', {}, [
          el('div', { style: 'font-weight:600' }, i18n.lang === 'ar' ? labelAr : labelEn),
          el('div', { class: 'muted small' }, hint),
        ]),
      ]);
    };

    const confirmIn = el('input', {
      class: 'input', type: 'text', placeholder: 'Type: RESET',
      style: 'width:100%; margin-top:12px',
    });

    const errBox = el('div', { class: 'form-error', hidden: true });

    const form = el('div', { style: 'padding:4px' }, [
      el('h2', {}, '⚠️ ' + (i18n.lang === 'ar' ? 'تهيئة النظام' : 'System Reset')),
      el('p', { class: 'muted' },
        i18n.lang === 'ar'
          ? 'هذا سيحذف البيانات بشكل دائم. لا يمكن التراجع!'
          : 'This will permanently delete data. Cannot be undone!'),

      el('div', { style: 'margin:12px 0' }, [
        scopeRadio('transactions',
          'Transactions only',
          'المعاملات فقط',
          i18n.lang === 'ar'
            ? 'يحذف: المبيعات، المشتريات، المدفوعات، المصاريف، المخزون، القيود'
            : 'Clears: sales, purchases, payments, expenses, stock movements, journal entries'),
        scopeRadio('all_except_masters',
          'All except COA & settings',
          'كل شي ما عدا الحسابات والإعدادات',
          i18n.lang === 'ar'
            ? 'يحذف كل شي إضافة إلى: المنتجات، العملاء، الموردين، الموظفين'
            : 'Also clears: products, customers, suppliers, employees'),
      ]),

      el('div', { style: 'margin-top:12px' }, [
        el('label', { class: 'muted' },
          i18n.lang === 'ar' ? 'للتأكيد، اكتب "RESET":' : 'To confirm, type "RESET":'),
        confirmIn,
      ]),

      errBox,

      el('div', { class: 'form__actions', style: 'margin-top:16px' }, [
        el('button', { class: 'btn btn--ghost', onclick: () => dlg.close() }, t('cancel')),
        el('button', { class: 'btn btn--danger', onclick: async () => {
          errBox.hidden = true;
          const scope = form.querySelector('input[name="scope"]:checked')?.value || 'transactions';
          const confirmText = confirmIn.value.trim();
          if (confirmText !== 'RESET') {
            errBox.textContent = i18n.lang === 'ar' ? 'اكتب RESET بالضبط' : 'Type RESET exactly';
            errBox.hidden = false;
            return;
          }

          try {
            const { data, error } = await supabase.rpc('admin_system_reset', {
              p_confirm_text: 'RESET',
              p_scope: scope,
            });
            if (error) throw new Error(errMsg(error));
            toast('✅ ' + (data.tables_cleared?.length || 0) + ' tables cleared', 'success');
            dlg.close();
          } catch (err) {
            errBox.textContent = err.message;
            errBox.hidden = false;
          }
        } }, '🗑 ' + (i18n.lang === 'ar' ? 'تهيئة الآن' : 'Reset now')),
      ]),
    ]);
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
}

