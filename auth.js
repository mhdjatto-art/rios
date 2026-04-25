// frontend/auth.js
import { authApi } from './api.js';

const state = { session: null, profile: null, ready: false, _listeners: new Set() };

function emit() { for (const fn of state._listeners) try { fn(getSnapshot()); } catch (e) { console.error(e); } }
function getSnapshot() {
  return {
    session: state.session, profile: state.profile, user: state.session?.user || null, ready: state.ready,
    isAuthenticated: !!state.session,
    role: state.profile?.role || null,
    isAdmin: state.profile?.role === 'admin',
    isManagerOrAdmin: state.profile?.role === 'admin' || state.profile?.role === 'manager',
    isViewer: state.profile?.role === 'viewer',
    isMasterAdmin: state.profile?.role === 'master_admin',
  };
}

// Redirect master_admin to /master panel automatically
function redirectIfMasterAdmin() {
  if (state.profile?.role === 'master_admin') {
    const isMasterPage = window.location.pathname.startsWith('/master') ||
                         window.location.pathname.endsWith('master.html');
    if (!isMasterPage) {
      window.location.href = '/master';
    }
  }
}

function refreshPerms() {
  import('./permissions.js').then((m) => m.refreshPermissionsCache?.()).catch(() => {});
}

async function loadProfile() {
  if (!state.session) { state.profile = null; refreshPerms(); return; }
  const { data, error } = await authApi.getProfile(state.session.user.id);
  if (error) { console.error('profile:', error); state.profile = null; refreshPerms(); return; }
  state.profile = data;
  refreshPerms();
}

export const auth = {
  subscribe(fn) { state._listeners.add(fn); fn(getSnapshot()); return () => state._listeners.delete(fn); },
  get state() { return getSnapshot(); },
  async init() {
    const { data } = await authApi.getSession();
    state.session = data || null;
    await loadProfile();
    state.ready = true;
    emit();
    redirectIfMasterAdmin();
    authApi.onChange(async (s) => { state.session = s || null; await loadProfile(); redirectIfMasterAdmin(); emit(); });
  },
  async signIn(email, password) {
    const { data, error } = await authApi.signIn(email, password);
    if (error) return { error };
    state.session = data.session;
    await loadProfile();
    redirectIfMasterAdmin();
    emit();
    return { error: null };
  },
  async signOut() { await authApi.signOut(); state.session = null; state.profile = null; emit(); },
};
