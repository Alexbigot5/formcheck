import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { deduplicateLead, findDuplicates, calculateSimilarity } from '../index';
import { buildKeys } from '../keys';
import { mergeLeads } from '../merger';
import type { Lead, DedupeKeys, DedupeResult } from '../../../types/index';

// Mock Prisma
const mockPrisma = {
  leadDedupeKey: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
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

describe('Deduplication System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default transaction mock - just execute the callback
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback(mockPrisma);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildKeys', () => {
    it('should generate correct dedupe keys for complete lead', () => {
      const lead = {
        email: 'john.doe@company.com',
        name: 'John Doe',
        phone: '+1-555-123-4567',
        company: 'Acme Corp',
        domain: 'company.com'
      };

      const keys = buildKeys(lead);

      expect(keys.emailHash).toBeDefined();
      expect(keys.domain).toBe('company.com');
      expect(keys.nameKey).toBe('johndoe'); // Normalized name
    });

    it('should handle missing email gracefully', () => {
      const lead = {
        name: 'John Doe',
        company: 'Acme Corp',
        domain: 'company.com'
      };

      const keys = buildKeys(lead);

      expect(keys.emailHash).toBeUndefined();
      expect(keys.domain).toBe('company.com');
      expect(keys.nameKey).toBe('johndoe');
    });

    it('should normalize names correctly', () => {
      const testCases = [
        { input: 'John Doe', expected: 'johndoe' },
        { input: 'Mary Jane Smith', expected: 'maryjanesmith' },
        { input: 'Jean-Claude Van Damme', expected: 'jeanclaudevandamme' },
        { input: 'O\'Connor', expected: 'oconnor' },
        { input: 'José María', expected: 'josemaria' }
      ];

      testCases.forEach(({ input, expected }) => {
        const keys = buildKeys({ name: input });
        expect(keys.nameKey).toBe(expected);
      });
    });

    it('should extract domain from email when domain not provided', () => {
      const lead = {
        email: 'user@example.com',
        name: 'Test User'
      };

      const keys = buildKeys(lead);

      expect(keys.domain).toBe('example.com');
    });

    it('should handle international domains', () => {
      const lead = {
        email: 'user@münchen.de',
        domain: 'münchen.de'
      };

      const keys = buildKeys(lead);

      expect(keys.domain).toBe('münchen.de');
    });

    it('should handle empty or null inputs', () => {
      expect(() => buildKeys({})).not.toThrow();
      expect(() => buildKeys(null as any)).not.toThrow();
      expect(() => buildKeys(undefined as any)).not.toThrow();
    });
  });

  describe('calculateSimilarity', () => {
    const lead1 = {
      id: '1',
      email: 'john.doe@company.com',
      name: 'John Doe',
      company: 'Acme Corp',
      domain: 'company.com',
      phone: '+1-555-123-4567'
    };

    it('should detect exact email match', () => {
      const lead2 = {
        id: '2',
        email: 'john.doe@company.com',
        name: 'J. Doe',
        company: 'Acme Corporation'
      };

      const similarity = calculateSimilarity(lead1, lead2);

      expect(similarity.score).toBeGreaterThan(0.8);
      expect(similarity.reasons).toContain('Exact email match');
      expect(similarity.confidence).toBe('high');
    });

    it('should detect similar names with same domain', () => {
      const lead2 = {
        id: '2',
        email: 'j.doe@company.com',
        name: 'J. Doe',
        company: 'Acme Corp',
        domain: 'company.com'
      };

      const similarity = calculateSimilarity(lead1, lead2);

      expect(similarity.score).toBeGreaterThan(0.6);
      expect(similarity.reasons).toContain('Same domain');
      expect(similarity.reasons).toContain('Similar name');
    });

    it('should detect phone number matches', () => {
      const lead2 = {
        id: '2',
        email: 'different@other.com',
        name: 'Different Name',
        phone: '+1-555-123-4567' // Same phone
      };

      const similarity = calculateSimilarity(lead1, lead2);

      expect(similarity.score).toBeGreaterThan(0.5);
      expect(similarity.reasons).toContain('Same phone number');
    });

    it('should handle normalized phone number formats', () => {
      const phoneVariations = [
        '+1-555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '5551234567',
        '+15551234567'
      ];

      phoneVariations.forEach(phone => {
        const lead2 = { ...lead1, id: '2', phone };
        const similarity = calculateSimilarity(lead1, lead2);
        expect(similarity.score).toBeGreaterThan(0.5);
      });
    });

    it('should detect company name similarities', () => {
      const lead2 = {
        id: '2',
        email: 'different@company.com',
        name: 'Different Person',
        company: 'Acme Corporation', // Similar to "Acme Corp"
        domain: 'company.com'
      };

      const similarity = calculateSimilarity(lead1, lead2);

      expect(similarity.score).toBeGreaterThan(0.4);
      expect(similarity.reasons).toContain('Same domain');
      expect(similarity.reasons).toContain('Similar company name');
    });

    it('should return low similarity for completely different leads', () => {
      const lead2 = {
        id: '2',
        email: 'completely@different.com',
        name: 'Totally Different',
        company: 'Other Company',
        domain: 'different.com',
        phone: '+1-999-888-7777'
      };

      const similarity = calculateSimilarity(lead1, lead2);

      expect(similarity.score).toBeLessThan(0.3);
      expect(similarity.confidence).toBe('low');
    });

    it('should handle missing data gracefully', () => {
      const incompleteLead = {
        id: '2',
        email: 'test@example.com'
      };

      expect(() => calculateSimilarity(lead1, incompleteLead)).not.toThrow();
      
      const similarity = calculateSimilarity(lead1, incompleteLead);
      expect(similarity.score).toBeGreaterThanOrEqual(0);
      expect(similarity.score).toBeLessThanOrEqual(1);
    });
  });

  describe('findDuplicates', () => {
    const testLead = {
      email: 'john@company.com',
      name: 'John Smith',
      company: 'Test Corp',
      domain: 'company.com'
    };

    beforeEach(() => {
      mockPrisma.leadDedupeKey.findMany.mockResolvedValue([
        {
          id: 'key1',
          leadId: 'lead1',
          emailHash: 'hash123',
          domain: 'company.com',
          nameKey: 'johnsmith',
          lead: {
            id: 'lead1',
            email: 'john@company.com',
            name: 'John Smith',
            company: 'Test Corp',
            domain: 'company.com'
          }
        },
        {
          id: 'key2',
          leadId: 'lead2',
          emailHash: 'hash456',
          domain: 'company.com',
          nameKey: 'janesmith',
          lead: {
            id: 'lead2',
            email: 'jane@company.com',
            name: 'Jane Smith',
            company: 'Test Corp',
            domain: 'company.com'
          }
        }
      ]);
    });

    it('should find exact email duplicates', async () => {
      const duplicates = await findDuplicates(mockApp, testLead, 'team1');

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].lead.email).toBe('john@company.com');
      expect(duplicates[0].similarity.confidence).toBe('high');
    });

    it('should find similar leads in same domain', async () => {
      const similarLead = {
        email: 'j.smith@company.com',
        name: 'J. Smith',
        company: 'Test Corporation',
        domain: 'company.com'
      };

      const duplicates = await findDuplicates(mockApp, similarLead, 'team1');

      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates.some(d => d.similarity.reasons.includes('Same domain'))).toBe(true);
    });

    it('should respect similarity threshold', async () => {
      const veryDifferentLead = {
        email: 'completely@different.com',
        name: 'Totally Different',
        company: 'Other Corp',
        domain: 'different.com'
      };

      const duplicates = await findDuplicates(mockApp, veryDifferentLead, 'team1', { threshold: 0.8 });

      expect(duplicates).toHaveLength(0);
    });

    it('should limit results when requested', async () => {
      // Mock many potential duplicates
      const manyKeys = Array.from({ length: 20 }, (_, i) => ({
        id: `key${i}`,
        leadId: `lead${i}`,
        emailHash: `hash${i}`,
        domain: 'company.com',
        nameKey: `user${i}`,
        lead: {
          id: `lead${i}`,
          email: `user${i}@company.com`,
          name: `User ${i}`,
          company: 'Test Corp',
          domain: 'company.com'
        }
      }));

      mockPrisma.leadDedupeKey.findMany.mockResolvedValue(manyKeys);

      const duplicates = await findDuplicates(mockApp, testLead, 'team1', { limit: 5 });

      expect(duplicates.length).toBeLessThanOrEqual(5);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.leadDedupeKey.findMany.mockRejectedValue(new Error('Database error'));

      const duplicates = await findDuplicates(mockApp, testLead, 'team1');

      expect(duplicates).toEqual([]);
      expect(mockApp.log.error).toHaveBeenCalledWith(
        'Failed to find duplicates:',
        expect.any(Error)
      );
    });
  });

  describe('deduplicateLead (integration)', () => {
    const newLead = {
      email: 'john@company.com',
      name: 'John Smith',
      company: 'Test Corp',
      domain: 'company.com',
      phone: '+1-555-123-4567',
      source: 'website_form',
      fields: { title: 'Manager' },
      utm: { source: 'google' }
    };

    it('should create new lead when no duplicates found', async () => {
      mockPrisma.leadDedupeKey.findMany.mockResolvedValue([]);
      mockPrisma.lead.create.mockResolvedValue({ id: 'new_lead_id', ...newLead });

      const result = await deduplicateLead(mockApp, newLead, 'team1');

      expect(result.action).toBe('created');
      expect(result.leadId).toBe('new_lead_id');
      expect(result.message).toContain('New lead created');
      expect(mockPrisma.lead.create).toHaveBeenCalled();
    });

    it('should merge with high-confidence duplicate', async () => {
      const existingLead = {
        id: 'existing_id',
        email: 'john@company.com',
        name: 'John Smith',
        company: 'Test Corp',
        score: 50,
        fields: { department: 'Sales' }
      };

      mockPrisma.leadDedupeKey.findMany.mockResolvedValue([
        {
          id: 'key1',
          leadId: 'existing_id',
          emailHash: 'hash123',
          lead: existingLead
        }
      ]);

      // Mock merge operation
      vi.mocked(mergeLeads).mockResolvedValue({
        success: true,
        mergedLead: { ...existingLead, ...newLead },
        changes: ['Added phone number', 'Updated UTM data']
      });

      const result = await deduplicateLead(mockApp, newLead, 'team1');

      expect(result.action).toBe('merged');
      expect(result.leadId).toBe('existing_id');
      expect(result.duplicateId).toBe('existing_id');
      expect(result.message).toContain('Merged with existing lead');
    });

    it('should skip merge for low-confidence duplicates', async () => {
      const existingLead = {
        id: 'existing_id',
        email: 'different@company.com',
        name: 'Different Name',
        company: 'Test Corp',
        domain: 'company.com'
      };

      mockPrisma.leadDedupeKey.findMany.mockResolvedValue([
        {
          id: 'key1',
          leadId: 'existing_id',
          lead: existingLead
        }
      ]);

      mockPrisma.lead.create.mockResolvedValue({ id: 'new_lead_id', ...newLead });

      const result = await deduplicateLead(mockApp, newLead, 'team1', { threshold: 0.8 });

      expect(result.action).toBe('created');
      expect(result.leadId).toBe('new_lead_id');
      expect(mockPrisma.lead.create).toHaveBeenCalled();
    });

    it('should handle merge strategy override', async () => {
      const existingLead = {
        id: 'existing_id',
        email: 'john@company.com',
        name: 'John Smith',
        score: 75
      };

      mockPrisma.leadDedupeKey.findMany.mockResolvedValue([
        {
          id: 'key1',
          leadId: 'existing_id',
          lead: existingLead
        }
      ]);

      const result = await deduplicateLead(mockApp, newLead, 'team1', { 
        strategy: 'skip_if_exists' 
      });

      expect(result.action).toBe('skipped');
      expect(result.leadId).toBe('existing_id');
      expect(result.message).toContain('Skipped - lead already exists');
    });

    it('should create dedupe keys for new leads', async () => {
      mockPrisma.leadDedupeKey.findMany.mockResolvedValue([]);
      mockPrisma.lead.create.mockResolvedValue({ id: 'new_lead_id', ...newLead });

      await deduplicateLead(mockApp, newLead, 'team1');

      expect(mockPrisma.leadDedupeKey.create).toHaveBeenCalledWith({
        data: {
          leadId: 'new_lead_id',
          emailHash: expect.any(String),
          domain: 'company.com',
          nameKey: 'johnsmith'
        }
      });
    });

    it('should handle transaction failures', async () => {
      mockPrisma.leadDedupeKey.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await deduplicateLead(mockApp, newLead, 'team1');

      expect(result.action).toBe('error');
      expect(result.message).toContain('Failed to process lead');
      expect(mockApp.log.error).toHaveBeenCalled();
    });

    it('should validate lead data before processing', async () => {
      const invalidLead = {
        // Missing required fields
        name: 'Test'
      };

      const result = await deduplicateLead(mockApp, invalidLead as any, 'team1');

      expect(result.action).toBe('error');
      expect(result.message).toContain('Invalid lead data');
    });

    it('should handle multiple potential duplicates', async () => {
      const multipleDuplicates = [
        {
          id: 'key1',
          leadId: 'lead1',
          lead: {
            id: 'lead1',
            email: 'john@company.com',
            name: 'John Smith',
            score: 60
          }
        },
        {
          id: 'key2',
          leadId: 'lead2',
          lead: {
            id: 'lead2',
            email: 'j.smith@company.com',
            name: 'J. Smith',
            score: 70
          }
        }
      ];

      mockPrisma.leadDedupeKey.findMany.mockResolvedValue(multipleDuplicates);

      vi.mocked(mergeLeads).mockResolvedValue({
        success: true,
        mergedLead: { id: 'lead1' },
        changes: ['Merged data']
      });

      const result = await deduplicateLead(mockApp, newLead, 'team1');

      // Should merge with highest confidence match (exact email)
      expect(result.action).toBe('merged');
      expect(result.leadId).toBe('lead1');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of potential duplicates efficiently', async () => {
      const manyDuplicates = Array.from({ length: 1000 }, (_, i) => ({
        id: `key${i}`,
        leadId: `lead${i}`,
        emailHash: `hash${i}`,
        domain: 'company.com',
        nameKey: `user${i}`,
        lead: {
          id: `lead${i}`,
          email: `user${i}@company.com`,
          name: `User ${i}`,
          company: 'Test Corp',
          domain: 'company.com'
        }
      }));

      mockPrisma.leadDedupeKey.findMany.mockResolvedValue(manyDuplicates);

      const testLead = {
        email: 'user500@company.com',
        name: 'User 500',
        company: 'Test Corp',
        domain: 'company.com'
      };

      const startTime = Date.now();
      const duplicates = await findDuplicates(mockApp, testLead, 'team1');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should handle special characters in names and emails', async () => {
      const specialLead = {
        email: 'josé.maría+test@münchen.de',
        name: 'José María O\'Connor-Smith',
        company: 'Åcme Çorp',
        domain: 'münchen.de'
      };

      expect(() => buildKeys(specialLead)).not.toThrow();
      
      const keys = buildKeys(specialLead);
      expect(keys.nameKey).toBeDefined();
      expect(keys.domain).toBe('münchen.de');
    });

    it('should handle very long field values', async () => {
      const longLead = {
        email: 'test@example.com',
        name: 'A'.repeat(1000),
        company: 'B'.repeat(1000)
      };

      expect(() => buildKeys(longLead)).not.toThrow();
      expect(() => calculateSimilarity(longLead, longLead)).not.toThrow();
    });

    it('should handle null and undefined values in lead data', async () => {
      const partialLead = {
        email: 'test@example.com',
        name: null,
        company: undefined,
        phone: '',
        domain: null
      };

      expect(() => buildKeys(partialLead as any)).not.toThrow();
      
      const keys = buildKeys(partialLead as any);
      expect(keys.emailHash).toBeDefined();
      expect(keys.nameKey).toBeUndefined();
    });

    it('should handle concurrent deduplication requests', async () => {
      const lead1 = { email: 'concurrent1@test.com', name: 'Test 1' };
      const lead2 = { email: 'concurrent2@test.com', name: 'Test 2' };

      mockPrisma.leadDedupeKey.findMany.mockResolvedValue([]);
      mockPrisma.lead.create
        .mockResolvedValueOnce({ id: 'lead1', ...lead1 })
        .mockResolvedValueOnce({ id: 'lead2', ...lead2 });

      const promises = [
        deduplicateLead(mockApp, lead1, 'team1'),
        deduplicateLead(mockApp, lead2, 'team1')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.action === 'created')).toBe(true);
    });
  });
});
