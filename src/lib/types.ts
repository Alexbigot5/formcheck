// Base types
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// User and Authentication types
export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  team_id: string;
  is_active: boolean;
  last_login?: string;
}

export type UserRole = 'admin' | 'manager' | 'agent' | 'viewer';

export interface AuthResponse {
  token: string;
  user: User;
  team_id: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  company_name: string;
}

// Lead types
export interface Lead extends BaseEntity {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  source: string;
  form_id?: string;
  team_id: string;
  assigned_to?: string;
  status: LeadStatus;
  score?: number;
  priority: LeadPriority;
  tags: string[];
  custom_fields: Record<string, any>;
  last_activity?: string;
  conversion_value?: number;
  notes?: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost' | 'nurturing';
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface LeadFilters {
  status?: LeadStatus[];
  priority?: LeadPriority[];
  source?: string[];
  assigned_to?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  score_range?: {
    min: number;
    max: number;
  };
  tags?: string[];
  search?: string;
}

// Timeline and Activity types
export interface TimelineEvent extends BaseEntity {
  lead_id: string;
  event_type: TimelineEventType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  user_id?: string;
  user_name?: string;
}

export type TimelineEventType = 
  | 'lead_created'
  | 'lead_updated'
  | 'lead_assigned'
  | 'lead_scored'
  | 'email_sent'
  | 'email_opened'
  | 'email_clicked'
  | 'form_submitted'
  | 'call_made'
  | 'meeting_scheduled'
  | 'note_added'
  | 'status_changed'
  | 'integration_sync';

// Scoring types
export interface ScoringConfig extends BaseEntity {
  name: string;
  description?: string;
  team_id: string;
  is_active: boolean;
  rules: ScoringRule[];
}

export interface ScoringRule extends BaseEntity {
  config_id: string;
  condition_type: ScoringConditionType;
  field_name: string;
  operator: ScoringOperator;
  value: string;
  points: number;
  is_active: boolean;
  weight?: number;
}

export type ScoringConditionType = 'demographic' | 'behavioral' | 'engagement' | 'firmographic';
export type ScoringOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';

// Routing types
export interface RoutingRule extends BaseEntity {
  name: string;
  description?: string;
  team_id: string;
  priority: number;
  is_active: boolean;
  conditions: RoutingCondition[];
  actions: RoutingAction[];
}

export interface RoutingCondition {
  field: string;
  operator: string;
  value: string;
  logic_operator?: 'AND' | 'OR';
}

export interface RoutingAction {
  type: RoutingActionType;
  target: string;
  parameters?: Record<string, any>;
}

export type RoutingActionType = 'assign_to_user' | 'assign_to_team' | 'set_priority' | 'add_tag' | 'send_notification' | 'create_task';

// SLA and Settings types
export interface SLASetting extends BaseEntity {
  name: string;
  team_id: string;
  lead_priority: LeadPriority;
  response_time_hours: number;
  escalation_time_hours?: number;
  escalation_user_id?: string;
  is_active: boolean;
}

// Integration types
export interface Integration extends BaseEntity {
  name: string;
  type: IntegrationType;
  team_id: string;
  config: Record<string, any>;
  is_active: boolean;
  last_sync?: string;
  sync_frequency?: number;
  error_count: number;
  last_error?: string;
}

export type IntegrationType = 
  | 'salesforce'
  | 'hubspot'
  | 'pipedrive'
  | 'mailchimp'
  | 'sendgrid'
  | 'slack'
  | 'zapier'
  | 'webhook'
  | 'email_imap'
  | 'calendar';

export interface IntegrationHealth {
  integration_id: string;
  status: IntegrationStatus;
  last_check: string;
  response_time_ms?: number;
  error_message?: string;
  success_rate_24h: number;
  total_syncs_24h: number;
  failed_syncs_24h: number;
}

export type IntegrationStatus = 'healthy' | 'warning' | 'error' | 'disconnected';

// API Key types
export interface ApiKey extends BaseEntity {
  name: string;
  key: string;
  team_id: string;
  permissions: ApiKeyPermission[];
  last_used?: string;
  expires_at?: string;
  is_active: boolean;
  usage_count: number;
  rate_limit?: number;
}

export type ApiKeyPermission = 'read_leads' | 'write_leads' | 'read_forms' | 'write_forms' | 'read_analytics' | 'admin';

// Form types
export interface Form extends BaseEntity {
  name: string;
  description?: string;
  team_id: string;
  fields: FormField[];
  settings: FormSettings;
  is_active: boolean;
  submission_count: number;
  conversion_rate?: number;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  validation?: FormFieldValidation;
  order: number;
}

export type FormFieldType = 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file';

export interface FormFieldValidation {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  custom_message?: string;
}

export interface FormSettings {
  redirect_url?: string;
  thank_you_message?: string;
  notification_emails?: string[];
  auto_response_enabled: boolean;
  auto_response_template_id?: string;
  spam_protection_enabled: boolean;
  captcha_enabled: boolean;
}

// Email Template types
export interface EmailTemplate extends BaseEntity {
  name: string;
  subject: string;
  content: string;
  template_type: EmailTemplateType;
  team_id: string;
  variables: EmailTemplateVariable[];
  is_active: boolean;
  usage_count: number;
}

export type EmailTemplateType = 'welcome' | 'follow_up' | 'nurture' | 'proposal' | 'thank_you' | 'reminder' | 'custom';

export interface EmailTemplateVariable {
  name: string;
  description: string;
  default_value?: string;
  required: boolean;
}

// Analytics types
export interface AnalyticsData {
  period: string;
  leads_count: number;
  conversion_rate: number;
  avg_score: number;
  response_time_avg: number;
  top_sources: SourceMetric[];
  lead_status_distribution: StatusMetric[];
  activity_timeline: ActivityMetric[];
}

export interface SourceMetric {
  source: string;
  count: number;
  conversion_rate: number;
}

export interface StatusMetric {
  status: LeadStatus;
  count: number;
  percentage: number;
}

export interface ActivityMetric {
  date: string;
  leads_created: number;
  leads_converted: number;
  emails_sent: number;
  calls_made: number;
}

// API Response types - Standardized format
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

// Legacy format for backward compatibility
export interface LegacyApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T = any> {
  ok: boolean;
  data?: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  error?: string;
}

// Upload types
export interface UploadResponse {
  ok: boolean;
  data?: {
    file_url: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  };
  error?: string;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

// Utility types
export type CreateRequest<T> = Omit<T, keyof BaseEntity>;
export type UpdateRequest<T> = Partial<Omit<T, keyof BaseEntity>>;

// Query and Mutation types for React Query
export interface QueryOptions {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number;
}

export interface MutationCallbacks<TData = any, TError = ApiError, TVariables = any> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: TError, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void;
}

// Unibox types
export type Channel = 'email' | 'sms' | 'linkedin' | 'webform';
export type ConvStatus = 'open' | 'snoozed' | 'closed';

export interface Conversation {
  id: string;
  subject: string;
  contactName?: string;
  contactHandle?: string; // email/phone/LI
  channel: Channel;
  leadId?: string;
  leadName?: string;
  assigneeId?: string;
  assigneeName?: string;
  status: ConvStatus;
  lastMessageAt: string;   // ISO
  slaDueAt?: string;       // ISO
  unread: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'in' | 'out' | 'note';
  body: string;
  sentAt: string; // ISO
  authorName?: string;
}
