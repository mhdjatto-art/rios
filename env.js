// RIOS — Runtime Environment Configuration
// NOTE: The SUPABASE_ANON_KEY is a PUBLIC key (safe to expose in frontend)
// It is restricted by Row Level Security (RLS) policies in the database.
// The real secret (service_role key) is NEVER included here.
window.__RIOS_ENV__ = {
  SUPABASE_URL:      "https://dschyoxkcazxvzppbvxm.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzY2h5b3hrY2F6eHZ6cHBidnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mzc2MzEsImV4cCI6MjA5MjAxMzYzMX0.DZA-gZGdNf03xOENlnP9sLQRUhesNZrEiURcf3CrHvU",
  APP_NAME:    "RIOS",
  APP_VERSION: "2.0.0",
};
