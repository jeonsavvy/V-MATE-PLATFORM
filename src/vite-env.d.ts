/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_PUBLIC_SUPABASE_URL?: string
  readonly VITE_PUBLIC_SUPABASE_ANON_KEY?: string
  readonly VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_CHAT_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __V_MATE_RUNTIME_ENV__?: {
    VITE_SUPABASE_URL?: string
    VITE_SUPABASE_ANON_KEY?: string
    VITE_SUPABASE_PUBLISHABLE_KEY?: string
    VITE_PUBLIC_SUPABASE_URL?: string
    VITE_PUBLIC_SUPABASE_ANON_KEY?: string
    VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
    VITE_CHAT_API_BASE_URL?: string
  }
}
