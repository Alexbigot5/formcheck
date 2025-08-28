import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { applyScoring, calculateBaseScore, applyRules, determineBand } from '../engine.js';
import type { ScoringConfig, ScoringRule, Lead } from '../../../types/index.js';

// Mock Prisma
const mockPrisma = {
  scoringConfig: {
    findFirst: vi.fn(),
  },
  scoringRule: {
    findMany: vi.fn(),
  },
} as any;

// Mock Fastify app
const mockApp = {
  prisma: mockPrisma,
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
} as unknown as FastifyInstance;

describe('Scoring Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateBaseScore', () => {
    const mockConfig = {
      weights: {
        urgency: 25,
        engagement: 30,
        jobRole: 45
      },
      negative: {
        competitor: -20,
        freeEmail: -10,
        invalidDomain: -15,
        spam: -30
      },
      enrichment: {
        companySize: {
          'enterprise': 20,
          'large': 15,
          'medium': 10,
          'small': 5,
          'startup': 0
        },
        industry: {
          'technology': 15,
          'finance': 12,
          'healthcare': 10,
          'manufacturing': 8,
          'retail': 5,
          'other': 0
        }
      }
    };

    it('should calculate base score correctly for high-value lead', () => {
      const lead = {
        email: 'ceo@enterprise.com',
        name: 'John CEO',
        company: 'Enterprise Corp',
        domain: 'enterprise.com',
        fields: {
          title: 'Chief Executive Officer',
          company_size: 'enterprise',
          industry: 'technology',
          urgency: 'high',
          engagement: 'very_interested'
        },
        utm: {
          source: 'google-ads',
          medium: 'cpc'
        }
      };

      const result = calculateBaseScore(lead, mockConfig);

      expect(result.score).toBeGreaterThan(70);
      expect(result.components).toHaveProperty('urgency');
      expect(result.components).toHaveProperty('engagement');
      expect(result.components).toHaveProperty('jobRole');
      expect(result.components).toHaveProperty('enrichment');
      expect(result.tags).toContain('enterprise');
      expect(result.tags).toContain('technology');
    });

    it('should apply negative scoring for competitors', () => {
      const lead = {
        email: 'user@typeform.com',
        name: 'Competitor User',
        company: 'Typeform',
        domain: 'typeform.com',
        fields: {
          title: 'Product Manager'
        }
      };

      const result = calculateBaseScore(lead, mockConfig);

      expect(result.score).toBeLessThan(30); // Should be low due to competitor penalty
      expect(result.tags).toContain('competitor');
      expect(result.trace).toContain('Competitor penalty applied');
    });

    it('should handle free email domains', () => {
      const lead = {
        email: 'user@gmail.com',
        name: 'Gmail User',
        fields: {
          title: 'Manager'
        }
      };

      const result = calculateBaseScore(lead, mockConfig);

      expect(result.tags).toContain('free_email');
      expect(result.trace).toContain('Free email penalty');
    });

    it('should handle missing data gracefully', () => {
      const lead = {
        email: 'minimal@example.com'
      };

      const result = calculateBaseScore(lead, mockConfig);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.components).toBeDefined();
      expect(result.tags).toBeDefined();
      expect(result.trace).toBeDefined();
    });

    it('should calculate job role scoring correctly', () => {
      const executiveRoles = ['CEO', 'CTO', 'VP', 'Director', 'President', 'Founder'];
      
      for (const role of executiveRoles) {
        const lead = {
          email: `${role.toLowerCase()}@company.com`,
          fields: { title: role }
        };

        const result = calculateBaseScore(lead, mockConfig);
        expect(result.components.jobRole).toBeGreaterThan(20); // High score for executives
      }
    });

    it('should handle enrichment data properly', () => {
      const lead = {
        email: 'user@company.com',
        fields: {
          enrichment: {
            companySize: 'enterprise',
            industry: 'technology',
            revenue: '100M+',
            isFreeMailbox: false,
            isCompetitor: false
          }
        }
      };

      const result = calculateBaseScore(lead, mockConfig);

      expect(result.components.enrichment).toBeGreaterThan(0);
      expect(result.tags).toContain('enriched');
    });
  });

  describe('applyRules', () => {
    const mockRules: ScoringRule[] = [
      {
        id: '1',
        teamId: 'team1',
        type: 'IF_THEN',
        enabled: true,
        order: 1,
        definition: {
          if: [
            { field: 'email', op: 'ends_with', value: '@gmail.com' }
          ],
          then: { adjust: -10, reason: 'Free email domain' }
        }
      },
      {
        id: '2',
        teamId: 'team1',
        type: 'IF_THEN',
        enabled: true,
        order: 2,
        definition: {
          if: [
            { field: 'fields.title', op: 'contains', value: 'ceo' }
          ],
          then: { adjust: 25, reason: 'CEO title' }
        }
      },
      {
        id: '3',
        teamId: 'team1',
        type: 'WEIGHT',
        enabled: true,
        order: 3,
        definition: {
          field: 'utm.source',
          weights: {
            'google-ads': 20,
            'linkedin': 15,
            'organic': 10,
            'referral': 12
          }
        }
      }
    ];

    it('should apply IF_THEN rules correctly', () => {
      const lead = {
        email: 'user@gmail.com',
        fields: { title: 'CEO' }
      };

      const result = applyRules(lead, mockRules, 50);

      // Should apply both -10 (gmail) and +25 (CEO) = net +15
      expect(result.finalScore).toBe(65);
      expect(result.adjustments).toHaveLength(2);
      expect(result.adjustments[0].rule).toBe('Free email domain');
      expect(result.adjustments[1].rule).toBe('CEO title');
    });

    it('should apply WEIGHT rules correctly', () => {
      const lead = {
        email: 'user@company.com',
        utm: { source: 'google-ads' }
      };

      const result = applyRules(lead, mockRules, 50);

      expect(result.finalScore).toBe(70); // 50 + 20 from google-ads weight
      expect(result.adjustments).toHaveLength(1);
      expect(result.adjustments[0].rule).toContain('UTM source weight');
    });

    it('should skip disabled rules', () => {
      const disabledRules = mockRules.map(rule => ({ ...rule, enabled: false }));
      const lead = {
        email: 'user@gmail.com',
        fields: { title: 'CEO' }
      };

      const result = applyRules(lead, disabledRules, 50);

      expect(result.finalScore).toBe(50); // No adjustments
      expect(result.adjustments).toHaveLength(0);
    });

    it('should handle complex field paths', () => {
      const complexRules: ScoringRule[] = [
        {
          id: '1',
          teamId: 'team1',
          type: 'IF_THEN',
          enabled: true,
          order: 1,
          definition: {
            if: [
              { field: 'fields.enrichment.companySize', op: 'equals', value: 'enterprise' }
            ],
            then: { adjust: 15, reason: 'Enterprise company' }
          }
        }
      ];

      const lead = {
        email: 'user@company.com',
        fields: {
          enrichment: {
            companySize: 'enterprise'
          }
        }
      };

      const result = applyRules(lead, complexRules, 50);

      expect(result.finalScore).toBe(65);
      expect(result.adjustments[0].rule).toBe('Enterprise company');
    });

    it('should handle array operations', () => {
      const arrayRules: ScoringRule[] = [
        {
          id: '1',
          teamId: 'team1',
          type: 'IF_THEN',
          enabled: true,
          order: 1,
          definition: {
            if: [
              { field: 'domain', op: 'in', value: ['typeform.com', 'jotform.com'] }
            ],
            then: { adjust: -25, reason: 'Competitor domain' }
          }
        }
      ];

      const lead = {
        email: 'user@typeform.com',
        domain: 'typeform.com'
      };

      const result = applyRules(lead, arrayRules, 50);

      expect(result.finalScore).toBe(25);
      expect(result.adjustments[0].rule).toBe('Competitor domain');
    });
  });

  describe('determineBand', () => {
    const mockBands = {
      high: 75,
      medium: 50,
      low: 0
    };

    it('should determine HIGH band correctly', () => {
      expect(determineBand(85, mockBands)).toBe('HIGH');
      expect(determineBand(75, mockBands)).toBe('HIGH');
    });

    it('should determine MEDIUM band correctly', () => {
      expect(determineBand(74, mockBands)).toBe('MEDIUM');
      expect(determineBand(50, mockBands)).toBe('MEDIUM');
    });

    it('should determine LOW band correctly', () => {
      expect(determineBand(49, mockBands)).toBe('LOW');
      expect(determineBand(0, mockBands)).toBe('LOW');
    });

    it('should handle edge cases', () => {
      expect(determineBand(-10, mockBands)).toBe('LOW');
      expect(determineBand(150, mockBands)).toBe('HIGH');
    });
  });

  describe('applyScoring (integration)', () => {
    const mockConfig = {
      weights: { urgency: 25, engagement: 30, jobRole: 45 },
      bands: { high: 75, medium: 50, low: 0 },
      negative: { competitor: -20, freeEmail: -10 },
      enrichment: {
        companySize: { 'enterprise': 20, 'startup': 0 },
        industry: { 'technology': 15, 'other': 0 }
      }
    };

    const mockRules: ScoringRule[] = [
      {
        id: '1',
        teamId: 'team1',
        type: 'IF_THEN',
        enabled: true,
        order: 1,
        definition: {
          if: [{ field: 'fields.title', op: 'contains', value: 'ceo' }],
          then: { adjust: 20, reason: 'Executive contact' }
        }
      }
    ];

    beforeEach(() => {
      mockPrisma.scoringConfig.findFirst.mockResolvedValue(mockConfig);
      mockPrisma.scoringRule.findMany.mockResolvedValue(mockRules);
    });

    it('should perform complete scoring workflow', async () => {
      const lead = {
        email: 'ceo@enterprise.com',
        name: 'John CEO',
        company: 'Enterprise Corp',
        fields: {
          title: 'Chief Executive Officer',
          company_size: 'enterprise',
          industry: 'technology'
        }
      };

      const result = await applyScoring(mockApp, lead, mockConfig, mockRules);

      expect(result.score).toBeGreaterThan(70);
      expect(result.band).toBe('HIGH');
      expect(result.tags).toContain('enterprise');
      expect(result.trace).toBeDefined();
      expect(result.trace.length).toBeGreaterThan(0);
    });

    it('should handle low-scoring leads', async () => {
      const lead = {
        email: 'user@gmail.com',
        name: 'Basic User',
        fields: {
          title: 'Student'
        }
      };

      const result = await applyScoring(mockApp, lead, mockConfig, mockRules);

      expect(result.score).toBeLessThan(50);
      expect(result.band).toBe('LOW');
      expect(result.tags).toContain('free_email');
    });

    it('should handle missing config gracefully', async () => {
      const lead = {
        email: 'test@example.com',
        name: 'Test User'
      };

      const result = await applyScoring(mockApp, lead, null, []);

      expect(result.score).toBe(0);
      expect(result.band).toBe('LOW');
      expect(result.tags).toEqual(['no_config']);
    });

    it('should validate score bounds', async () => {
      const lead = {
        email: 'test@example.com',
        fields: {
          title: 'CEO President Founder Director VP' // Multiple high-value terms
        }
      };

      const result = await applyScoring(mockApp, lead, mockConfig, mockRules);

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined lead data', () => {
      const result = calculateBaseScore(null as any, {
        weights: { urgency: 25, engagement: 30, jobRole: 45 },
        negative: {},
        enrichment: {}
      });

      expect(result.score).toBe(0);
      expect(result.tags).toContain('invalid_data');
    });

    it('should handle malformed rules', () => {
      const malformedRules = [
        {
          id: '1',
          teamId: 'team1',
          type: 'IF_THEN' as const,
          enabled: true,
          order: 1,
          definition: null as any
        }
      ];

      const lead = { email: 'test@example.com' };
      const result = applyRules(lead, malformedRules, 50);

      expect(result.finalScore).toBe(50); // Should not crash, should skip bad rule
      expect(result.adjustments).toHaveLength(0);
    });

    it('should handle circular references in field paths', () => {
      const lead = {
        email: 'test@example.com',
        fields: {} as any
      };
      
      // Create circular reference
      lead.fields.self = lead.fields;

      const rules: ScoringRule[] = [
        {
          id: '1',
          teamId: 'team1',
          type: 'IF_THEN',
          enabled: true,
          order: 1,
          definition: {
            if: [{ field: 'fields.self.title', op: 'equals', value: 'test' }],
            then: { adjust: 10, reason: 'Test' }
          }
        }
      ];

      expect(() => applyRules(lead, rules, 50)).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of rules efficiently', () => {
      const manyRules: ScoringRule[] = Array.from({ length: 100 }, (_, i) => ({
        id: `rule_${i}`,
        teamId: 'team1',
        type: 'IF_THEN' as const,
        enabled: true,
        order: i,
        definition: {
          if: [{ field: 'email', op: 'contains', value: `test${i}` }],
          then: { adjust: 1, reason: `Rule ${i}` }
        }
      }));

      const lead = { email: 'test50@example.com' };

      const startTime = Date.now();
      const result = applyRules(lead, manyRules, 50);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
      expect(result.finalScore).toBe(51); // Should find and apply one matching rule
    });

    it('should handle complex nested field access efficiently', () => {
      const deepLead = {
        email: 'test@example.com',
        fields: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deepValue: 'target'
                  }
                }
              }
            }
          }
        }
      };

      const deepRule: ScoringRule[] = [
        {
          id: '1',
          teamId: 'team1',
          type: 'IF_THEN',
          enabled: true,
          order: 1,
          definition: {
            if: [{ field: 'fields.level1.level2.level3.level4.level5.deepValue', op: 'equals', value: 'target' }],
            then: { adjust: 10, reason: 'Deep field match' }
          }
        }
      ];

      const result = applyRules(deepLead, deepRule, 50);

      expect(result.finalScore).toBe(60);
      expect(result.adjustments[0].rule).toBe('Deep field match');
    });
  });
});
