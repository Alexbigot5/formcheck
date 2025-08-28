import apiClient from './apiClient';

// Types for routing functionality
export interface RoutingRule {
  id?: string;
  name: string;
  definition: {
    if: Array<{
      field: string;
      op: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in' | 'exists' | 'not_exists';
      value: any;
    }>;
    then: {
      assign: string;
      priority?: number;
      alert?: 'SLACK' | 'EMAIL' | 'WEBHOOK';
      webhook?: string;
      sla?: number;
    };
  };
  enabled: boolean;
  order: number;
}

export interface TestLead {
  email?: string;
  name?: string;
  company?: string;
  domain?: string;
  source?: string;
  score?: number;
  scoreBand?: 'LOW' | 'MEDIUM' | 'HIGH';
  fields?: Record<string, any>;
  utm?: Record<string, any>;
}

export interface RoutingResult {
  ownerId: string | null;
  pool: string | null;
  reason: string;
  trace: Array<{
    step: string;
    rule?: string;
    condition?: string;
    result: boolean | string;
    reason: string;
  }>;
  alerts: Array<{
    type: string;
    message: string;
  }>;
  sla?: number;
  priority?: number;
}

export interface Owner {
  id: string;
  userId: string;
  email: string;
  name?: string;
  capacity: number;
  currentLoad: number;
  isActive: boolean;
  pool: string;
}

export interface Pool {
  name: string;
  owners: number;
  strategy: string;
  roundRobinState?: {
    lastAssignedIndex: number;
    nextOwner?: string;
  };
}

export interface SLAThresholds {
  priority1: number;
  priority2: number;
  priority3: number;
  priority4: number;
  escalation: {
    enabled: boolean;
    levels: Array<{
      minutes: number;
      action: string;
    }>;
  };
  business_hours: {
    enabled: boolean;
    timezone: string;
    schedule: Record<string, any>;
  };
}

export interface SLATestResult {
  priority: number;
  slaMinutes: number;
  targetAt: string;
  dueTime: string;
  businessHoursAdjusted: boolean;
  escalationSchedule: Array<{
    minutes: number;
    action: string;
    scheduledAt: string;
  }>;
}

