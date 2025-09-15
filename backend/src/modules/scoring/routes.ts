import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';
import { 
  getScoringConfig, 
  getScoringRules, 
  upsertScoringConfig, 
  upsertScoringRule,
  initializeDefaultScoringConfig,
  updateScoringRule,
  deleteScoringRule,
  reorderScoringRules,
  getScoringConfigHistory,
  validateScoringConfig,
  validateScoringRule
} from './config';
import { applyScoring, getDefaultScoringConfig, type Lead } from './engine';

// Validation schemas
const testScoringSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  domain: z.string().optional(),
  source: z.string().default('test'),
  fields: z.record(z.any()).default({}),
  utm: z.record(z.any()).default({})
});

const scoringConfigSchema = z.object({
  weights: z.record(z.number().min(0)),
  bands: z.object({
    low: z.object({ min: z.number(), max: z.number() }),
    medium: z.object({ min: z.number(), max: z.number() }),
    high: z.object({ min: z.number(), max: z.number() })
  }),
  negative: z.array(z.object({
    field: z.string(),
    op: z.enum(['equals', 'contains', 'starts_with', 'ends_with', 'regex']),
    value: z.any(),
    penalty: z.number().min(0),
    reason: z.string()
  })),
  enrichment: z.record(z.any()).default({})
});

const scoringRuleSchema = z.object({
  type: z.enum(['IF_THEN', 'WEIGHT']),
  definition: z.object({
    if: z.array(z.object({
      field: z.string(),
      op: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'contains', 'not_contains', 'starts_with', 'ends_with', 'regex', 'in', 'not_in', 'exists', 'not_exists']),
      value: z.any()
    })).optional(),
    then: z.object({
      add: z.number().optional(),
      multiply: z.number().optional(),
      tag: z.string().optional(),
      route: z.string().optional(),
      sla: z.number().optional()
    }).optional(),
    weight: z.number().optional(),
    field: z.string().optional()
  }),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0)
});

export async function registerScoringRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  // Note: Authentication is applied per route using preHandler option

  /**
   * GET /api/scoring/config - Get current scoring configuration
   */
  app.get('/api/scoring/config', async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId!;

    try {
      let [config, rules] = await Promise.all([
        getScoringConfig(app, teamId),
        getScoringRules(app, teamId)
      ]);

      // Initialize default config if none exists
      if (!config) {
        const userId = request.user!.id;
        const initialized = await initializeDefaultScoringConfig(app, teamId, userId);
        config = initialized.config;
        rules = initialized.rules;
      }

      return reply.send({ ok: true, data: { config, rules } });

    } catch (error) {
      app.log.error('Failed to get scoring config:', error as any);
      return reply.code(500).send({ ok: false, error: 'Failed to get scoring configuration' });
    }
  });

  /**
   * POST /api/scoring/config - Create or update scoring configuration
   */
  app.post('/api/scoring/config', async (request: AuthenticatedRequest, reply) => {
    // Validate request body
    const parsed = scoringConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error });
    }
    const configData = parsed.data;
    const teamId = request.teamId!;
    const userId = request.user!.id;

    try {
      // Validate configuration
      const validation = validateScoringConfig(configData);
      if (!validation.valid) {
        return reply.code(400).send({ 
          ok: false,
          error: 'Invalid scoring configuration', 
          details: validation.errors 
        });
      }

      const config = await upsertScoringConfig(app, teamId, configData, userId);

      return reply.send({
        ok: true,
        data: { config, message: 'Scoring configuration updated successfully' }
      });

    } catch (error) {
      app.log.error('Failed to update scoring config:', error as any);
      return reply.code(500).send({ ok: false, error: 'Failed to update scoring configuration' });
    }
  });

  /**
   * POST /api/scoring/test - Test scoring rules against sample lead
   */
  app.post('/api/scoring/test', async (request: AuthenticatedRequest, reply) => {
    // Validate request body
    const parsed = testScoringSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error });
    }
    const leadData = parsed.data;
    const teamId = request.teamId!;

    try {
      // Get scoring configuration and rules
      let config = await getScoringConfig(app, teamId);
      let rules = await getScoringRules(app, teamId);

      // Initialize default config if none exists
      if (!config) {
        const userId = request.user!.id;
        const initialized = await initializeDefaultScoringConfig(app, teamId, userId);
        config = initialized.config;
        rules = initialized.rules;
      }

      // Apply scoring
      const result = await applyScoring(app, leadData as Lead, config, rules);

      return reply.send({ ok: true, data: result });

    } catch (error) {
      app.log.error('Scoring test failed:', error as any);
      return reply.code(500).send({ ok: false, error: 'Failed to test scoring' });
    }
  });

  /**
   * POST /api/scoring/rules - Create scoring rule
   */
  app.post('/api/scoring/rules', async (request: AuthenticatedRequest, reply) => {
    // Validate request body
    const parsed = scoringRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error });
    }
    const ruleData = parsed.data;
    const teamId = request.teamId!;

    try {
      // Validate rule
      const validation = validateScoringRule(ruleData);
      if (!validation.valid) {
        return reply.code(400).send({ 
          ok: false,
          error: 'Invalid scoring rule', 
          details: validation.errors 
        });
      }

      const rule = await upsertScoringRule(app, teamId, ruleData);

      return reply.code(201).send({
        ok: true,
        data: { rule, message: 'Scoring rule created successfully' }
      });

    } catch (error) {
      app.log.error('Failed to create scoring rule:', error as any);
      return reply.code(500).send({ ok: false, error: 'Failed to create scoring rule' });
    }
  });

  /**
   * PUT /api/scoring/rules/:id - Update scoring rule
   */
  app.put('/api/scoring/rules/:id', async (request: AuthenticatedRequest, reply) => {
    // Validate request body
    const bodyParsed = scoringRuleSchema.partial().safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: bodyParsed.error });
    }
    const { id } = request.params as { id: string };
    const updates = bodyParsed.data;
    const teamId = request.teamId!;

    try {
      const rule = await updateScoringRule(app, id, teamId, updates);

      return reply.send({
        ok: true,
        data: { rule, message: 'Scoring rule updated successfully' }
      });

    } catch (error) {
      app.log.error('Failed to update scoring rule:', error as any);
      return reply.code(500).send({ ok: false, error: 'Failed to update scoring rule' });
    }
  });

  /**
   * DELETE /api/scoring/rules/:id - Delete scoring rule
   */
  app.delete('/api/scoring/rules/:id', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const teamId = request.teamId!;

    try {
      await deleteScoringRule(app, id, teamId);

      return reply.send({
        ok: true,
        data: { message: 'Scoring rule deleted successfully' }
      });

    } catch (error) {
      app.log.error('Failed to delete scoring rule:', error as any);
      return reply.code(500).send({ ok: false, error: 'Failed to delete scoring rule' });
    }
  });

  /**
   * POST /api/scoring/initialize - Initialize default scoring configuration
   */
  app.post('/api/scoring/initialize', async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId!;
    const userId = request.user!.id;

    try {
      const { config, rules } = await initializeDefaultScoringConfig(app, teamId, userId);

      return reply.send({
        ok: true,
        data: {
          config,
          rules,
          message: 'Default scoring configuration initialized successfully'
        }
      });

    } catch (error) {
      app.log.error('Failed to initialize scoring config:', error as any);
      return reply.code(500).send({ ok: false, error: 'Failed to initialize scoring configuration' });
    }
  });
}
