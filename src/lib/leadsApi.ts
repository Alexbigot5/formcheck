import apiClient from './apiClient';

// Types for leads functionality
export interface Lead {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  domain?: string;
  source: string;
  sourceRef?: string;
  fields: Record<string, any>;
  utm: Record<string, any>;
  score: number;
  scoreBand: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    user: {
      email: string;
      firstName?: string;
      lastName?: string;
    };
  };
  ownerName?: string;
  slaStatus?: 'overdue' | 'due_soon' | 'on_track' | null;
  slaCountdown?: {
    targetAt: string;
    minutesRemaining: number;
    isOverdue: boolean;
    status: string;
  } | null;
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  status?: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  source?: string;
  scoreBand?: 'LOW' | 'MEDIUM' | 'HIGH';
  ownerId?: string;
  search?: string;
  sla?: 'overdue' | 'due_soon' | 'all';
}

export interface LeadsResponse {
  leads: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TimelineEvent {
  id: string;
  type: 'message' | 'event';
  timestamp: string;
  data: {
    // For messages
    direction?: 'IN' | 'OUT';
    channel?: 'FORM' | 'EMAIL' | 'DM' | 'API';
    subject?: string;
    body?: string;
    
    // For events
    eventType?: 'FORM_SUBMISSION' | 'EMAIL_RECEIVED' | 'DM_RECEIVED' | 'CRM_UPDATE' | 'ROUTED' | 'SLA_ESCALATED' | 'SCORE_UPDATED';
    payload?: Record<string, any>;
  };
}

export interface TimelineResponse {
  timeline: TimelineEvent[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface LeadDetails extends Lead {
  messages: Array<{
    id: string;
    direction: 'IN' | 'OUT';
    channel: 'FORM' | 'EMAIL' | 'DM' | 'API';
    subject?: string;
    body: string;
    meta: Record<string, any>;
    createdAt: string;
  }>;
  timelineEvents: Array<{
    id: string;
    type: 'FORM_SUBMISSION' | 'EMAIL_RECEIVED' | 'DM_RECEIVED' | 'CRM_UPDATE' | 'ROUTED' | 'SLA_ESCALATED' | 'SCORE_UPDATED';
    payload: Record<string, any>;
    createdAt: string;
  }>;
  slaClocks: Array<{
    id: string;
    targetAt: string;
    satisfiedAt?: string;
    escalatedAt?: string;
  }>;
}

export interface CreateLead {
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  domain?: string;
  source: string;
  sourceRef?: string;
  fields?: Record<string, any>;
  utm?: Record<string, any>;
  score?: number;
  scoreBand?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface UpdateLead {
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  domain?: string;
  score?: number;
  scoreBand?: 'LOW' | 'MEDIUM' | 'HIGH';
  status?: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  ownerId?: string;
}

// Leads API functions
export const leadsApi = {
  // GET /api/leads - List leads with filtering and pagination
  async getLeads(filters: LeadFilters = {}): Promise<LeadsResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await apiClient.get(`/api/leads?${params.toString()}`);
    return response.data;
  },

  // GET /api/leads/:id - Get lead details
  async getLead(id: string): Promise<LeadDetails> {
    const response = await apiClient.get(`/api/leads/${id}`);
    return response.data;
  },

  // GET /leads/:id/timeline - Get merged timeline
  async getTimeline(id: string, limit: number = 50, offset: number = 0): Promise<TimelineResponse> {
    const response = await apiClient.get(`/leads/${id}/timeline`, {
      params: { limit, offset }
    });
    return response.data;
  },

  // POST /api/leads - Create new lead
  async createLead(leadData: CreateLead): Promise<{
    action: 'created' | 'merged' | 'skipped';
    leadId: string;
    duplicateId?: string;
    message: string;
  }> {
    const response = await apiClient.post('/api/leads', leadData);
    return response.data;
  },

  // PUT /api/leads/:id - Update lead
  async updateLead(id: string, updates: UpdateLead): Promise<Lead> {
    const response = await apiClient.put(`/api/leads/${id}`, updates);
    return response.data;
  },

  // POST /api/leads/:id/timeline - Add timeline event
  async addTimelineEvent(id: string, event: {
    type: string;
    payload: Record<string, any>;
  }): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/leads/${id}/timeline`, event);
    return response.data;
  },

  // Get leads summary/stats
  async getLeadsSummary(): Promise<{
    total: number;
    new: number;
    assigned: number;
    inProgress: number;
    closed: number;
    overdueSLAs: number;
    dueSoonSLAs: number;
  }> {
    const [allLeads, newLeads, assignedLeads, inProgressLeads, closedLeads, overdueLeads, dueSoonLeads] = await Promise.all([
      this.getLeads({ limit: 1 }),
      this.getLeads({ status: 'NEW', limit: 1 }),
      this.getLeads({ status: 'ASSIGNED', limit: 1 }),
      this.getLeads({ status: 'IN_PROGRESS', limit: 1 }),
      this.getLeads({ status: 'CLOSED', limit: 1 }),
      this.getLeads({ sla: 'overdue', limit: 1 }),
      this.getLeads({ sla: 'due_soon', limit: 1 })
    ]);

    return {
      total: allLeads.pagination.total,
      new: newLeads.pagination.total,
      assigned: assignedLeads.pagination.total,
      inProgress: inProgressLeads.pagination.total,
      closed: closedLeads.pagination.total,
      overdueSLAs: overdueLeads.pagination.total,
      dueSoonSLAs: dueSoonLeads.pagination.total
    };
  }
};

// Lead Actions API
export const leadActionsApi = {
  // PUT /leads/:id/score - Update lead score
  async updateScore(id: string, score: number, scoreBand: 'LOW' | 'MEDIUM' | 'HIGH', reason?: string): Promise<{
    lead: Lead;
    message: string;
  }> {
    const response = await apiClient.put(`/leads/${id}/score`, {
      score,
      scoreBand,
      reason
    });
    return response.data;
  },

  // PUT /leads/:id/assign - Assign lead to owner
  async assignOwner(id: string, ownerId: string, reason?: string, sla?: number): Promise<{
    lead: Lead;
    message: string;
  }> {
    const response = await apiClient.put(`/leads/${id}/assign`, {
      ownerId,
      reason,
      sla
    });
    return response.data;
  },

  // POST /messages - Create message (first touch)
  async createMessage(leadId: string, body: string, subject?: string, channel: 'EMAIL' | 'DM' | 'API' = 'API'): Promise<{
    message: any;
    slaUpdate?: {
      satisfied: boolean;
      clockId?: string;
    };
  }> {
    const response = await apiClient.post('/messages', {
      leadId,
      direction: 'OUT',
      channel,
      subject,
      body,
      meta: {}
    });
    return response.data;
  },

  // POST /crm/sync/lead/:id - Sync to CRM
  async syncToCrm(id: string, dryRun: boolean = false, provider?: string): Promise<{
    dryRun: boolean;
    provider: string;
    payload: Record<string, any>;
    result?: any;
    diff?: {
      added: Record<string, any>;
      changed: Record<string, { from: any; to: any }>;
      removed: string[];
    };
    message: string;
  }> {
    const params = new URLSearchParams();
    if (dryRun) params.append('dryRun', '1');
    if (provider) params.append('provider', provider);

    const response = await apiClient.post(`/crm/sync/lead/${id}?${params.toString()}`);
    return response.data;
  },

  // GET /crm/providers - Get CRM providers
  async getCrmProviders(): Promise<{
    providers: Array<{
      id: string;
      name: string;
      configured: boolean;
      lastSync?: string;
    }>;
  }> {
    const response = await apiClient.get('/crm/providers');
    return response.data;
  },

  // DELETE /leads/:id - Delete lead (GDPR)
  async deleteLead(id: string): Promise<{
    message: string;
    deletedItems: {
      lead: boolean;
      messages: number;
      timelineEvents: number;
      slaClocks: number;
      dedupeKeys: number;
    };
  }> {
    const response = await apiClient.delete(`/leads/${id}?confirm=true`);
    return response.data;
  }
};

// Helper functions
export const leadsHelpers = {
  // Get status color for UI
  getStatusColor(status: Lead['status']): string {
    const colors = {
      'NEW': 'bg-blue-100 text-blue-800',
      'ASSIGNED': 'bg-orange-100 text-orange-800',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
      'CLOSED': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  },

  // Get score band color
  getScoreBandColor(scoreBand: Lead['scoreBand']): string {
    const colors = {
      'HIGH': 'bg-green-100 text-green-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'LOW': 'bg-red-100 text-red-800'
    };
    return colors[scoreBand] || 'bg-gray-100 text-gray-800';
  },

  // Get SLA status color
  getSLAStatusColor(status: string | null): string {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    const colors = {
      'overdue': 'bg-red-100 text-red-800',
      'due_soon': 'bg-orange-100 text-orange-800',
      'on_track': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  },

  // Format SLA countdown
  formatSLACountdown(countdown: Lead['slaCountdown']): string {
    if (!countdown) return 'No SLA';
    
    if (countdown.isOverdue) {
      const overdue = Math.abs(countdown.minutesRemaining);
      if (overdue < 60) return `${overdue}m overdue`;
      const hours = Math.floor(overdue / 60);
      const mins = overdue % 60;
      return mins > 0 ? `${hours}h ${mins}m overdue` : `${hours}h overdue`;
    }
    
    const remaining = countdown.minutesRemaining;
    if (remaining < 60) return `${remaining}m left`;
    const hours = Math.floor(remaining / 60);
    const mins = remaining % 60;
    return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
  },

  // Get timeline event icon
  getTimelineIcon(event: TimelineEvent): string {
    if (event.type === 'message') {
      switch (event.data.channel) {
        case 'FORM': return '📝';
        case 'EMAIL': return '📧';
        case 'DM': return '💬';
        default: return '📩';
      }
    } else {
      switch (event.data.eventType) {
        case 'FORM_SUBMISSION': return '📝';
        case 'EMAIL_RECEIVED': return '📧';
        case 'DM_RECEIVED': return '💬';
        case 'CRM_UPDATE': return '🔄';
        case 'ROUTED': return '➡️';
        case 'SLA_ESCALATED': return '⚠️';
        case 'SCORE_UPDATED': return '📊';
        default: return '📋';
      }
    }
  },

  // Get timeline event title
  getTimelineTitle(event: TimelineEvent): string {
    if (event.type === 'message') {
      const channel = event.data.channel || 'Unknown';
      const direction = event.data.direction === 'IN' ? 'Received' : 'Sent';
      return `${direction} ${channel.toLowerCase()} message`;
    } else {
      switch (event.data.eventType) {
        case 'FORM_SUBMISSION': return 'Form submitted';
        case 'EMAIL_RECEIVED': return 'Email received';
        case 'DM_RECEIVED': return 'Direct message received';
        case 'CRM_UPDATE': return 'CRM updated';
        case 'ROUTED': return 'Lead routed';
        case 'SLA_ESCALATED': return 'SLA escalated';
        case 'SCORE_UPDATED': return 'Score updated';
        default: return 'Event occurred';
      }
    }
  },

  // Format relative time
  formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return time.toLocaleDateString();
  },

  // Get source icon
  getSourceIcon(source: string): string {
    const icons: Record<string, string> = {
      'website_form': '🌐',
      'email': '📧',
      'instagram': '📷',
      'linkedin': '💼',
      'webhook': '🔗',
      'api': '⚡',
      'manual': '✍️'
    };
    return icons[source] || '📋';
  },

  // Check if lead has overdue SLA
  hasOverdueSLA(lead: Lead): boolean {
    return lead.slaStatus === 'overdue';
  },

  // Check if lead is due soon
  isDueSoon(lead: Lead): boolean {
    return lead.slaStatus === 'due_soon';
  },

  // Get lead display name
  getDisplayName(lead: Lead): string {
    if (lead.name) return lead.name;
    if (lead.email) return lead.email;
    if (lead.company) return lead.company;
    return 'Unknown Lead';
  },

  // Validate lead data
  validateLead(lead: Partial<CreateLead>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!lead.source) {
      errors.push('Source is required');
    }

    if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
      errors.push('Invalid email format');
    }

    if (lead.score !== undefined && (lead.score < 0 || lead.score > 100)) {
      errors.push('Score must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};