// Routing API functions
export const routingApi = {
  // GET /routing/rules - List routing rules
  async getRules(): Promise<{ rules: RoutingRule[] }> {
    const response = await apiClient.get('/routing/rules');
    return response.data;
  },

  // POST /routing/rules - Create routing rule
  async createRule(rule: Omit<RoutingRule, 'id'>): Promise<{ rule: RoutingRule; message: string }> {
    const response = await apiClient.post('/routing/rules', rule);
    return response.data;
  },

  // PUT /routing/rules/:id - Update routing rule
  async updateRule(id: string, updates: Partial<RoutingRule>): Promise<{ rule: RoutingRule; message: string }> {
    const response = await apiClient.put(`/routing/rules/${id}`, updates);
    return response.data;
  },

  // DELETE /routing/rules/:id - Delete routing rule
  async deleteRule(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/routing/rules/${id}`);
    return response.data;
  },

  // POST /routing/rules/reorder - Reorder routing rules
  async reorderRules(ruleIds: string[]): Promise<{ message: string }> {
    const response = await apiClient.post('/routing/rules/reorder', { ruleIds });
    return response.data;
  },

  // POST /routing/test - Test routing with sample payload
  async testRouting(lead: TestLead): Promise<RoutingResult> {
    const response = await apiClient.post('/routing/test', lead);
    return response.data;
  },

  // POST /routing/batch-test - Test multiple leads
  async batchTestRouting(leads: TestLead[]): Promise<{ results: Array<{ lead: TestLead; routing: RoutingResult }> }> {
    const response = await apiClient.post('/routing/batch-test', { leads });
    return response.data;
  },

  // POST /routing/initialize - Initialize default routing rules
  async initializeDefault(): Promise<{ rules: RoutingRule[]; message: string }> {
    const response = await apiClient.post('/routing/initialize');
    return response.data;
  }
};

// Owners API functions
export const ownersApi = {
  // GET /owners - Get owners with pools and capacities
  async getOwners(): Promise<{ owners: Owner[]; pools: Pool[] }> {
    const response = await apiClient.get('/owners');
    return response.data;
  },

  // GET /routing/pools - Get owner pools (alternative endpoint)
  async getPools(): Promise<{ pools: Pool[] }> {
    const response = await apiClient.get('/routing/pools');
    return response.data;
  },

  // GET /routing/stats - Get routing statistics
  async getStats(days: number = 30): Promise<{
    totalLeads: number;
    routedLeads: number;
    unroutedLeads: number;
    poolDistribution: Record<string, number>;
    avgRoutingTime: number;
  }> {
    const response = await apiClient.get('/routing/stats', { params: { days } });
    return response.data;
  }
};

// SLA API functions
export const slaApi = {
  // GET /sla/settings - Load SLA thresholds
  async getSettings(): Promise<{ thresholds: SLAThresholds }> {
    const response = await apiClient.get('/sla/settings');
    return response.data;
  },

  // PUT /sla/settings - Save SLA thresholds
  async saveSettings(thresholds: SLAThresholds): Promise<{ message: string; thresholds: SLAThresholds }> {
    const response = await apiClient.put('/sla/settings', { thresholds });
    return response.data;
  },

  // POST /sla/test - Compute target times for sample lead
  async testSLA(lead: TestLead, priority: number = 3): Promise<SLATestResult> {
    const response = await apiClient.post('/sla/test', { lead, priority });
    return response.data;
  }
};

// Helper functions
export const routingHelpers = {
  // Validate routing rule
  validateRule(rule: Partial<RoutingRule>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rule.name || rule.name.length < 1) {
      errors.push('Rule name is required');
    }

    if (!rule.definition) {
      errors.push('Rule definition is required');
    } else {
      if (!rule.definition.if || rule.definition.if.length === 0) {
        errors.push('At least one condition is required');
      }

      if (!rule.definition.then || !rule.definition.then.assign) {
        errors.push('Assignment target is required');
      }
    }

    if (typeof rule.order !== 'number' || rule.order < 0) {
      errors.push('Order must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Get condition display text
  getConditionText(condition: RoutingRule['definition']['if'][0]): string {
    const { field, op, value } = condition;
    const opText = {
      equals: '=',
      not_equals: '≠',
      greater_than: '>',
      less_than: '<',
      greater_equal: '≥',
      less_equal: '≤',
      contains: 'contains',
      not_contains: 'does not contain',
      starts_with: 'starts with',
      ends_with: 'ends with',
      regex: 'matches regex',
      in: 'is in',
      not_in: 'is not in',
      exists: 'exists',
      not_exists: 'does not exist'
    }[op] || op;

    if (op === 'exists' || op === 'not_exists') {
      return `${field} ${opText}`;
    }

    return `${field} ${opText} ${Array.isArray(value) ? value.join(', ') : value}`;
  },

  // Get pool color for UI
  getPoolColor(poolName: string): string {
    const colors: Record<string, string> = {
      'SENIOR_AE_POOL': 'bg-purple-100 text-purple-800',
      'AE_POOL_A': 'bg-blue-100 text-blue-800',
      'AE_POOL_B': 'bg-green-100 text-green-800',
      'SDR_POOL': 'bg-orange-100 text-orange-800',
      'FAST_TRACK_POOL': 'bg-red-100 text-red-800'
    };
    return colors[poolName] || 'bg-gray-100 text-gray-800';
  },

  // Get priority label
  getPriorityLabel(priority: number): string {
    const labels = {
      1: 'Highest',
      2: 'High',
      3: 'Medium',
      4: 'Low'
    };
    return labels[priority as keyof typeof labels] || 'Unknown';
  },

  // Format SLA time
  formatSLATime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },

  // Calculate owner utilization
  getOwnerUtilization(owner: Owner): number {
    return owner.capacity > 0 ? Math.round((owner.currentLoad / owner.capacity) * 100) : 0;
  },

  // Get utilization color
  getUtilizationColor(utilization: number): string {
    if (utilization >= 90) return 'text-red-600';
    if (utilization >= 70) return 'text-orange-600';
    if (utilization >= 50) return 'text-yellow-600';
    return 'text-green-600';
  }
};
