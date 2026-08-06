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
      audit_events: {
        Row: {
          action: string
          actor_role: Database["public"]["Enums"]["case_role"] | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          case_id: string | null
          id: number
          object_id: string | null
          object_type: string
          occurred_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      conversations: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          merged_into: string | null
          title: string | null
        }
        Insert: {
          case_id: string
          created_by: string
          kind: string
          title?: string | null
        }
        Update: never
        Relationships: [
          {
            foreignKeyName: "conversations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          added_by: string | null
          conversation_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          conversation_id: string
          user_id: string
        }
        Update: never
        Relationships: []
      }
      message_acks: {
        Row: {
          acked_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          message_id: string
          user_id: string
        }
        Update: never
        Relationships: []
      }
      case_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          case_id: string
          created_at: string
          email: string
          email_enqueued_at: string | null
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["case_role"]
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: "case_invitations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tasks: {
        Row: {
          assigned_to: string | null
          case_id: string
          created_at: string
          done_at: string | null
          done_by: string | null
          due_date: string | null
          id: string
          label: string
          source: string
        }
        Insert: {
          assigned_to?: string | null
          case_id: string
          due_date?: string | null
          label: string
          source?: string
        }
        Update: {
          assigned_to?: string | null
          done_at?: string | null
          done_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_messages: {
        Row: {
          author_user_id: string | null
          attachment_document_id: string | null
          body: string
          case_id: string
          conversation_id: string | null
          created_at: string
          expects_reply_from: string | null
          id: string
          read_at: string | null
        }
        Insert: {
          author_user_id?: string | null
          attachment_document_id?: string | null
          body: string
          case_id: string
          conversation_id?: string | null
          expects_reply_from?: string | null
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
          plan_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          user_id: string
          plan_id?: string
        }
        Update: {
          closed_at?: string | null
          due_at?: string | null
          note?: string | null
          paid_at?: string | null
          plan_id?: string
        }
        Relationships: []
      }
      customer_invoices: {
        Row: {
          description: string
          customer_address: string | null
          customer_org_number: string | null
          customer_name: string | null
          due_at: string
          period_end: string | null
          period_start: string | null
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
          review_status: string
          review_requested_at: string | null
          reviewed_by: string | null
          reviewed_at: string | null
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
          review_status?: string
          review_requested_at?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
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
      professional_members: {
        Row: {
          id: string
          professional_id: string
          user_id: string
          role: string
          created_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          professional_id: string
          user_id?: string
          role?: string
          created_at?: string
          revoked_at?: string | null
        }
        Update: {
          revoked_at?: string | null
          role?: string
        }
        Relationships: []
      }
      professional_invitations: {
        Row: {
          id: string
          professional_id: string
          email: string
          role: string
          invited_by: string
          created_at: string
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          revoked_at: string | null
        }
        Insert: {
          id?: string
          professional_id: string
          email: string
          role?: string
          invited_by?: string
          created_at?: string
          expires_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
        }
        Relationships: []
      }
      case_share_links: {
        Row: {
          id: string
          case_id: string
          created_by: string
          scope: string
          label: string | null
          created_at: string
          expires_at: string
          revoked_at: string | null
        }
        Insert: {
          case_id: string
          scope: string
          label?: string | null
          expires_at: string
        }
        Update: {
          revoked_at?: string | null
        }
        Relationships: []
      }
      share_link_access: {
        Row: {
          id: number
          link_id: string
          accessed_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      document_signatures: {
        Row: {
          id: string
          document_id: string
          signer_user_id: string
          signer_name: string
          signer_email: string
          statement_version: string
          statement_text: string
          content_sha256: string
          signed_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      api_keys: {
        Row: {
          id: string
          owner_user_id: string
          label: string
          key_prefix: string
          key_hash: string
          created_at: string
          last_used_at: string | null
          revoked_at: string | null
        }
        Insert: never
        Update: {
          revoked_at?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      advisor_sessions: {
        Row: {
          id: string
          case_id: string
          flow_id: string
          flow_title: string
          started_at: string
          closed_at: string | null
          entries: Json
        }
        Insert: {
          id?: string
          case_id: string
          flow_id: string
          flow_title: string
          started_at?: string
          closed_at?: string | null
          entries?: Json
        }
        Update: {
          id?: string
          case_id?: string
          flow_id?: string
          flow_title?: string
          started_at?: string
          closed_at?: string | null
          entries?: Json
        }
        Relationships: []
      }
      case_decisions: {
        Row: {
          id: string
          case_id: string
          decided_by: string
          title: string
          rationale: string
          premise: string | null
          decided_at: string
          status: string
          reconsidered_at: string | null
          reconsider_note: string | null
          watch_signal: string | null
          watch_comparator: string | null
          watch_threshold: number | null
          watch_ack_observation: string | null
          watch_ack_at: string | null
        }
        Insert: {
          id?: string
          case_id: string
          decided_by?: string
          title: string
          rationale: string
          premise?: string | null
          decided_at?: string
          status?: string
          reconsidered_at?: string | null
          reconsider_note?: string | null
          watch_signal?: string | null
          watch_comparator?: string | null
          watch_threshold?: number | null
          watch_ack_observation?: string | null
          watch_ack_at?: string | null
        }
        Update: {
          status?: string
          reconsidered_at?: string | null
          reconsider_note?: string | null
          watch_signal?: string | null
          watch_comparator?: string | null
          watch_threshold?: number | null
          watch_ack_observation?: string | null
          watch_ack_at?: string | null
        }
        Relationships: []
      }
      case_notes: {
        Row: {
          id: string
          case_id: string
          author_user_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          author_user_id?: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          author_user_id?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          id: string
          case_id: string
          user_id: string
          minutes: number
          note: string | null
          occurred_on: string
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          user_id?: string
          minutes: number
          note?: string | null
          occurred_on?: string
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          user_id?: string
          minutes?: number
          note?: string | null
          occurred_on?: string
          created_at?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          can_pay_rent: boolean | null
          can_pay_salary: boolean | null
          can_pay_suppliers: boolean | null
          can_pay_tax: boolean | null
          closed_at: string | null
          company_name: string | null
          created_at: string
          employees: string | null
          exit_note: string | null
          exit_reason: string | null
          health_mode: boolean
          id: string
          org_number: string
          plan_approved_at: string | null
          plan_approved_by: string | null
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
          closed_at?: string | null
          company_name?: string | null
          created_at?: string
          employees?: string | null
          exit_note?: string | null
          exit_reason?: string | null
          health_mode?: boolean
          id?: string
          org_number: string
          plan_approved_at?: string | null
          plan_approved_by?: string | null
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
          closed_at?: string | null
          company_name?: string | null
          created_at?: string
          employees?: string | null
          exit_note?: string | null
          exit_reason?: string | null
          health_mode?: boolean
          id?: string
          org_number?: string
          plan_approved_at?: string | null
          plan_approved_by?: string | null
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
          source: string
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
          source?: string
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
          source?: string
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          included_cases: number | null
          monthly_fee_sek: number | null
          plan_kind: string
          professional_id: string
          shadow: boolean
          unlock_fee_sek: number | null
          updated_at: string
        }
        Insert: {
          included_cases?: number | null
          monthly_fee_sek?: number | null
          plan_kind?: string
          professional_id: string
          shadow?: boolean
          unlock_fee_sek?: number | null
          updated_at?: string
        }
        Update: {
          included_cases?: number | null
          monthly_fee_sek?: number | null
          plan_kind?: string
          professional_id?: string
          shadow?: boolean
          unlock_fee_sek?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          case_id: string
          consent_at: string
          created_at: string
          created_by: string
          decline_note: string | null
          declined_at: string | null
          id: string
          preview: Json
          professional_id: string
          status: string
          summary: Json
          unlocked_at: string | null
          unlocked_terms_version: string | null
        }
        Insert: {
          case_id: string
          consent_at?: string
          created_at?: string
          created_by: string
          decline_note?: string | null
          declined_at?: string | null
          id?: string
          preview: Json
          professional_id: string
          status?: string
          summary: Json
          unlocked_at?: string | null
          unlocked_terms_version?: string | null
        }
        Update: {
          case_id?: string
          consent_at?: string
          created_at?: string
          created_by?: string
          decline_note?: string | null
          declined_at?: string | null
          id?: string
          preview?: Json
          professional_id?: string
          status?: string
          summary?: Json
          unlocked_at?: string | null
          unlocked_terms_version?: string | null
        }
        Relationships: []
      }
      usage_charges: {
        Row: {
          amount_ore: number
          case_type: string | null
          company_name: string | null
          contact_request_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          org_number: string | null
          period_start: string | null
          professional_id: string
          service_code: string
          service_label: string
          shadow: boolean
          user_id: string
          vat_rate: number
        }
        Insert: {
          amount_ore: number
          case_type?: string | null
          company_name?: string | null
          contact_request_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          org_number?: string | null
          period_start?: string | null
          professional_id: string
          service_code: string
          service_label: string
          shadow?: boolean
          user_id: string
          vat_rate?: number
        }
        Update: {
          amount_ore?: number
          case_type?: string | null
          company_name?: string | null
          contact_request_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          org_number?: string | null
          period_start?: string | null
          professional_id?: string
          service_code?: string
          service_label?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          id: string
          user_id: string
          case_id: string | null
          kind: string
          severity: string
          title: string
          body: string
          href: string
          dedupe_key: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          case_id?: string | null
          kind: string
          severity: string
          title: string
          body: string
          href: string
          dedupe_key: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          read_at?: string | null
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          id: string
          event_id: string
          channel: "inapp" | "email" | "sms" | "push"
          status: "pending" | "sent" | "failed" | "suppressed"
          attempts: number
          last_error: string | null
          suppressed_reason: string | null
          deferred_until: string | null
          created_at: string
          sent_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          channel: "inapp" | "email" | "sms" | "push"
          status?: "pending" | "sent" | "failed" | "suppressed"
          attempts?: number
          last_error?: string | null
          suppressed_reason?: string | null
          deferred_until?: string | null
          created_at?: string
          sent_at?: string | null
        }
        Update: {
          status?: "pending" | "sent" | "failed" | "suppressed"
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          user_id: string
          level: string
          email_enabled: boolean
          sms_enabled: boolean
          quiet_start_hour: number
          quiet_end_hour: number
          updated_at: string
        }
        Insert: {
          user_id: string
          level?: string
          email_enabled?: boolean
          sms_enabled?: boolean
          quiet_start_hour?: number
          quiet_end_hour?: number
          updated_at?: string
        }
        Update: {
          level?: string
          email_enabled?: boolean
          sms_enabled?: boolean
          quiet_start_hour?: number
          quiet_end_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      verified_phones: {
        Row: {
          user_id: string
          e164: string
          code_sha256: string | null
          code_expires_at: string | null
          code_attempts: number
          verified_at: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          e164: string
          code_sha256?: string | null
          code_expires_at?: string | null
          code_attempts?: number
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          verified_at?: string | null
        }
        Relationships: []
      }
      profile_claims: {
        Row: {
          contact: string
          created_at: string
          id: string
          motivation: string
          professional_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          contact: string
          created_at?: string
          id?: string
          motivation: string
          professional_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: string
          motivation?: string
          professional_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
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
      close_case: {
        Args: {
          p_case_id: string
          p_reason: string
          p_note?: string | null
          p_enter_health?: boolean
        }
        Returns: undefined
      }
      reopen_case: {
        Args: { p_case_id: string }
        Returns: undefined
      }
      invite_firm_member: {
        Args: { p_professional_id: string; p_email: string; p_role?: string }
        Returns: string
      }
      revoke_firm_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      my_firm_invitations: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          professional_id: string
          firm_name: string
          role: string
          created_at: string
        }[]
      }
      accept_firm_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      remove_firm_member: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      list_firm_team: {
        Args: { p_professional_id: string }
        Returns: {
          id: string | null
          user_id: string
          email: string | null
          role: string
          created_at: string
        }[]
      }
      set_billing_shadow: {
        Args: { p_professional_id: string; p_shadow: boolean }
        Returns: undefined
      }
      set_plan_approval: {
        Args: { p_case_id: string; p_approved: boolean }
        Returns: undefined
      }
      set_document_review: {
        Args: { p_document_id: string; p_action: string }
        Returns: undefined
      }
      fetch_shared_case: {
        Args: { p_token: string }
        Returns: Json
      }
      create_api_key: {
        Args: { p_label: string }
        Returns: {
          id: string
          key_prefix: string
          secret: string
          created_at: string
        }[]
      }
      sign_document: {
        Args: {
          p_document_id: string
          p_signer_name: string
          p_content_sha256: string
          p_statement_version: string
          p_statement_text: string
        }
        Returns: {
          id: string
          document_id: string
          signer_user_id: string
          signer_name: string
          signer_email: string
          statement_version: string
          statement_text: string
          content_sha256: string
          signed_at: string
        }
      }
      api_journal: {
        Args: { p_key: string; p_case_id: string }
        Returns: Json
      }
      north_star_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          recovered: number
          in_health: number
          bad_churn: number
          open_cases: number
        }[]
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
      merge_conversations: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      my_open_mentions: {
        Args: Record<PropertyKey, never>
        Returns: {
          message_id: string
          case_id: string
          conversation_id: string | null
          conversation_title: string | null
          author_name: string | null
          body: string
          created_at: string
        }[]
      }
      invite_to_case: {
        Args: {
          p_case_id: string
          p_email: string
          p_role: Database["public"]["Enums"]["case_role"]
        }
        Returns: string
      }
      revoke_case_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      peek_case_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          id: string
          company_name: string | null
          org_number: string
          role: Database["public"]["Enums"]["case_role"]
          inviter_name: string | null
          expires_at: string
          accepted_at: string | null
          revoked_at: string | null
        }[]
      }
      accept_case_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      list_case_members: {
        Args: { p_case_id: string }
        Returns: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["case_role"]
          display_name: string | null
          email: string | null
          created_at: string
          revoked_at: string | null
        }[]
      }
      retry_outbound_email: {
        Args: { p_id: string }
        Returns: undefined
      }
      claim_professional_profile: {
        Args: { p_professional_id: string; p_motivation: string; p_contact: string }
        Returns: string
      }
      list_profile_claims: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          professional_id: string
          professional_name: string
          claimant_email: string
          motivation: string
          contact: string
          status: string
          review_note: string | null
          created_at: string
        }[]
      }
      review_profile_claim: {
        Args: { p_claim_id: string; p_approve: boolean; p_note?: string | null }
        Returns: undefined
      }
      create_contact_request: {
        Args: { p_case_id: string; p_professional_id: string; p_preview: Json; p_summary: Json }
        Returns: string
      }
      list_lead_previews: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          professional_id: string
          status: string
          created_at: string
          unlocked_at: string | null
          preview: Json
          plan_kind: string
          unlock_fee_sek: number | null
        }[]
      }
      unlock_case_lead: {
        Args: { p_request_id: string; p_terms_version: string }
        Returns: Json
      }
      decline_case_lead: {
        Args: { p_request_id: string; p_note?: string | null }
        Returns: undefined
      }
      get_unlocked_lead: {
        Args: { p_request_id: string }
        Returns: Json
      }
      set_billing_plan: {
        Args: {
          p_professional_id: string
          p_plan_kind: string
          p_unlock_fee_sek?: number | null
          p_monthly_fee_sek?: number | null
          p_included_cases?: number | null
        }
        Returns: undefined
      }
      set_billing_hold: {
        Args: { p_professional_id: string; p_hold: boolean; p_reason?: string | null }
        Returns: undefined
      }
      get_my_professional_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          company: string | null
          category: string
          verified: boolean
          description: string | null
          location: string | null
          email: string | null
          phone: string | null
          website: string | null
          specializations: string[] | null
          fixed_prices: Json
          billing_email: string | null
        }[]
      }
      update_my_professional_profile: {
        Args: {
          p_description: string | null
          p_location: string | null
          p_email: string | null
          p_phone: string | null
          p_website: string | null
          p_specializations: string[] | null
          p_fixed_prices: Json | null
          p_billing_email: string | null
        }
        Returns: undefined
      }
      set_referral_fee: {
        Args: { p_professional_id: string; p_fee_sek: number | null }
        Returns: undefined
      }
      list_professional_terms: {
        Args: Record<PropertyKey, never>
        Returns: {
          professional_id: string
          name: string
          company: string | null
          billing_email: string | null
          referral_fee: number | null
          uninvoiced_billable: number
        }[]
      }
      set_integration_secret: {
        Args: { p_provider: string; p_secret: string }
        Returns: undefined
      }
      list_integration_secrets: {
        Args: Record<PropertyKey, never>
        Returns: { provider: string; last4: string; updated_at: string }[]
      }
      delete_integration_secret: {
        Args: { p_provider: string }
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
      acknowledge_premise: {
        Args: { p_decision_id: string; p_observation: string }
        Returns: undefined
      }
      start_phone_verification: {
        Args: { p_e164: string; p_code_sha256: string; p_ttl_minutes?: number }
        Returns: undefined
      }
      confirm_phone_verification: {
        Args: { p_code_sha256: string }
        Returns: boolean
      }
      remove_phone: {
        Args: Record<string, never>
        Returns: undefined
      }
      queue_verification_sms: {
        Args: { p_body: string }
        Returns: undefined
      }
      issue_customer_invoice: {
        Args: {
          p_user_id: string
          p_description: string
          p_net_ore: number
          p_vat_ore: number
          p_vat_rate: number
          p_due_at: string
          p_customer_name: string
          p_customer_org_number: string | null
          p_customer_address: string
          p_period_start: string | null
          p_period_end: string | null
        }
        Returns: Database["public"]["Tables"]["customer_invoices"]["Row"]
      }
    }
    Enums: {
      application_status: "pending" | "needs_info" | "approved" | "rejected"
      case_role:
        | "owner"
        | "company_staff"
        | "reconstructor"
        | "trustee"
        | "auditor"
        | "legal_advisor"
        | "board_member"
        | "creditor"
        | "observer"
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
