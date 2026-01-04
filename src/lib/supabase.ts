import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const isSecretKey = (key: string): boolean => {
  try {
    const payload = JSON.parse(atob(key.split('.')[1]))
    return payload.role === 'service_role'
  } catch {
    return key.length > 200 || key.includes('service')
  }
}

if (supabaseAnonKey && isSecretKey(supabaseAnonKey)) {
  console.error('[V-MATE] ERROR: Service role key detected! Use anon public key instead.')
  console.error('[V-MATE] Service role keys cannot be used in browser for security reasons.')
  console.error('[V-MATE] Please set VITE_SUPABASE_ANON_KEY to the anon public key from Supabase dashboard.')
}

export const supabase = supabaseUrl && supabaseAnonKey && !isSecretKey(supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== 'https://placeholder.supabase.co' && 
    supabaseAnonKey !== 'placeholder-key' &&
    !isSecretKey(supabaseAnonKey))
}

