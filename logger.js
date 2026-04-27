// frontend/logger.js
// Centralized error/warning logger.
// - In development (localhost), prints to console with structured payload.
// - In production, the payload is built and returned so you can later wire it
//   to Sentry / Supabase error_logs / a monitoring endpoint without changing
//   call sites.
// Never throws. Never silently swallows real errors.

function isDev() {
  try {
    if (typeof location === 'undefined' || !location.hostname) return false;
    const h = location.hostname;
    return h === 'localhost' || h.includes('127.0.0.1');
  } catch (_) {
    return false;
  }
}

export function logError(error, context = {}) {
  try {
    const payload = {
      level: 'error',
      message: error?.message || String(error),
      stack: error?.stack || null,
      context,
      time: new Date().toISOString(),
    };
    if (isDev()) {
      // eslint-disable-next-line no-console
      console.error('[RIOS ERROR]', payload);
    }
    // Future production hook:
    // send to Sentry / Supabase error_logs / monitoring endpoint
    return payload;
  } catch (_) {
    return null;
  }
}

export function logWarning(message, context = {}) {
  try {
    const payload = {
      level: 'warning',
      message,
      context,
      time: new Date().toISOString(),
    };
    if (isDev()) {
      // eslint-disable-next-line no-console
      console.warn('[RIOS WARNING]', payload);
    }
    return payload;
  } catch (_) {
    return null;
  }
}
