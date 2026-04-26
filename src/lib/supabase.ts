import { createClient, processLock } from '@supabase/supabase-js'

// processLock = serialização in-process (uma fila por nome de lock, dentro
// da aba). Evita race conditions internas do supabase-js (refresh de token
// concorrente, getSession durante recover, etc). Não usa Web Locks API
// (navigatorLock padrão) que pode travar entre abas. Não usa noopLock que
// abre brechas pra deadlocks circulares.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env and fill in your project credentials, then restart `pnpm dev`.',
  )
}

// Use safe placeholders when env is missing so createClient doesn't throw at boot.
// Auth/DB calls will still fail, but the app mounts and the login screen can warn the user.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
      lock: processLock,
    },
  },
)
