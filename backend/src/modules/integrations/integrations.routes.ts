import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';
import { storeCredentials, getCredentials, deleteCredentials, hasValidCredentials, OAuthCredentials } from './credential.service';
import { getCRMFields, syncLeadToCRM } from './crm.service';

// Validation schemas
const oauthCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional()
});

const fieldMappingSchema = z.object({
  mapping: z.record(z.string())
});

const syncLeadSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  duplicatePolicy: z.enum(['skip', 'update', 'create_new']).optional().default('update')
});

export async function registerIntegrationRoutes(app: FastifyInstance) {
  
  /**
   * GET /api/integrations - Get all integrations status
   */
  app.get('/api/integrations', {
    preHandler: [authenticateSupabase],
    schema: {
      response: {
        200: z.object({
          integrations: z.array(z.object({
            kind: z.string(),
            status: z.string(),
            lastSeenAt: z.string().nullable(),
            lastSyncAt: z.string().nullable(),
            error: z.string().nullable(),
            settings: z.any()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId!;

    try {
      const integrations = await app.prisma.integration.findMany({
        where: { teamId },
        select: {
          kind: true,
          status: true,
          lastSeenAt: true,
          lastSyncAt: true,
          error: true,
          settings: true
        }
      });

      const formattedIntegrations = integrations.map(integration => ({
        ...integration,
        lastSeenAt: integration.lastSeenAt?.toISOString() || null,
        lastSyncAt: integration.lastSyncAt?.toISOString() || null
      }));

      return reply.send({ ok: true, data: { integrations: formattedIntegrations } });

    } catch (error) {
      app.log.error('Failed to get integrations:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get integrations' });
    }
  });

  /**
   * GET /integrations/:kind/fields - Get CRM fields
   */
  app.get('/integrations/:kind/fields', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce', 'pipedrive'])
      }),
      response: {
        200: z.object({
          fields: z.array(z.object({
            name: z.string(),
            label: z.string(),
            type: z.string(),
            required: z.boolean(),
            options: z.array(z.string()).optional()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const teamId = (request as any).teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: { teamId, kind: kind.toUpperCase() as any }
      });

      if (!integration || integration.status !== 'CONNECTED') {
        return reply.code(404).send({ error: 'Integration not connected' });
      }

      // Get fields from CRM
      const fields = await getCRMFields(kind, integration.auth as any);

      return reply.send({ fields });

    } catch (error) {
      app.log.error('Failed to get CRM fields:', error);
      return reply.code(500).send({ error: 'Failed to get CRM fields' });
    }
  });

  /**
   * GET /integrations/:kind/mapping - Get current field mapping
   */
  app.get('/integrations/:kind/mapping', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce', 'pipedrive'])
      }),
      response: {
        200: z.object({
          mapping: z.record(z.string()),
          lastUpdated: z.string().nullable()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const teamId = (request as any).teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: { teamId, kind: kind.toUpperCase() as any }
      });

      if (!integration) {
        return reply.code(404).send({ error: 'Integration not found' });
      }

      const mapping = (integration.settings as any)?.fieldMapping || {};

      return reply.send({
        mapping,
        lastUpdated: integration.lastSyncAt?.toISOString() || new Date().toISOString()
      });

    } catch (error) {
      app.log.error('Failed to get field mapping:', error);
      return reply.code(500).send({ error: 'Failed to get field mapping' });
    }
  });

  /**
   * POST /integrations/:kind/mapping - Save field mapping
   */
  app.post('/integrations/:kind/mapping', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce', 'pipedrive'])
      }),
      body: fieldMappingSchema,
      response: {
        200: z.object({
          message: z.string(),
          mapping: z.record(z.string())
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const { mapping } = request.body as { mapping: Record<string, string> };
    const teamId = (request as any).teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: { teamId, kind: kind.toUpperCase() as any }
      });

      if (!integration) {
        return reply.code(404).send({ error: 'Integration not found' });
      }

      // Update settings with new mapping
      const updatedSettings = {
        ...integration.settings as any,
        fieldMapping: mapping,
        fieldMappingUpdatedAt: new Date().toISOString()
      };

      await app.prisma.integration.update({
        where: { id: integration.id },
        data: { settings: updatedSettings }
      });

      return reply.send({
        message: 'Field mapping saved successfully',
        mapping
      });

    } catch (error) {
      app.log.error('Failed to save field mapping:', error);
      return reply.code(500).send({ error: 'Failed to save field mapping' });
    }
  });

  /**
   * GET /integrations/:kind/health - Get integration health status
   */
  app.get('/integrations/:kind/health', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce', 'pipedrive'])
      }),
      response: {
        200: z.object({
          status: z.string(),
          lastSeenAt: z.string().nullable(),
          lastSyncAt: z.string().nullable(),
          queuedOps: z.number(),
          recentErrors: z.array(z.object({
            timestamp: z.string(),
            error: z.string(),
            operation: z.string().optional()
          })),
          metrics: z.object({
            totalSyncs: z.number(),
            successRate: z.number(),
            avgResponseTime: z.number()
          })
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const teamId = (request as any).teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: { teamId, kind: kind.toUpperCase() as any }
      });

      if (!integration) {
        return reply.code(404).send({ error: 'Integration not found' });
      }

      // Get recent errors from logs (simulated for now)
      const recentErrors = [
        // This would come from actual error logs
      ];

      // Calculate metrics (simulated)
      const metrics = {
        totalSyncs: Math.floor(Math.random() * 1000),
        successRate: Math.round((Math.random() * 0.2 + 0.8) * 100) / 100, // 80-100%
        avgResponseTime: Math.round(Math.random() * 500 + 200) // 200-700ms
      };

      return reply.send({
        status: integration.status,
        lastSeenAt: integration.lastSeenAt?.toISOString() || null,
        lastSyncAt: integration.lastSyncAt?.toISOString() || null,
        queuedOps: 0, // This would come from a queue system
        recentErrors,
        metrics
      });

    } catch (error) {
      app.log.error('Failed to get integration health:', error);
      return reply.code(500).send({ error: 'Failed to get integration health' });
    }
  });

  /**
   * POST /integrations/:kind/test - Test integration connection
   */
  app.post('/integrations/:kind/test', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce', 'pipedrive'])
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          responseTime: z.number(),
          details: z.any().optional()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const teamId = (request as any).teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: { teamId, kind: kind.toUpperCase() as any }
      });

      if (!integration) {
        return reply.code(404).send({ error: 'Integration not found' });
      }

      const startTime = Date.now();
      let success = false;
      let details = {};

      try {
        // Test connection based on provider
        if (kind === 'hubspot') {
          const response = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + (integration.auth as any).access_token);
          success = response.ok;
          details = await response.json();
        } else if (kind === 'salesforce') {
          const response = await fetch((integration.auth as any).instance_url + '/services/data/v52.0/', {
            headers: {
              'Authorization': `Bearer ${(integration.auth as any).access_token}`
            }
          });
          success = response.ok;
          details = await response.json();
        }

        // Update lastSeenAt on successful test
        if (success) {
          await app.prisma.integration.update({
            where: { id: integration.id },
            data: { 
              lastSeenAt: new Date(),
              error: null
            }
          });
        }

      } catch (error) {
        success = false;
        details = { error: String(error) };
      }

      const responseTime = Date.now() - startTime;

      return reply.send({
        success,
        message: success ? 'Connection test successful' : 'Connection test failed',
        responseTime,
        details
      });

    } catch (error) {
      app.log.error('Failed to test integration:', error);
      return reply.code(500).send({ error: 'Failed to test integration' });
    }
  });

  /**
   * POST /integrations/:kind/disconnect - Disconnect integration
   */
  app.post('/integrations/:kind/disconnect', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce', 'pipedrive'])
      }),
      response: {
        200: z.object({
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const teamId = (request as any).teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: { teamId, kind: kind.toUpperCase() as any }
      });

      if (!integration) {
        return reply.code(404).send({ error: 'Integration not found' });
      }

      // Update integration status
      await app.prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: 'DISCONNECTED',
          auth: {},
          error: 'Manually disconnected'
        }
      });

      return reply.send({
        message: `${kind} integration disconnected successfully`
      });

    } catch (error) {
      app.log.error('Failed to disconnect integration:', error);
      return reply.code(500).send({ error: 'Failed to disconnect integration' });
    }
  });

  /**
   * GET /integrations/:kind/start - Start OAuth flow
   */
  app.get('/integrations/:kind/start', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce'])
      }),
      response: {
        200: z.object({
          authUrl: z.string().url(),
          state: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const teamId = (request as any).teamId;
    
    try {
      const state = `${teamId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      let authUrl: string;

      if (kind === 'hubspot') {
        const params = new URLSearchParams({
          client_id: process.env.HUBSPOT_CLIENT_ID!,
          redirect_uri: process.env.HUBSPOT_REDIRECT_URL!,
          scope: 'crm.objects.contacts.write crm.objects.contacts.read crm.schemas.contacts.read',
          response_type: 'code',
          state
        });
        authUrl = `https://app.hubspot.com/oauth/authorize?${params}`;
      } else if (kind === 'salesforce') {
        const params = new URLSearchParams({
          client_id: process.env.SALESFORCE_CLIENT_ID!,
          redirect_uri: process.env.SALESFORCE_REDIRECT_URL!,
          scope: 'api refresh_token',
          response_type: 'code',
          state
        });
        const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
        authUrl = `${loginUrl}/services/oauth2/authorize?${params}`;
      } else {
        return reply.code(400).send({ error: 'Unsupported provider' });
      }

      return reply.send({ authUrl, state });
    } catch (error) {
      app.log.error(`OAuth start error for ${kind}:`, error);
      return reply.code(500).send({ error: 'Failed to start OAuth flow' });
    }
  });

  /**
   * POST /integrations/:kind/callback - OAuth callback
   */
  app.post('/integrations/:kind/callback', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce'])
      }),
      body: oauthCallbackSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          provider: z.string(),
          connected: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const { code, state } = request.body as z.infer<typeof oauthCallbackSchema>;
    const teamId = (request as any).teamId;
    
    try {
      let tokenResponse: any;
      let credentials: OAuthCredentials;

      if (kind === 'hubspot') {
        tokenResponse = await axios.post('https://api.hubapi.com/oauth/v1/token', {
          grant_type: 'authorization_code',
          client_id: process.env.HUBSPOT_CLIENT_ID,
          client_secret: process.env.HUBSPOT_CLIENT_SECRET,
          redirect_uri: process.env.HUBSPOT_REDIRECT_URL,
          code,
        });
        
        const { access_token, refresh_token, expires_in } = tokenResponse.data;
        credentials = {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + (expires_in * 1000)
        };
      } else if (kind === 'salesforce') {
        const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
        tokenResponse = await axios.post(`${loginUrl}/services/oauth2/token`, {
          grant_type: 'authorization_code',
          client_id: process.env.SALESFORCE_CLIENT_ID,
          client_secret: process.env.SALESFORCE_CLIENT_SECRET,
          redirect_uri: process.env.SALESFORCE_REDIRECT_URL,
          code,
        });
        
        const { access_token, refresh_token, instance_url } = tokenResponse.data;
        credentials = {
          accessToken: access_token,
          refreshToken: refresh_token,
          instanceUrl: instance_url
        };
      } else {
        return reply.code(400).send({ error: 'Unsupported provider' });
      }

      // Store encrypted credentials
      await storeCredentials(app, teamId, kind, credentials, process.env.SECRET_VAULT_KEY!);

      // Update integration status
      await app.prisma.integration.upsert({
        where: {
          teamId_kind: {
            teamId,
            kind: kind.toUpperCase() as any
          }
        },
        update: {
          status: 'CONNECTED',
          lastSeenAt: new Date(),
          error: null
        },
        create: {
          teamId,
          kind: kind.toUpperCase() as any,
          status: 'CONNECTED',
          auth: {},
          settings: {},
          lastSeenAt: new Date()
        }
      });

      return reply.send({
        success: true,
        provider: kind,
        connected: true,
        message: `Successfully connected to ${kind}`
      });

    } catch (error) {
      app.log.error(`${kind} OAuth callback error:`, error);
      
      // Update integration status to error
      await app.prisma.integration.upsert({
        where: {
          teamId_kind: {
            teamId,
            kind: kind.toUpperCase() as any
          }
        },
        update: {
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'OAuth callback failed'
        },
        create: {
          teamId,
          kind: kind.toUpperCase() as any,
          status: 'ERROR',
          auth: {},
          settings: {},
          error: error instanceof Error ? error.message : 'OAuth callback failed'
        }
      });

      return reply.code(400).send({
        success: false,
        provider: kind,
        connected: false,
        message: `Failed to connect to ${kind}`
      });
    }
  });

  /**
   * DELETE /integrations/:kind/disconnect - Disconnect integration
   */
  app.delete('/integrations/:kind/disconnect', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce'])
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const teamId = (request as any).teamId;
    
    try {
      // Delete stored credentials
      await deleteCredentials(app, teamId, kind);

      // Update integration status
      await app.prisma.integration.updateMany({
        where: {
          teamId,
          kind: kind.toUpperCase() as any
        },
        data: {
          status: 'DISCONNECTED',
          error: null,
          lastSeenAt: new Date()
        }
      });

      return reply.send({
        success: true,
        message: `Successfully disconnected from ${kind}`
      });

    } catch (error) {
      app.log.error(`${kind} disconnect error:`, error);
      return reply.code(500).send({
        success: false,
        message: `Failed to disconnect from ${kind}`
      });
    }
  });

  /**
   * GET /integrations/:kind/fields - Get CRM fields
   */
  app.get('/integrations/:kind/fields', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce'])
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          fields: z.array(z.object({
            name: z.string(),
            label: z.string(),
            type: z.string(),
            required: z.boolean(),
            options: z.array(z.string()).optional(),
            description: z.string().optional()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const teamId = (request as any).teamId;
    
    try {
      const fields = await getCRMFields(app, teamId, kind, process.env.SECRET_VAULT_KEY!);
      
      return reply.send({
        success: true,
        fields
      });

    } catch (error) {
      app.log.error(`Get ${kind} fields error:`, error);
      return reply.code(400).send({
        success: false,
        fields: [],
        error: error instanceof Error ? error.message : 'Failed to fetch fields'
      });
    }
  });

  /**
   * POST /integrations/:kind/mapping - Save field mapping
   */
  app.post('/integrations/:kind/mapping', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        kind: z.enum(['hubspot', 'salesforce'])
      }),
      body: fieldMappingSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { kind } = request.params as { kind: string };
    const { mapping } = request.body as z.infer<typeof fieldMappingSchema>;
    const teamId = (request as any).teamId;
    
    try {
      // Store field mapping in integration settings
      await app.prisma.integration.upsert({
        where: {
          teamId_kind: {
            teamId,
            kind: kind.toUpperCase() as any
          }
        },
        update: {
          settings: { fieldMapping: mapping }
        },
        create: {
          teamId,
          kind: kind.toUpperCase() as any,
          status: 'DISCONNECTED',
          auth: {},
          settings: { fieldMapping: mapping }
        }
      });

      return reply.send({
        success: true,
        message: 'Field mapping saved successfully'
      });

    } catch (error) {
      app.log.error(`Save ${kind} mapping error:`, error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to save field mapping'
      });
    }
  });

  /**
   * POST /crm/sync/lead/:id - Sync lead to CRM
   */
  app.post('/crm/sync/lead/:id', {
    preHandler: [authenticateSupabase],
    schema: {
      params: z.object({
        id: z.string().cuid()
      }),
      querystring: syncLeadSchema,
      body: z.object({
        provider: z.enum(['hubspot', 'salesforce']),
        duplicatePolicy: z.enum(['skip', 'update', 'create_new']).optional().default('update')
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          contactId: z.string().optional(),
          action: z.enum(['created', 'updated', 'skipped', 'error']),
          message: z.string(),
          payload: z.any().optional()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const { dryRun } = request.query as z.infer<typeof syncLeadSchema>;
    const { provider, duplicatePolicy } = request.body as { provider: string; duplicatePolicy?: string };
    const teamId = (request as any).teamId;
    
    try {
      // Get lead data
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId }
      });

      if (!lead) {
        return reply.code(404).send({
          success: false,
          action: 'error',
          message: 'Lead not found'
        });
      }

      // Get field mapping from integration settings
      const integration = await app.prisma.integration.findFirst({
        where: {
          teamId,
          kind: provider.toUpperCase() as any
        }
      });

      if (!integration || !integration.settings) {
        return reply.code(400).send({
          success: false,
          action: 'error',
          message: 'Integration not configured or field mapping missing'
        });
      }

      const fieldMapping = (integration.settings as any).fieldMapping;
      if (!fieldMapping) {
        return reply.code(400).send({
          success: false,
          action: 'error',
          message: 'Field mapping not configured'
        });
      }

      // Sync lead to CRM
      const result = await syncLeadToCRM(
        app,
        teamId,
        provider,
        lead,
        fieldMapping,
        process.env.SECRET_VAULT_KEY!,
        dryRun,
(duplicatePolicy as 'skip' | 'update' | 'create_new') || 'update'
      );

      // Log timeline event if not dry run and successful
      if (!dryRun && result.success) {
        await app.prisma.timelineEvent.create({
          data: {
            leadId: lead.id,
            type: 'CRM_SYNC',
            payload: {
              title: `Synced to ${provider}`,
              body: `Lead ${result.action} in ${provider}: ${result.message}`,
              meta: {
                provider,
                contactId: result.contactId,
                action: result.action
              }
            }
          }
        });

        // Update integration lastSyncAt
        await app.prisma.integration.updateMany({
          where: {
            teamId,
            kind: provider.toUpperCase() as any
          },
          data: {
            lastSyncAt: new Date()
          }
        });
      }

      return reply.send(result);

    } catch (error) {
      app.log.error(`CRM sync error for lead ${id}:`, error);
      return reply.code(500).send({
        success: false,
        action: 'error',
        message: error instanceof Error ? error.message : 'Sync failed'
      });
    }
  });

  /**
   * GET /integrations/status - Get integration status
   */
  app.get('/integrations/status', {
    preHandler: [authenticateSupabase],
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          integrations: z.record(z.object({
            connected: z.boolean(),
            lastSync: z.string().optional(),
            error: z.string().optional()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = (request as any).teamId;
    
    try {
      // Get integration statuses from database
      const integrations = await app.prisma.integration.findMany({
        where: { teamId }
      });

      const status: Record<string, any> = {
        hubspot: { connected: false },
        salesforce: { connected: false },
        slack: { connected: !!process.env.SLACK_WEBHOOK_URL }
      };

      for (const integration of integrations) {
        const kind = integration.kind.toLowerCase();
        status[kind] = {
          connected: integration.status === 'CONNECTED',
          lastSync: integration.lastSyncAt?.toISOString(),
          error: integration.error
        };
      }

      // Check credential validity for connected integrations
      for (const [kind, config] of Object.entries(status)) {
        if (config.connected && (kind === 'hubspot' || kind === 'salesforce')) {
          const hasValid = await hasValidCredentials(app, teamId, kind, process.env.SECRET_VAULT_KEY!);
          if (!hasValid) {
            config.connected = false;
            config.error = 'Credentials expired or invalid';
          }
        }
      }

      return reply.send({
        success: true,
        integrations: status
      });

    } catch (error) {
      app.log.error('Integration status error:', error);
      return reply.code(500).send({
        success: false,
        integrations: {}
      });
    }
  });

  /**
   * POST /integrations/slack/test - Test Slack webhook
   */
  app.post('/integrations/slack/test', {
    preHandler: [authenticateSupabase],
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return reply.code(400).send({
        success: false,
        message: 'Slack webhook URL not configured'
      });
    }
    
    try {
      await axios.post(webhookUrl, {
        text: 'SmartForms AI integration test - connection successful! 🎉',
      });
      
      return reply.send({
        success: true,
        message: 'Test message sent to Slack'
      });
    } catch (error) {
      app.log.error('Slack webhook error:', error);
      return reply.code(400).send({
        success: false,
        message: 'Failed to send test message'
      });
    }
  });
}
