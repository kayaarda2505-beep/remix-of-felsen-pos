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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          business_name: string
          currency: string
          default_tip_percentages: number[]
          id: number
          language: string
          region: string
          updated_at: string
        }
        Insert: {
          business_name?: string
          currency?: string
          default_tip_percentages?: number[]
          id?: number
          language?: string
          region?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          currency?: string
          default_tip_percentages?: number[]
          id?: number
          language?: string
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      dining_tables: {
        Row: {
          area: Database["public"]["Enums"]["table_area"]
          created_at: string
          guests: number | null
          id: string
          location_id: string
          name: string
          opened_at: string | null
          pos_x: number | null
          pos_y: number | null
          qr_token: string | null
          seats: number
          sort_order: number
          status: Database["public"]["Enums"]["table_status"]
        }
        Insert: {
          area?: Database["public"]["Enums"]["table_area"]
          created_at?: string
          guests?: number | null
          id?: string
          location_id: string
          name: string
          opened_at?: string | null
          pos_x?: number | null
          pos_y?: number | null
          qr_token?: string | null
          seats?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["table_status"]
        }
        Update: {
          area?: Database["public"]["Enums"]["table_area"]
          created_at?: string
          guests?: number | null
          id?: string
          location_id?: string
          name?: string
          opened_at?: string | null
          pos_x?: number | null
          pos_y?: number | null
          qr_token?: string | null
          seats?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["table_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          expense_date: string
          id: string
          payment_method: string | null
          receipt_url: string | null
          vat_amount: number | null
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          vat_amount?: number | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          vat_amount?: number | null
          vendor?: string | null
        }
        Relationships: []
      }
      floor_elements: {
        Row: {
          color: string | null
          created_at: string
          height: number
          id: string
          kind: string
          label: string | null
          points: Json | null
          rotation: number
          shape: string
          width: number
          x: number
          y: number
          z_index: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          height?: number
          id?: string
          kind?: string
          label?: string | null
          points?: Json | null
          rotation?: number
          shape?: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          height?: number
          id?: string
          kind?: string
          label?: string | null
          points?: Json | null
          rotation?: number
          shape?: string
          width?: number
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: []
      }
      happy_hour_rules: {
        Row: {
          active: boolean
          category_filter: string | null
          created_at: string
          days_of_week: number[]
          discount_pct: number
          end_time: string
          id: string
          name: string
          start_time: string
        }
        Insert: {
          active?: boolean
          category_filter?: string | null
          created_at?: string
          days_of_week?: number[]
          discount_pct?: number
          end_time?: string
          id?: string
          name: string
          start_time?: string
        }
        Update: {
          active?: boolean
          category_filter?: string | null
          created_at?: string
          days_of_week?: number[]
          discount_pct?: number
          end_time?: string
          id?: string
          name?: string
          start_time?: string
        }
        Relationships: []
      }
      ingredient_suppliers: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          id: string
          ingredient_id: string
          is_preferred: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          ingredient_id: string
          is_preferred?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string
          is_preferred?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_suppliers_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          barcode: string | null
          category: string
          container_type: string | null
          cost_per_unit: number
          created_at: string
          id: string
          location_id: string | null
          min_stock: number
          name: string
          sale_price: number
          stock: number
          supplier_address: string | null
          supplier_contact: string | null
          supplier_name: string | null
          unit: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          category: string
          container_type?: string | null
          cost_per_unit?: number
          created_at?: string
          id?: string
          location_id?: string | null
          min_stock?: number
          name: string
          sale_price?: number
          stock?: number
          supplier_address?: string | null
          supplier_contact?: string | null
          supplier_name?: string | null
          unit?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          category?: string
          container_type?: string | null
          cost_per_unit?: number
          created_at?: string
          id?: string
          location_id?: string | null
          min_stock?: number
          name?: string
          sale_price?: number
          stock?: number
          supplier_address?: string | null
          supplier_contact?: string | null
          supplier_name?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          currency: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          birthday: string | null
          created_at: string
          email: string | null
          id: string
          level: Database["public"]["Enums"]["member_level"]
          name: string
          notes: string | null
          phone: string | null
          points: number
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          email?: string | null
          id?: string
          level?: Database["public"]["Enums"]["member_level"]
          name: string
          notes?: string | null
          phone?: string | null
          points?: number
        }
        Update: {
          birthday?: string | null
          created_at?: string
          email?: string | null
          id?: string
          level?: Database["public"]["Enums"]["member_level"]
          name?: string
          notes?: string | null
          phone?: string | null
          points?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          category: string | null
          id: string
          modifiers: Json
          note: string | null
          order_id: string
          product_id: string
          product_name: string
          qty: number
          sent_at: string
          unit_price: number
        }
        Insert: {
          category?: string | null
          id?: string
          modifiers?: Json
          note?: string | null
          order_id: string
          product_id: string
          product_name: string
          qty?: number
          sent_at?: string
          unit_price: number
        }
        Update: {
          category?: string | null
          id?: string
          modifiers?: Json
          note?: string | null
          order_id?: string
          product_id?: string
          product_name?: string
          qty?: number
          sent_at?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          closed_at: string | null
          created_at: string
          guests: number | null
          id: string
          location_id: string | null
          opened_at: string
          opened_by_name: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          total: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          guests?: number | null
          id?: string
          location_id?: string | null
          opened_at?: string
          opened_by_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          guests?: number | null
          id?: string
          location_id?: string | null
          opened_at?: string
          opened_by_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          enabled: boolean
          fee_pct: number
          id: string
          name: string
          sort_order: number
          type: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          fee_pct?: number
          id?: string
          name: string
          sort_order?: number
          type: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          fee_pct?: number
          id?: string
          name?: string
          sort_order?: number
          type?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          handled_at: string | null
          id: string
          method: string
          note: string | null
          order_id: string | null
          status: string
          table_id: string | null
          table_name: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          handled_at?: string | null
          id?: string
          method: string
          note?: string | null
          order_id?: string | null
          status?: string
          table_id?: string | null
          table_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          handled_at?: string | null
          id?: string
          method?: string
          note?: string | null
          order_id?: string | null
          status?: string
          table_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      payrolls: {
        Row: {
          ahv_iv_eo: number
          alv: number
          created_at: string
          created_by: string | null
          gross: number
          hourly_wage: number
          hours: number
          id: string
          member_id: string
          nbu: number
          net: number
          period_end: string
          period_start: string
          rates: Json
          total_deductions: number
          withholding_tax: number
        }
        Insert: {
          ahv_iv_eo?: number
          alv?: number
          created_at?: string
          created_by?: string | null
          gross?: number
          hourly_wage?: number
          hours?: number
          id?: string
          member_id: string
          nbu?: number
          net?: number
          period_end: string
          period_start: string
          rates?: Json
          total_deductions?: number
          withholding_tax?: number
        }
        Update: {
          ahv_iv_eo?: number
          alv?: number
          created_at?: string
          created_by?: string | null
          gross?: number
          hourly_wage?: number
          hours?: number
          id?: string
          member_id?: string
          nbu?: number
          net?: number
          period_end?: string
          period_start?: string
          rates?: Json
          total_deductions?: number
          withholding_tax?: number
        }
        Relationships: []
      }
      printers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          ip_address: string | null
          location_id: string | null
          name: string
          port: number | null
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          location_id?: string | null
          name: string
          port?: number | null
          type: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          location_id?: string | null
          name?: string
          port?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "printers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          amount: number
          created_at: string
          id: string
          ingredient_id: string
          product_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          ingredient_id: string
          product_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          ingredient_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          id: string
          meta: string | null
          modifier_groups: Json
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          id: string
          meta?: string | null
          modifier_groups?: Json
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          meta?: string | null
          modifier_groups?: Json
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_calls: {
        Row: {
          created_at: string
          handled_at: string | null
          id: string
          note: string | null
          status: string
          table_id: string | null
          table_name: string | null
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          id?: string
          note?: string | null
          status?: string
          table_id?: string | null
          table_name?: string | null
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          id?: string
          note?: string | null
          status?: string
          table_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_calls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          member_id: string
          notes: string | null
          position: string
          published_at: string | null
          shift_date: string
          start_time: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          member_id: string
          notes?: string | null
          position?: string
          published_at?: string | null
          shift_date: string
          start_time: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          member_id?: string
          notes?: string | null
          position?: string
          published_at?: string | null
          shift_date?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      song_requests: {
        Row: {
          artist: string | null
          created_at: string
          id: string
          image_url: string | null
          note: string | null
          spotify_track_id: string | null
          spotify_uri: string | null
          status: string
          table_id: string | null
          table_name: string | null
          title: string
        }
        Insert: {
          artist?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          note?: string | null
          spotify_track_id?: string | null
          spotify_uri?: string | null
          status?: string
          table_id?: string | null
          table_name?: string | null
          title: string
        }
        Update: {
          artist?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          note?: string | null
          spotify_track_id?: string | null
          spotify_uri?: string | null
          status?: string
          table_id?: string | null
          table_name?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      spotify_auth: {
        Row: {
          access_token: string
          expires_at: string
          id: boolean
          refresh_token: string
          scope: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at: string
          id?: boolean
          refresh_token: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          id?: boolean
          refresh_token?: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          account_number: number | null
          active: boolean
          address: string | null
          ahv_number: string | null
          birthdate: string | null
          color: string
          created_at: string
          email: string | null
          hourly_wage: number
          iban: string | null
          id: string
          location_id: string | null
          name: string
          phone: string | null
          pin_hash: string
          role: Database["public"]["Enums"]["team_role"]
          withholding_tax: boolean
          withholding_tax_rate: number
        }
        Insert: {
          account_number?: number | null
          active?: boolean
          address?: string | null
          ahv_number?: string | null
          birthdate?: string | null
          color?: string
          created_at?: string
          email?: string | null
          hourly_wage?: number
          iban?: string | null
          id?: string
          location_id?: string | null
          name: string
          phone?: string | null
          pin_hash: string
          role?: Database["public"]["Enums"]["team_role"]
          withholding_tax?: boolean
          withholding_tax_rate?: number
        }
        Update: {
          account_number?: number | null
          active?: boolean
          address?: string | null
          ahv_number?: string | null
          birthdate?: string | null
          color?: string
          created_at?: string
          email?: string | null
          hourly_wage?: number
          iban?: string | null
          id?: string
          location_id?: string | null
          name?: string
          phone?: string | null
          pin_hash?: string
          role?: Database["public"]["Enums"]["team_role"]
          withholding_tax?: boolean
          withholding_tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_members_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          break_minutes: number
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          member_id: string
          note: string | null
        }
        Insert: {
          break_minutes?: number
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          member_id: string
          note?: string | null
        }
        Update: {
          break_minutes?: number
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          member_id?: string
          note?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      dining_tables_safe: {
        Row: {
          area: Database["public"]["Enums"]["table_area"] | null
          created_at: string | null
          guests: number | null
          id: string | null
          location_id: string | null
          name: string | null
          opened_at: string | null
          pos_x: number | null
          pos_y: number | null
          seats: number | null
          sort_order: number | null
          status: Database["public"]["Enums"]["table_status"] | null
        }
        Insert: {
          area?: Database["public"]["Enums"]["table_area"] | null
          created_at?: string | null
          guests?: number | null
          id?: string | null
          location_id?: string | null
          name?: string | null
          opened_at?: string | null
          pos_x?: number | null
          pos_y?: number | null
          seats?: number | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["table_status"] | null
        }
        Update: {
          area?: Database["public"]["Enums"]["table_area"] | null
          created_at?: string | null
          guests?: number | null
          id?: string | null
          location_id?: string | null
          name?: string | null
          opened_at?: string | null
          pos_x?: number | null
          pos_y?: number | null
          seats?: number | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["table_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_team_member:
        | {
            Args: {
              _color?: string
              _name: string
              _pin: string
              _role: Database["public"]["Enums"]["team_role"]
            }
            Returns: string
          }
        | {
            Args: {
              _account_number?: number
              _color?: string
              _name: string
              _pin: string
              _role: Database["public"]["Enums"]["team_role"]
            }
            Returns: string
          }
        | {
            Args: {
              _account_number?: number
              _address?: string
              _ahv_number?: string
              _birthdate?: string
              _color?: string
              _email?: string
              _hourly_wage?: number
              _iban?: string
              _name: string
              _phone?: string
              _pin: string
              _role: Database["public"]["Enums"]["team_role"]
              _withholding_tax?: boolean
              _withholding_tax_rate?: number
            }
            Returns: string
          }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      report_category_totals: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category: string
          total: number
        }[]
      }
      report_daily_totals: {
        Args: { p_from: string; p_to: string }
        Returns: {
          day: string
          total: number
        }[]
      }
      report_hourly_totals: {
        Args: { p_from: string; p_to: string }
        Returns: {
          hour: number
          total: number
        }[]
      }
      report_orders_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          closed_count: number
          order_count: number
          revenue: number
        }[]
      }
      verify_team_pin: {
        Args: { _account_number: number; _pin: string }
        Returns: {
          account_number: number
          color: string
          id: string
          name: string
          role: Database["public"]["Enums"]["team_role"]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager"
      member_level: "bronze" | "silver" | "gold" | "platinum"
      order_status: "open" | "paid" | "cancelled"
      table_area: "indoor" | "outdoor" | "bar"
      table_status: "free" | "occupied" | "bill" | "pending"
      team_role: "manager" | "barkeeper" | "service" | "kueche"
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
      app_role: ["admin", "manager"],
      member_level: ["bronze", "silver", "gold", "platinum"],
      order_status: ["open", "paid", "cancelled"],
      table_area: ["indoor", "outdoor", "bar"],
      table_status: ["free", "occupied", "bill", "pending"],
      team_role: ["manager", "barkeeper", "service", "kueche"],
    },
  },
} as const
