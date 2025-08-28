import apiClient from './apiClient';

// Types for integrations functionality
export interface Integration {
  kind: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  error: string | null;
  settings: Record<string, any>;
}

export interface CRMField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface FieldMapping {
  mapping: Record<string, string>;
  lastUpdated: string | null;
}

export interface IntegrationHealth {
  status: string;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  queuedOps: number;
  recentErrors: Array<{
    timestamp: string;
    error: string;
    operation?: string;
  }>;
  metrics: {
    totalSyncs: number;
    successRate: number;
    avgResponseTime: number;
  };
}

export interface TestResult {
  success: boolean;
  message: string;
  responseTime: number;
  details?: any;
}

// Integrations API functions
export const integrationsApi = {
  // GET /api/integrations - Get all integrations status
  async getIntegrations(): Promise<{ integrations: Integration[] }> {
    const response = await apiClient.get('/api/integrations');
    return response.data;
  },

  // GET /integrations/:kind/fields - Get CRM fields
  async getFields(kind: string): Promise<{ fields: CRMField[] }> {
    const response = await apiClient.get(`/integrations/${kind}/fields`);
    return response.data;
  },

  // GET /integrations/:kind/mapping - Get current field mapping
  async getFieldMapping(kind: string): Promise<FieldMapping> {
    const response = await apiClient.get(`/integrations/${kind}/mapping`);
    return response.data;
  },

  // POST /integrations/:kind/mapping - Save field mapping
  async saveFieldMapping(kind: string, mapping: Record<string, string>): Promise<{
    message: string;
    mapping: Record<string, string>;
  }> {
    const response = await apiClient.post(`/integrations/${kind}/mapping`, { mapping });
    return response.data;
  },

  // GET /integrations/:kind/health - Get integration health status
  async getHealth(kind: string): Promise<IntegrationHealth> {
    const response = await apiClient.get(`/integrations/${kind}/health`);
    return response.data;
  },

  // POST /integrations/:kind/test - Test integration connection
  async testConnection(kind: string): Promise<TestResult> {
    const response = await apiClient.post(`/integrations/${kind}/test`);
    return response.data;
  },

  // POST /integrations/:kind/disconnect - Disconnect integration
  async disconnect(kind: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/integrations/${kind}/disconnect`);
    return response.data;
  },

  // Start OAuth flow
  async startOAuth(provider: 'hubspot' | 'salesforce', redirectUrl?: string): Promise<void> {
    const params = redirectUrl ? `?redirectUrl=${encodeURIComponent(redirectUrl)}` : '';
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/oauth/${provider}/start${params}`;
  },

  // Handle OAuth callback
  async handleOAuthCallback(provider: string, code: string, state: string): Promise<{
    success: boolean;
    message: string;
    redirectUrl: string;
  }> {
    const response = await apiClient.post(`/oauth/${provider}/callback`, { code, state });
    return response.data;
  }
};

// Helper functions
export const integrationsHelpers = {
  // Get status color for UI
  getStatusColor(status: Integration['status']): string {
    const colors = {
      'CONNECTED': 'bg-green-100 text-green-800',
      'DISCONNECTED': 'bg-gray-100 text-gray-800',
      'ERROR': 'bg-red-100 text-red-800',
      'PENDING': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  },

  // Get provider icon
  getProviderIcon(provider: string): string {
    const icons: Record<string, string> = {
      'hubspot': '🧡',
      'salesforce': '☁️',
      'pipedrive': '🔵',
      'slack': '💬',
      'zapier': '⚡'
    };
    return icons[provider.toLowerCase()] || '🔗';
  },

  // Get provider display name
  getProviderName(provider: string): string {
    const names: Record<string, string> = {
      'hubspot': 'HubSpot',
      'salesforce': 'Salesforce',
      'pipedrive': 'Pipedrive',
      'slack': 'Slack',
      'zapier': 'Zapier'
    };
    return names[provider.toLowerCase()] || provider;
  },

  // Format relative time
  formatRelativeTime(timestamp: string | null): string {
    if (!timestamp) return 'Never';
    
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

  // Get health status color
  getHealthColor(successRate: number): string {
    if (successRate >= 0.95) return 'text-green-600';
    if (successRate >= 0.85) return 'text-yellow-600';
    return 'text-red-600';
  },

  // Format success rate
  formatSuccessRate(rate: number): string {
    return `${Math.round(rate * 100)}%`;
  },

  // Format response time
  formatResponseTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  },

  // Get field type icon
  getFieldTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'string': '📝',
      'number': '🔢',
      'boolean': '✅',
      'date': '📅',
      'datetime': '⏰',
      'email': '📧',
      'phone': '📞',
      'url': '🔗',
      'select': '📋',
      'multiselect': '📋'
    };
    return icons[type.toLowerCase()] || '📄';
  },

  // Validate field mapping
  validateMapping(mapping: Record<string, string>, fields: CRMField[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldNames = fields.map(f => f.name);

    // Check for invalid field mappings
    Object.entries(mapping).forEach(([leadField, crmField]) => {
      if (crmField && !fieldNames.includes(crmField)) {
        errors.push(`CRM field "${crmField}" does not exist`);
      }
    });

    // Check for required fields
    const requiredFields = fields.filter(f => f.required);
    const mappedCrmFields = Object.values(mapping).filter(Boolean);
    
    requiredFields.forEach(field => {
      if (!mappedCrmFields.includes(field.name)) {
        warnings.push(`Required CRM field "${field.label}" is not mapped`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  // Get common lead field mappings
  getCommonMappings(): Record<string, Record<string, string>> {
    return {
      hubspot: {
        'email': 'email',
        'name': 'firstname',
        'company': 'company',
        'phone': 'phone',
        'score': 'hubspotscore'
      },
      salesforce: {
        'email': 'Email',
        'name': 'FirstName',
        'company': 'Company',
        'phone': 'Phone',
        'score': 'Lead_Score__c'
      },
      pipedrive: {
        'email': 'email',
        'name': 'name',
        'company': 'org_id',
        'phone': 'phone',
        'score': 'lead_score'
      }
    };
  },

  // Auto-suggest field mappings
  autoSuggestMapping(leadFields: string[], crmFields: CRMField[]): Record<string, string> {
    const suggestions: Record<string, string> = {};
    const commonMappings = this.getCommonMappings();
    
    leadFields.forEach(leadField => {
      const leadFieldLower = leadField.toLowerCase();
      
      // Try exact match first
      const exactMatch = crmFields.find(f => 
        f.name.toLowerCase() === leadFieldLower || 
        f.label.toLowerCase() === leadFieldLower
      );
      
      if (exactMatch) {
        suggestions[leadField] = exactMatch.name;
        return;
      }
      
      // Try fuzzy match
      const fuzzyMatch = crmFields.find(f => 
        f.name.toLowerCase().includes(leadFieldLower) ||
        f.label.toLowerCase().includes(leadFieldLower) ||
        leadFieldLower.includes(f.name.toLowerCase()) ||
        leadFieldLower.includes(f.label.toLowerCase())
      );
      
      if (fuzzyMatch) {
        suggestions[leadField] = fuzzyMatch.name;
      }
    });
    
    return suggestions;
  }
};
