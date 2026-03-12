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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: Array<{
          foreignKeyName: string
          columns: string[]
          isOneToOne: boolean
          referencedRelation: string
          referencedColumns: string[]
        }>
      }
      activities: {
        Row: {
          body: string | null
          completed: boolean
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          due_at: string | null
          id: string
          subject: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          body?: string | null
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          subject?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          body?: string | null
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          subject?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          contact_id: string
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          event_id: string | null
          id: string
          is_published: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          event_id?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_id?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_flows: {
        Row: {
          created_at: string
          created_by: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["approval_entity_type"]
          id: string
          status: Database["public"]["Enums"]["approval_flow_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["approval_entity_type"]
          id?: string
          status?: Database["public"]["Enums"]["approval_flow_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["approval_entity_type"]
          id?: string
          status?: Database["public"]["Enums"]["approval_flow_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_flows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          approver_email: string | null
          approver_id: string | null
          approver_name: string | null
          approver_type: Database["public"]["Enums"]["approver_type"]
          comment: string | null
          flow_id: string
          id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["approval_step_status"]
          step_order: number
          title: string | null
          token: string | null
        }
        Insert: {
          approver_email?: string | null
          approver_id?: string | null
          approver_name?: string | null
          approver_type: Database["public"]["Enums"]["approver_type"]
          comment?: string | null
          flow_id: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["approval_step_status"]
          step_order: number
          title?: string | null
          token?: string | null
        }
        Update: {
          approver_email?: string | null
          approver_id?: string | null
          approver_name?: string | null
          approver_type?: Database["public"]["Enums"]["approver_type"]
          comment?: string | null
          flow_id?: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["approval_step_status"]
          step_order?: number
          title?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "approval_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          end_at: string
          id: string
          location: string | null
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
          video_url: string | null
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          deal_id?: string | null
          description?: string | null
          end_at: string
          id?: string
          location?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          all_day?: boolean
          color?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          end_at?: string
          id?: string
          location?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_tokens: {
        Row: {
          access_count: number
          contact_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          last_accessed_at: string | null
          token: string
        }
        Insert: {
          access_count?: number
          contact_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_accessed_at?: string | null
          token?: string
        }
        Update: {
          access_count?: number
          contact_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_accessed_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_to: string | null
          company_name: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          source: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_name?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          annexes: Json
          client_token: string | null
          contact_id: string
          content: string
          contract_number: string
          created_at: string
          created_by: string
          id: string
          quote_id: string | null
          rejection_reason: string | null
          sent_at: string | null
          signed_signature_data: string | null
          signed_signature_name: string | null
          signature_ip: string | null
          signed_at: string | null
          signed_by: string | null
          initials_data: Json
          page_count: number
          pdf_storage_path: string | null
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string | null
          title: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          annexes?: Json
          client_token?: string | null
          contact_id: string
          content: string
          contract_number?: string
          created_at?: string
          created_by: string
          id?: string
          quote_id?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          signed_signature_data?: string | null
          signed_signature_name?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          signed_by?: string | null
          initials_data?: Json
          page_count?: number
          pdf_storage_path?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          annexes?: Json
          client_token?: string | null
          contact_id?: string
          content?: string
          contract_number?: string
          created_at?: string
          created_by?: string
          id?: string
          quote_id?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          signed_signature_data?: string | null
          signed_signature_name?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          signed_by?: string | null
          initials_data?: Json
          page_count?: number
          pdf_storage_path?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          contact_id: string
          created_at: string
          created_by: string
          currency: string
          expected_close: string | null
          id: string
          lost_reason: string | null
          notes: string | null
          position: number
          probability: number | null
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          created_by: string
          currency?: string
          expected_close?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          position?: number
          probability?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          expected_close?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          position?: number
          probability?: number | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          email: string | null
          event_id: string
          id: string
          name: string | null
          rsvp: Database["public"]["Enums"]["rsvp_status"]
          user_id: string | null
        }
        Insert: {
          email?: string | null
          event_id: string
          id?: string
          name?: string | null
          rsvp?: Database["public"]["Enums"]["rsvp_status"]
          user_id?: string | null
        }
        Update: {
          email?: string | null
          event_id?: string
          id?: string
          name?: string | null
          rsvp?: Database["public"]["Enums"]["rsvp_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_resources: {
        Row: {
          event_id: string
          resource_id: string
        }
        Insert: {
          event_id: string
          resource_id: string
        }
        Update: {
          event_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_resources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          album_id: string
          blurhash: string | null
          caption: string | null
          created_at: string
          duration_secs: number | null
          filename: string
          height: number | null
          id: string
          is_favorite: boolean
          mime_type: string
          size_bytes: number | null
          sort_order: number
          storage_path: string
          width: number | null
        }
        Insert: {
          album_id: string
          blurhash?: string | null
          caption?: string | null
          created_at?: string
          duration_secs?: number | null
          filename: string
          height?: number | null
          id?: string
          is_favorite?: boolean
          mime_type: string
          size_bytes?: number | null
          sort_order?: number
          storage_path: string
          width?: number | null
        }
        Update: {
          album_id?: string
          blurhash?: string | null
          caption?: string | null
          created_at?: string
          duration_secs?: number | null
          filename?: string
          height?: number | null
          id?: string
          is_favorite?: boolean
          mime_type?: string
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_items_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_line_items: {
        Row: {
          category: string | null
          description: string
          discount_pct: number
          id: string
          quantity: number
          quote_id: string
          sort_order: number
          total: number
          unit_price: number
        }
        Insert: {
          category?: string | null
          description: string
          discount_pct?: number
          id?: string
          quantity?: number
          quote_id: string
          sort_order?: number
          total: number
          unit_price: number
        }
        Update: {
          category?: string | null
          description?: string
          discount_pct?: number
          id?: string
          quantity?: number
          quote_id?: string
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_ip: string | null
          approved_signature_data: string | null
          approved_signature_name: string | null
          client_token: string | null
          contact_id: string
          created_at: string
          created_by: string
          currency: string
          deal_id: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          parent_id: string | null
          pdf_storage_path: string | null
          quote_number: string
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total: number
          updated_at: string
          valid_until: string | null
          version: number
          viewed_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_ip?: string | null
          approved_signature_data?: string | null
          approved_signature_name?: string | null
          client_token?: string | null
          contact_id: string
          created_at?: string
          created_by: string
          currency?: string
          deal_id?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          parent_id?: string | null
          pdf_storage_path?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
          viewed_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_ip?: string | null
          approved_signature_data?: string | null
          approved_signature_name?: string | null
          client_token?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          deal_id?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          parent_id?: string | null
          pdf_storage_path?: string | null
          quote_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          color: string | null
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["resource_type"]
        }
        Insert: {
          color?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: Database["public"]["Enums"]["resource_type"]
        }
        Update: {
          color?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["resource_type"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_internal_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      activity_type:
        | "note"
        | "call"
        | "email"
        | "meeting"
        | "task"
        | "stage_change"
        | "file"
      approval_entity_type: "quote" | "contract" | "asset" | "custom"
      approval_flow_status:
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
        | "cancelled"
      approval_step_status: "pending" | "approved" | "rejected" | "skipped"
      approver_type: "internal" | "client"
      contract_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed"
        | "rejected"
        | "voided"
      deal_stage:
        | "lead"
        | "prospect"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      event_status: "tentative" | "confirmed" | "cancelled"
      event_type: "meeting" | "production_session"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "approved"
        | "rejected"
        | "expired"
      resource_type: "studio" | "equipment" | "personnel"
      rsvp_status: "pending" | "yes" | "no" | "maybe"
      user_role: "admin" | "project_manager" | "operator" | "client"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: [
        "note",
        "call",
        "email",
        "meeting",
        "task",
        "stage_change",
        "file",
      ],
      approval_entity_type: ["quote", "contract", "asset", "custom"],
      approval_flow_status: [
        "pending",
        "in_progress",
        "approved",
        "rejected",
        "cancelled",
      ],
      approval_step_status: ["pending", "approved", "rejected", "skipped"],
      approver_type: ["internal", "client"],
      contract_status: [
        "draft",
        "sent",
        "viewed",
        "signed",
        "rejected",
        "voided",
      ],
      deal_stage: [
        "lead",
        "prospect",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      event_status: ["tentative", "confirmed", "cancelled"],
      event_type: ["meeting", "production_session"],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "approved",
        "rejected",
        "expired",
      ],
      resource_type: ["studio", "equipment", "personnel"],
      rsvp_status: ["pending", "yes", "no", "maybe"],
      user_role: ["admin", "project_manager", "operator", "client"],
    },
  },
} as const

