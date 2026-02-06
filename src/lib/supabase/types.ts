/**
 * Supabase Types for Support Desk
 *
 * TODO: When integrating into nolimitsOS monorepo, replace these local types
 * with the shared package:
 *
 *   import type { Database, Tables } from '@nolimitos/supabase-types';
 *
 * The shared types will be located at: packages/supabase-types
 * This file can then be reduced to app-specific type extensions only.
 */

export type UserRole = 'admin' | 'agent' | 'viewer';
export type TicketStatus = 'open' | 'pending' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketChannel = 'email' | 'facebook' | 'instagram' | 'manual';
export type MessageSource = 'reply' | 'new_email' | 'merge';
export type ResourceType = 'video' | 'article' | 'faq' | 'guide';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  email_address: string;
  color: string;
  logo_url: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  team_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  team?: Team | null;
}

export interface Customer {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface AutoTagRule {
  id: string;
  name: string;
  keywords: string[];
  tag_id: string;
  match_subject: boolean;
  match_body: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tag?: Tag;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  customer_id: string | null;
  assigned_agent_id: string | null;
  assigned_team_id: string | null;
  brand_id: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  snoozed_until: string | null;
  snoozed_by: string | null;
  merged_into_ticket_id: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer | null;
  assigned_agent?: Profile | null;
  assigned_team?: Team | null;
  brand?: Brand | null;
  tags?: Tag[];
}

export interface TicketWithRelations extends Ticket {
  customer: Customer | null;
  assigned_agent: Profile | null;
  assigned_team: Team | null;
  brand: Brand | null;
  tags: Tag[];
  messages?: Message[];
}

export type MatchField =
  | 'ticket_number'
  | 'subject'
  | 'customer_name'
  | 'customer_email'
  | 'message';

export interface TicketSearchResult extends TicketWithRelations {
  match_field?: MatchField;
}

export interface Message {
  id: string;
  ticket_id: string;
  sender_type: 'customer' | 'agent';
  sender_id: string | null;
  content: string;
  is_internal: boolean;
  source: MessageSource;
  attachments: Attachment[];
  created_at: string;
  sender?: Profile | Customer | null;
}

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
  category: string | null;
  brand_id: string | null;
  created_by: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  brand?: Brand | null;
}

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  type: ResourceType;
  category: string | null;
  brand_id: string | null;
  thumbnail_url: string | null;
  file_path: string | null;
  is_uploaded: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  brand?: Brand | null;
}

export interface TicketActivity {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: Profile | null;
}

export interface TicketPresence {
  id: string;
  ticket_id: string;
  user_id: string;
  last_seen_at: string;
  is_typing: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      teams: {
        Row: Team;
        Insert: Omit<Team, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Team, 'id' | 'created_at'>>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>;
      };
      tags: {
        Row: Tag;
        Insert: Omit<Tag, 'id' | 'created_at'>;
        Update: Partial<Omit<Tag, 'id' | 'created_at'>>;
      };
      tickets: {
        Row: Ticket;
        Insert: Omit<Ticket, 'id' | 'ticket_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Ticket, 'id' | 'ticket_number' | 'created_at'>>;
      };
      ticket_tags: {
        Row: { ticket_id: string; tag_id: string };
        Insert: { ticket_id: string; tag_id: string };
        Update: never;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: never;
      };
      canned_responses: {
        Row: CannedResponse;
        Insert: Omit<CannedResponse, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CannedResponse, 'id' | 'created_at'>>;
      };
      ticket_activities: {
        Row: TicketActivity;
        Insert: Omit<TicketActivity, 'id' | 'created_at'>;
        Update: never;
      };
      auto_tag_rules: {
        Row: AutoTagRule;
        Insert: Omit<AutoTagRule, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AutoTagRule, 'id' | 'created_at'>>;
      };
      ticket_presence: {
        Row: TicketPresence;
        Insert: Omit<TicketPresence, 'id' | 'created_at'>;
        Update: Partial<Omit<TicketPresence, 'id' | 'created_at'>>;
      };
      resources: {
        Row: Resource;
        Insert: Omit<Resource, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Resource, 'id' | 'created_at'>>;
      };
      brands: {
        Row: Brand;
        Insert: Omit<Brand, 'id' | 'created_at'>;
        Update: Partial<Omit<Brand, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      get_user_role: {
        Args: Record<string, never>;
        Returns: UserRole;
      };
      get_user_team_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      get_ticket_volume: {
        Args: { start_date: string; end_date: string };
        Returns: { date: string; opened: number; closed: number }[];
      };
      get_response_time_stats: {
        Args: { start_date: string; end_date: string };
        Returns: {
          avg_first_response_minutes: number;
          avg_resolution_minutes: number;
          total_tickets: number;
          tickets_with_response: number;
        }[];
      };
      get_agent_performance: {
        Args: { start_date: string; end_date: string };
        Returns: {
          agent_id: string;
          agent_name: string;
          tickets_resolved: number;
          avg_response_minutes: number;
          avg_resolution_minutes: number;
        }[];
      };
      search_tickets: {
        Args: {
          search_term: string;
          status_filter?: TicketStatus | null;
          priority_filter?: TicketPriority | null;
          assignee_filter?: string | null;
          assignee_unassigned?: boolean;
          channel_filter?: TicketChannel | null;
        };
        Returns: {
          id: string;
          ticket_number: number;
          subject: string;
          status: TicketStatus;
          priority: TicketPriority;
          channel: TicketChannel | null;
          customer_id: string | null;
          assigned_agent_id: string | null;
          assigned_team_id: string | null;
          first_response_at: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
          match_field: MatchField;
          customer_email: string | null;
          customer_full_name: string | null;
          customer_phone: string | null;
          customer_avatar_url: string | null;
          customer_metadata: Record<string, unknown> | null;
          customer_created_at: string | null;
          customer_updated_at: string | null;
          agent_email: string | null;
          agent_full_name: string | null;
          agent_avatar_url: string | null;
          agent_role: UserRole | null;
          agent_team_id: string | null;
          agent_is_active: boolean | null;
          team_name: string | null;
          team_description: string | null;
        }[];
      };
    };
  };
}
