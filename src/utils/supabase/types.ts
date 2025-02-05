export type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY';
export type UserRole = 'ADMIN' | 'USER';
export type ChannelRole = 'ADMIN' | 'MEMBER';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          status: UserStatus;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      channels: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_private: boolean;
          created_by_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['channels']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['channels']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          content: string;
          channel_id: string;
          user_id: string;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      message_reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['message_reactions']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['message_reactions']['Insert']>;
      };
      files: {
        Row: {
          id: string;
          url: string;
          message_id: string;
          user_id: string;
          uploaded_at: string;
        };
        Insert: Omit<Database['public']['Tables']['files']['Row'], 'uploaded_at'>;
        Update: Partial<Database['public']['Tables']['files']['Insert']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      vector_begin_transaction: {
        Args: Record<string, never>;
        Returns: void;
      };
      vector_commit_transaction: {
        Args: Record<string, never>;
        Returns: void;
      };
      vector_rollback_transaction: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: {
      user_status: UserStatus;
      user_role: UserRole;
      channel_role: ChannelRole;
    };
  };
  vector_store: {
    Tables: {
      message_embeddings_dev: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          content_embedding: number[];
          content_embedding_small: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['vector_store']['Tables']['message_embeddings_dev']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['vector_store']['Tables']['message_embeddings_dev']['Insert']>;
      };
      message_embeddings_prod: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          content_embedding: number[];
          content_embedding_small: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['vector_store']['Tables']['message_embeddings_prod']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['vector_store']['Tables']['message_embeddings_prod']['Insert']>;
      };
    };
  };
};

export type Message = Database['public']['Tables']['messages']['Row']; 