'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type NotificationType = 'ticket_assigned' | 'ticket_mentioned' | 'snooze_expired';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  ticket_id: string | null;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(limit = 20): Promise<{ notifications: Notification[] } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Get notifications error:', error);
    return { error: 'Failed to fetch notifications' };
  }

  return { notifications: data as Notification[] };
}

export async function getUnreadCount(): Promise<{ count: number } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Get unread count error:', error);
    return { error: 'Failed to fetch unread count' };
  }

  return { count: count || 0 };
}

export async function markAsRead(notificationId: string): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Mark as read error:', error);
    return { error: 'Failed to mark notification as read' };
  }

  revalidatePath('/');
  return { success: true };
}

export async function markAllAsRead(): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Mark all as read error:', error);
    return { error: 'Failed to mark all notifications as read' };
  }

  revalidatePath('/');
  return { success: true };
}

// Helper function to create a notification (used by other server actions)
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  ticketId?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      ticket_id: ticketId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Create notification error:', error);
    return { error: 'Failed to create notification' };
  }

  return { id: data.id };
}
