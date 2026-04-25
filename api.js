// frontend/api.js  (Phase 4)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'rios.auth' },
});

function normalizeError(err) {
  if (!err) return null;
  const code = err.code || err.status || 'ERR';
  const raw = err.message || String(err);
  let userMessage = raw;
  if (/INSUFFICIENT_STOCK/.test(raw)) userMessage = 'INSUFFICIENT_STOCK';
  else if (/FORBIDDEN/.test(raw) || code === '42501') userMessage = 'FORBIDDEN';
  else if (/AUTH_REQUIRED/.test(raw) || code === '28000') userMessage = 'AUTH_REQUIRED';
  else if (/VALIDATION:/.test(raw)) userMessage = raw.replace(/.*VALIDATION:\s*/, '');
  else if (code === '23505') userMessage = 'A record with that unique value already exists.';
  return { code, raw, message: userMessage };
}
const ok = (d) => ({ data: d, error: null });
const fail = (e) => ({ data: null, error: normalizeError(e) });

export const authApi = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? fail(error) : ok(data);
  },
  async signOut() { const { error } = await supabase.auth.signOut(); return error ? fail(error) : ok(true); },
  async getSession() { const { data, error } = await supabase.auth.getSession(); return error ? fail(error) : ok(data.session); },
  async getProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('id,email,full_name,role,is_active').eq('id', userId).single();
    return error ? fail(error) : ok(data);
  },
  onChange(cb) { return supabase.auth.onAuthStateChange((_e, s) => cb(s)); },
};

export const productsApi = {
  async list({ search = '', status = null, limit = 500 } = {}) {
    let q = supabase.from('products')
      .select('id,sku,name,brand,category,barcode,status,image_url,description,selling_price,wholesale_price,vat_rate,reorder_level,reorder_qty,created_at')
      .order('name', { ascending: true }).limit(limit);
    if (status) q = q.eq('status', status);
    if (search) { const s = `%${search}%`; q = q.or(`sku.ilike.${s},name.ilike.${s},brand.ilike.${s}`); }
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async create(row) { const { data, error } = await supabase.from('products').insert(row).select().single(); return error ? fail(error) : ok(data); },
  async update(id, p) { const { data, error } = await supabase.from('products').update(p).eq('id', id).select().single(); return error ? fail(error) : ok(data); },
  async remove(id) { const { error } = await supabase.from('products').delete().eq('id', id); return error ? fail(error) : ok(true); },
  async bulkImport(rows) { const { data, error } = await supabase.rpc('bulk_import_products', { rows }); return error ? fail(error) : ok(data); },
  async uploadImage(file, sku) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeSku = (sku || crypto.randomUUID()).replace(/[^a-z0-9_-]/gi, '_');
    const path = `${safeSku}_${Date.now()}.${ext}`;
    const up = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
    if (up.error) return fail(up.error);
    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
    return ok(pub.publicUrl);
  },
};

function makePartyApi(table) {
  return {
    async list({ search = '', activeOnly = false, limit = 500 } = {}) {
      let q = supabase.from(table).select('id,name,phone,email,address,notes,is_active,created_at').order('name', { ascending: true }).limit(limit);
      if (activeOnly) q = q.eq('is_active', true);
      if (search) { const s = `%${search}%`; q = q.or(`name.ilike.${s},phone.ilike.${s},email.ilike.${s}`); }
      const { data, error } = await q;
      return error ? fail(error) : ok(data);
    },
    async create(row) { const { data, error } = await supabase.from(table).insert(row).select().single(); return error ? fail(error) : ok(data); },
    async update(id, p) { const { data, error } = await supabase.from(table).update(p).eq('id', id).select().single(); return error ? fail(error) : ok(data); },
    async remove(id) { const { error } = await supabase.from(table).delete().eq('id', id); return error ? fail(error) : ok(true); },
  };
}
export const customersApi = makePartyApi('customers');
export const suppliersApi = makePartyApi('suppliers');

