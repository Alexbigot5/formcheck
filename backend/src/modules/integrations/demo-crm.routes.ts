import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';

export async function registerDemoCrmRoutes(app: FastifyInstance) {
  /**
   * GET /api/integrations/status - Get integration status (demo)
   */
  app.get('/api/integrations/status', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    // Mock integration status for demo
    const mockStatus = {
      hubspot: {
        connected: true,
        lastSync: new Date().toISOString(),
        health: 'healthy'
      },
      salesforce: {
        connected: false,
        lastSync: null,
        health: 'disconnected'
      },
      slack: {
        connected: true,
        lastSync: new Date().toISOString(),
        health: 'healthy'
      }
    };

    return reply.send({ ok: true, data: { integrations: mockStatus } });
  });

  /**
   * POST /api/integrations/:provider/connect - Connect to CRM (demo)
   */
  app.post('/api/integrations/:provider/connect', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const { provider } = request.params as { provider: string };
    const teamId = request.teamId!;

    // Simulate OAuth flow
    const authUrl = `https://app.${provider}.com/oauth/authorize?client_id=demo&redirect_uri=http://localhost:8082/integrations/callback&state=${teamId}`;

    return reply.send({
      ok: true,
      data: {
        authUrl,
        message: `Redirecting to ${provider} authorization...`
      }
    });
  });

  /**
   * GET /api/integrations/:provider/fields - Get CRM fields (demo)
   */
  app.get('/api/integrations/:provider/fields', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const { provider } = request.params as { provider: string };

    // Mock CRM fields for demo
    const mockFields = {
      hubspot: [
        { name: 'email', label: 'Email', type: 'string', required: true },
        { name: 'firstname', label: 'First Name', type: 'string', required: false },
        { name: 'lastname', label: 'Last Name', type: 'string', required: false },
        { name: 'company', label: 'Company', type: 'string', required: false },
        { name: 'phone', label: 'Phone', type: 'string', required: false },
        { name: 'hs_lead_status', label: 'Lead Status', type: 'enumeration', required: false, options: ['NEW', 'OPEN', 'IN_PROGRESS', 'CLOSED'] },
        { name: 'hubspot_owner_id', label: 'Owner', type: 'enumeration', required: false }
      ],
      salesforce: [
        { name: 'Email', label: 'Email', type: 'email', required: true },
        { name: 'FirstName', label: 'First Name', type: 'string', required: false },
        { name: 'LastName', label: 'Last Name', type: 'string', required: true },
        { name: 'Company', label: 'Company', type: 'string', required: true },
        { name: 'Phone', label: 'Phone', type: 'phone', required: false },
        { name: 'Status', label: 'Status', type: 'picklist', required: false, options: ['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted'] },
        { name: 'OwnerId', label: 'Owner', type: 'reference', required: false }
      ],
      pipedrive: [
        { name: 'email', label: 'Email', type: 'varchar', required: true },
        { name: 'name', label: 'Name', type: 'varchar', required: true },
        { name: 'org_name', label: 'Organization', type: 'varchar', required: false },
        { name: 'phone', label: 'Phone', type: 'phone', required: false }
      ]
    };

    return reply.send({
      ok: true,
      data: { fields: (mockFields as any)[provider] || [] }
    });
  });

  /**
   * POST /api/crm/sync/lead/:id - Sync lead to CRM (demo)
   */
  app.post('/api/crm/sync/lead/:id', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const { provider, dryRun } = request.body as { provider: string; dryRun?: boolean };
    const teamId = request.teamId!;

    try {
      // Get lead data
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId }
      });

      if (!lead) {
        return reply.code(404).send({
          ok: false,
          error: 'Lead not found'
        });
      }

      // Mock sync result
      const syncResult = {
        success: true,
        contactId: `${provider}_${Date.now()}`,
        action: lead.externalId ? 'updated' : 'created',
        message: dryRun 
          ? `Dry run: Lead would be ${lead.externalId ? 'updated' : 'created'} in ${provider}`
          : `Lead successfully ${lead.externalId ? 'updated' : 'created'} in ${provider}`,
        payload: {
          email: lead.email,
          name: lead.name,
          company: lead.company,
          phone: lead.phone,
          source: lead.source,
          score: lead.score
        }
      };

      // Update lead with external ID if not dry run
      if (!dryRun && !lead.externalId) {
        await app.prisma.lead.update({
          where: { id },
          data: { externalId: (syncResult as any).contactId }
        });
      }

      return reply.send({ ok: true, data: syncResult });

    } catch (error) {
      app.log.error('CRM sync failed:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to sync to CRM' });
    }
  });
}
