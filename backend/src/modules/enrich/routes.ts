import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { 
  enrichLead, 
  batchEnrichLeads, 
  getEnrichmentStats,
  getCompetitorConfig,
  updateCompetitorConfig,
  addCompetitor,
  removeCompetitor,
  getCompetitorStats
} from './index';

// Schemas
const enrichLeadSchema = z.object({
  email: z.string().email().optional(),
  domain: z.string().optional(),
  company: z.string().optional(),
  name: z.string().optional(),
  fields: z.record(z.any()).optional()
});

const competitorEntrySchema = z.object({
  name: z.string(),
  domains: z.array(z.string()),
  keywords: z.array(z.string()),
  type: z.enum(['direct', 'indirect', 'partner', 'vendor']),
  riskLevel: z.enum(['low', 'medium', 'high']),
  notes: z.string().optional()
});

const competitorConfigSchema = z.object({
  competitors: z.array(competitorEntrySchema).optional(),
  partnerCompanies: z.array(z.string()).optional(),
  vendorCompanies: z.array(z.string()).optional(),
  autoDetectKeywords: z.array(z.string()).optional(),
  enabled: z.boolean().optional()
});

export async function registerEnrichmentRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  app.addHook('preHandler', authenticate);

  /**
   * POST /enrich/lead - Enrich a single lead
   */
  app.post('/enrich/lead', {
    schema: {
      body: enrichLeadSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          enrichedLead: z.object({
            email: z.string().optional(),
            domain: z.string().optional(),
            company: z.string().optional(),
            name: z.string().optional(),
            fields: z.object({
              enrichment: z.object({
                companySize: z.string().optional(),
                revenue: z.string().optional(),
                location: z.string().optional(),
                industry: z.string().optional(),
                isFreeMailbox: z.boolean().optional(),
                isCompetitor: z.boolean().optional(),
                emailQuality: z.number().optional(),
                relationship: z.enum(['competitor', 'partner', 'vendor', 'prospect', 'unknown']).optional(),
                riskLevel: z.enum(['low', 'medium', 'high']).optional(),
                enrichmentSources: z.array(z.string()).optional(),
                enrichedAt: z.string().optional()
              })
            })
          }),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const leadData = request.body as z.infer<typeof enrichLeadSchema>;
    const teamId = (request as any).teamId;

    try {
      app.log.info('Single lead enrichment requested', { 
        email: leadData.email,
        teamId 
      });

      const enrichedLead = await enrichLead(app, leadData, teamId);

      return reply.send({
        success: true,
        enrichedLead,
        message: 'Lead enrichment completed successfully'
      });

    } catch (error) {
      app.log.error('Single lead enrichment failed:', error);
      return reply.code(500).send({ 
        error: 'Lead enrichment failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /enrich/batch - Batch enrich multiple leads
   */
  app.post('/enrich/batch', {
    schema: {
      body: z.object({
        leads: z.array(enrichLeadSchema).max(100) // Limit batch size
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          processed: z.number(),
          enrichedLeads: z.array(z.any()),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { leads } = request.body as { leads: z.infer<typeof enrichLeadSchema>[] };
    const teamId = (request as any).teamId;

    try {
      app.log.info('Batch lead enrichment requested', { 
        count: leads.length,
        teamId 
      });

      const enrichedLeads = await batchEnrichLeads(app, leads, teamId);

      return reply.send({
        success: true,
        processed: enrichedLeads.length,
        enrichedLeads,
        message: `Batch enrichment completed: ${enrichedLeads.length} leads processed`
      });

    } catch (error) {
      app.log.error('Batch lead enrichment failed:', error);
      return reply.code(500).send({ 
        error: 'Batch enrichment failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /enrich/stats - Get enrichment statistics
   */
  app.get('/enrich/stats', {
    schema: {
      querystring: z.object({
        days: z.coerce.number().min(1).max(365).default(30)
      }),
      response: {
        200: z.object({
          totalEnriched: z.number(),
          enrichmentRate: z.number(),
          sourceBreakdown: z.record(z.number()),
          qualityMetrics: z.object({
            averageEmailQuality: z.number(),
            freeMailboxRate: z.number(),
            competitorRate: z.number(),
            businessDomainRate: z.number()
          })
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { days } = request.query as { days: number };
    const teamId = (request as any).teamId;

    try {
      const stats = await getEnrichmentStats(app, teamId, days);
      return reply.send(stats);

    } catch (error) {
      app.log.error('Failed to get enrichment stats:', error);
      return reply.code(500).send({ 
        error: 'Failed to get enrichment statistics' 
      });
    }
  });

  /**
   * GET /enrich/competitors - Get competitor configuration
   */
  app.get('/enrich/competitors', {
    schema: {
      response: {
        200: competitorConfigSchema
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = (request as any).teamId;

    try {
      const config = await getCompetitorConfig(app, teamId);
      return reply.send(config);

    } catch (error) {
      app.log.error('Failed to get competitor config:', error);
      return reply.code(500).send({ 
        error: 'Failed to get competitor configuration' 
      });
    }
  });

  /**
   * PUT /enrich/competitors - Update competitor configuration
   */
  app.put('/enrich/competitors', {
    schema: {
      body: competitorConfigSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          config: competitorConfigSchema,
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const configUpdate = request.body as z.infer<typeof competitorConfigSchema>;
    const teamId = (request as any).teamId;

    try {
      const updatedConfig = await updateCompetitorConfig(app, teamId, configUpdate);

      return reply.send({
        success: true,
        config: updatedConfig,
        message: 'Competitor configuration updated successfully'
      });

    } catch (error) {
      app.log.error('Failed to update competitor config:', error);
      return reply.code(500).send({ 
        error: 'Failed to update competitor configuration' 
      });
    }
  });

  /**
   * POST /enrich/competitors - Add new competitor
   */
  app.post('/enrich/competitors', {
    schema: {
      body: competitorEntrySchema,
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const competitor = request.body as z.infer<typeof competitorEntrySchema>;
    const teamId = (request as any).teamId;

    try {
      await addCompetitor(app, teamId, competitor);

      return reply.send({
        success: true,
        message: `Competitor '${competitor.name}' added successfully`
      });

    } catch (error) {
      app.log.error('Failed to add competitor:', error);
      return reply.code(500).send({ 
        error: 'Failed to add competitor' 
      });
    }
  });

  /**
   * DELETE /enrich/competitors/:name - Remove competitor
   */
  app.delete('/enrich/competitors/:name', {
    schema: {
      params: z.object({
        name: z.string()
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { name } = request.params as { name: string };
    const teamId = (request as any).teamId;

    try {
      await removeCompetitor(app, teamId, name);

      return reply.send({
        success: true,
        message: `Competitor '${name}' removed successfully`
      });

    } catch (error) {
      app.log.error('Failed to remove competitor:', error);
      return reply.code(500).send({ 
        error: 'Failed to remove competitor' 
      });
    }
  });

  /**
   * GET /enrich/competitors/stats - Get competitor statistics
   */
  app.get('/enrich/competitors/stats', {
    schema: {
      querystring: z.object({
        days: z.coerce.number().min(1).max(365).default(30)
      }),
      response: {
        200: z.object({
          totalCompetitorLeads: z.number(),
          competitorBreakdown: z.array(z.object({
            name: z.string(),
            count: z.number(),
            type: z.string(),
            riskLevel: z.string()
          })),
          recentTrends: z.array(z.object({
            date: z.string(),
            count: z.number()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { days } = request.query as { days: number };
    const teamId = (request as any).teamId;

    try {
      const stats = await getCompetitorStats(app, teamId, days);
      return reply.send(stats);

    } catch (error) {
      app.log.error('Failed to get competitor stats:', error);
      return reply.code(500).send({ 
        error: 'Failed to get competitor statistics' 
      });
    }
  });
}

