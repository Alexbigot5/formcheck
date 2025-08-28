import apiClient from './apiClient';

// Types for scoring configuration
export interface ScoringWeights {
  [key: string]: number;
}

export interface ScoringBand {
  min: number;
  max: number;
}

export interface ScoringBands {
  low: ScoringBand;
  medium: ScoringBand;
  high: ScoringBand;
}

export interface NegativeRule {
  field: string;
  op: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  value: any;
  penalty: number;
  reason: string;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  bands: ScoringBands;
  negative: NegativeRule[];
  enrichment: Record<string, any>;
}

export interface ScoringRule {
  id?: string;
  type: 'IF_THEN' | 'WEIGHT';
  definition: {
    if?: Array<{
      field: string;
      op: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in' | 'exists' | 'not_exists';
      value: any;
    }>;
    then?: {
      add?: number;
      multiply?: number;
      tag?: string;
      route?: string;
      sla?: number;
    };
    weight?: number;
    field?: string;
  };
  enabled: boolean;
  order: number;
}

export interface ScoringTrace {
  step: string;
  field?: string;
  value?: any;
  operation: string;
  points: number;
  total: number;
  reason: string;
  rule?: string;
}

export interface ScoringResult {
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  trace: ScoringTrace[];
  tags: string[];
  routing?: string;
  sla?: number;
}

export interface TestLead {
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  domain?: string;
  source?: string;
  fields?: Record<string, any>;
  utm?: Record<string, any>;
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: any;
  after?: any;
  createdAt: string;
  userId?: string;
  teamId?: string;
}

export interface ConfigHistory {
  id: string;
  config: ScoringConfig;
  createdAt: string;
  createdBy: string;
}

