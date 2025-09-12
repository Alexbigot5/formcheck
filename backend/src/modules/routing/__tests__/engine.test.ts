import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { routeLead, selectOwnerFromPool, checkRuleConditions, evaluateCondition } from '../engine';
import type { RoutingRule, Owner, Lead, RoutingResult } from '../../../types/index';

// Mock Prisma
const mockPrisma = {
  owner: {
    findMany: vi.fn(),
  },
  lead: {
    count: vi.fn(),
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

describe('Routing Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('evaluateCondition', () => {
    const testLead = {
      email: 'test@example.com',
      name: 'Test User',
      company: 'Test Corp',
      domain: 'example.com',
      score: 75,
      scoreBand: 'HIGH' as const,
      source: 'website_form',
      fields: {
        title: 'VP of Sales',
        company_size: 'enterprise',
        industry: 'technology',
        budget: '50k-100k'
      },
      utm: {
        source: 'google-ads',
        medium: 'cpc',
        campaign: 'lead-gen'
      }
    };

    describe('equals operator', () => {
      it('should match exact string values', () => {
        expect(evaluateCondition(testLead, { field: 'source', op: 'equals', value: 'website_form' })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'source', op: 'equals', value: 'linkedin' })).toBe(false);
      });

      it('should match exact number values', () => {
        expect(evaluateCondition(testLead, { field: 'score', op: 'equals', value: 75 })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'score', op: 'equals', value: 80 })).toBe(false);
      });

      it('should handle nested field paths', () => {
        expect(evaluateCondition(testLead, { field: 'fields.title', op: 'equals', value: 'VP of Sales' })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'utm.source', op: 'equals', value: 'google-ads' })).toBe(true);
      });
    });

    describe('comparison operators', () => {
      it('should handle greater_than correctly', () => {
        expect(evaluateCondition(testLead, { field: 'score', op: 'greater_than', value: 70 })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'score', op: 'greater_than', value: 75 })).toBe(false);
        expect(evaluateCondition(testLead, { field: 'score', op: 'greater_than', value: 80 })).toBe(false);
      });

      it('should handle less_than correctly', () => {
        expect(evaluateCondition(testLead, { field: 'score', op: 'less_than', value: 80 })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'score', op: 'less_than', value: 75 })).toBe(false);
        expect(evaluateCondition(testLead, { field: 'score', op: 'less_than', value: 70 })).toBe(false);
      });

      it('should handle greater_equal correctly', () => {
        expect(evaluateCondition(testLead, { field: 'score', op: 'greater_equal', value: 75 })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'score', op: 'greater_equal', value: 70 })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'score', op: 'greater_equal', value: 80 })).toBe(false);
      });

      it('should handle less_equal correctly', () => {
        expect(evaluateCondition(testLead, { field: 'score', op: 'less_equal', value: 75 })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'score', op: 'less_equal', value: 80 })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'score', op: 'less_equal', value: 70 })).toBe(false);
      });
    });

    describe('string operators', () => {
      it('should handle contains correctly', () => {
        expect(evaluateCondition(testLead, { field: 'fields.title', op: 'contains', value: 'VP' })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'fields.title', op: 'contains', value: 'sales' })).toBe(true); // Case insensitive
        expect(evaluateCondition(testLead, { field: 'fields.title', op: 'contains', value: 'CEO' })).toBe(false);
      });

      it('should handle starts_with correctly', () => {
        expect(evaluateCondition(testLead, { field: 'email', op: 'starts_with', value: 'test' })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'email', op: 'starts_with', value: 'admin' })).toBe(false);
      });

      it('should handle ends_with correctly', () => {
        expect(evaluateCondition(testLead, { field: 'email', op: 'ends_with', value: '@example.com' })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'email', op: 'ends_with', value: '@gmail.com' })).toBe(false);
      });

      it('should handle regex correctly', () => {
        expect(evaluateCondition(testLead, { field: 'email', op: 'regex', value: '^test.*@.*\\.com$' })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'email', op: 'regex', value: '^admin.*' })).toBe(false);
      });
    });

    describe('array operators', () => {
      it('should handle in operator correctly', () => {
        expect(evaluateCondition(testLead, { 
          field: 'source', 
          op: 'in', 
          value: ['website_form', 'linkedin', 'google-ads'] 
        })).toBe(true);
        
        expect(evaluateCondition(testLead, { 
          field: 'source', 
          op: 'in', 
          value: ['linkedin', 'instagram'] 
        })).toBe(false);
      });

      it('should handle not_in operator correctly', () => {
        expect(evaluateCondition(testLead, { 
          field: 'source', 
          op: 'not_in', 
          value: ['linkedin', 'instagram'] 
        })).toBe(true);
        
        expect(evaluateCondition(testLead, { 
          field: 'source', 
          op: 'not_in', 
          value: ['website_form', 'linkedin'] 
        })).toBe(false);
      });
    });

    describe('existence operators', () => {
      it('should handle exists correctly', () => {
        expect(evaluateCondition(testLead, { field: 'email', op: 'exists', value: null })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'phone', op: 'exists', value: null })).toBe(false);
        expect(evaluateCondition(testLead, { field: 'fields.title', op: 'exists', value: null })).toBe(true);
      });

      it('should handle not_exists correctly', () => {
        expect(evaluateCondition(testLead, { field: 'phone', op: 'not_exists', value: null })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'email', op: 'not_exists', value: null })).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle missing nested fields', () => {
        expect(evaluateCondition(testLead, { field: 'fields.missing.nested', op: 'equals', value: 'test' })).toBe(false);
        expect(evaluateCondition(testLead, { field: 'fields.missing.nested', op: 'exists', value: null })).toBe(false);
      });

      it('should handle null and undefined values', () => {
        const leadWithNulls = { ...testLead, company: null, phone: undefined };
        
        expect(evaluateCondition(leadWithNulls, { field: 'company', op: 'equals', value: null })).toBe(true);
        expect(evaluateCondition(leadWithNulls, { field: 'phone', op: 'exists', value: null })).toBe(false);
      });

      it('should handle type coercion for numbers', () => {
        expect(evaluateCondition(testLead, { field: 'score', op: 'equals', value: '75' })).toBe(true);
        expect(evaluateCondition(testLead, { field: 'score', op: 'greater_than', value: '70' })).toBe(true);
      });
    });
  });

  describe('checkRuleConditions', () => {
    const testLead = {
      email: 'enterprise@bigcorp.com',
      score: 85,
      scoreBand: 'HIGH' as const,
      source: 'google-ads',
      fields: {
        title: 'CEO',
        company_size: 'enterprise'
      }
    };

    it('should match when all conditions are met (AND logic)', () => {
      const conditions = [
        { field: 'scoreBand', op: 'equals' as const, value: 'HIGH' },
        { field: 'source', op: 'equals' as const, value: 'google-ads' },
        { field: 'score', op: 'greater_than' as const, value: 80 }
      ];

      const result = checkRuleConditions(testLead, conditions);
      expect(result.matches).toBe(true);
      expect(result.trace).toHaveLength(3);
      expect(result.trace.every(t => t.result === true)).toBe(true);
    });

    it('should not match when any condition fails', () => {
      const conditions = [
        { field: 'scoreBand', op: 'equals' as const, value: 'HIGH' },
        { field: 'source', op: 'equals' as const, value: 'linkedin' }, // This will fail
        { field: 'score', op: 'greater_than' as const, value: 80 }
      ];

      const result = checkRuleConditions(testLead, conditions);
      expect(result.matches).toBe(false);
      expect(result.trace.some(t => t.result === false)).toBe(true);
    });

    it('should handle empty conditions array', () => {
      const result = checkRuleConditions(testLead, []);
      expect(result.matches).toBe(true); // Empty conditions should match
      expect(result.trace).toHaveLength(0);
    });

    it('should provide detailed trace information', () => {
      const conditions = [
        { field: 'fields.title', op: 'contains' as const, value: 'CEO' }
      ];

      const result = checkRuleConditions(testLead, conditions);
      expect(result.trace[0]).toMatchObject({
        condition: conditions[0],
        result: true,
        actualValue: 'CEO'
      });
    });
  });

  describe('selectOwnerFromPool', () => {
    const mockOwners = [
      {
        id: 'owner1',
        userId: 'user1',
        teamId: 'team1',
        capacity: 50,
        user: { email: 'sarah@company.com' }
      },
      {
        id: 'owner2',
        userId: 'user2',
        teamId: 'team1',
        capacity: 40,
        user: { email: 'mike@company.com' }
      },
      {
        id: 'owner3',
        userId: 'user3',
        teamId: 'team1',
        capacity: 45,
        user: { email: 'emily@company.com' }
      }
    ] as Owner[];

    beforeEach(() => {
      // Mock current lead counts for each owner
      mockPrisma.lead.count
        .mockResolvedValueOnce(25) // owner1: 25/50 = 50% utilization
        .mockResolvedValueOnce(35) // owner2: 35/40 = 87.5% utilization  
        .mockResolvedValueOnce(20); // owner3: 20/45 = 44% utilization
    });

    it('should select owner with lowest utilization rate', async () => {
      const result = await selectOwnerFromPool(mockApp, 'AE_POOL_A', mockOwners);

      expect(result.ownerId).toBe('owner3'); // Emily has lowest utilization (44%)
      expect(result.pool).toBe('AE_POOL_A');
      expect(result.reason).toContain('lowest utilization');
      expect(result.reason).toContain('44.4%');
    });

    it('should handle empty pool', async () => {
      const result = await selectOwnerFromPool(mockApp, 'EMPTY_POOL', []);

      expect(result.ownerId).toBeNull();
      expect(result.pool).toBe('EMPTY_POOL');
      expect(result.reason).toContain('No available owners');
    });

    it('should handle owners at full capacity', async () => {
      // Mock all owners at 100% capacity
      mockPrisma.lead.count
        .mockResolvedValueOnce(50) // owner1: 50/50 = 100%
        .mockResolvedValueOnce(40) // owner2: 40/40 = 100%
        .mockResolvedValueOnce(45); // owner3: 45/45 = 100%

      const result = await selectOwnerFromPool(mockApp, 'FULL_POOL', mockOwners);

      // Should still assign to someone (round-robin fallback)
      expect(result.ownerId).toBeTruthy();
      expect(result.reason).toContain('All owners at capacity');
    });

    it('should provide detailed utilization information', async () => {
      const result = await selectOwnerFromPool(mockApp, 'TEST_POOL', mockOwners);

      expect(result.trace).toBeDefined();
      expect(result.trace.length).toBe(3);
      
      // Check that each owner's utilization was calculated
      result.trace.forEach(trace => {
        expect(trace).toHaveProperty('ownerId');
        expect(trace).toHaveProperty('utilization');
        expect(trace).toHaveProperty('capacity');
        expect(trace).toHaveProperty('currentLeads');
      });
    });
  });

  describe('routeLead (integration)', () => {
    const mockRules: RoutingRule[] = [
      {
        id: 'rule1',
        teamId: 'team1',
        enabled: true,
        order: 1,
        definition: {
          if: [
            { field: 'scoreBand', op: 'equals', value: 'HIGH' }
          ],
          then: {
            assign: 'AE_POOL_A',
            priority: 1,
            alert: 'SLACK',
            sla: 5
          }
        }
      },
      {
        id: 'rule2',
        teamId: 'team1',
        enabled: true,
        order: 2,
        definition: {
          if: [
            { field: 'source', op: 'equals', value: 'google-ads' },
            { field: 'score', op: 'greater_than', value: 60 }
          ],
          then: {
            assign: 'AE_POOL_A',
            priority: 2,
            sla: 10
          }
        }
      },
      {
        id: 'rule3',
        teamId: 'team1',
        enabled: true,
        order: 3,
        definition: {
          if: [
            { field: 'fields.company_size', op: 'equals', value: 'enterprise' }
          ],
          then: {
            assign: 'owner1', // Direct assignment to specific owner
            priority: 1,
            alert: 'EMAIL',
            sla: 15
          }
        }
      }
    ];

    const mockOwners = [
      {
        id: 'owner1',
        userId: 'user1',
        teamId: 'team1',
        capacity: 50,
        user: { email: 'sarah@company.com' }
      }
    ] as Owner[];

    beforeEach(() => {
      mockPrisma.owner.findMany.mockResolvedValue(mockOwners);
      mockPrisma.lead.count.mockResolvedValue(20); // 40% utilization
    });

    it('should route high-value lead to priority pool', async () => {
      const lead = {
        email: 'ceo@enterprise.com',
        score: 90,
        scoreBand: 'HIGH' as const,
        source: 'website_form',
        fields: {
          title: 'CEO'
        }
      };

      const result = await routeLead(mockApp, lead, mockRules);

      expect(result.ownerId).toBe('owner1');
      expect(result.pool).toBe('AE_POOL_A');
      expect(result.priority).toBe(1);
      expect(result.alerts).toContain('SLACK');
      expect(result.sla).toBe(5);
      expect(result.reason).toContain('HIGH scoreBand');
    });

    it('should route paid leads with high score', async () => {
      const lead = {
        email: 'user@company.com',
        score: 75,
        scoreBand: 'MEDIUM' as const,
        source: 'google-ads',
        fields: {}
      };

      const result = await routeLead(mockApp, lead, mockRules);

      expect(result.ownerId).toBe('owner1');
      expect(result.pool).toBe('AE_POOL_A');
      expect(result.priority).toBe(2);
      expect(result.sla).toBe(10);
      expect(result.reason).toContain('google-ads source');
    });

    it('should handle direct owner assignment', async () => {
      const lead = {
        email: 'enterprise@bigcorp.com',
        score: 70,
        scoreBand: 'MEDIUM' as const,
        source: 'referral',
        fields: {
          company_size: 'enterprise'
        }
      };

      const result = await routeLead(mockApp, lead, mockRules);

      expect(result.ownerId).toBe('owner1');
      expect(result.pool).toBeNull();
      expect(result.priority).toBe(1);
      expect(result.alerts).toContain('EMAIL');
      expect(result.sla).toBe(15);
      expect(result.reason).toContain('enterprise company_size');
    });

    it('should handle no matching rules', async () => {
      const lead = {
        email: 'basic@smallco.com',
        score: 30,
        scoreBand: 'LOW' as const,
        source: 'organic',
        fields: {
          company_size: 'small'
        }
      };

      const result = await routeLead(mockApp, lead, mockRules);

      expect(result.ownerId).toBeNull();
      expect(result.pool).toBeNull();
      expect(result.reason).toContain('No matching routing rules');
      expect(result.trace).toBeDefined();
    });

    it('should skip disabled rules', async () => {
      const disabledRules = mockRules.map(rule => ({ ...rule, enabled: false }));
      
      const lead = {
        email: 'test@example.com',
        score: 90,
        scoreBand: 'HIGH' as const
      };

      const result = await routeLead(mockApp, lead, disabledRules);

      expect(result.ownerId).toBeNull();
      expect(result.reason).toContain('No matching routing rules');
    });

    it('should process rules in order and use first match', async () => {
      const lead = {
        email: 'enterprise@bigcorp.com',
        score: 90,
        scoreBand: 'HIGH' as const,
        source: 'google-ads',
        fields: {
          company_size: 'enterprise'
        }
      };

      const result = await routeLead(mockApp, lead, mockRules);

      // Should match first rule (HIGH scoreBand) even though it matches others
      expect(result.reason).toContain('HIGH scoreBand');
      expect(result.sla).toBe(5); // From first rule, not later ones
    });

    it('should handle pool assignment when no owners available', async () => {
      mockPrisma.owner.findMany.mockResolvedValue([]); // No owners in pool

      const lead = {
        email: 'test@example.com',
        score: 90,
        scoreBand: 'HIGH' as const
      };

      const result = await routeLead(mockApp, lead, mockRules);

      expect(result.ownerId).toBeNull();
      expect(result.pool).toBe('AE_POOL_A');
      expect(result.reason).toContain('No available owners in pool');
    });

    it('should provide comprehensive trace information', async () => {
      const lead = {
        email: 'test@example.com',
        score: 40,
        scoreBand: 'LOW' as const,
        source: 'organic'
      };

      const result = await routeLead(mockApp, lead, mockRules);

      expect(result.trace).toBeDefined();
      expect(result.trace.length).toBe(mockRules.length);
      
      result.trace.forEach((trace, index) => {
        expect(trace).toHaveProperty('ruleId', mockRules[index].id);
        expect(trace).toHaveProperty('matched');
        expect(trace).toHaveProperty('conditions');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed rule definitions', async () => {
      const malformedRules = [
        {
          id: 'bad1',
          teamId: 'team1',
          enabled: true,
          order: 1,
          definition: null as any
        },
        {
          id: 'bad2',
          teamId: 'team1',
          enabled: true,
          order: 2,
          definition: {
            if: null,
            then: null
          } as any
        }
      ];

      const lead = { email: 'test@example.com', score: 50 };

      const result = await routeLead(mockApp, lead, malformedRules);

      expect(result.ownerId).toBeNull();
      expect(result.reason).toContain('No matching routing rules');
      // Should not throw error, should skip malformed rules
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.owner.findMany.mockRejectedValue(new Error('Database error'));

      const rules = [
        {
          id: 'rule1',
          teamId: 'team1',
          enabled: true,
          order: 1,
          definition: {
            if: [{ field: 'score', op: 'greater_than' as const, value: 50 }],
            then: { assign: 'AE_POOL_A', priority: 1 }
          }
        }
      ];

      const lead = { email: 'test@example.com', score: 75 };

      const result = await routeLead(mockApp, lead, rules);

      expect(result.ownerId).toBeNull();
      expect(result.reason).toContain('Error during pool assignment');
    });

    it('should handle circular references in lead data', () => {
      const lead = {
        email: 'test@example.com',
        fields: {} as any
      };
      
      // Create circular reference
      lead.fields.self = lead;

      const condition = { field: 'fields.self.email', op: 'equals' as const, value: 'test@example.com' };

      // Should not throw error or cause infinite loop
      expect(() => evaluateCondition(lead, condition)).not.toThrow();
    });

    it('should handle very deep field paths', () => {
      const deepLead = {
        a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 'deep_value' } } } } } } } } }
      };

      const condition = { field: 'a.b.c.d.e.f.g.h.i.j', op: 'equals' as const, value: 'deep_value' };

      expect(evaluateCondition(deepLead, condition)).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of rules efficiently', async () => {
      const manyRules = Array.from({ length: 100 }, (_, i) => ({
        id: `rule_${i}`,
        teamId: 'team1',
        enabled: true,
        order: i,
        definition: {
          if: [{ field: 'score', op: 'equals' as const, value: i }],
          then: { assign: `owner_${i}`, priority: 1 }
        }
      }));

      const lead = { email: 'test@example.com', score: 50 };

      const startTime = Date.now();
      const result = await routeLead(mockApp, lead, manyRules);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(result.ownerId).toBe('owner_50'); // Should find matching rule
    });

    it('should handle complex condition evaluation efficiently', () => {
      const complexLead = {
        email: 'complex@example.com',
        fields: {
          nested: {
            deep: {
              array: ['value1', 'value2', 'value3'],
              object: {
                prop1: 'test',
                prop2: 123,
                prop3: true
              }
            }
          }
        }
      };

      const complexConditions = [
        { field: 'fields.nested.deep.array', op: 'in' as const, value: ['value2'] },
        { field: 'fields.nested.deep.object.prop1', op: 'contains' as const, value: 'test' },
        { field: 'fields.nested.deep.object.prop2', op: 'greater_than' as const, value: 100 },
        { field: 'fields.nested.deep.object.prop3', op: 'equals' as const, value: true }
      ];

      const startTime = Date.now();
      const result = checkRuleConditions(complexLead, complexConditions);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
      expect(result.matches).toBe(true);
    });
  });
});
