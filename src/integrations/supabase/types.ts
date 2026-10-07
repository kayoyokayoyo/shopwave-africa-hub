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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      orders: {
        Row: {
          created_at: string
          currency: string
          customer_name: string
          id: string
          items: Json
          notes: string | null
          shop_id: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
        }
        Insert: {
          created_at?: string
          currency: string
          customer_name: string
          id?: string
          items: Json
          notes?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total: number
        }
        Update: {
          created_at?: string
          currency?: string
          customer_name?: string
          id?: string
          items?: Json
          notes?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          shop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          shop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          featured: boolean
          id: string
          images: string[]
          name: string
          price: number
          shop_id: string
          status: Database["public"]["Enums"]["product_status"]
          stock: number | null
          updated_at: string
          variants: Json
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          id?: string
          images?: string[]
          name: string
          price: number
          shop_id: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          updated_at?: string
          variants?: Json
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          id?: string
          images?: string[]
          name?: string
          price?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          updated_at?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          address: string | null
          banner_url: string | null
          category: string | null
          city: string | null
          created_at: string
          currency: string
          description: string | null
          facebook: string | null
          hours: string | null
          id: string
          instagram: string | null
          is_published: boolean
          is_suspended: boolean
          logo_url: string | null
          name: string
          owner_id: string
          primary_color: string
          slug: string
          slug_changed: boolean
          theme: string
          tiktok: string | null
          updated_at: string
          views: number
          whatsapp: string
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          facebook?: string | null
          hours?: string | null
          id?: string
          instagram?: string | null
          is_published?: boolean
          is_suspended?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          primary_color?: string
          slug: string
          slug_changed?: boolean
          theme?: string
          tiktok?: string | null
          updated_at?: string
          views?: number
          whatsapp: string
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          facebook?: string | null
          hours?: string | null
          id?: string
          instagram?: string | null
          is_published?: boolean
          is_suspended?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          primary_color?: string
          slug?: string
          slug_changed?: boolean
          theme?: string
          tiktok?: string | null
          updated_at?: string
          views?: number
          whatsapp?: string
        }
        Relationships: []
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
      increment_shop_view: { Args: { _slug: string }; Returns: undefined }
      is_shop_owner: { Args: { _shop_id: string }; Returns: boolean }
      is_shop_public: { Args: { _shop_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "merchant"
      order_status: "new" | "confirmed" | "delivered" | "cancelled"
      product_status: "active" | "hidden" | "out_of_stock"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "merchant"],
      order_status: ["new", "confirmed", "delivered", "cancelled"],
      product_status: ["active", "hidden", "out_of_stock"],
    },
  },
} as const
