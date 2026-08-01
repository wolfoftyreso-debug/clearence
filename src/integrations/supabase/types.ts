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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          display_name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      case_messages: {
        Row: {
          author_user_id: string | null
          body: string
          case_id: string
          created_at: string
          id: string
          read_at: string | null
        }
        Insert: {
          author_user_id?: string | null
          body: string
          case_id: string
        }
        // Endast read_at. En skickad text kan inte ändras - se triggern
        // case_messages_no_edit i migrationen.
        Update: {
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      account_billing: {
        Row: {
          closed_at: string | null
          due_at: string | null
          note: string | null
          paid_at: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          closed_at?: string | null
          due_at?: string | null
          note?: string | null
          paid_at?: string | null
        }
        Relationships: []
      }
      customer_invoices: {
        Row: {
          description: string
          due_at: string
          gross_ore: number
          id: string
          invoice_number: string
          issued_at: string
          net_ore: number
          paid_at: string | null
          payment_reference: string | null
          receipt_number: string | null
          status: Database["public"]["Enums"]["customer_invoice_status"]
          user_id: string
          vat_ore: number
          vat_rate: number
        }
        Insert: {
          description: string
          due_at: string
          gross_ore: number
          invoice_number: string
          net_ore: number
          user_id: string
          vat_ore: number
          vat_rate: number
        }
        Update: {
          paid_at?: string | null
          payment_reference?: string | null
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["customer_invoice_status"]
        }
        Relationships: []
      }
      outbound_emails: {
        Row: {
          attempts: number
          body_html: string
          body_text: string
          created_at: string
          id: string
          kind: string
          last_error: string | null
          recipient: string
          related_invoice_id: string | null
          related_user_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["outbound_email_status"]
          subject: string
        }
        Insert: {
          body_html: string
          body_text: string
          kind: string
          recipient: string
          related_invoice_id?: string | null
          related_user_id?: string | null
          subject: string
        }
        // Skrivs av arbetaren via mark_email_sent / mark_email_failed.
        Update: {
          last_error?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_email_status"]
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          company: string | null
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: string
          internal_note: string | null
          message: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["contact_status"]
          topic: Database["public"]["Enums"]["contact_topic"]
          user_id: string | null
        }
        // Bara de kolumner formuläret får skicka. Resten sätts av databasen -
        // se grant insert (...) i migrationen; att utelämna dem här gör att
        // typkontrollen fångar det innan PostgREST hinner neka.
        Insert: {
          company?: string | null
          email: string
          message: string
          name: string
          phone?: string | null
          topic?: Database["public"]["Enums"]["contact_topic"]
        }
        Update: {
          handled_at?: string | null
          handled_by?: string | null
          internal_note?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          note: string | null
          revoked_at: string | null
          user_id: string
        }
        // Tilldelas utanför applikationen. Inga skrivbara fält med flit.
        Insert: never
        Update: never
        Relationships: []
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string
          note: string | null
          source: Database["public"]["Enums"]["document_source"]
          storage_path: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type: string
          note?: string | null
          source?: Database["public"]["Enums"]["document_source"]
          storage_path: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string
          note?: string | null
          source?: Database["public"]["Enums"]["document_source"]
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          can_pay_rent: boolean | null
          can_pay_salary: boolean | null
          can_pay_suppliers: boolean | null
          can_pay_tax: boolean | null
          company_name: string | null
          created_at: string
          employees: string | null
          id: string
          org_number: string
          quick_liquidation_value: string | null
          recommendation_description: string | null
          recommendation_next_steps: Json
          recommendation_reasons: Json
          recommendation_title: string | null
          recommendation_type:
            | Database["public"]["Enums"]["recommendation_type"]
            | null
          rent_amount: string | null
          rent_day: number | null
          salary_amount: string | null
          salary_day: number | null
          tax_amount: string | null
          tax_day: number | null
          total_debt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_pay_rent?: boolean | null
          can_pay_salary?: boolean | null
          can_pay_suppliers?: boolean | null
          can_pay_tax?: boolean | null
          company_name?: string | null
          created_at?: string
          employees?: string | null
          id?: string
          org_number: string
          quick_liquidation_value?: string | null
          recommendation_description?: string | null
          recommendation_next_steps?: Json
          recommendation_reasons?: Json
          recommendation_title?: string | null
          recommendation_type?:
            | Database["public"]["Enums"]["recommendation_type"]
            | null
          rent_amount?: string | null
          rent_day?: number | null
          salary_amount?: string | null
          salary_day?: number | null
          tax_amount?: string | null
          tax_day?: number | null
          total_debt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_pay_rent?: boolean | null
          can_pay_salary?: boolean | null
          can_pay_suppliers?: boolean | null
          can_pay_tax?: boolean | null
          company_name?: string | null
          created_at?: string
          employees?: string | null
          id?: string
          org_number?: string
          quick_liquidation_value?: string | null
          recommendation_description?: string | null
          recommendation_next_steps?: Json
          recommendation_reasons?: Json
          recommendation_title?: string | null
          recommendation_type?:
            | Database["public"]["Enums"]["recommendation_type"]
            | null
          rent_amount?: string | null
          rent_day?: number | null
          salary_amount?: string | null
          salary_day?: number | null
          tax_amount?: string | null
          tax_day?: number | null
          total_debt?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kbr_assessments: {
        Row: {
          ambition_level: string | null
          case_id: string | null
          company_name: string | null
          created_at: string
          has_related_companies: boolean | null
          id: string
          is_part_of_larger_structure: boolean | null
          org_number: string | null
          share_capital: number
          status: Database["public"]["Enums"]["kbr_status"]
          total_assets: number
          total_liabilities: number
          user_id: string
        }
        Insert: {
          ambition_level?: string | null
          case_id?: string | null
          company_name?: string | null
          created_at?: string
          has_related_companies?: boolean | null
          id?: string
          is_part_of_larger_structure?: boolean | null
          org_number?: string | null
          share_capital: number
          status: Database["public"]["Enums"]["kbr_status"]
          total_assets: number
          total_liabilities: number
          user_id: string
        }
        Update: {
          ambition_level?: string | null
          case_id?: string | null
          company_name?: string | null
          created_at?: string
          has_related_companies?: boolean | null
          id?: string
          is_part_of_larger_structure?: boolean | null
          org_number?: string | null
          share_capital?: number
          status?: Database["public"]["Enums"]["kbr_status"]
          total_assets?: number
          total_liabilities?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kbr_assessments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          case_id: string
          category: Database["public"]["Enums"]["payment_category"]
          created_at: string
          due_date: string
          id: string
          label: string
          recurring: boolean
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          case_id: string
          category: Database["public"]["Enums"]["payment_category"]
          created_at?: string
          due_date: string
          id?: string
          label: string
          recurring?: boolean
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          case_id?: string
          category?: Database["public"]["Enums"]["payment_category"]
          created_at?: string
          due_date?: string
          id?: string
          label?: string
          recurring?: boolean
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          case_id: string
          counterpart: string | null
          created_at: string
          direction: Database["public"]["Enums"]["invoice_direction"]
          due_date: string
          id: string
          issue_date: string
          label: string
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          case_id: string
          counterpart?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["invoice_direction"]
          due_date: string
          id?: string
          issue_date: string
          label: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          case_id?: string
          counterpart?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["invoice_direction"]
          due_date?: string
          id?: string
          issue_date?: string
          label?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          billable_at: string | null
          case_id: string | null
          channel: Database["public"]["Enums"]["referral_channel"]
          created_at: string
          fee_amount: number | null
          id: string
          professional_id: string
          referrer_user_id: string | null
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          billable_at?: string | null
          case_id?: string | null
          channel: Database["public"]["Enums"]["referral_channel"]
          created_at?: string
          fee_amount?: number | null
          id?: string
          professional_id: string
          referrer_user_id?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          billable_at?: string | null
          case_id?: string | null
          channel?: Database["public"]["Enums"]["referral_channel"]
          created_at?: string
          fee_amount?: number | null
          id?: string
          professional_id?: string
          referrer_user_id?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_applications: {
        Row: {
          category: Database["public"]["Enums"]["professional_category"]
          company: string | null
          contact_name: string
          created_at: string
          credential_authority: string | null
          credential_note: string | null
          credential_reference: string | null
          description: string | null
          email: string
          fixed_prices: Json | null
          id: string
          location: string | null
          org_number: string | null
          phone: string | null
          review_note: string | null
          reviewed_at: string | null
          specializations: string[] | null
          status: Database["public"]["Enums"]["application_status"]
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["professional_category"]
          company?: string | null
          contact_name: string
          created_at?: string
          credential_authority?: string | null
          credential_note?: string | null
          credential_reference?: string | null
          description?: string | null
          email: string
          fixed_prices?: Json | null
          id?: string
          location?: string | null
          org_number?: string | null
          phone?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          specializations?: string[] | null
          status?: Database["public"]["Enums"]["application_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["professional_category"]
          company?: string | null
          contact_name?: string
          created_at?: string
          credential_authority?: string | null
          credential_note?: string | null
          credential_reference?: string | null
          description?: string | null
          email?: string
          fixed_prices?: Json | null
          id?: string
          location?: string | null
          org_number?: string | null
          phone?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          specializations?: string[] | null
          status?: Database["public"]["Enums"]["application_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      professional_ratings: {
        Row: {
          communication_score: number | null
          created_at: string
          expertise_score: number | null
          id: string
          overall_score: number | null
          price_transparency_score: number | null
          professional_id: string
          response_time_score: number | null
        }
        Insert: {
          communication_score?: number | null
          created_at?: string
          expertise_score?: number | null
          id?: string
          overall_score?: number | null
          price_transparency_score?: number | null
          professional_id: string
          response_time_score?: number | null
        }
        Update: {
          communication_score?: number | null
          created_at?: string
          expertise_score?: number | null
          id?: string
          overall_score?: number | null
          price_transparency_score?: number | null
          professional_id?: string
          response_time_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_ratings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean | null
          application_id: string | null
          billing_email: string | null
          category: Database["public"]["Enums"]["professional_category"]
          company: string | null
          created_at: string
          description: string | null
          email: string | null
          fixed_prices: Json | null
          id: string
          location: string | null
          name: string
          phone: string | null
          specializations: string[] | null
          referral_fee: number | null
          updated_at: string
          user_id: string | null
          verified: boolean | null
          website: string | null
        }
        Insert: {
          active?: boolean | null
          application_id?: string | null
          billing_email?: string | null
          category: Database["public"]["Enums"]["professional_category"]
          company?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          fixed_prices?: Json | null
          id?: string
          location?: string | null
          name: string
          phone?: string | null
          specializations?: string[] | null
          referral_fee?: number | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          active?: boolean | null
          application_id?: string | null
          billing_email?: string | null
          category?: Database["public"]["Enums"]["professional_category"]
          company?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          fixed_prices?: Json | null
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          specializations?: string[] | null
          referral_fee?: number | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_platform_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      approve_professional_application: {
        Args: { p_application_id: string }
        Returns: string
      }
      review_professional_application: {
        Args: {
          p_application_id: string
          p_status: Database["public"]["Enums"]["application_status"]
          p_note: string
        }
        Returns: undefined
      }
      close_overdue_accounts: {
        Args: { p_now?: string }
        Returns: {
          user_id: string
          email: string
          display_name: string | null
          invoice_number: string | null
        }[]
      }
    }
    Enums: {
      application_status: "pending" | "needs_info" | "approved" | "rejected"
      contact_status: "new" | "in_progress" | "answered" | "closed"
      customer_invoice_status: "issued" | "paid" | "cancelled"
      outbound_email_status: "pending" | "sent" | "failed"
      user_role: "company" | "advisor"
      contact_topic:
        | "question"
        | "company"
        | "advisor"
        | "invoice"
        | "privacy"
        | "bug"
        | "other"
      document_kind:
        | "bank_statement"
        | "balance_sheet"
        | "income_statement"
        | "annual_report"
        | "tax_account"
        | "debt_overview"
        | "agreement"
        | "correspondence"
        | "other"
      document_source: "manual" | "fortnox" | "visma"
      invoice_direction: "in" | "out"
      invoice_status: "unpaid" | "paid" | "overdue"
      kbr_status: "not_required" | "warning" | "required" | "critical"
      payment_category:
        | "salary"
        | "tax"
        | "rent"
        | "supplier"
        | "loan"
        | "other"
      payment_status: "pending" | "paid" | "postponed" | "critical"
      professional_category:
        | "konkursforvaltare"
        | "rekonstruktor"
        | "revisor"
        | "affarsjurist"
        | "kreditbolag"
      recommendation_type: "bankruptcy" | "reconstruction" | "stabilize"
      referral_channel: "email" | "phone" | "website"
      referral_status: "initiated" | "accepted" | "declined" | "completed"
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
      application_status: ["pending", "needs_info", "approved", "rejected"],
      document_kind: [
        "bank_statement",
        "balance_sheet",
        "income_statement",
        "annual_report",
        "tax_account",
        "debt_overview",
        "agreement",
        "correspondence",
        "other",
      ],
      document_source: ["manual", "fortnox", "visma"],
      invoice_direction: ["in", "out"],
      invoice_status: ["unpaid", "paid", "overdue"],
      kbr_status: ["not_required", "warning", "required", "critical"],
      payment_category: [
        "salary",
        "tax",
        "rent",
        "supplier",
        "loan",
        "other",
      ],
      payment_status: ["pending", "paid", "postponed", "critical"],
      professional_category: [
        "konkursforvaltare",
        "rekonstruktor",
        "revisor",
        "affarsjurist",
        "kreditbolag",
      ],
      recommendation_type: ["bankruptcy", "reconstruction", "stabilize"],
      referral_channel: ["email", "phone", "website"],
      referral_status: ["initiated", "accepted", "declined", "completed"],
    },
  },
} as const
