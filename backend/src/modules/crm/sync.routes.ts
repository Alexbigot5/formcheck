import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

export async function registerCrmSyncRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  app.addHook('preHandler', authenticate);

  /**
   * POST /crm/sync/lead/:id - Sync lead to CRM
   */
  app.post('/crm/sync/lead/:id', {
    schema: {
      params: z.object({
        id: z.string().cuid()
      }),
      querystring: z.object({
        dryRun: z.enum(['1', 'true']).optional(),
        provider: z.string().optional()
      }),
      response: {
        200: z.object({
          dryRun: z.boolean(),
          provider: z.string(),
          payload: z.any(),
          result: z.any().optional(),
          diff: z.object({
            added: z.record(z.any()),
            changed: z.record(z.object({
              from: z.any(),
              to: z.any()
            })),
            removed: z.array(z.string())
          }).optional(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const { dryRun, provider } = request.query as { dryRun?: string; provider?: string };
    const teamId = (request as any).teamId;
    const userId = (request as any).user?.id || 'system';

    const isDryRun = dryRun === '1' || dryRun === 'true';
    const crmProvider = provider || 'hubspot'; // Default to HubSpot

    try {
      // Get lead with all related data
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId },
        include: {
          owner: {
            include: { user: { select: { email: true, name: true } } }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          timelineEvents: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      // Get CRM settings for the team
      const crmSettings = await app.prisma.credential.findFirst({
        where: { 
          teamId, 
          provider: crmProvider 
        }
      });

      if (!crmSettings) {
        return reply.code(400).send({ 
          error: 'CRM not configured',
          message: `${crmProvider} integration not found. Please configure CRM settings first.`
        });
      }

      // Build CRM payload based on provider
      const payload = buildCrmPayload(lead, crmProvider);

      if (isDryRun) {
        // For dry run, simulate the sync and show what would be sent
        const existingData = await simulateExistingCrmData(lead, crmProvider);
        const diff = calculateDiff(existingData, payload);

        return reply.send({
          dryRun: true,
          provider: crmProvider,
          payload,
          diff,
          message: `Dry run complete. ${Object.keys(diff.added).length} fields would be added, ${Object.keys(diff.changed).length} would be changed.`
        });
      }

      // Perform actual CRM sync
      const result = await syncToCrm(lead, payload, crmProvider, crmSettings);

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: id,
          type: 'CRM_SYNC',
          payload: {
            provider: crmProvider,
            action: 'sync',
            success: result.success,
            crmId: result.crmId,
            syncedFields: Object.keys(payload),
            syncedBy: userId,
            result: result.details
          }
        }
      });

      return reply.send({
        dryRun: false,
        provider: crmProvider,
        payload,
        result,
        message: result.success 
          ? `Lead successfully synced to ${crmProvider}` 
          : `Sync to ${crmProvider} failed: ${result.error}`
      });

    } catch (error) {
      app.log.error('CRM sync failed:', error);
      return reply.code(500).send({ error: 'Failed to sync to CRM' });
    }
  });

  /**
   * GET /crm/providers - Get available CRM providers
   */
  app.get('/crm/providers', {
    schema: {
      response: {
        200: z.object({
          providers: z.array(z.object({
            id: z.string(),
            name: z.string(),
            configured: z.boolean(),
            lastSync: z.string().optional()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = (request as any).teamId;

    try {
      const credentials = await app.prisma.credential.findMany({
        where: { teamId }
      });

      const providers = [
        { id: 'hubspot', name: 'HubSpot' },
        { id: 'salesforce', name: 'Salesforce' },
        { id: 'pipedrive', name: 'Pipedrive' }
      ];

      const providersWithStatus = providers.map(provider => {
        const credential = credentials.find(c => c.provider === provider.id);
        return {
          ...provider,
          configured: !!credential,
          lastSync: credential?.updatedAt.toISOString()
        };
      });

      return reply.send({ providers: providersWithStatus });

    } catch (error) {
      app.log.error('Failed to get CRM providers:', error);
      return reply.code(500).send({ error: 'Failed to get CRM providers' });
    }
  });
}

// Helper functions
function buildCrmPayload(lead: any, provider: string): Record<string, any> {
  const basePayload = {
    email: lead.email,
    firstName: lead.name?.split(' ')[0],
    lastName: lead.name?.split(' ').slice(1).join(' '),
    company: lead.company,
    phone: lead.phone,
    website: lead.domain,
    leadSource: lead.source,
    leadScore: lead.score,
    leadStatus: mapLeadStatus(lead.status, provider),
    createdDate: lead.createdAt,
    lastModifiedDate: lead.updatedAt
  };

  // Add custom fields
  if (lead.fields && typeof lead.fields === 'object') {
    Object.entries(lead.fields).forEach(([key, value]) => {
      basePayload[`custom_${key}`] = value;
    });
  }

  // Add UTM data
  if (lead.utm && typeof lead.utm === 'object') {
    Object.entries(lead.utm).forEach(([key, value]) => {
      basePayload[`utm_${key}`] = value;
    });
  }

  // Provider-specific mappings
  switch (provider) {
    case 'hubspot':
      return {
        ...basePayload,
        hs_lead_status: basePayload.leadStatus,
        hubspot_owner_id: lead.owner?.user?.email,
        lifecyclestage: 'lead'
      };
    
    case 'salesforce':
      return {
        ...basePayload,
        Status: basePayload.leadStatus,
        OwnerId: lead.owner?.user?.email,
        Company: basePayload.company || 'Unknown'
      };
    
    default:
      return basePayload;
  }
}

function mapLeadStatus(status: string, provider: string): string {
  const statusMappings: Record<string, Record<string, string>> = {
    hubspot: {
      'NEW': 'NEW',
      'ASSIGNED': 'OPEN',
      'IN_PROGRESS': 'IN_PROGRESS',
      'CLOSED': 'CLOSED'
    },
    salesforce: {
      'NEW': 'Open - Not Contacted',
      'ASSIGNED': 'Working - Contacted',
      'IN_PROGRESS': 'Working - Contacted',
      'CLOSED': 'Closed - Converted'
    }
  };

  return statusMappings[provider]?.[status] || status;
}

async function simulateExistingCrmData(lead: any, provider: string): Promise<Record<string, any>> {
  // Simulate existing CRM data for diff calculation
  // In a real implementation, this would fetch from the actual CRM
  return {
    email: lead.email,
    firstName: lead.name?.split(' ')[0],
    company: lead.company,
    leadScore: lead.score - 10, // Simulate a different score
    leadStatus: 'NEW', // Simulate different status
    phone: null // Simulate missing phone
  };
}

function calculateDiff(existing: Record<string, any>, newData: Record<string, any>): {
  added: Record<string, any>;
  changed: Record<string, { from: any; to: any }>;
  removed: string[];
} {
  const added: Record<string, any> = {};
  const changed: Record<string, { from: any; to: any }> = {};
  const removed: string[] = [];

  // Check for new and changed fields
  Object.entries(newData).forEach(([key, value]) => {
    if (!(key in existing)) {
      if (value !== null && value !== undefined && value !== '') {
        added[key] = value;
      }
    } else if (existing[key] !== value) {
      changed[key] = {
        from: existing[key],
        to: value
      };
    }
  });

  // Check for removed fields
  Object.keys(existing).forEach(key => {
    if (!(key in newData)) {
      removed.push(key);
    }
  });

  return { added, changed, removed };
}

async function syncToCrm(lead: any, payload: Record<string, any>, provider: string, settings: any): Promise<{
  success: boolean;
  crmId?: string;
  error?: string;
  details?: any;
}> {
  // Simulate CRM sync
  // In a real implementation, this would make actual API calls to the CRM
  
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate success/failure based on provider
    const success = Math.random() > 0.1; // 90% success rate

    if (success) {
      return {
        success: true,
        crmId: `${provider}_${Date.now()}`,
        details: {
          created: !lead.externalId,
          updated: !!lead.externalId,
          fieldsUpdated: Object.keys(payload).length,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      return {
        success: false,
        error: 'Simulated API error - rate limit exceeded',
        details: {
          errorCode: 'RATE_LIMIT',
          retryAfter: 300
        }
      };
    }
  } catch (error) {
    return {
      success: false,
      error: String(error),
      details: { error }
    };
  }
}
