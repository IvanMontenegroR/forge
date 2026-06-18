import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// La URL y la anon key son públicas por diseño: la protección real
// es Row Level Security en Supabase. La API key de Claude vive solo
// en la Edge Function.
export const supabaseConfigured = Boolean(url && anonKey && !url.includes('TU-PROYECTO'))

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export const COACH_FUNCTION = import.meta.env.VITE_COACH_FUNCTION || 'coach'
