export interface Message {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
} 