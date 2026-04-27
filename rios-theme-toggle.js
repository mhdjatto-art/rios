/* RIOS theme toggle — professional hybrid persistence
   Priority:
   1) Supabase profile theme for logged-in users
   2) localStorage fallback
   3) system preference fallback
*/

(function () {
  'use strict';

  const KEY = 'rios.theme';
  const DEFAULT_THEME = 'light';
  const VALID_THEMES = ['light', 'dark'];

  function normalizeTheme(theme) {
    return VALID_THEMES.includes(theme) ? theme : null;
  }

  function getSystemTheme() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : DEFAULT_THEME;
  }

  function applyTheme(theme) {
    const safeTheme = normalizeTheme(theme) || DEFAULT_THEME;

    document.documentElement.setAttribute('data-theme', safeTheme);
    document.documentElement.classList.toggle('dark', safeTheme === 'dark');
  }

  function saveLocalTheme(theme) {
    const safeTheme = normalizeTheme(theme);
    if (!safeTheme) return;

    try {
      localStorage.setItem(KEY, safeTheme);
    } catch (e) {
      // Silently fail - local storage might be unavailable
    }
  }

  function loadLocalTheme() {
    try {
      return normalizeTheme(localStorage.getItem(KEY));
    } catch (e) {
      return null;
    }
  }

  async function getCurrentUser() {
    try {
      if (!window.supabase || !window.supabase.auth) return null;

      const { data, error } = await window.supabase.auth.getUser();
      if (error) return null;

      return data?.user || null;
    } catch (e) {
      return null;
    }
  }

  async function loadProfileTheme(userId) {
    try {
      if (!window.supabase || !userId) return null;

      const { data, error } = await window.supabase
        .from('profiles')
        .select('theme')
        .eq('id', userId)
        .single();

      if (error) {
        // Silently fail - could not load user theme
        return null;
      }

      return normalizeTheme(data?.theme);
    } catch (e) {
      // Silently fail - could not load profile theme
      return null;
    }
  }

  async function saveProfileTheme(userId, theme) {
    try {
      const safeTheme = normalizeTheme(theme);
      if (!window.supabase || !userId || !safeTheme) return;

      const { error } = await window.supabase
        .from('profiles')
        .update({ theme: safeTheme })
        .eq('id', userId);

      if (error) {
        // Silently fail - could not save profile theme
      }
    } catch (e) {
      // Silently fail - could not save profile theme
    }
  }

  async function setTheme(theme) {
    const safeTheme = normalizeTheme(theme) || DEFAULT_THEME;

    applyTheme(safeTheme);
    saveLocalTheme(safeTheme);

    const user = await getCurrentUser();
    if (user?.id) {
      await saveProfileTheme(user.id, safeTheme);
    }
  }

  async function toggleTheme() {
    const current =
      normalizeTheme(document.documentElement.getAttribute('data-theme')) ||
      loadLocalTheme() ||
      getSystemTheme();

    const nextTheme = current === 'dark' ? 'light' : 'dark';

    await setTheme(nextTheme);
  }

  async function init() {
    const user = await getCurrentUser();

    let theme = null;

    if (user?.id) {
      theme = await loadProfileTheme(user.id);
    }

    if (!theme) {
      theme = loadLocalTheme();
    }

    if (!theme) {
      theme = getSystemTheme();
    }

    applyTheme(theme);
    saveLocalTheme(theme);

    const btn = document.getElementById('rios-theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }

    window.RIOSTheme = {
      setTheme,
      toggleTheme,
      getTheme: function () {
        return document.documentElement.getAttribute('data-theme');
      }
    };
  }

  init();

})();
