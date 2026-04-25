// frontend/theme.js  (Phase 21 — 25 themes)
import { supabase } from './api.js';

export const DEFAULT_THEME = {
  mode: 'light',
  primary: '#007aff',
  accent: '#34c759',
  danger: '#ff3b30',
  warning: '#ff9500',
  info: '#5ac8fa',
  bg: '#f2f2f7',
  surface: '#ffffff',
  surface2: '#f8f9fb',
  text: '#1d1d1f',
  muted: '#8e8e93',
  border: '#d2d2d7',
  font: 'sf',
  radius: 10,
  density: 'comfortable',
  shadow: 'soft',
  glass: false,
};

export const PRESETS = {
  mac_monterey: {
    ...DEFAULT_THEME, name: '🖥️ macOS Monterey',
    primary: '#007aff', accent: '#30d158', danger: '#ff3b30',
    bg: '#ecebeb', surface: '#ffffff', surface2: '#f5f5f7',
    text: '#1d1d1f', muted: '#8e8e93', border: '#d2d2d7',
    font: 'sf', radius: 10, shadow: 'soft', glass: true,
  },
  mac_bigsur: {
    ...DEFAULT_THEME, name: '🏔️ macOS Big Sur',
    primary: '#5e5ce6', accent: '#34c759', danger: '#ff453a',
    bg: '#f5e6e8', surface: '#fff9fa', surface2: '#f9eef0',
    text: '#000000', muted: '#636366', border: '#d1d1d6',
    font: 'sf', radius: 12, shadow: 'soft', glass: true,
  },
  mac_ventura: {
    ...DEFAULT_THEME, name: '🏜️ macOS Ventura',
    primary: '#af52de', accent: '#ff9500', danger: '#ff3b30',
    bg: '#fef9f2', surface: '#ffffff', surface2: '#fff3e6',
    text: '#1d1d1f', muted: '#86868b', border: '#e5d5c8',
    font: 'sf', radius: 12, shadow: 'pronounced', glass: true,
  },
  mac_sonoma_dark: {
    ...DEFAULT_THEME, name: '🌊 macOS Sonoma Dark',
    mode: 'dark',
    primary: '#0a84ff', accent: '#64d2ff', danger: '#ff453a', warning: '#ff9f0a',
    bg: '#1a1a2e', surface: '#252541', surface2: '#2e2e52',
    text: '#ffffff', muted: '#98989f', border: '#3a3a52',
    font: 'sf', radius: 12, shadow: 'pronounced', glass: true,
  },
  mac_tahoe: {
    ...DEFAULT_THEME, name: '🌅 macOS Tahoe',
    primary: '#bf5af2', accent: '#ff375f', danger: '#ff3b30',
    bg: '#faf0ff', surface: '#ffffff', surface2: '#f5e8fd',
    text: '#1d1d1f', muted: '#86868b', border: '#e2c7f2',
    font: 'sf', radius: 14, shadow: 'pronounced', glass: true,
  },
  ios_liquid: {
    ...DEFAULT_THEME, name: '💧 iOS Liquid',
    primary: '#32ade6', accent: '#30d158', danger: '#ff375f',
    bg: '#e0f2fe', surface: '#ffffff', surface2: '#ccebff',
    text: '#000000', muted: '#6e6e73', border: '#b0d9f5',
    font: 'sf', radius: 16, shadow: 'pronounced', glass: true,
  },
  ipad_glass: {
    ...DEFAULT_THEME, name: '🪟 iPad Glass',
    mode: 'dark',
    primary: '#64d2ff', accent: '#ff9f0a', danger: '#ff453a',
    bg: '#000000', surface: '#1c1c1e', surface2: '#2c2c2e',
    text: '#ffffff', muted: '#8e8e93', border: '#38383a',
    font: 'sf', radius: 14, shadow: 'pronounced', glass: true,
  },
  default: { ...DEFAULT_THEME, name: '⚪ Default', glass: false },
  dark_pro: {
    ...DEFAULT_THEME, name: '🌑 Dark Pro',
    mode: 'dark',
    primary: '#60a5fa', accent: '#34d399', danger: '#f87171',
    bg: '#0f172a', surface: '#1e293b', surface2: '#334155',
    text: '#f1f5f9', muted: '#94a3b8', border: '#475569',
    radius: 8, shadow: 'subtle', glass: false,
  },
  warm_cream: {
    ...DEFAULT_THEME, name: '🍦 Warm Cream',
    primary: '#c2410c', accent: '#0d9488', danger: '#be123c',
    bg: '#fef6e4', surface: '#fef3c7', surface2: '#fde68a',
    text: '#422006', muted: '#78716c', border: '#d6d3d1',
    font: 'amiri', radius: 6, shadow: 'subtle',
  },
  midnight: {
    ...DEFAULT_THEME, name: '🌌 Midnight',
    mode: 'dark',
    primary: '#a78bfa', accent: '#f472b6', danger: '#fb7185',
    bg: '#0c0a1a', surface: '#1e1b2e', surface2: '#2e2a47',
    text: '#e0e7ff', muted: '#a5b4fc', border: '#4338ca',
    font: 'inter', radius: 10, shadow: 'pronounced', glass: true,
  },
  sunset: {
    ...DEFAULT_THEME, name: '🌇 Sunset',
    primary: '#ea580c', accent: '#d97706', danger: '#b91c1c',
    bg: '#fff7ed', surface: '#ffedd5', surface2: '#fed7aa',
    text: '#431407', muted: '#78716c', border: '#fed7aa',
    radius: 10, shadow: 'pronounced',
  },
  forest: {
    ...DEFAULT_THEME, name: '🌲 Forest',
    primary: '#059669', accent: '#0891b2', danger: '#dc2626',
    bg: '#ffffff', surface: '#f0fdf4', surface2: '#dcfce7',
    text: '#064e3b', muted: '#6b7280', border: '#d1fae5',
    radius: 8, shadow: 'subtle',
  },
  ocean: {
    ...DEFAULT_THEME, name: '🌊 Ocean Breeze',
    primary: '#0891b2', accent: '#06b6d4', danger: '#ef4444',
    bg: '#ecfeff', surface: '#ffffff', surface2: '#cffafe',
    text: '#164e63', muted: '#64748b', border: '#a5f3fc',
    font: 'inter', radius: 14, shadow: 'soft', glass: true,
  },
  rose_gold: {
    ...DEFAULT_THEME, name: '🌹 Rose Gold',
    primary: '#be185d', accent: '#f59e0b', danger: '#dc2626',
    bg: '#fdf2f8', surface: '#ffffff', surface2: '#fce7f3',
    text: '#500724', muted: '#9f1239', border: '#fbcfe8',
    font: 'inter', radius: 16, shadow: 'pronounced', glass: true,
  },
  carbon: {
    ...DEFAULT_THEME, name: '⬛ Carbon',
    mode: 'dark',
    primary: '#10b981', accent: '#3b82f6', danger: '#ef4444', warning: '#f59e0b',
    bg: '#0a0a0a', surface: '#171717', surface2: '#262626',
    text: '#f5f5f5', muted: '#a3a3a3', border: '#404040',
    font: 'inter', radius: 6, shadow: 'subtle', glass: false,
  },
  neon: {
    ...DEFAULT_THEME, name: '💜 Cyber Neon',
    mode: 'dark',
    primary: '#d946ef', accent: '#22d3ee', danger: '#f43f5e', warning: '#fbbf24',
    bg: '#0f0a1e', surface: '#1a1430', surface2: '#2a1f48',
    text: '#e9d5ff', muted: '#a78bfa', border: '#6d28d9',
    font: 'inter', radius: 12, shadow: 'pronounced', glass: true,
  },
  paper: {
    ...DEFAULT_THEME, name: '📜 Paper',
    primary: '#374151', accent: '#6b7280', danger: '#991b1b',
    bg: '#faf7f2', surface: '#ffffff', surface2: '#f5f0e6',
    text: '#1f2937', muted: '#78716c', border: '#d6d3d1',
    font: 'amiri', radius: 4, shadow: 'subtle', glass: false,
  },
  royal: {
    ...DEFAULT_THEME, name: '👑 Royal',
    primary: '#6d28d9', accent: '#d97706', danger: '#dc2626',
    bg: '#faf5ff', surface: '#ffffff', surface2: '#f3e8ff',
    text: '#4c1d95', muted: '#7c3aed', border: '#e9d5ff',
    font: 'inter', radius: 12, shadow: 'pronounced', glass: true,
  },
  mint: {
    ...DEFAULT_THEME, name: '🍃 Mint Fresh',
    primary: '#14b8a6', accent: '#84cc16', danger: '#f43f5e',
    bg: '#f0fdfa', surface: '#ffffff', surface2: '#ccfbf1',
    text: '#134e4a', muted: '#6b7280', border: '#99f6e4',
    font: 'inter', radius: 10, shadow: 'soft', glass: true,
  },
  linear: {
    ...DEFAULT_THEME, name: '⚡ Linear',
    mode: 'dark',
    primary: '#5e6ad2', accent: '#7c8cff', danger: '#eb5757', warning: '#f2994a',
    bg: '#0a0a0a', surface: '#111112', surface2: '#18181b',
    text: '#f7f8f8', muted: '#8a8f98', border: '#23232a',
    font: 'inter', radius: 8, shadow: 'subtle', glass: false,
  },
  notion: {
    ...DEFAULT_THEME, name: '📝 Notion',
    primary: '#2eaadc', accent: '#0f7b0f', danger: '#e03e3e', warning: '#d9730d',
    bg: '#ffffff', surface: '#fbfbfa', surface2: '#f7f6f3',
    text: '#37352f', muted: '#9b9a97', border: '#e8e8e6',
    font: 'inter', radius: 6, shadow: 'subtle', glass: false,
  },
  stripe: {
    ...DEFAULT_THEME, name: '💳 Stripe',
    primary: '#635bff', accent: '#00d4ff', danger: '#df1b41', warning: '#ffd900',
    bg: '#f6f9fc', surface: '#ffffff', surface2: '#e3e8ee',
    text: '#0a2540', muted: '#425466', border: '#e6ebf1',
    font: 'inter', radius: 10, shadow: 'pronounced', glass: false,
  },
  vercel: {
    ...DEFAULT_THEME, name: '▲ Vercel',
    mode: 'dark',
    primary: '#ffffff', accent: '#0070f3', danger: '#ee0000', warning: '#f5a623',
    bg: '#000000', surface: '#0a0a0a', surface2: '#111111',
    text: '#ededed', muted: '#888888', border: '#222222',
    font: 'inter', radius: 8, shadow: 'subtle', glass: false,
  },
  shopify: {
    ...DEFAULT_THEME, name: '🛍️ Shopify',
    primary: '#008060', accent: '#004c3f', danger: '#d72c0d', warning: '#916a00',
    bg: '#f6f6f7', surface: '#ffffff', surface2: '#f1f1f1',
    text: '#202223', muted: '#6d7175', border: '#e1e3e5',
    font: 'inter', radius: 8, shadow: 'soft', glass: false,
  },
};

