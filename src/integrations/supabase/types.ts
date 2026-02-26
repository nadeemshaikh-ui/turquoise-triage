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
          service_affinity: string[] | null
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
          service_affinity?: string[] | null
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
          service_affinity?: string[] | null
          updated_at?: string
        }
        Relationships: []
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
          created_at: string
          created_by: string | null
          custom_service_name: string | null
          custom_service_price: number | null
          customer_id: string
          id: string
          is_gold_tier: boolean
          issue_tags: Json | null
          meta_campaign_name: string | null
          notes: string | null
          qc_checklist: Json | null
          quoted_price: number
          service_id: string | null
          status: string
          tat_days_max: number
          tat_days_min: number
          tier: string
          updated_at: string
        }
        Insert: {
          condition_note?: string | null
          created_at?: string
          created_by?: string | null
          custom_service_name?: string | null
          custom_service_price?: number | null
          customer_id: string
          id?: string
          is_gold_tier?: boolean
          issue_tags?: Json | null
          meta_campaign_name?: string | null
          notes?: string | null
          qc_checklist?: Json | null
          quoted_price: number
          service_id?: string | null
          status?: string
          tat_days_max?: number
          tat_days_min?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          condition_note?: string | null
          created_at?: string
          created_by?: string | null
          custom_service_name?: string | null
          custom_service_price?: number | null
          customer_id?: string
          id?: string
          is_gold_tier?: boolean
          issue_tags?: Json | null
          meta_campaign_name?: string | null
          notes?: string | null
          qc_checklist?: Json | null
          quoted_price?: number
          service_id?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
