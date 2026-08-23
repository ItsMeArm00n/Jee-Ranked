export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      match_answers: {
        Row: {
          answered_at: string;
          choice: string | null;
          id: string;
          is_correct: boolean;
          match_id: string;
          question_index: number;
          user_id: string;
        };
        Insert: {
          answered_at?: string;
          choice?: string | null;
          id?: string;
          is_correct?: boolean;
          match_id: string;
          question_index: number;
          user_id: string;
        };
        Update: {
          answered_at?: string;
          choice?: string | null;
          id?: string;
          is_correct?: boolean;
          match_id?: string;
          question_index?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_answers_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          bot_schedule: Json | null;
          created_at: string;
          duration_seconds: number;
          ends_at: string | null;
          finished_at: string | null;
          id: string;
          is_bot_match: boolean;
          is_ranked: boolean;
          player1_delta: number | null;
          player1_elo_before: number | null;
          player1_id: string;
          player2_delta: number | null;
          player2_elo_before: number | null;
          player2_id: string | null;
          question_ids: string[];
          started_at: string | null;
          status: string;
          subject_filter: string | null;
          winner_id: string | null;
        };
        Insert: {
          bot_schedule?: Json | null;
          created_at?: string;
          duration_seconds?: number;
          ends_at?: string | null;
          finished_at?: string | null;
          id?: string;
          is_bot_match?: boolean;
          is_ranked?: boolean;
          player1_delta?: number | null;
          player1_elo_before?: number | null;
          player1_id: string;
          player2_delta?: number | null;
          player2_elo_before?: number | null;
          player2_id?: string | null;
          question_ids: string[];
          started_at?: string | null;
          status?: string;
          subject_filter?: string | null;
          winner_id?: string | null;
        };
        Update: {
          bot_schedule?: Json | null;
          created_at?: string;
          duration_seconds?: number;
          ends_at?: string | null;
          finished_at?: string | null;
          id?: string;
          is_bot_match?: boolean;
          is_ranked?: boolean;
          player1_delta?: number | null;
          player1_elo_before?: number | null;
          player1_id?: string;
          player2_delta?: number | null;
          player2_elo_before?: number | null;
          player2_id?: string | null;
          question_ids?: string[];
          started_at?: string | null;
          status?: string;
          subject_filter?: string | null;
          winner_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          draws: number;
          elo: number;
          id: string;
          is_bot: boolean;
          losses: number;
          matches_played: number;
          username: string;
          wins: number;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          draws?: number;
          elo?: number;
          id: string;
          is_bot?: boolean;
          losses?: number;
          matches_played?: number;
          username: string;
          wins?: number;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          draws?: number;
          elo?: number;
          id?: string;
          is_bot?: boolean;
          losses?: number;
          matches_played?: number;
          username?: string;
          wins?: number;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          correct_option: string;
          created_at: string;
          id: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          stem: string;
          subject: string;
          topic: string;
        };
        Insert: {
          correct_option: string;
          created_at?: string;
          id?: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          stem: string;
          subject: string;
          topic: string;
        };
        Update: {
          correct_option?: string;
          created_at?: string;
          id?: string;
          option_a?: string;
          option_b?: string;
          option_c?: string;
          option_d?: string;
          stem?: string;
          subject?: string;
          topic?: string;
        };
        Relationships: [];
      };
      question_reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          match_id: string | null;
          question_id: string;
          question_index: number | null;
          reason: string;
          reported_by: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          match_id?: string | null;
          question_id: string;
          question_index?: number | null;
          reason: string;
          reported_by: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          match_id?: string | null;
          question_id?: string;
          question_index?: number | null;
          reason?: string;
          reported_by?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_reports_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_reports_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