const FONT_FAMILIES = {
  sf: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif, "SF Arabic", "Geeza Pro"',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Noto Sans Arabic"',
  inter: 'Inter, -apple-system, sans-serif',
  cairo: '"Cairo", "SF Arabic", Tahoma, sans-serif',
  tajawal: '"Tajawal", "SF Arabic", Tahoma, sans-serif',
  amiri: '"Amiri", "Geeza Pro", "Segoe UI", serif',
};
const DENSITY_SPACING = {
  compact: { pad: '6px', gap: '6px', fontSize: '13px' },
  comfortable: { pad: '10px', gap: '10px', fontSize: '14px' },
  spacious: { pad: '16px', gap: '16px', fontSize: '15px' },
};
const SHADOW_STYLES = {
  none: 'none',
  subtle: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
  soft: '0 4px 6px -1px rgba(0,0,0,.06), 0 2px 4px -1px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.04)',
  pronounced: '0 20px 40px -8px rgba(0,0,0,.12), 0 8px 16px -4px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04)',
};
const GOOGLE_FONTS = {
  cairo: 'Cairo:wght@400;600;700',
  tajawal: 'Tajawal:wght@400;500;700',
  amiri: 'Amiri:wght@400;700',
  inter: 'Inter:wght@400;500;600;700',
};

