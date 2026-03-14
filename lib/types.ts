export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
        };
        Update: {
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          merchant_name: string;
          amount: number;
          status: "approved" | "review" | "blocked";
          risk_score: number;
          payment_method: string;
          ip_address: string;
          country: string;
          device_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          merchant_name: string;
          amount: number;
          status: "approved" | "review" | "blocked";
          risk_score: number;
          payment_method: string;
          ip_address: string;
          country: string;
          device_id: string;
        };
        Update: {
          merchant_name?: string;
          amount?: number;
          status?: "approved" | "review" | "blocked";
          risk_score?: number;
          payment_method?: string;
          ip_address?: string;
          country?: string;
          device_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fraud_cases: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          transaction_id: string | null;
          title: string;
          reason: string;
          status: "open" | "investigating" | "resolved";
          severity: "low" | "medium" | "high";
          assigned_to: string | null;
          resolution_notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          transaction_id?: string | null;
          title: string;
          reason: string;
          status: "open" | "investigating" | "resolved";
          severity: "low" | "medium" | "high";
          assigned_to?: string | null;
          resolution_notes?: string | null;
        };
        Update: {
          transaction_id?: string | null;
          title?: string;
          reason?: string;
          status?: "open" | "investigating" | "resolved";
          severity?: "low" | "medium" | "high";
          assigned_to?: string | null;
          resolution_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type FraudCase = Database["public"]["Tables"]["fraud_cases"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
