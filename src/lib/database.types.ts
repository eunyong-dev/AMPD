export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          active_campaigns: number | null
          active_games: number | null
          adjust_account_id: number | null
          assigned_user_id: string
          bill_to_address: string | null
          bill_to_due_days: number
          bill_to_email: string | null
          bill_to_name: string | null
          company: string
          country: string
          created_at: string | null
          id: string
          invoice_email_cc: string | null
          invoice_email_to: string | null
          total_campaigns: number | null
          updated_at: string | null
        }
        Insert: {
          active_campaigns?: number | null
          active_games?: number | null
          adjust_account_id?: number | null
          assigned_user_id: string
          bill_to_address?: string | null
          bill_to_due_days?: number
          bill_to_email?: string | null
          bill_to_name?: string | null
          company: string
          country: string
          created_at?: string | null
          id?: string
          invoice_email_cc?: string | null
          invoice_email_to?: string | null
          total_campaigns?: number | null
          updated_at?: string | null
        }
        Update: {
          active_campaigns?: number | null
          active_games?: number | null
          adjust_account_id?: number | null
          assigned_user_id?: string
          bill_to_address?: string | null
          bill_to_due_days?: number
          bill_to_email?: string | null
          bill_to_name?: string | null
          company?: string
          country?: string
          created_at?: string | null
          id?: string
          invoice_email_cc?: string | null
          invoice_email_to?: string | null
          total_campaigns?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_id: string
          adjust_ad_revenue_sources: string | null
          campaign_type: string
          created_at: string | null
          created_by: string | null
          daily_report_url: string | null
          description: string | null
          end_date: string | null
          game_id: string | null
          id: string
          jira_url: string | null
          mmp: string
          name: string
          region: string
          regional_game_name: string | null
          start_date: string
          status: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          adjust_ad_revenue_sources?: string | null
          campaign_type: string
          created_at?: string | null
          created_by?: string | null
          daily_report_url?: string | null
          description?: string | null
          end_date?: string | null
          game_id?: string | null
          id?: string
          jira_url?: string | null
          mmp: string
          name: string
          region: string
          regional_game_name?: string | null
          start_date: string
          status: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          adjust_ad_revenue_sources?: string | null
          campaign_type?: string
          created_at?: string | null
          created_by?: string | null
          daily_report_url?: string | null
          description?: string | null
          end_date?: string | null
          game_id?: string | null
          id?: string
          jira_url?: string | null
          mmp?: string
          name?: string
          region?: string
          regional_game_name?: string | null
          start_date?: string
          status?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      company_info: {
        Row: {
          address: string
          bank_account_number: string
          bank_address: string
          bank_name: string
          bank_swift_code: string
          beneficiary_address: string
          beneficiary_name: string
          email: string
          id: number
          name: string
          payment_method: string
          stamp_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          bank_account_number?: string
          bank_address?: string
          bank_name?: string
          bank_swift_code?: string
          beneficiary_address?: string
          beneficiary_name?: string
          email?: string
          id?: number
          name?: string
          payment_method?: string
          stamp_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          bank_account_number?: string
          bank_address?: string
          bank_name?: string
          bank_swift_code?: string
          beneficiary_address?: string
          beneficiary_name?: string
          email?: string
          id?: number
          name?: string
          payment_method?: string
          stamp_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          account_id: string
          created_at: string | null
          game_name: string
          id: string
          logo_url: string | null
          package_identifier: string | null
          platform: string
          store_url: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          game_name: string
          id?: string
          logo_url?: string | null
          package_identifier?: string | null
          platform: string
          store_url?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          game_name?: string
          id?: string
          logo_url?: string | null
          package_identifier?: string | null
          platform?: string
          store_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_email_templates: {
        Row: {
          id: string
          name: string
          subject: string
          body: string
          scope: 'personal' | 'shared'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          subject: string
          body: string
          scope: 'personal' | 'shared'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          subject?: string
          body?: string
          scope?: 'personal' | 'shared'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_send_history: {
        Row: {
          id: string
          invoice_id: string
          sent_at: string
          sent_to: string
          sent_cc: string | null
          sent_subject: string
          sent_by: string | null
          sent_by_email: string | null
          sent_message_id: string | null
          attachments_summary: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          sent_at?: string
          sent_to: string
          sent_cc?: string | null
          sent_subject: string
          sent_by?: string | null
          sent_by_email?: string | null
          sent_message_id?: string | null
          attachments_summary?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          sent_at?: string
          sent_to?: string
          sent_cc?: string | null
          sent_subject?: string
          sent_by?: string | null
          sent_by_email?: string | null
          sent_message_id?: string | null
          attachments_summary?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_send_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bill_to_address: string | null
          bill_to_email: string | null
          bill_to_name: string | null
          created_at: string
          created_by: string | null
          daily_seq: number
          due_date: string
          from_email: string | null
          id: string
          invoice_date: string
          invoice_no: string
          manager_no: string
          sent_at: string | null
          sent_by: string | null
          sent_cc: string | null
          sent_message_id: string | null
          sent_subject: string | null
          sent_to: string | null
          settlement_id: string
        }
        Insert: {
          bill_to_address?: string | null
          bill_to_email?: string | null
          bill_to_name?: string | null
          created_at?: string
          created_by?: string | null
          daily_seq: number
          due_date: string
          from_email?: string | null
          id?: string
          invoice_date: string
          invoice_no: string
          manager_no: string
          sent_at?: string | null
          sent_by?: string | null
          sent_cc?: string | null
          sent_message_id?: string | null
          sent_subject?: string | null
          sent_to?: string | null
          settlement_id: string
        }
        Update: {
          bill_to_address?: string | null
          bill_to_email?: string | null
          bill_to_name?: string | null
          created_at?: string
          created_by?: string | null
          daily_seq?: number
          due_date?: string
          from_email?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string
          manager_no?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_cc?: string | null
          sent_message_id?: string | null
          sent_subject?: string | null
          sent_to?: string | null
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_campaigns: {
        Row: {
          campaign_id: string
          settlement_id: string
        }
        Insert: {
          campaign_id: string
          settlement_id: string
        }
        Update: {
          campaign_id?: string
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_campaigns_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_lines: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          description: string | null
          duration_from: string
          duration_to: string
          geo: string | null
          id: string
          model: string | null
          quantity: number
          rate: number
          settlement_id: string
          sort_order: number
        }
        Insert: {
          amount?: number
          campaign_id: string
          created_at?: string
          description?: string | null
          duration_from: string
          duration_to: string
          geo?: string | null
          id?: string
          model?: string | null
          quantity?: number
          rate?: number
          settlement_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          description?: string | null
          duration_from?: string
          duration_to?: string
          geo?: string | null
          id?: string
          model?: string | null
          quantity?: number
          rate?: number
          settlement_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_lines_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_lines_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          period_from: string
          period_to: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_from: string
          period_to: string
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_from?: string
          period_to?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          appsflyer_api_key: string | null
          avatar_url: string | null
          created_at: string | null
          default_invoice_template_id: string | null
          display_name: string | null
          email: string
          google_refresh_token: string | null
          id: string
          is_active: boolean
          manager_no: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          appsflyer_api_key?: string | null
          avatar_url?: string | null
          created_at?: string | null
          default_invoice_template_id?: string | null
          display_name?: string | null
          email: string
          google_refresh_token?: string | null
          id?: string
          is_active?: boolean
          manager_no?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          appsflyer_api_key?: string | null
          avatar_url?: string | null
          created_at?: string | null
          default_invoice_template_id?: string | null
          display_name?: string | null
          email?: string
          google_refresh_token?: string | null
          id?: string
          is_active?: boolean
          manager_no?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_default_invoice_template_id_fkey"
            columns: ["default_invoice_template_id"]
            isOneToOne: false
            referencedRelation: "invoice_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_invoice_daily_seq: {
        Args: { p_invoice_date: string; p_manager_no: string }
        Returns: number
      }
    }
    Enums: {
      user_role: "am" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["am", "admin"],
    },
  },
} as const
