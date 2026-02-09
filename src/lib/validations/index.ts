import { z } from 'zod';

// ============================================
// Common schemas
// ============================================

export const uuidSchema = z.string().uuid();

export const ticketStatusSchema = z.enum(['open', 'pending', 'closed']);
export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const userRoleSchema = z.enum(['admin', 'agent', 'viewer']);

// ============================================
// Ticket schemas
// ============================================

export const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  priority: ticketPrioritySchema,
  customerEmail: z.string().email('Invalid email'),
  customerName: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
});

export const updateTicketStatusSchema = z.object({
  ticketId: uuidSchema,
  status: ticketStatusSchema,
});

export const updateTicketPrioritySchema = z.object({
  ticketId: uuidSchema,
  priority: ticketPrioritySchema,
});

export const assignTicketSchema = z.object({
  ticketId: uuidSchema,
  agentId: uuidSchema.nullable(),
});

export const assignTicketToTeamSchema = z.object({
  ticketId: uuidSchema,
  teamId: uuidSchema.nullable(),
});

export const ticketTagSchema = z.object({
  ticketId: uuidSchema,
  tagId: uuidSchema,
});

// ============================================
// Message schemas
// ============================================

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string().url(),
  path: z.string(),
});

export const sendMessageSchema = z.object({
  ticketId: uuidSchema,
  content: z.string(),
  isInternal: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional(),
}).refine(
  (data) => data.content.trim().length > 0 || (data.attachments && data.attachments.length > 0),
  { message: 'Message content or attachments required', path: ['content'] }
);

// ============================================
// Customer schemas
// ============================================

export const createCustomerSchema = z.object({
  email: z.string().email('Invalid email'),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateCustomerSchema = z.object({
  id: uuidSchema,
  full_name: z.string().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// Canned response schemas
// ============================================

export const createCannedResponseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  shortcut: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  is_shared: z.boolean().optional(),
  brand_id: uuidSchema.nullable().optional(),
});

export const updateCannedResponseSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  shortcut: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  is_shared: z.boolean().optional(),
  brand_id: uuidSchema.nullable().optional(),
});

// ============================================
// Tag schemas
// ============================================

export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  description: z.string().max(500).optional(),
});

export const updateTagSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(500).nullable().optional(),
});

// ============================================
// Profile schemas
// ============================================

export const updateProfileSchema = z.object({
  full_name: z.string().max(200).optional(),
});

export const updateUserRoleSchema = z.object({
  userId: uuidSchema,
  role: userRoleSchema,
});

export const updateUserTeamSchema = z.object({
  userId: uuidSchema,
  teamId: uuidSchema.nullable(),
});

export const toggleUserActiveSchema = z.object({
  userId: uuidSchema,
  isActive: z.boolean(),
});

// ============================================
// Resource schemas
// ============================================

export const resourceTypeSchema = z.enum(['video', 'article', 'faq', 'guide']);

export const createResourceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(500).optional(),
  url: z.string().url('Must be a valid URL'),
  type: resourceTypeSchema,
  category: z.string().max(100).optional(),
  thumbnail_url: z.string().url().optional().or(z.literal('')),
  file_path: z.string().optional(),
  is_uploaded: z.boolean().optional(),
  brand_id: uuidSchema.nullable().optional(),
});

export const updateResourceSchema = createResourceSchema.extend({
  id: uuidSchema,
});

// ============================================
// Type exports (inferred from schemas)
// ============================================

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateCannedResponseInput = z.infer<typeof createCannedResponseSchema>;
export type UpdateCannedResponseInput = z.infer<typeof updateCannedResponseSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserTeamInput = z.infer<typeof updateUserTeamSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