// API functions
export const scoringApi = {
  // GET current config: GET /api/scoring/config
  async getCurrentConfig(): Promise<{ config: ScoringConfig | null; rules: ScoringRule[] }> {
    const response = await apiClient.get('/api/scoring/config');
    return response.data;
  },

  // POST /api/scoring/config for weights, bands, negative, enrichment
  async saveConfig(config: ScoringConfig): Promise<{ config: ScoringConfig; message: string }> {
    const response = await apiClient.post('/api/scoring/config', config);
    return response.data;
  },

  // PUT /scoring/rules for IF_THEN rules array with order and enabled flags
  async saveRules(rules: ScoringRule[]): Promise<{ message: string }> {
    // Since the backend has individual rule endpoints, we'll need to handle this differently
    // For now, we'll create/update rules individually
    const results = [];
    
    for (const rule of rules) {
      if (rule.id) {
        // Update existing rule
        const response = await apiClient.put(`/scoring/rules/${rule.id}`, rule);
        results.push(response.data);
      } else {
        // Create new rule
        const response = await apiClient.post('/scoring/rules', rule);
        results.push(response.data);
      }
    }
    
    return { message: 'Rules saved successfully' };
  },

  // POST /api/scoring/test with a sample lead payload and render {score, band, trace[]}
  async testScoring(lead: TestLead): Promise<ScoringResult> {
    const response = await apiClient.post('/api/scoring/test', lead);
    return response.data;
  },

  // Batch test multiple leads
  async batchTestScoring(leads: TestLead[]): Promise<{ results: Array<{ lead: TestLead; scoring: ScoringResult }> }> {
    const response = await apiClient.post('/scoring/batch-test', { leads });
    return response.data;
  },

  // GET /audits?entityType=SCORING limit 20
  async getAudits(limit: number = 20): Promise<AuditEntry[]> {
    // This endpoint might not exist yet, so we'll implement a fallback
    try {
      const response = await apiClient.get('/audits', {
        params: {
          entityType: 'SCORING',
          limit
        }
      });
      return response.data;
    } catch (error: any) {
      // If audit endpoint doesn't exist, return empty array or use config history
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  },

  // GET scoring config history
  async getConfigHistory(limit: number = 10): Promise<{ configs: ConfigHistory[] }> {
    const response = await apiClient.get('/scoring/config/history', {
      params: { limit }
    });
    return response.data;
  },

  // POST /configs/scoring/rollback?version=X to restore (if implemented)
  async rollbackConfig(version: string): Promise<{ config: ScoringConfig; message: string }> {
    try {
      const response = await apiClient.post(`/configs/scoring/rollback`, null, {
        params: { version }
      });
      return response.data;
    } catch (error: any) {
      // If rollback endpoint doesn't exist, throw a descriptive error
      if (error.response?.status === 404) {
        throw new Error('Rollback functionality not yet implemented');
      }
      throw error;
    }
  },

  // Individual rule management
  async createRule(rule: Omit<ScoringRule, 'id'>): Promise<{ rule: ScoringRule; message: string }> {
    const response = await apiClient.post('/scoring/rules', rule);
    return response.data;
  },

  async updateRule(id: string, updates: Partial<ScoringRule>): Promise<{ rule: ScoringRule; message: string }> {
    const response = await apiClient.put(`/scoring/rules/${id}`, updates);
    return response.data;
  },

  async deleteRule(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/scoring/rules/${id}`);
    return response.data;
  },

  async reorderRules(ruleIds: string[]): Promise<{ message: string }> {
    const response = await apiClient.post('/scoring/rules/reorder', { ruleIds });
    return response.data;
  },

  // Initialize default configuration
  async initializeDefault(): Promise<{ config: ScoringConfig; rules: ScoringRule[]; message: string }> {
    const response = await apiClient.post('/scoring/initialize');
    return response.data;
  }
};

// Helper functions for working with scoring data
export const scoringHelpers = {
  // Convert legacy scoring format to new format
  convertLegacyConfig(legacyConfig: any): ScoringConfig {
    const weights: ScoringWeights = {};
    
    // Map old field names to new ones
    if (legacyConfig.emailDomainMatch !== undefined) {
      weights.email = legacyConfig.emailDomainMatch;
    }
    if (legacyConfig.jobSeniority !== undefined) {
      weights.jobRole = legacyConfig.jobSeniority;
    }
    if (legacyConfig.companySize !== undefined) {
      weights.company = legacyConfig.companySize;
    }

    // Map new field names
    if (legacyConfig.weights) {
      Object.assign(weights, legacyConfig.weights);
    }

    const bands: ScoringBands = {
      low: { min: 0, max: 44 },
      medium: { min: 45, max: 74 },
      high: { min: 75, max: 100 }
    };

    // Override with legacy thresholds if available
    if (legacyConfig.thresholds) {
      bands.high.min = legacyConfig.thresholds.high || 75;
      bands.medium.min = legacyConfig.thresholds.medium || 45;
      bands.low.min = legacyConfig.thresholds.low || 0;
      bands.medium.max = bands.high.min - 1;
      bands.low.max = bands.medium.min - 1;
    }

    return {
      weights,
      bands,
      negative: legacyConfig.negative || [],
      enrichment: legacyConfig.enrichment || {}
    };
  },

  // Calculate score preview using simple weights
  calculatePreviewScore(
    values: Record<string, number>,
    weights: ScoringWeights
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [field, value] of Object.entries(values)) {
      const weight = weights[field] || 0;
      totalScore += value * (weight / 100);
      totalWeight += weight;
    }

    // Normalize to 0-100 scale
    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
  },

  // Get band classification from score
  getBandFromScore(score: number, bands: ScoringBands): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (score >= bands.high.min) return 'HIGH';
    if (score >= bands.medium.min) return 'MEDIUM';
    return 'LOW';
  },

  // Validate scoring configuration
  validateConfig(config: ScoringConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate weights
    if (!config.weights || Object.keys(config.weights).length === 0) {
      errors.push('At least one weight must be defined');
    } else {
      for (const [field, weight] of Object.entries(config.weights)) {
        if (typeof weight !== 'number' || weight < 0) {
          errors.push(`Weight for ${field} must be a non-negative number`);
        }
      }
    }

    // Validate bands
    if (!config.bands) {
      errors.push('Scoring bands must be defined');
    } else {
      const { low, medium, high } = config.bands;
      if (low.min >= medium.min || medium.min >= high.min) {
        errors.push('Band thresholds must be in ascending order');
      }
      if (low.max >= medium.max || medium.max >= high.max) {
        errors.push('Band maximums must be in ascending order');
      }
    }

    // Validate negative rules
    if (config.negative) {
      config.negative.forEach((rule, index) => {
        if (!rule.field || !rule.op || rule.penalty < 0) {
          errors.push(`Negative rule ${index + 1} is invalid`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};
