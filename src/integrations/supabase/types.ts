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
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      asset_passport: {
        Row: {
          brand: string | null
          created_at: string
          customer_id: string
          id: string
          item_category: string
          model: string | null
          serial_number: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          customer_id: string
          id?: string
          item_category: string
          model?: string | null
          serial_number?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          item_category?: string
          model?: string | null
          serial_number?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string | null
          reason: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string | null
          reason: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          message: string
          trigger_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message: string
          trigger_type: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string
          trigger_type?: string
        }
        Relationships: []
      }
      brand_category_tags: {
        Row: {
          brand_id: string
          category_id: string
          id: string
        }
        Insert: {
          brand_id: string
          category_id: string
          id?: string
        }
        Update: {
          brand_id?: string
          category_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_category_tags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_category_tags_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tier: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tier?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      category_issues: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          suggestive_price: number
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          suggestive_price?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          suggestive_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_issues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_packages: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          includes: string[]
          is_active: boolean
          name: string
          sort_order: number
          suggestive_price: number
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          includes?: string[]
          is_active?: boolean
          name: string
          sort_order?: number
          suggestive_price?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          includes?: string[]
          is_active?: boolean
          name?: string
          sort_order?: number
          suggestive_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_packages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          historical_context: string | null
          id: string
          legacy_ltv: number
          legacy_source: string | null
          name: string
          phone: string
          pincode: string | null
          service_affinity: string[] | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          historical_context?: string | null
          id?: string
          legacy_ltv?: number
          legacy_source?: string | null
          name: string
          phone: string
          pincode?: string | null
          service_affinity?: string[] | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          historical_context?: string | null
          id?: string
          legacy_ltv?: number
          legacy_source?: string | null
          name?: string
          phone?: string
          pincode?: string | null
          service_affinity?: string[] | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expert_tasks: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          estimated_price: number | null
          expert_note: string | null
          expert_type: string
          id: string
          is_completed: boolean | null
          is_optional: boolean
          order_id: string
          scope_description: string | null
          scope_tags: Json | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_price?: number | null
          expert_note?: string | null
          expert_type: string
          id?: string
          is_completed?: boolean | null
          is_optional?: boolean
          order_id: string
          scope_description?: string | null
          scope_tags?: Json | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_price?: number | null
          expert_note?: string | null
          expert_type?: string
          id?: string
          is_completed?: boolean | null
          is_optional?: boolean
          order_id?: string
          scope_description?: string | null
          scope_tags?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          cost_per_unit: number
          created_at: string
          id: string
          min_stock_level: number
          name: string
          stock_level: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          cost_per_unit?: number
          created_at?: string
          id?: string
          min_stock_level?: number
          name: string
          stock_level?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost_per_unit?: number
          created_at?: string
          id?: string
          min_stock_level?: number
          name?: string
          stock_level?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_activity: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activity_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_items: {
        Row: {
          brand_id: string | null
          category_id: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          manual_price: number
          mode: string
          selected_issues: Json
          selected_package_id: string | null
          selected_package_name: string | null
          service_type: string
          sort_order: number
          suggestive_price: number
        }
        Insert: {
          brand_id?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          manual_price?: number
          mode?: string
          selected_issues?: Json
          selected_package_id?: string | null
          selected_package_name?: string | null
          service_type?: string
          sort_order?: number
          suggestive_price?: number
        }
        Update: {
          brand_id?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          manual_price?: number
          mode?: string
          selected_issues?: Json
          selected_package_id?: string | null
          selected_package_name?: string | null
          service_type?: string
          sort_order?: number
          suggestive_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_items_selected_package_id_fkey"
            columns: ["selected_package_id"]
            isOneToOne: false
            referencedRelation: "category_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_photos: {
        Row: {
          file_name: string
          id: string
          lead_id: string
          lead_item_id: string | null
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          id?: string
          lead_id: string
          lead_item_id?: string | null
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          id?: string
          lead_id?: string
          lead_item_id?: string | null
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_photos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_photos_lead_item_id_fkey"
            columns: ["lead_item_id"]
            isOneToOne: false
            referencedRelation: "lead_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_quotes: {
        Row: {
          accepted_at: string | null
          accepted_tier: string | null
          created_at: string
          elite_price: number
          elite_tat_max: number
          elite_tat_min: number
          id: string
          lead_id: string
          premium_price: number
          premium_tat_max: number
          premium_tat_min: number
          quote_token: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_tier?: string | null
          created_at?: string
          elite_price?: number
          elite_tat_max?: number
          elite_tat_min?: number
          id?: string
          lead_id: string
          premium_price?: number
          premium_tat_max?: number
          premium_tat_min?: number
          quote_token: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_tier?: string | null
          created_at?: string
          elite_price?: number
          elite_tat_max?: number
          elite_tat_min?: number
          id?: string
          lead_id?: string
          premium_price?: number
          premium_tat_max?: number
          premium_tat_min?: number
          quote_token?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          condition_note: string | null
          converted_order_id: string | null
          created_at: string
          created_by: string | null
          custom_service_name: string | null
          custom_service_price: number | null
          customer_id: string
          expected_item_count: number
          id: string
          is_gold_tier: boolean
          issue_tags: Json | null
          lifecycle_status: string
          meta_campaign_name: string | null
          notes: string | null
          original_order_id: string | null
          photos_pending: boolean
          qc_checklist: Json | null
          quoted_price: number
          service_id: string | null
          source: string
          status: string
          tat_days_max: number
          tat_days_min: number
          tier: string
          updated_at: string
        }
        Insert: {
          condition_note?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_service_name?: string | null
          custom_service_price?: number | null
          customer_id: string
          expected_item_count?: number
          id?: string
          is_gold_tier?: boolean
          issue_tags?: Json | null
          lifecycle_status?: string
          meta_campaign_name?: string | null
          notes?: string | null
          original_order_id?: string | null
          photos_pending?: boolean
          qc_checklist?: Json | null
          quoted_price: number
          service_id?: string | null
          source?: string
          status?: string
          tat_days_max?: number
          tat_days_min?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          condition_note?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_service_name?: string | null
          custom_service_price?: number | null
          customer_id?: string
          expected_item_count?: number
          id?: string
          is_gold_tier?: boolean
          issue_tags?: Json | null
          lifecycle_status?: string
          meta_campaign_name?: string | null
          notes?: string | null
          original_order_id?: string | null
          photos_pending?: boolean
          qc_checklist?: Json | null
          quoted_price?: number
          service_id?: string | null
          source?: string
          status?: string
          tat_days_max?: number
          tat_days_min?: number
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_alerts: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          is_read: boolean
          item_name: string
          min_stock_level: number
          stock_level: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          is_read?: boolean
          item_name: string
          min_stock_level: number
          stock_level: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          is_read?: boolean
          item_name?: string
          min_stock_level?: number
          stock_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_alerts_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      meta_ad_spend: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          amount_spent: number
          campaign_name: string | null
          clicks: number | null
          created_at: string
          date: string
          engagement: number | null
          id: string
          impressions: number | null
          reach: number | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          amount_spent?: number
          campaign_name?: string | null
          clicks?: number | null
          created_at?: string
          date: string
          engagement?: number | null
          id?: string
          impressions?: number | null
          reach?: number | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          amount_spent?: number
          campaign_name?: string | null
          clicks?: number | null
          created_at?: string
          date?: string
          engagement?: number | null
          id?: string
          impressions?: number | null
          reach?: number | null
        }
        Relationships: []
      }
      order_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          order_id: string
          payload_hash: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          order_id: string
          payload_hash: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          order_id?: string
          payload_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_actions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_discoveries: {
        Row: {
          approved_at: string | null
          created_at: string
          description: string
          discovery_photo_url: string | null
          extra_price: number
          id: string
          order_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          description: string
          discovery_photo_url?: string | null
          extra_price?: number
          id?: string
          order_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          description?: string
          discovery_photo_url?: string | null
          extra_price?: number
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_discoveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          brand: string
          category: string
          created_at: string
          id: string
          order_id: string
          service_type: string
          sort_order: number
        }
        Insert: {
          brand: string
          category: string
          created_at?: string
          id?: string
          order_id: string
          service_type: string
          sort_order?: number
        }
        Update: {
          brand?: string
          category?: string
          created_at?: string
          id?: string
          order_id?: string
          service_type?: string
          sort_order?: number
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
      order_photos: {
        Row: {
          file_name: string
          id: string
          order_id: string
          photo_type: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          id?: string
          order_id: string
          photo_type?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          id?: string
          order_id?: string
          photo_type?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          advance_paid: number | null
          advance_required: number | null
          asset_id: string | null
          auto_sweetener_type: string | null
          auto_sweetener_value: string | null
          balance_remaining: number | null
          certificate_error: string | null
          certificate_status: string
          certificate_url: string | null
          checked_in_items: Json
          checkin_confirmed: boolean
          cleaning_fee: number | null
          consultation_start_time: string | null
          created_at: string
          created_by: string | null
          customer_approved_at: string | null
          customer_declined_at: string | null
          customer_id: string
          customer_name: string | null
          customer_phone: string | null
          decline_reason: string | null
          delivery_address: Json | null
          delivery_address_confirmed_at: string | null
          delivery_address_mode: string
          discount_amount: number | null
          discount_reason: string | null
          discovery_pending: boolean | null
          dropoff_slot: string | null
          expected_item_count: number
          final_qc_video_url: string | null
          google_review_prompted_at: string | null
          health_score: number | null
          id: string
          is_bundle_applied: boolean | null
          is_gst_applicable: boolean | null
          is_loyalty_vip: boolean | null
          lead_id: string | null
          maintenance_due: string | null
          notes: string | null
          package_tier: string | null
          packing_photo_url: string | null
          payment_declared: boolean | null
          pickup_date: string | null
          pickup_slot: string | null
          quote_sent_at: string | null
          quote_valid_until: string | null
          reminder_count: number | null
          shipping_fee: number | null
          sla_start: string | null
          slider_after_photo_id: string | null
          slider_before_photo_id: string | null
          status: string
          tax_amount: number | null
          total_amount_due: number | null
          total_price: number | null
          unique_asset_signature: string | null
          updated_at: string
          warranty_months: number | null
        }
        Insert: {
          advance_paid?: number | null
          advance_required?: number | null
          asset_id?: string | null
          auto_sweetener_type?: string | null
          auto_sweetener_value?: string | null
          balance_remaining?: number | null
          certificate_error?: string | null
          certificate_status?: string
          certificate_url?: string | null
          checked_in_items?: Json
          checkin_confirmed?: boolean
          cleaning_fee?: number | null
          consultation_start_time?: string | null
          created_at?: string
          created_by?: string | null
          customer_approved_at?: string | null
          customer_declined_at?: string | null
          customer_id: string
          customer_name?: string | null
          customer_phone?: string | null
          decline_reason?: string | null
          delivery_address?: Json | null
          delivery_address_confirmed_at?: string | null
          delivery_address_mode?: string
          discount_amount?: number | null
          discount_reason?: string | null
          discovery_pending?: boolean | null
          dropoff_slot?: string | null
          expected_item_count?: number
          final_qc_video_url?: string | null
          google_review_prompted_at?: string | null
          health_score?: number | null
          id?: string
          is_bundle_applied?: boolean | null
          is_gst_applicable?: boolean | null
          is_loyalty_vip?: boolean | null
          lead_id?: string | null
          maintenance_due?: string | null
          notes?: string | null
          package_tier?: string | null
          packing_photo_url?: string | null
          payment_declared?: boolean | null
          pickup_date?: string | null
          pickup_slot?: string | null
          quote_sent_at?: string | null
          quote_valid_until?: string | null
          reminder_count?: number | null
          shipping_fee?: number | null
          sla_start?: string | null
          slider_after_photo_id?: string | null
          slider_before_photo_id?: string | null
          status?: string
          tax_amount?: number | null
          total_amount_due?: number | null
          total_price?: number | null
          unique_asset_signature?: string | null
          updated_at?: string
          warranty_months?: number | null
        }
        Update: {
          advance_paid?: number | null
          advance_required?: number | null
          asset_id?: string | null
          auto_sweetener_type?: string | null
          auto_sweetener_value?: string | null
          balance_remaining?: number | null
          certificate_error?: string | null
          certificate_status?: string
          certificate_url?: string | null
          checked_in_items?: Json
          checkin_confirmed?: boolean
          cleaning_fee?: number | null
          consultation_start_time?: string | null
          created_at?: string
          created_by?: string | null
          customer_approved_at?: string | null
          customer_declined_at?: string | null
          customer_id?: string
          customer_name?: string | null
          customer_phone?: string | null
          decline_reason?: string | null
          delivery_address?: Json | null
          delivery_address_confirmed_at?: string | null
          delivery_address_mode?: string
          discount_amount?: number | null
          discount_reason?: string | null
          discovery_pending?: boolean | null
          dropoff_slot?: string | null
          expected_item_count?: number
          final_qc_video_url?: string | null
          google_review_prompted_at?: string | null
          health_score?: number | null
          id?: string
          is_bundle_applied?: boolean | null
          is_gst_applicable?: boolean | null
          is_loyalty_vip?: boolean | null
          lead_id?: string | null
          maintenance_due?: string | null
          notes?: string | null
          package_tier?: string | null
          packing_photo_url?: string | null
          payment_declared?: boolean | null
          pickup_date?: string | null
          pickup_slot?: string | null
          quote_sent_at?: string | null
          quote_valid_until?: string | null
          reminder_count?: number | null
          shipping_fee?: number | null
          sla_start?: string | null
          slider_after_photo_id?: string | null
          slider_before_photo_id?: string | null
          status?: string
          tax_amount?: number | null
          total_amount_due?: number | null
          total_price?: number | null
          unique_asset_signature?: string | null
          updated_at?: string
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_passport"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_markers: {
        Row: {
          created_at: string
          id: string
          label: string | null
          photo_id: string
          x_coordinate: number
          y_coordinate: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          photo_id: string
          x_coordinate: number
          y_coordinate: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          photo_id?: string
          x_coordinate?: number
          y_coordinate?: number
        }
        Relationships: [
          {
            foreignKeyName: "photo_markers_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "order_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string | null
          expert_type: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          expert_type?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          expert_type?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recovery_offers: {
        Row: {
          created_at: string
          discount_percent: number
          expires_at: string
          id: string
          lead_id: string
          offer_type: string
          responded_at: string | null
          sent_at: string
          status: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          expires_at?: string
          id?: string
          lead_id: string
          offer_type?: string
          responded_at?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          expires_at?: string
          id?: string
          lead_id?: string
          offer_type?: string
          responded_at?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_imports: {
        Row: {
          amount: number
          created_at: string
          customer_name: string | null
          date: string
          id: string
          matched_lead_id: string | null
          order_ref: string | null
          phone: string | null
          source: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          date: string
          id?: string
          matched_lead_id?: string | null
          order_ref?: string | null
          phone?: string | null
          source?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          date?: string
          id?: string
          matched_lead_id?: string | null
          order_ref?: string | null
          phone?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_imports_matched_lead_id_fkey"
            columns: ["matched_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_tag_definitions: {
        Row: {
          expert_type: string
          id: string
          is_active: boolean | null
          service_description: string
          sort_order: number | null
          tag_name: string
        }
        Insert: {
          expert_type: string
          id?: string
          is_active?: boolean | null
          service_description: string
          sort_order?: number | null
          tag_name: string
        }
        Update: {
          expert_type?: string
          id?: string
          is_active?: boolean | null
          service_description?: string
          sort_order?: number | null
          tag_name?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          icon_name: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      service_recipes: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          quantity: number
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          quantity?: number
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          quantity?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_recipes_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_recipes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string
          created_at: string
          default_price: number | null
          default_tat_max: number
          default_tat_min: number
          id: string
          is_active: boolean
          name: string
          price_range_max: number | null
          price_range_min: number | null
          requires_photos: boolean
        }
        Insert: {
          category: string
          created_at?: string
          default_price?: number | null
          default_tat_max?: number
          default_tat_min?: number
          id?: string
          is_active?: boolean
          name: string
          price_range_max?: number | null
          price_range_min?: number | null
          requires_photos?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          default_price?: number | null
          default_tat_max?: number
          default_tat_min?: number
          id?: string
          is_active?: boolean
          name?: string
          price_range_max?: number | null
          price_range_min?: number | null
          requires_photos?: boolean
        }
        Relationships: []
      }
      system_health_logs: {
        Row: {
          details: Json | null
          errors_found: number
          fixes_applied: number
          ghost_test_passed: boolean | null
          id: string
          notes: string | null
          rls_test_passed: boolean | null
          run_at: string
          run_type: string
        }
        Insert: {
          details?: Json | null
          errors_found?: number
          fixes_applied?: number
          ghost_test_passed?: boolean | null
          id?: string
          notes?: string | null
          rls_test_passed?: boolean | null
          run_at?: string
          run_type?: string
        }
        Update: {
          details?: Json | null
          errors_found?: number
          fixes_applied?: number
          ghost_test_passed?: boolean | null
          id?: string
          notes?: string | null
          rls_test_passed?: boolean | null
          run_at?: string
          run_type?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          company_upi_id: string | null
          created_at: string
          dropoff_slots: Json
          followup_days: number
          id: string
          initial_reminder_days: number
          pickup_slots: Json
          updated_at: string
          workshop_capacity: number
        }
        Insert: {
          company_upi_id?: string | null
          created_at?: string
          dropoff_slots?: Json
          followup_days?: number
          id?: string
          initial_reminder_days?: number
          pickup_slots?: Json
          updated_at?: string
          workshop_capacity?: number
        }
        Update: {
          company_upi_id?: string | null
          created_at?: string
          dropoff_slots?: Json
          followup_days?: number
          id?: string
          initial_reminder_days?: number
          pickup_slots?: Json
          updated_at?: string
          workshop_capacity?: number
        }
        Relationships: []
      }
      turns_sales: {
        Row: {
          amount: number
          created_at: string
          customer_name: string | null
          date: string
          id: string
          matched_at: string | null
          matched_lead_id: string | null
          order_ref: string | null
          phone: string | null
          qty: number | null
          sanitized_phone: string | null
          service_details: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          date: string
          id?: string
          matched_at?: string | null
          matched_lead_id?: string | null
          order_ref?: string | null
          phone?: string | null
          qty?: number | null
          sanitized_phone?: string | null
          service_details?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          date?: string
          id?: string
          matched_at?: string | null
          matched_lead_id?: string | null
          order_ref?: string | null
          phone?: string | null
          qty?: number | null
          sanitized_phone?: string | null
          service_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turns_sales_matched_lead_id_fkey"
            columns: ["matched_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_staff: { Args: never; Returns: boolean }
      convert_lead_to_order: { Args: { p_lead_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      request_rework: {
        Args: {
          p_order_id: string
          p_photos_pending?: boolean
          p_reason: string
        }
        Returns: string
      }
      transition_order_status: {
        Args: { p_order_id: string; p_payload?: Json; p_to_status: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "super_admin"
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
      app_role: ["admin", "staff", "super_admin"],
    },
  },
} as const
