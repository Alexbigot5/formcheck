import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { webhookAuth } from '../../middleware/auth';
import { deduplicateLead } from '../dedupe/index';
import { applyScoring, getScoringConfig, getScoringRules, initializeDefaultScoringConfig } from '../scoring/index';
import { routeLead, getRoutingRules, initializeDefaultRoutingRules } from '../routing/index';
import { enrichLead } from './enrichment';
import { normalizeWebhookPayload } from './normalizer';

// Validation schemas
const webhookPayloadSchema = z.object({
  // Common webhook fields
  event: z.string().optional(),
  source: z.string().default('webhook'),
  timestamp: z.number().optional(),
  
  // Lead data (flexible structure)
  email: z.string().email().optional(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  
  // Form-specific fields
  formId: z.string().optional(),
  formName: z.string().optional(),
  submissionId: z.string().optional(),
  
  // Custom fields (flexible)
  fields: z.record(z.any()).optional(),
  customFields: z.record(z.any()).optional(),
  
  // UTM and tracking
  utm: z.record(z.string()).optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  gclid: z.string().optional(),
  referrer: z.string().optional(),
  
  // Additional metadata
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export interface WebhookIngestionResult {
  leadId: string;
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  ownerId: string | null;
  pool: string | null;
  slaTargetAt: string | null;
  action: 'created' | 'merged' | 'skipped';
  messageId: string;
  timelineEvents: string[];
}

export async function registerWebhookIngestionRoutes(app: FastifyInstance) {
  
  /**
   * POST /ingest/webhook - Main webhook ingestion endpoint
   */
  app.post('/ingest/webhook', {
    preHandler: [webhookAuth],
    schema: {
      body: webhookPayloadSchema,
      response: {
        200: z.object({
          leadId: z.string(),
          score: z.number(),
          band: z.enum(['LOW', 'MEDIUM', 'HIGH']),
          ownerId: z.string().nullable(),
          pool: z.string().nullable(),
          slaTargetAt: z.string().nullable(),
          action: z.enum(['created', 'merged', 'skipped']),
          messageId: z.string(),
          timelineEvents: z.array(z.string()),
          message: z.string()
        })
      }
    }
  }, async (request, reply) => {
    const payload = request.body as z.infer<typeof webhookPayloadSchema>;

    try {
      app.log.info('Webhook ingestion started', { 
        source: payload.source,
        email: payload.email,
        company: payload.company 
      });

      // Step 1: Normalize payload to lead fields
      const normalizedLead = await normalizeWebhookPayload(payload);
      app.log.debug('Payload normalized', { normalizedLead });

      // Determine teamId (for now, use a default or extract from API key context)
      // In a real implementation, you might extract this from the webhook source or API key
      const teamId = extractTeamIdFromWebhook(payload) || 'default_team';

      // Step 2: Enrichment
      const enrichedLead = await enrichLead(app, normalizedLead, teamId);
      app.log.debug('Lead enriched', { enrichedLead });

      // Step 3: Scoring
      let config = await getScoringConfig(app, teamId);
      let rules = await getScoringRules(app, teamId);

      if (!config) {
        const initialized = await initializeDefaultScoringConfig(app, teamId, 'system');
        config = initialized.config;
        rules = initialized.rules;
      }

      const scoringResult = await applyScoring(app, enrichedLead, config, rules);
      app.log.debug('Lead scored', { 
        score: scoringResult.score, 
        band: scoringResult.band 
      });

      // Update lead with scoring results
      const scoredLead = {
        ...enrichedLead,
        score: scoringResult.score,
        scoreBand: scoringResult.band
      };

      // Step 4: Deduplication
      const dedupeResult = await deduplicateLead(app, scoredLead, teamId);
      app.log.debug('Deduplication completed', { 
        action: dedupeResult.action, 
        leadId: dedupeResult.leadId 
      });

      // Step 5: Routing (only for new leads)
      let routingResult = null;
      let slaTargetAt: string | null = null;

      if (dedupeResult.action === 'created') {
        let routingRules = await getRoutingRules(app, teamId);
        
        if (routingRules.length === 0) {
          routingRules = await initializeDefaultRoutingRules(app, teamId);
        }

        routingResult = await routeLead(app, scoredLead, routingRules, teamId);

        // Update lead with routing assignment
        if (routingResult.ownerId) {
          await app.prisma.lead.update({
            where: { id: dedupeResult.leadId },
            data: { ownerId: routingResult.ownerId }
          });
        }

        // Step 6: SLA Management
        if (routingResult.sla) {
          const slaTarget = new Date(Date.now() + routingResult.sla * 60 * 1000);
          slaTargetAt = slaTarget.toISOString();

          await app.prisma.sLAClock.create({
            data: {
              leadId: dedupeResult.leadId,
              targetAt: slaTarget
            }
          });
        }

        app.log.debug('Lead routed', { 
          ownerId: routingResult.ownerId, 
          pool: routingResult.pool,
          sla: routingResult.sla 
        });
      }

      // Step 7: Save Message
      const messageId = await saveWebhookMessage(
        app, 
        dedupeResult.leadId, 
        payload, 
        normalizedLead
      );

      // Step 8: Save Timeline Events
      const timelineEventIds = await saveTimelineEvents(
        app,
        dedupeResult.leadId,
        {
          action: dedupeResult.action,
          scoring: scoringResult,
          routing: routingResult,
          enrichment: enrichedLead,
          source: payload.source || 'webhook'
        }
      );

      const result: WebhookIngestionResult = {
        leadId: dedupeResult.leadId,
        score: scoringResult.score,
        band: scoringResult.band,
        ownerId: routingResult?.ownerId || null,
        pool: routingResult?.pool || null,
        slaTargetAt,
        action: dedupeResult.action,
        messageId,
        timelineEvents: timelineEventIds
      };

      const message = createSuccessMessage(result);

      app.log.info('Webhook ingestion completed', result);

      return reply.send({
        ...result,
        message
      });

    } catch (error) {
      app.log.error('Webhook ingestion failed:', error);
      return reply.code(500).send({ 
        error: 'Webhook ingestion failed',
        details: error.message 
      });
    }
  });

  /**
   * POST /ingest/webhook/test - Test webhook ingestion without HMAC
   */
  app.post('/ingest/webhook/test', {
    schema: {
      body: webhookPayloadSchema,
      response: {
        200: z.object({
          normalized: z.any(),
          enriched: z.any(),
          scoring: z.any(),
          routing: z.any(),
          message: z.string()
        })
      }
    }
  }, async (request, reply) => {
    const payload = request.body as z.infer<typeof webhookPayloadSchema>;

    try {
      // Step 1: Normalize
      const normalizedLead = await normalizeWebhookPayload(payload);
      
      // Step 2: Enrichment (mock)
      const enrichedLead = await enrichLead(app, normalizedLead, 'test_team');
      
      // Step 3: Scoring (mock)
      const mockConfig = {
        id: 'test',
        teamId: 'test_team',
        weights: { email: 5, company: 8, phone: 4 },
        bands: {
          low: { min: 0, max: 30 },
          medium: { min: 31, max: 70 },
          high: { min: 71, max: 100 }
        },
        negative: [],
        enrichment: {},
        version: 1
      };

      const scoringResult = await applyScoring(app, enrichedLead, mockConfig, []);
      
      // Step 4: Routing (mock)
      const mockRoutingRules = [{
        id: 'test_rule',
        teamId: 'test_team',
        name: 'Test Rule',
        definition: {
          if: [{ field: 'scoreBand', op: 'equals' as const, value: 'HIGH' }],
          then: { assign: 'TEST_POOL', sla: 30 }
        },
        enabled: true,
        order: 1
      }];

      const routingResult = await routeLead(app, {
        ...enrichedLead,
        score: scoringResult.score,
        scoreBand: scoringResult.band
      }, mockRoutingRules, 'demo-team-id');

      return reply.send({
        normalized: normalizedLead,
        enriched: enrichedLead,
        scoring: scoringResult,
        routing: routingResult,
        message: 'Webhook test completed successfully'
      });

    } catch (error) {
      app.log.error('Webhook test failed:', error);
      return reply.code(500).send({ 
        error: 'Webhook test failed',
        details: error.message 
      });
    }
  });
}

/**
 * Save webhook message to database
 */
async function saveWebhookMessage(
  app: FastifyInstance,
  leadId: string,
  payload: any,
  normalizedLead: any
): Promise<string> {
  const message = await app.prisma.message.create({
    data: {
      leadId,
      direction: 'IN',
      channel: 'FORM',
      subject: `Form submission from ${normalizedLead.source || 'webhook'}`,
      body: JSON.stringify({
        email: normalizedLead.email,
        name: normalizedLead.name,
        company: normalizedLead.company,
        fields: normalizedLead.fields
      }, null, 2),
      meta: {
        originalPayload: payload,
        source: payload.source || 'webhook',
        submissionId: payload.submissionId,
        formId: payload.formId,
        formName: payload.formName,
        timestamp: payload.timestamp || Date.now(),
        ip: payload.ip,
        userAgent: payload.userAgent
      }
    }
  });

  return message.id;
}

/**
 * Save timeline events for webhook ingestion
 */
async function saveTimelineEvents(
  app: FastifyInstance,
  leadId: string,
  data: {
    action: string;
    scoring: any;
    routing: any;
    enrichment: any;
    source: string;
  }
): Promise<string[]> {
  const events = [];

  // Form submission event
  const submissionEvent = await app.prisma.timelineEvent.create({
    data: {
      leadId,
      type: 'FORM_SUBMISSION',
      payload: {
        action: 'webhook_submission',
        source: data.source,
        enrichment: data.enrichment,
        timestamp: new Date().toISOString()
      }
    }
  });
  events.push(submissionEvent.id);

  // Scoring event
  const scoringEvent = await app.prisma.timelineEvent.create({
    data: {
      leadId,
      type: 'SCORE_UPDATED',
      payload: {
        action: 'webhook_scoring',
        score: data.scoring.score,
        band: data.scoring.band,
        tags: data.scoring.tags,
        trace: data.scoring.trace
      }
    }
  });
  events.push(scoringEvent.id);

  // Routing event (only for new leads)
  if (data.action === 'created' && data.routing) {
    const routingEvent = await app.prisma.timelineEvent.create({
      data: {
        leadId,
        type: 'SCORE_UPDATED', // Using existing enum value
        payload: {
          action: 'webhook_routing',
          ownerId: data.routing.ownerId,
          pool: data.routing.pool,
          reason: data.routing.reason,
          trace: data.routing.trace,
          alerts: data.routing.alerts,
          sla: data.routing.sla
        }
      }
    });
    events.push(routingEvent.id);
  }

  return events;
}

/**
 * Extract team ID from webhook payload
 */
function extractTeamIdFromWebhook(payload: any): string | null {
  // Try various methods to extract team ID
  if (payload.teamId) return payload.teamId;
  if (payload.metadata?.teamId) return payload.metadata.teamId;
  if (payload.formId) {
    // Could derive team from form ID
    return `team_from_form_${payload.formId}`;
  }
  
  // Fallback: could be extracted from API key context in real implementation
  return null;
}

/**
 * Create success message for webhook response
 */
function createSuccessMessage(result: WebhookIngestionResult): string {
  const { action, score, band, ownerId, pool, slaTargetAt } = result;
  
  let message = `Webhook processed successfully. `;
  
  switch (action) {
    case 'created':
      message += `New lead created with score ${score} (${band}).`;
      if (ownerId) {
        message += ` Routed to owner ${ownerId}${pool ? ` (${pool})` : ''}.`;
      } else if (pool) {
        message += ` Routed to pool ${pool}.`;
      }
      if (slaTargetAt) {
        message += ` SLA target: ${slaTargetAt}.`;
      }
      break;
      
    case 'merged':
      message += `Lead merged with existing lead.`;
      break;
      
    case 'skipped':
      message += `Duplicate lead detected, merge skipped.`;
      break;
  }
  
  return message;
}
