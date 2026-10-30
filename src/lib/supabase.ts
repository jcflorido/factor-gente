import { createClient } from '@supabase/supabase-js';

// Valores públicos del proyecto (la anon key está hecha para ir dentro de la app; la seguridad la da RLS).
// Sirven de respaldo si el hosting no tiene configuradas las variables de entorno.
const DEFAULT_URL = 'https://aytixgebriffxplfjtpk.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5dGl4Z2VicmlmZnhwbGZqdHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzODE2OTIsImV4cCI6MjEwODk1NzY5Mn0.nXKX1beLbUnqIUvIYpy4rJHJE7r53ZeGwSXOCeiY8dE';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_ANON_KEY;

export const isConfigured = Boolean(url && key && !url.includes('TU-PROYECTO'));

export const supabase = createClient(url, key || 'falta-la-llave', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