export const purchasesApi = {
  async list({ from = null, to = null, limit = 100 } = {}) {
    let q = supabase.from('purchases')
      .select('id,purchase_number,supplier,supplier_id,purchase_date,grand_total,paid_amount,subtotal,total_vat,discount_invoice,notes,created_at,suppliers(name)')
      .order('purchase_date', { ascending: false }).limit(limit);
    if (from) q = q.gte('purchase_date', from);
    if (to) q = q.lte('purchase_date', to);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async getDetail(id) {
    const [hdr, items, payments] = await Promise.all([
      supabase.from('purchases').select('*, suppliers(name,phone,address,email)').eq('id', id).single(),
      supabase.from('purchase_items').select('id,product_id,qty,cost_price,line_total,vat_rate,vat_amount,discount_amount,products(sku,name)').eq('purchase_id', id),
      supabase.from('payments').select('id,amount,method,payment_date,notes,created_at').eq('kind', 'purchase_pay').eq('reference_id', id).order('payment_date', { ascending: false }),
    ]);
    if (hdr.error) return fail(hdr.error);
    if (items.error) return fail(items.error);
    return ok({ header: hdr.data, items: items.data, payments: payments.data || [] });
  },
  async create(payload) { const { data, error } = await supabase.rpc('create_purchase', { payload }); return error ? fail(error) : ok(data); },
};

export const salesApi = {
  async list({ from = null, to = null, limit = 100 } = {}) {
    let q = supabase.from('sales')
      .select('id,sale_number,customer,customer_id,sale_date,grand_total,paid_amount,subtotal,total_vat,discount_invoice,notes,created_at,customers(name)')
      .order('sale_date', { ascending: false }).limit(limit);
    if (from) q = q.gte('sale_date', from);
    if (to) q = q.lte('sale_date', to);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async getDetail(id) {
    const [hdr, items, payments] = await Promise.all([
      supabase.from('sales').select('*, customers(name,phone,address,email)').eq('id', id).single(),
      supabase.from('sale_items').select('id,product_id,qty,selling_price,line_total,vat_rate,vat_amount,discount_amount,products(sku,name)').eq('sale_id', id),
      supabase.from('payments').select('id,amount,method,payment_date,notes,created_at').eq('kind', 'sale_collect').eq('reference_id', id).order('payment_date', { ascending: false }),
    ]);
    if (hdr.error) return fail(hdr.error);
    if (items.error) return fail(items.error);
    return ok({ header: hdr.data, items: items.data, payments: payments.data || [] });
  },
  async create(payload) { const { data, error } = await supabase.rpc('create_sale', { payload }); return error ? fail(error) : ok(data); },
};

export const inventoryApi = {
  async list({ brand = null, category = null, search = '' } = {}) {
    let q = supabase.from('v_inventory_value').select('product_id,sku,name,brand,category,current_stock,wac,stock_value').order('name', { ascending: true });
    if (brand) q = q.eq('brand', brand);
    if (category) q = q.eq('category', category);
    if (search) { const s = `%${search}%`; q = q.or(`sku.ilike.${s},name.ilike.${s}`); }
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async movementsForProduct(productId, { limit = 200 } = {}) {
    const { data, error } = await supabase.from('stock_movements')
      .select('id,movement_type,qty,unit_cost,reference_table,reference_id,movement_date,notes')
      .eq('product_id', productId).order('movement_date', { ascending: false }).limit(limit);
    return error ? fail(error) : ok(data);
  },
  async adjust(productId, qty, reason) {
    const { data, error } = await supabase.rpc('adjust_stock', { p_product_id: productId, p_qty: qty, p_reason: reason });
    return error ? fail(error) : ok(data);
  },
};

export const dashboardApi = {
  async kpis() { const { data, error } = await supabase.from('v_dashboard_kpis').select('*').single(); return error ? fail(error) : ok(data); },
  async topSellingProducts(l = 5) { const { data, error } = await supabase.from('v_sales_by_product').select('product_id,sku,name,brand,qty_sold,revenue').order('revenue', { ascending: false }).limit(l); return error ? fail(error) : ok(data); },
  async slowProducts(l = 5) { const { data, error } = await supabase.from('v_sales_by_product').select('product_id,sku,name,brand,qty_sold,revenue').order('qty_sold', { ascending: true }).limit(l); return error ? fail(error) : ok(data); },
  async lowStock(l = 20) { const { data, error } = await supabase.from('v_product_stock').select('product_id,sku,name,brand,category,current_stock').gt('current_stock', 0).lt('current_stock', 10).order('current_stock', { ascending: true }).limit(l); return error ? fail(error) : ok(data); },
  async outOfStock(l = 20) { const { data, error } = await supabase.from('v_product_stock').select('product_id,sku,name,brand,category,current_stock').lte('current_stock', 0).limit(l); return error ? fail(error) : ok(data); },
  async aggregateBy(field, l = 5) {
    const { data, error } = await supabase.from('v_sales_by_product').select(`${field}, revenue`);
    if (error) return fail(error);
    const m = new Map();
    for (const r of data) { const k = r[field] || (field === 'brand' ? 'Unbranded' : 'Uncategorized'); m.set(k, (m.get(k) || 0) + Number(r.revenue || 0)); }
    return ok([...m.entries()].map(([k, v]) => ({ [field]: k, revenue: v })).sort((a, b) => b.revenue - a.revenue).slice(0, l));
  },
};

export const usersApi = {
  async list() { const { data, error } = await supabase.from('profiles').select('id,email,full_name,role,is_active,created_at').order('created_at', { ascending: false }); return error ? fail(error) : ok(data); },
  async setRole(userId, role) { const { error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role }); return error ? fail(error) : ok(true); },
};

export const paymentsApi = {
  async listForSale(saleId) {
    const { data, error } = await supabase.from('payments').select('id,amount,method,payment_date,notes,created_at')
      .eq('kind', 'sale_collect').eq('reference_id', saleId).order('payment_date', { ascending: false });
    return error ? fail(error) : ok(data);
  },
  async listForPurchase(purchaseId) {
    const { data, error } = await supabase.from('payments').select('id,amount,method,payment_date,notes,created_at')
      .eq('kind', 'purchase_pay').eq('reference_id', purchaseId).order('payment_date', { ascending: false });
    return error ? fail(error) : ok(data);
  },
  async record(payload) { const { data, error } = await supabase.rpc('record_payment', { payload }); return error ? fail(error) : ok(data); },
  async balanceList(kind) {
    const view = kind === 'sales' ? 'v_sales_balance' : 'v_purchases_balance';
    const { data, error } = await supabase.from(view).select('*').gt('balance_due', 0).order('age_days', { ascending: false }).limit(200);
    return error ? fail(error) : ok(data);
  },
};

export const returnsApi = {
  async list({ kind = null, limit = 100 } = {}) {
    let q = supabase.from('returns').select('id,return_number,kind,reference_id,party_name,return_date,grand_total,subtotal,total_vat,notes,created_at')
      .order('return_date', { ascending: false }).limit(limit);
    if (kind) q = q.eq('kind', kind);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async getDetail(id) {
    const [hdr, items] = await Promise.all([
      supabase.from('returns').select('*').eq('id', id).single(),
      supabase.from('return_items').select('id,product_id,qty,unit_price,vat_rate,vat_amount,line_total,products(sku,name)').eq('return_id', id),
    ]);
    if (hdr.error) return fail(hdr.error);
    if (items.error) return fail(items.error);
    return ok({ header: hdr.data, items: items.data });
  },
  async create(payload) { const { data, error } = await supabase.rpc('create_return', { payload }); return error ? fail(error) : ok(data); },
};

// =====================================================================
// PHASE 4
// =====================================================================
export const expensesApi = {
  async list({ from = null, to = null, category = null, limit = 200 } = {}) {
    let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(limit);
    if (from) q = q.gte('expense_date', from);
    if (to)   q = q.lte('expense_date', to);
    if (category) q = q.eq('category', category);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async create(row) {
    // Compute vat_amount and total_amount client-side; DB enforces constraints.
    const amount = Number(row.amount || 0);
    const vat_rate = Number(row.vat_rate || 0);
    const vat_amount = +(amount * vat_rate / 100).toFixed(2);
    const total_amount = +(amount + vat_amount).toFixed(2);
    const { data, error } = await supabase.from('expenses').insert({ ...row, vat_amount, total_amount }).select().single();
    return error ? fail(error) : ok(data);
  },
  async update(id, row) {
    const amount = Number(row.amount || 0);
    const vat_rate = Number(row.vat_rate || 0);
    const vat_amount = +(amount * vat_rate / 100).toFixed(2);
    const total_amount = +(amount + vat_amount).toFixed(2);
    const { data, error } = await supabase.from('expenses').update({ ...row, vat_amount, total_amount }).eq('id', id).select().single();
    return error ? fail(error) : ok(data);
  },
  async remove(id) { const { error } = await supabase.from('expenses').delete().eq('id', id); return error ? fail(error) : ok(true); },
  async categories() {
    const { data, error } = await supabase.from('expenses').select('category');
    if (error) return fail(error);
    return ok([...new Set(data.map((r) => r.category))].filter(Boolean).sort());
  },
};

export const statementsApi = {
  async customer(customerId) {
    let q = supabase.from('v_customer_statement').select('*').order('txn_date', { ascending: true });
    q = customerId ? q.eq('customer_id', customerId) : q.is('customer_id', null);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async supplier(supplierId) {
    let q = supabase.from('v_supplier_statement').select('*').order('txn_date', { ascending: true });
    q = supplierId ? q.eq('supplier_id', supplierId) : q.is('supplier_id', null);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
};

export const reportsApi = {
  async daily() { const { data, error } = await supabase.from('v_daily_summary').select('*'); return error ? fail(error) : ok(data); },
  async monthly() { const { data, error } = await supabase.from('v_monthly_pnl').select('*'); return error ? fail(error) : ok(data); },
};

export const exportApi = {
  // Returns rows for any allowed table — used for backup/export.
  async fetchAll(table) {
    const { data, error } = await supabase.from(table).select('*').limit(50000);
    return error ? fail(error) : ok(data);
  },
};


// =====================================================================
// PHASE 5
// =====================================================================

export const quotationsApi = {
  async list({ status = null, limit = 100 } = {}) {
    let q = supabase.from('quotations')
      .select('id,quotation_number,customer,customer_id,quotation_date,valid_until,status,grand_total,subtotal,total_vat,discount_invoice,converted_to_sale_id,notes,created_at,customers(name)')
      .order('quotation_date', { ascending: false }).limit(limit);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async getDetail(id) {
    const [hdr, items] = await Promise.all([
      supabase.from('quotations').select('*, customers(name,phone,address,email)').eq('id', id).single(),
      supabase.from('quotation_items').select('id,product_id,qty,selling_price,line_total,vat_rate,vat_amount,discount_amount,products(sku,name)').eq('quotation_id', id),
    ]);
    if (hdr.error) return fail(hdr.error);
    if (items.error) return fail(items.error);
    return ok({ header: hdr.data, items: items.data });
  },
  async create(payload) { const { data, error } = await supabase.rpc('create_quotation', { payload }); return error ? fail(error) : ok(data); },
  async setStatus(id, status) {
    const { data, error } = await supabase.from('quotations').update({ status }).eq('id', id).select().single();
    return error ? fail(error) : ok(data);
  },
  async convertToSale(id, saleNumber) {
    const { data, error } = await supabase.rpc('convert_quotation_to_sale', { p_quotation_id: id, p_sale_number: saleNumber });
    return error ? fail(error) : ok(data);
  },
  async remove(id) { const { error } = await supabase.from('quotations').delete().eq('id', id); return error ? fail(error) : ok(true); },
};

export const posApi = {
  async list({ status = null, limit = 100 } = {}) {
    let q = supabase.from('purchase_orders')
      .select('id,po_number,supplier,supplier_id,po_date,expected_date,status,grand_total,subtotal,total_vat,discount_invoice,converted_to_purchase_id,notes,created_at,suppliers(name)')
      .order('po_date', { ascending: false }).limit(limit);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async getDetail(id) {
    const [hdr, items] = await Promise.all([
      supabase.from('purchase_orders').select('*, suppliers(name,phone,address,email)').eq('id', id).single(),
      supabase.from('po_items').select('id,product_id,qty,cost_price,line_total,vat_rate,vat_amount,discount_amount,products(sku,name)').eq('po_id', id),
    ]);
    if (hdr.error) return fail(hdr.error);
    if (items.error) return fail(items.error);
    return ok({ header: hdr.data, items: items.data });
  },
  async create(payload) { const { data, error } = await supabase.rpc('create_po', { payload }); return error ? fail(error) : ok(data); },
  async setStatus(id, status) {
    const { data, error } = await supabase.from('purchase_orders').update({ status }).eq('id', id).select().single();
    return error ? fail(error) : ok(data);
  },
  async convertToPurchase(id, purchaseNumber) {
    const { data, error } = await supabase.rpc('convert_po_to_purchase', { p_po_id: id, p_purchase_number: purchaseNumber });
    return error ? fail(error) : ok(data);
  },
  async remove(id) { const { error } = await supabase.from('purchase_orders').delete().eq('id', id); return error ? fail(error) : ok(true); },
};

export const auditApi = {
  async list({ table = null, user = null, limit = 200 } = {}) {
    let q = supabase.from('audit_log')
      .select('id,table_name,operation,record_id,old_data,new_data,user_id,user_email,changed_at')
      .order('changed_at', { ascending: false }).limit(limit);
    if (table) q = q.eq('table_name', table);
    if (user) q = q.eq('user_id', user);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
};

export const cashApi = {
  async currentSession() {
    const { data, error } = await supabase.from('v_current_cash_session').select('*').maybeSingle();
    return error ? fail(error) : ok(data);
  },
  async history({ limit = 50 } = {}) {
    const { data, error } = await supabase.from('cash_sessions').select('*').order('opened_at', { ascending: false }).limit(limit);
    return error ? fail(error) : ok(data);
  },
  async open(opening, notes) {
    const { data, error } = await supabase.rpc('open_cash_session', { p_opening: opening, p_notes: notes || null });
    return error ? fail(error) : ok(data);
  },
  async close(sessionId, closing, notes) {
    const { error } = await supabase.rpc('close_cash_session', { p_session_id: sessionId, p_closing: closing, p_notes: notes || null });
    return error ? fail(error) : ok(true);
  },
};


// =====================================================================
// PHASE 6
// =====================================================================
export const branchesApi = {
  async list({ activeOnly = false } = {}) {
    let q = supabase.from('branches').select('*').order('name');
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async create(row) { const { data, error } = await supabase.from('branches').insert(row).select().single(); return error ? fail(error) : ok(data); },
  async update(id, p) { const { data, error } = await supabase.from('branches').update(p).eq('id', id).select().single(); return error ? fail(error) : ok(data); },
  async remove(id) { const { error } = await supabase.from('branches').delete().eq('id', id); return error ? fail(error) : ok(true); },
  async getCurrent() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return ok(null);
    const { data, error } = await supabase.from('profiles').select('default_branch_id').eq('id', user.id).single();
    return error ? fail(error) : ok(data?.default_branch_id || null);
  },
  async setCurrent(branchId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail({ message: 'not signed in' });
    const { error } = await supabase.from('profiles').update({ default_branch_id: branchId }).eq('id', user.id);
    return error ? fail(error) : ok(true);
  },
  async stockByBranch({ branchId = null, productId = null } = {}) {
    let q = supabase.from('v_product_stock_by_branch').select('*');
    if (branchId) q = q.eq('branch_id', branchId);
    if (productId) q = q.eq('product_id', productId);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
};

export const transfersApi = {
  async list({ limit = 100 } = {}) {
    const { data, error } = await supabase.from('stock_transfers')
      .select('*, from_branch:from_branch_id(name,code), to_branch:to_branch_id(name,code)')
      .order('transfer_date', { ascending: false }).limit(limit);
    return error ? fail(error) : ok(data);
  },
  async getDetail(id) {
    const [hdr, items] = await Promise.all([
      supabase.from('stock_transfers').select('*, from_branch:from_branch_id(name,code), to_branch:to_branch_id(name,code)').eq('id', id).single(),
      supabase.from('stock_transfer_items').select('id,product_id,qty,products(sku,name)').eq('transfer_id', id),
    ]);
    if (hdr.error) return fail(hdr.error);
    if (items.error) return fail(items.error);
    return ok({ header: hdr.data, items: items.data });
  },
  async create(payload) { const { data, error } = await supabase.rpc('create_stock_transfer', { payload }); return error ? fail(error) : ok(data); },
};


// =====================================================================
// PHASE 8
// =====================================================================
export const settingsApi = {
  async get() {
    const { data, error } = await supabase.from('company_settings').select('*').eq('id', 1).single();
    return error ? fail(error) : ok(data);
  },
  async save(row) {
    const { data, error } = await supabase.from('company_settings').update(row).eq('id', 1).select().single();
    return error ? fail(error) : ok(data);
  },
  async uploadLogo(file) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `logo_${Date.now()}.${ext}`;
    const up = await supabase.storage.from('company-logo').upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) return fail(up.error);
    const { data: pub } = supabase.storage.from('company-logo').getPublicUrl(path);
    return ok(pub.publicUrl);
  },
};

export const reorderApi = {
  async list() {
    const { data, error } = await supabase.from('v_reorder_list').select('*');
    return error ? fail(error) : ok(data);
  },
  async count() {
    const { data, error } = await supabase.rpc('reorder_count');
    return error ? fail(error) : ok(data);
  },
};


// =====================================================================
// PHASE 13 — ACCOUNTING
// =====================================================================
export const accountingApi = {
  // Chart of accounts
  async listAccounts({ typeFilter = null } = {}) {
    let q = supabase.from('chart_of_accounts').select('*').order('code');
    if (typeFilter) q = q.eq('account_type', typeFilter);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async createAccount(row) {
    const { data, error } = await supabase.from('chart_of_accounts').insert(row).select().single();
    return error ? fail(error) : ok(data);
  },
  async updateAccount(id, row) {
    const { data, error } = await supabase.from('chart_of_accounts').update(row).eq('id', id).select().single();
    return error ? fail(error) : ok(data);
  },
  async removeAccount(id) {
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id);
    return error ? fail(error) : ok(true);
  },

  // Journal entries
  async listEntries({ from = null, to = null, source = null, limit = 200 } = {}) {
    let q = supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(limit);
    if (from) q = q.gte('entry_date', from);
    if (to) q = q.lte('entry_date', to);
    if (source) q = q.eq('source_type', source);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async getEntry(id) {
    const [hdr, lines] = await Promise.all([
      supabase.from('journal_entries').select('*').eq('id', id).single(),
      supabase.from('journal_lines').select('*, chart_of_accounts(code, name_ar, name_en)').eq('entry_id', id).order('line_order'),
    ]);
    if (hdr.error) return fail(hdr.error);
    if (lines.error) return fail(lines.error);
    return ok({ header: hdr.data, lines: lines.data });
  },
  async postEntry({ source_type, source_id, entry_date, description, branch_id, lines }) {
    const { data, error } = await supabase.rpc('post_journal_entry', {
      p_source_type: source_type,
      p_source_id: source_id,
      p_entry_date: entry_date,
      p_description: description,
      p_branch_id: branch_id,
      p_lines: lines,
    });
    return error ? fail(error) : ok(data);
  },
  async backfillLedger() {
    const { data, error } = await supabase.rpc('backfill_ledger');
    return error ? fail(error) : ok(data);
  },

  // Reports
  async trialBalance() {
    const { data, error } = await supabase.from('v_trial_balance').select('*');
    return error ? fail(error) : ok(data);
  },
  async balanceSheet() {
    const { data, error } = await supabase.from('v_balance_sheet').select('*');
    return error ? fail(error) : ok(data);
  },
  async incomeStatement() {
    const { data, error } = await supabase.from('v_income_statement').select('*');
    return error ? fail(error) : ok(data);
  },
  async accountLedger(accountId, from = null, to = null) {
    const { data, error } = await supabase.rpc('account_ledger', {
      p_account_id: accountId,
      p_from: from,
      p_to: to,
    });
    return error ? fail(error) : ok(data);
  },
};


// =====================================================================
// PHASE 14 — Additional accounting APIs
// =====================================================================

// Extend accountingApi
export const accountingApiExt = {
  async rebuildLedger() {
    const { data, error } = await supabase.rpc('rebuild_ledger');
    return error ? fail(error) : ok(data);
  },
  async incomeStatementPeriod(from, to) {
    const { data, error } = await supabase.rpc('income_statement_period', { p_from: from, p_to: to });
    return error ? fail(error) : ok(data);
  },
  async balanceSheetAsOf(asOf) {
    const { data, error } = await supabase.rpc('balance_sheet_as_of', { p_as_of: asOf });
    return error ? fail(error) : ok(data);
  },
  async trialBalancePeriod(from, to) {
    const { data, error } = await supabase.rpc('trial_balance_period', { p_from: from, p_to: to });
    return error ? fail(error) : ok(data);
  },
  async branchPnl(from, to) {
    const { data, error } = await supabase.rpc('branch_pnl', { p_from: from, p_to: to });
    return error ? fail(error) : ok(data);
  },
  async cashFlow(from, to) {
    const { data, error } = await supabase.rpc('cash_flow_statement', { p_from: from, p_to: to });
    return error ? fail(error) : ok(data);
  },
  async yearEndClosing(year) {
    const { data, error } = await supabase.rpc('year_end_closing', { p_year: year });
    return error ? fail(error) : ok(data);
  },
  async arAging() {
    const { data, error } = await supabase.from('v_ar_aging').select('*');
    return error ? fail(error) : ok(data);
  },
  async apAging() {
    const { data, error } = await supabase.from('v_ap_aging').select('*');
    return error ? fail(error) : ok(data);
  },
};

// Merge into accountingApi for convenience
Object.assign(accountingApi, accountingApiExt);


// =====================================================================
// PHASE 17 — Enterprise upgrades
// =====================================================================

export const inventoryCountApi = {
  async list() {
    const { data, error } = await supabase.from('inventory_counts').select('*').order('count_date', { ascending: false }).limit(50);
    return error ? fail(error) : ok(data);
  },
  async get(id) {
    const [hdr, items] = await Promise.all([
      supabase.from('inventory_counts').select('*').eq('id', id).single(),
      supabase.from('inventory_count_items').select('*, products(sku,name)').eq('count_id', id),
    ]);
    if (hdr.error) return fail(hdr.error);
    return ok({ header: hdr.data, items: items.data || [] });
  },
  async create(row) {
    const { data, error } = await supabase.from('inventory_counts').insert(row).select().single();
    return error ? fail(error) : ok(data);
  },
  async snapshot(id) {
    const { data, error } = await supabase.rpc('snapshot_inventory_to_count', { p_count_id: id });
    return error ? fail(error) : ok(data);
  },
  async updateItem(itemId, counted_qty, notes = null) {
    const { error } = await supabase.from('inventory_count_items').update({ counted_qty, notes }).eq('id', itemId);
    return error ? fail(error) : ok(true);
  },
  async post(id) {
    const { data, error } = await supabase.rpc('post_inventory_count', { p_count_id: id });
    return error ? fail(error) : ok(data);
  },
  async remove(id) {
    const { error } = await supabase.from('inventory_counts').delete().eq('id', id);
    return error ? fail(error) : ok(true);
  },
};

export const employeesApi = {
  async list({ activeOnly = false } = {}) {
    let q = supabase.from('employees').select('*').order('name');
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    return error ? fail(error) : ok(data);
  },
  async create(row) {
    const { data, error } = await supabase.from('employees').insert(row).select().single();
    return error ? fail(error) : ok(data);
  },
  async update(id, row) {
    const { data, error } = await supabase.from('employees').update(row).eq('id', id).select().single();
    return error ? fail(error) : ok(data);
  },
  async remove(id) {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    return error ? fail(error) : ok(true);
  },
};

export const payrollApi = {
  async listRuns() {
    const { data, error } = await supabase.from('payroll_runs').select('*').order('pay_date', { ascending: false });
    return error ? fail(error) : ok(data);
  },
  async getRun(id) {
    const [hdr, items] = await Promise.all([
      supabase.from('payroll_runs').select('*').eq('id', id).single(),
      supabase.from('payroll_items').select('*, employees(name, position)').eq('run_id', id),
    ]);
    if (hdr.error) return fail(hdr.error);
    return ok({ header: hdr.data, items: items.data || [] });
  },
  async createRun(row) {
    const { data, error } = await supabase.from('payroll_runs').insert(row).select().single();
    return error ? fail(error) : ok(data);
  },
  async addItem(row) {
    const { data, error } = await supabase.from('payroll_items').insert(row).select().single();
    return error ? fail(error) : ok(data);
  },
  async updateItem(id, row) {
    const { data, error } = await supabase.from('payroll_items').update(row).eq('id', id).select().single();
    return error ? fail(error) : ok(data);
  },
  async removeItem(id) {
    const { error } = await supabase.from('payroll_items').delete().eq('id', id);
    return error ? fail(error) : ok(true);
  },
  async post(id) {
    const { data, error } = await supabase.rpc('post_payroll_run', { p_run_id: id });
    return error ? fail(error) : ok(data);
  },
};

export const fixedAssetsApi = {
  async list() {
    const { data, error } = await supabase.from('fixed_assets').select('*').order('purchase_date', { ascending: false });
    return error ? fail(error) : ok(data);
  },
  async create(row) {
    const { data, error } = await supabase.from('fixed_assets').insert(row).select().single();
    return error ? fail(error) : ok(data);
  },
  async update(id, row) {
    const { data, error } = await supabase.from('fixed_assets').update(row).eq('id', id).select().single();
    return error ? fail(error) : ok(data);
  },
  async remove(id) {
    const { error } = await supabase.from('fixed_assets').delete().eq('id', id);
    return error ? fail(error) : ok(true);
  },
  async runDepreciation(month) {
    const { data, error } = await supabase.rpc('run_depreciation', { p_month: month });
    return error ? fail(error) : ok(data);
  },
};

export const bundlesApi = {
  async getComponents(bundleId) {
    const { data, error } = await supabase.from('bundle_items')
      .select('*, products!bundle_items_component_id_fkey(id,sku,name,selling_price)')
      .eq('bundle_id', bundleId);
    return error ? fail(error) : ok(data);
  },
  async setComponents(bundleId, components) {
    await supabase.from('bundle_items').delete().eq('bundle_id', bundleId);
    if (components.length) {
      const rows = components.map((c) => ({ bundle_id: bundleId, component_id: c.component_id, qty: c.qty }));
      const { error } = await supabase.from('bundle_items').insert(rows);
      if (error) return fail(error);
    }
    return ok(true);
  },
};

export const loyaltyApi = {
  async adjust(customer_id, kind, points, sale_id = null, notes = null) {
    const { data, error } = await supabase.rpc('loyalty_adjust', {
      p_customer_id: customer_id, p_kind: kind, p_points: points, p_sale_id: sale_id, p_notes: notes,
    });
    return error ? fail(error) : ok(data);
  },
  async history(customer_id) {
    const { data, error } = await supabase.from('loyalty_transactions').select('*').eq('customer_id', customer_id).order('created_at', { ascending: false });
    return error ? fail(error) : ok(data);
  },
};

export const customerBalanceApi = {
  async list() {
    const { data, error } = await supabase.from('v_customer_balance').select('*');
    return error ? fail(error) : ok(data);
  },
  async getForCustomer(customer_id) {
    const { data, error } = await supabase.from('v_customer_balance').select('*').eq('customer_id', customer_id).maybeSingle();
    return error ? fail(error) : ok(data);
  },
};

export const recurringEntriesApi = {
  async list() {
    const { data, error } = await supabase.from('recurring_entries').select('*').order('next_run_date');
    return error ? fail(error) : ok(data);
  },
  async create(row) {
    const { data, error } = await supabase.from('recurring_entries').insert(row).select().single();
    return error ? fail(error) : ok(data);
  },
  async update(id, row) {
    const { data, error } = await supabase.from('recurring_entries').update(row).eq('id', id).select().single();
    return error ? fail(error) : ok(data);
  },
  async remove(id) {
    const { error } = await supabase.from('recurring_entries').delete().eq('id', id);
    return error ? fail(error) : ok(true);
  },
  async runDue() {
    const { data, error } = await supabase.rpc('process_recurring_entries');
    return error ? fail(error) : ok(data);
  },
};
