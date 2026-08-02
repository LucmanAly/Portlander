/**
 * Minimal Supabase Database typing for Portlander tables.
 * Keep in sync with supabase/schema.sql.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      holdings: {
        Row: {
          id: string
          user_id: string
          ticker: string
          name: string | null
          shares: number | string
          cost_basis: number | string | null
          last_price: number | string | null
          weight_override_pct: number | string | null
          tags: string[] | null
          notes: string | null
          source: string
          day_change_value: number | string | null
          day_change_pct: number | string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ticker: string
          name?: string | null
          shares: number
          cost_basis?: number | null
          last_price?: number | null
          weight_override_pct?: number | null
          tags?: string[] | null
          notes?: string | null
          source?: string
          day_change_value?: number | null
          day_change_pct?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ticker?: string
          name?: string | null
          shares?: number
          cost_basis?: number | null
          last_price?: number | null
          weight_override_pct?: number | null
          tags?: string[] | null
          notes?: string | null
          source?: string
          day_change_value?: number | null
          day_change_pct?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          id: string
          user_id: string
          ticker: string
          name: string | null
          notes: string | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ticker: string
          name?: string | null
          notes?: string | null
          tags?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ticker?: string
          name?: string | null
          notes?: string | null
          tags?: string[] | null
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          user_id: string | null
          ticker: string | null
          title: string
          event_type: string
          event_date: string
          event_time: string | null
          timing: string
          status: string
          source: string | null
          description: string | null
          raw: Json | null
          created_at: string
          updated_at: string
          eps_estimate: number | string | null
          eps_actual: number | string | null
          revenue_estimate: number | string | null
          revenue_actual: number | string | null
          ai_interpretation: Json | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          ticker?: string | null
          title: string
          event_type: string
          event_date: string
          event_time?: string | null
          timing?: string
          status?: string
          source?: string | null
          description?: string | null
          raw?: Json | null
          created_at?: string
          updated_at?: string
          eps_estimate?: number | null
          eps_actual?: number | null
          revenue_estimate?: number | null
          revenue_actual?: number | null
          ai_interpretation?: Json | null
        }
        Update: {
          id?: string
          user_id?: string | null
          ticker?: string | null
          title?: string
          event_type?: string
          event_date?: string
          event_time?: string | null
          timing?: string
          status?: string
          source?: string | null
          description?: string | null
          raw?: Json | null
          created_at?: string
          updated_at?: string
          eps_estimate?: number | null
          eps_actual?: number | null
          revenue_estimate?: number | null
          revenue_actual?: number | null
          ai_interpretation?: Json | null
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          id: string
          started_at: string
          finished_at: string | null
          status: string
          provider: string | null
          tickers_count: number | null
          events_upserted: number | null
          error: string | null
        }
        Insert: {
          id?: string
          started_at?: string
          finished_at?: string | null
          status?: string
          provider?: string | null
          tickers_count?: number | null
          events_upserted?: number | null
          error?: string | null
        }
        Update: {
          id?: string
          started_at?: string
          finished_at?: string | null
          status?: string
          provider?: string | null
          tickers_count?: number | null
          events_upserted?: number | null
          error?: string | null
        }
        Relationships: []
      }
      snaptrade_connections: {
        Row: {
          id: string
          user_id: string
          brokerage_name: string
          authorization_id: string
          connected_at: string
        }
        Insert: {
          id?: string
          user_id: string
          brokerage_name: string
          authorization_id: string
          connected_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          brokerage_name?: string
          authorization_id?: string
          connected_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type HoldingRow = Database['public']['Tables']['holdings']['Row']
export type WatchlistRow = Database['public']['Tables']['watchlist']['Row']
export type EventRow = Database['public']['Tables']['events']['Row']
export type SnaptradeConnectionRow = Database['public']['Tables']['snaptrade_connections']['Row']
