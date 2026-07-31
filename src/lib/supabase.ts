import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

/** True when both Vite env vars are non-empty. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

let client: SupabaseClient<Database> | null = null

/**
 * Returns a singleton Supabase browser client, or null when env is missing.
 * Never throws — local mode must keep working.
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export type DataBackend = 'local' | 'supabase'

/** Effective write backend: supabase only when configured AND user is signed in. */
export function resolveBackend(hasSession: boolean): DataBackend {
  if (isSupabaseConfigured() && hasSession) return 'supabase'
  return 'local'
}

export function supabaseConfigSummary(): {
  configured: boolean
  urlHost: string | null
} {
  if (!isSupabaseConfigured()) {
    return { configured: false, urlHost: null }
  }
  try {
    return { configured: true, urlHost: new URL(url).host }
  } catch {
    return { configured: true, urlHost: '(invalid URL)' }
  }
}
