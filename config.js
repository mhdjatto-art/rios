// frontend/config.js
function readEnv() {
  const env = window.__RIOS_ENV__ || {};
  const url = (env.SUPABASE_URL || '').trim();
  const anonKey = (env.SUPABASE_ANON_KEY || '').trim();
  const missing = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  if (missing.length) {
    const msg = 'Missing configuration: ' + missing.join(', ') +
      '. Copy frontend/env.example.js to frontend/env.js and fill in values.';
    document.body.innerHTML =
      '<div style="padding:2rem;font-family:system-ui;color:#b00020">' +
      '<h1>Configuration error</h1><p>' + msg + '</p></div>';
    throw new Error(msg);
  }
  return {
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: anonKey,
    APP_NAME: env.APP_NAME || 'RIOS',
    APP_VERSION: env.APP_VERSION || '2.0.0',
  };
}
export const CONFIG = readEnv();
