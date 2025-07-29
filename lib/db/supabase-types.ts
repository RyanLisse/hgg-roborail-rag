export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '12.2.12 (cd3cf9e)';
  };
  public: {
    Tables: {
      Chat: {
        Row: {
          createdAt: string;
          id: string;
          title: string;
          userId: string;
          visibility: string;
        };
        Insert: {
          createdAt?: string;
          id: string;
          title: string;
          userId: string;
          visibility?: string;
        };
        Update: {
          createdAt?: string;
          id?: string;
          title?: string;
          userId?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'Chat_userId_fkey';
            columns: ['userId'];
            isOneToOne: false;
            referencedRelation: 'User';
            referencedColumns: ['id'];
          },
        ];
      };
      Document: {
        Row: {
          content: string | null;
          createdAt: string;
          id: string;
          kind: string;
          title: string;
          userId: string;
        };
        Insert: {
          content?: string | null;
          createdAt?: string;
          id: string;
          kind?: string;
          title: string;
          userId: string;
        };
        Update: {
          content?: string | null;
          createdAt?: string;
          id?: string;
          kind?: string;
          title?: string;
          userId?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'Document_userId_fkey';
            columns: ['userId'];
            isOneToOne: false;
            referencedRelation: 'User';
            referencedColumns: ['id'];
          },
        ];
      };
      Message: {
        Row: {
          attachments: Json;
          chatId: string;
          createdAt: string;
          id: string;
          parts: Json;
          role: string;
        };
        Insert: {
          attachments?: Json;
          chatId: string;
          createdAt?: string;
          id: string;
          parts: Json;
          role: string;
        };
        Update: {
          attachments?: Json;
          chatId?: string;
          createdAt?: string;
          id?: string;
          parts?: Json;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'Message_chatId_fkey';
            columns: ['chatId'];
            isOneToOne: false;
            referencedRelation: 'Chat';
            referencedColumns: ['id'];
          },
        ];
      };
      Suggestion: {
        Row: {
          createdAt: string;
          description: string | null;
          documentCreatedAt: string;
          documentId: string;
          id: string;
          isResolved: boolean;
          originalText: string;
          suggestedText: string;
          userId: string;
        };
        Insert: {
          createdAt?: string;
          description?: string | null;
          documentCreatedAt: string;
          documentId: string;
          id: string;
          isResolved?: boolean;
          originalText: string;
          suggestedText: string;
          userId: string;
        };
        Update: {
          createdAt?: string;
          description?: string | null;
          documentCreatedAt?: string;
          documentId?: string;
          id?: string;
          isResolved?: boolean;
          originalText?: string;
          suggestedText?: string;
          userId?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'Suggestion_userId_fkey';
            columns: ['userId'];
            isOneToOne: false;
            referencedRelation: 'User';
            referencedColumns: ['id'];
          },
        ];
      };
      User: {
        Row: {
          email: string;
          id: string;
          password: string | null;
          type: string;
        };
        Insert: {
          email: string;
          id: string;
          password?: string | null;
          type?: string;
        };
        Update: {
          email?: string;
          id?: string;
          password?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      Vote: {
        Row: {
          chatId: string;
          isUpvoted: boolean;
          messageId: string;
        };
        Insert: {
          chatId: string;
          isUpvoted: boolean;
          messageId: string;
        };
        Update: {
          chatId?: string;
          isUpvoted?: boolean;
          messageId?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'Vote_chatId_fkey';
            columns: ['chatId'];
            isOneToOne: false;
            referencedRelation: 'Chat';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'Vote_messageId_fkey';
            columns: ['messageId'];
            isOneToOne: false;
            referencedRelation: 'Message';
            referencedColumns: ['id'];
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
