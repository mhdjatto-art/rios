// Master Admin Console - Logic
(function () {
  const ENV = window.__RIOS_ENV__ || {};
  const SUPABASE_URL = ENV.SUPABASE_URL || window.SUPABASE_URL;
  const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
  const LOGIN_URL = '/';
  const STORAGE_KEYS = ['rios.auth', 'sb-dschyoxkcazxvzppbvxm-auth-token', 'supabase.auth.token'];

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    document.addEventListener('DOMContentLoaded', () => {
      alert('إعدادات Supabase غير محملة. تحقق من env.js');
    });
    return;
  }

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true }
  });

  let me = null;
  let companiesCache = [];

  function toast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) { console.log('toast:', msg); return; }
    el.textContent = msg;
    el.style.borderColor = type === 'error' ? '#d9534f' : (type === 'success' ? '#28a745' : '#2a3160');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3500);
  }
  function openModal(id) { document.getElementById(id).classList.add('show'); }
  function closeModal(id) { document.getElementById(id).classList.remove('show'); }
  window.closeModal = closeModal;

  function badge(status) {
    const m = { active: 'b-active', suspended: 'b-suspended', trial: 'b-trial' };
    const labels = { active: 'نشط', suspended: 'معلّق', trial: 'تجريبي' };
    const cls = m[status] || 'b-trial';
    return '<span class="badge ' + cls + '">' + (labels[status] || status || '-') + '</span>';
  }
  function fmtDate(d) {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('ar-SA'); } catch (e) { return d; }
  }

  function readStoredSession() {
    try {
      // Try all known storage keys
      for (const key of STORAGE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.access_token && parsed.user) return parsed;
        if (parsed && parsed.currentSession && parsed.currentSession.access_token) return parsed.currentSession;
      }
    } catch (e) {}
    return null;
  }

  async function ensureMasterAdmin() {
    let session = null;
    try {
      const r = await sb.auth.getSession();
      session = r.data && r.data.session ? r.data.session : null;
    } catch (e) {}
    if (!session) session = readStoredSession();

    if (!session || !session.user) {
      window.location.href = LOGIN_URL;
      return false;
    }
    me = session.user;
    const meBox = document.getElementById('meEmail');
    if (meBox) meBox.textContent = me.email || me.id;

    const profRes = await sb.from('profiles').select('role, is_active').eq('id', me.id).maybeSingle();
    if (profRes.error) { toast('تعذر التحقق من الصلاحية: ' + profRes.error.message, 'error'); return false; }
    const prof = profRes.data;
    if (!prof || prof.role !== 'master_admin' || prof.is_active === false) {
      toast('غير مصرّح بالدخول إلى لوحة المسؤول الرئيسي', 'error');
      return false;
    }
    return true;
  }

  function switchSection(name) {
    document.querySelectorAll('.section').forEach(function(s){ s.classList.remove('active'); });
    const target = document.getElementById('sec-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('.sidebar a').forEach(function(a){ a.classList.remove('active'); });
    const link = document.querySelector('.sidebar a[data-sec="' + name + '"]');
    if (link) link.classList.add('active');
    if (name === 'dashboard') loadStats();
    if (name === 'companies') loadCompanies();
    if (name === 'audit') loadAudit();
  }

  async function loadStats() {
    const box = document.getElementById('statsBox');
    if (!box) return;
    box.innerHTML = '<div class="stat"><div class="v">...</div><div class="l">جاري التحميل</div></div>';
    const res = await sb.rpc('master_get_stats');
    if (res.error) {
      box.innerHTML = '<div class="stat"><div class="v">!</div><div class="l">' + res.error.message + '</div></div>';
      return;
    }
    const s = res.data || {};
    const items = [
      ['إجمالي الشركات', s.total_companies || 0],
      ['الشركات النشطة', s.active_companies || 0],
      ['المعلّقة', s.suspended_companies || 0],
      ['التجريبية', s.trial_companies || 0],
      ['إجمالي المستخدمين', s.total_users || 0],
      ['إجمالي الفروع', s.total_branches || 0]
    ];
    box.innerHTML = items.map(function(p){ return '<div class="stat"><div class="v">' + p[1] + '</div><div class="l">' + p[0] + '</div></div>'; }).join('');
  }

  async function loadCompanies() {
    const tbody = document.querySelector('#coTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="muted">جاري التحميل...</td></tr>';
    const res = await sb.from('companies').select('*').order('created_at', { ascending: false });
    if (res.error) { tbody.innerHTML = '<tr><td colspan="8" class="muted">خطأ: ' + res.error.message + '</td></tr>'; return; }
    companiesCache = res.data || [];
    renderCompanies();
  }

  function renderCompanies() {
    const tbody = document.querySelector('#coTable tbody');
    if (!tbody) return;
    const q = (document.getElementById('searchCo').value || '').toLowerCase();
    const fs = document.getElementById('filterStatus').value;
    const filtered = companiesCache.filter(function(c){
      if (fs && c.status !== fs) return false;
      if (q) {
        const blob = ((c.name || '') + ' ' + (c.contact_email || '') + ' ' + (c.contact_phone || '')).toLowerCase();
        if (blob.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="8" class="muted">لا توجد شركات</td></tr>'; return; }
    tbody.innerHTML = filtered.map(function(c){
      const plan = c.plan || c.subscription_plan || '-';
      const maxUsers = c.max_users != null ? c.max_users : (c.user_limit || 0);
      const maxBranches = c.max_branches != null ? c.max_branches : (c.branch_limit || 0);
      const owner = c.contact_email || c.owner_email || '-';
      const actBtn = c.status === 'active'
        ? '<button class="btn btn-warn" data-act="suspend" data-id="' + c.id + '">تعليق</button>'
        : '<button class="btn btn-ok" data-act="activate" data-id="' + c.id + '">تفعيل</button>';
      const actions = actBtn
        + '<button class="btn btn-sec" data-act="edit" data-id="' + c.id + '">تعديل</button>'
        + '<button class="btn btn-sec" data-act="reset" data-id="' + c.id + '">كلمة المرور</button>'
        + '<button class="btn btn-danger" data-act="delete" data-id="' + c.id + '">حذف</button>';
      return '<tr>'
        + '<td>' + (c.name || '-') + '</td>'
        + '<td>' + owner + '</td>'
        + '<td>' + badge(c.status) + '</td>'
        + '<td>' + plan + '</td>'
        + '<td>' + maxUsers + '</td>'
        + '<td>' + maxBranches + '</td>'
        + '<td>' + fmtDate(c.created_at) + '</td>'
        + '<td>' + actions + '</td>'
        + '</tr>';
    }).join('');
  }
  async function createCompany() {
    const payload = {
      p_name: document.getElementById('cName').value.trim(),
      p_owner_user_id: document.getElementById('cOwnerId').value.trim() || null,
      p_owner_name: document.getElementById('cOwnerName').value.trim() || null,
      p_contact_email: document.getElementById('cEmail').value.trim() || null,
      p_contact_phone: document.getElementById('cPhone').value.trim() || null,
      p_plan: document.getElementById('cPlan').value,
      p_max_users: parseInt(document.getElementById('cMaxUsers').value) || 5,
      p_max_branches: parseInt(document.getElementById('cMaxBranches').value) || 1
    };
    if (!payload.p_name) return toast('اسم الشركة مطلوب', 'error');
    if (!payload.p_owner_user_id) return toast('UUID المالك مطلوب', 'error');
    const res = await sb.rpc('master_create_company', payload);
    if (res.error) return toast('فشل الإنشاء: ' + res.error.message, 'error');
    toast('تم إنشاء الشركة بنجاح', 'success');
    ['cName', 'cEmail', 'cPhone', 'cOwnerId', 'cOwnerName'].forEach(function(id){ document.getElementById(id).value = ''; });
    switchSection('companies');
  }

  async function setStatus(id, status) {
    if (!confirm('هل أنت متأكد من تغيير حالة الشركة إلى ' + status + '؟')) return;
    const res = await sb.rpc('master_set_company_status', { p_company_id: id, p_status: status });
    if (res.error) return toast('خطأ: ' + res.error.message, 'error');
    toast('تم التحديث', 'success');
    loadCompanies();
  }

  function openEditSubscription(id) {
    const c = companiesCache.find(function(x){ return x.id === id; });
    if (!c) return;
    document.getElementById('eId').value = c.id;
    document.getElementById('ePlan').value = c.plan || c.subscription_plan || 'trial';
    document.getElementById('eMaxUsers').value = c.max_users || 5;
    document.getElementById('eMaxBranches').value = c.max_branches || 1;
    document.getElementById('eExpires').value = '';
    openModal('editModal');
  }

  async function saveSubscription() {
    const id = document.getElementById('eId').value;
    const expiresVal = document.getElementById('eExpires').value;
    const payload = {
      p_company_id: id,
      p_plan: document.getElementById('ePlan').value,
      p_max_users: parseInt(document.getElementById('eMaxUsers').value) || 5,
      p_max_branches: parseInt(document.getElementById('eMaxBranches').value) || 1,
      p_subscription_expires_at: expiresVal ? new Date(expiresVal).toISOString() : null
    };
    const res = await sb.rpc('master_update_subscription', payload);
    if (res.error) return toast('خطأ: ' + res.error.message, 'error');
    closeModal('editModal');
    toast('تم تحديث الاشتراك', 'success');
    loadCompanies();
  }
  window.saveSubscription = saveSubscription;

  async function deleteCompany(id) {
    const c = companiesCache.find(function(x){ return x.id === id; });
    const name = c ? c.name : id;
    const phrase = prompt('تحذير! هذا سيحذف الشركة "' + name + '" وكل بياناتها نهائياً. اكتب اسم الشركة بالضبط للتأكيد:');
    if (phrase !== name) return toast('تم الإلغاء', 'error');
    const res = await sb.rpc('master_delete_company', { p_company_id: id });
    if (res.error) return toast('فشل الحذف: ' + res.error.message, 'error');
    toast('تم حذف الشركة', 'success');
    loadCompanies();
  }

  function resetPasswordInfo(id) {
    const c = companiesCache.find(function(x){ return x.id === id; });
    const email = c && c.contact_email ? c.contact_email : '';
    alert('لإعادة تعيين كلمة المرور، يجب استخدام Supabase Dashboard > Authentication > Users. بريد المالك: ' + (email || 'غير محدد'));
  }

  async function loadAudit() {
    const tbody = document.querySelector('#auditTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="muted">جاري التحميل...</td></tr>';
    const res = await sb.from('master_audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    if (res.error) { tbody.innerHTML = '<tr><td colspan="5" class="muted">' + res.error.message + '</td></tr>'; return; }
    const data = res.data;
    if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="5" class="muted">لا توجد سجلات</td></tr>'; return; }
    tbody.innerHTML = data.map(function(r){ return '<tr>'
      + '<td>' + fmtDate(r.created_at) + '</td>'
      + '<td>' + (r.actor_email || r.actor_id || '-') + '</td>'
      + '<td>' + (r.action || '-') + '</td>'
      + '<td>' + (r.entity_type || '-') + ' ' + (r.entity_id || '') + '</td>'
      + '<td><code style="font-size:11px;">' + (r.details ? JSON.stringify(r.details).slice(0, 120) : '-') + '</code></td>'
      + '</tr>'; }).join('');
  }
  async function init() {
    const ok = await ensureMasterAdmin();
    if (!ok) return;
    document.querySelectorAll('.sidebar a').forEach(function(a){
      a.addEventListener('click', function(e){ e.preventDefault(); switchSection(a.dataset.sec); });
    });
    const logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', async function(e){
      e.preventDefault();
      e.stopPropagation();
      logout.textContent = '...';
      logout.style.pointerEvents = 'none';
      try { await sb.auth.signOut({ scope: 'local' }); } catch (err) { console.warn('signOut:', err); }
      // Clear ALL possible session storage keys
      STORAGE_KEYS.forEach(function(k) {
        try { localStorage.removeItem(k); } catch (_) {}
        try { sessionStorage.removeItem(k); } catch (_) {}
      });
      // Clear all sb-* keys from localStorage
      Object.keys(localStorage).forEach(function(k) {
        if (k.startsWith('sb-') || k.startsWith('supabase') || k.startsWith('rios')) {
          try { localStorage.removeItem(k); } catch (_) {}
        }
      });
      // Use replace so back button won't return to master panel
      window.location.replace(LOGIN_URL);
    });
    const sc = document.getElementById('searchCo');
    if (sc) sc.addEventListener('input', renderCompanies);
    const fs = document.getElementById('filterStatus');
    if (fs) fs.addEventListener('change', renderCompanies);
    const tbl = document.querySelector('#coTable');
    if (tbl) tbl.addEventListener('click', function(e){
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === 'suspend') setStatus(id, 'suspended');
      else if (act === 'activate') setStatus(id, 'active');
      else if (act === 'edit') openEditSubscription(id);
      else if (act === 'delete') deleteCompany(id);
      else if (act === 'reset') resetPasswordInfo(id);
    });
    loadStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.loadCompanies = loadCompanies;
  window.createCompany = createCompany;
})();