export function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  const root = document.documentElement;

  root.dataset.theme = t.mode;
  if (t.mode === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  if (t.glass) root.classList.add('glass'); else root.classList.remove('glass');
  root.dataset.glass = t.glass ? 'true' : 'false';

  root.style.setProperty('--rios-primary', t.primary);
  root.style.setProperty('--rios-accent', t.accent);
  root.style.setProperty('--rios-danger', t.danger);
  root.style.setProperty('--rios-warning', t.warning);
  root.style.setProperty('--rios-info', t.info);
  root.style.setProperty('--rios-bg', t.bg);
  root.style.setProperty('--rios-surface', t.surface);
  root.style.setProperty('--rios-surface2', t.surface2);
  root.style.setProperty('--rios-text', t.text);
  root.style.setProperty('--rios-muted', t.muted);
  root.style.setProperty('--rios-border', t.border);
  root.style.setProperty('--rios-surface-rgb', hexToRgb(t.surface));
  root.style.setProperty('--rios-primary-rgb', hexToRgb(t.primary));

  const fontVar = FONT_FAMILIES[t.font] || FONT_FAMILIES.sf;
  root.style.setProperty('--rios-font', fontVar);
  root.style.setProperty('--rios-radius', t.radius + 'px');

  const den = DENSITY_SPACING[t.density] || DENSITY_SPACING.comfortable;
  root.style.setProperty('--rios-pad', den.pad);
  root.style.setProperty('--rios-gap', den.gap);
  root.style.setProperty('--rios-fs', den.fontSize);

  root.style.setProperty('--rios-shadow', SHADOW_STYLES[t.shadow] || SHADOW_STYLES.soft);

  if (GOOGLE_FONTS[t.font] && !document.querySelector(`link[data-font="${t.font}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.font = t.font;
    link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[t.font]}&display=swap`;
    document.head.appendChild(link);
  }
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '255, 255, 255';
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

export async function loadPreferences() {
  const { data, error } = await supabase.rpc('get_my_preferences');
  if (error) return {};
  return data || {};
}

export async function savePreferences(prefs) {
  const { data, error } = await supabase.rpc('save_my_preferences', { p_prefs: prefs });
  if (error) return { error };
  try { localStorage.setItem('rios.prefs', JSON.stringify(data)); } catch {}
  return { data };
}

export function cachedPrefs() {
  try { return JSON.parse(localStorage.getItem('rios.prefs') || '{}'); } catch { return {}; }
}

export function themeFromPrefs(prefs) {
  return { ...DEFAULT_THEME, ...(prefs?.theme || {}) };
}
