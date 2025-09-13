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
    preHandler: [authenticateSupabase]
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
   * GET /integrations/:kind/mapping - Get current field mapping
   */
  app.get('/integrations/:kind/mapping', {
    preHandler: [authenticateSupabase]
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
   * GET /integrations/:kind/health - Get integration health status
   */
  app.get('/integrations/:kind/health', {
    preHandler: [authenticateSupabase]
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
    preHandler: [authenticateSupabase]
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
    preHandler: [authenticateSupabase]
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
    preHandler: [authenticateSupabase]
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
      params: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['hubspot', 'salesforce'] }
        },
        required: ['kind']
      },
      body: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' }
        },
        required: ['code']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            provider: { type: 'string' },
            connected: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'provider', 'connected', 'message']
        }
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
      params: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['hubspot', 'salesforce'] }
        },
        required: ['kind']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        }
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
      params: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['hubspot', 'salesforce'] }
        },
        required: ['kind']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  label: { type: 'string' },
                  type: { type: 'string' },
                  required: { type: 'boolean' },
                  options: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string' }
                },
                required: ['name', 'label', 'type', 'required']
              }
            }
          },
          required: ['success', 'fields']
        }
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
      params: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['hubspot', 'salesforce'] }
        },
        required: ['kind']
      },
      body: {
        type: 'object',
        properties: {
          mapping: { type: 'object', additionalProperties: { type: 'string' } }
        },
        required: ['mapping']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        }
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
   * GET /integrations/status - Get integration status
   */
  app.get('/integrations/status', {
    preHandler: [authenticateSupabase],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            integrations: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  connected: { type: 'boolean' },
                  lastSync: { type: 'string' },
                  error: { type: 'string' }
                },
                required: ['connected']
              }
            }
          },
          required: ['success', 'integrations']
        }
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
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        }
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
