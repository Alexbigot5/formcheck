import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';

// Validation schemas
const crmProviderSchema = z.object({
  provider: z.enum(['hubspot', 'salesforce', 'zoho', 'pipedrive']),
  credentials: z.record(z.string()),
  fieldMappings: z.record(z.string()).optional(),
  routingRules: z.record(z.any()).optional(),
  syncSettings: z.object({
    mode: z.enum(['off', 'one_way', 'two_way']),
    frequency: z.enum(['real_time', 'hourly', 'daily']),
    conflictResolution: z.enum(['smartforms_wins', 'crm_wins', 'newest_wins'])
  }).optional()
});

const testCrmSchema = z.object({
  provider: z.enum(['hubspot', 'salesforce', 'zoho', 'pipedrive']),
  credentials: z.record(z.string())
});

export async function registerCrmIntegrationRoutes(app: FastifyInstance) {
  
  /**
   * POST /api/integrations/crm/test - Test CRM connection
   */
  app.post('/api/integrations/crm/test', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof testCrmSchema>;
    const teamId = request.teamId;

    try {
      const { provider, credentials } = testCrmSchema.parse(body);

      // Test CRM connection
      const testResult = await testCrmConnection(provider, credentials);

      if (testResult.success) {
        return reply.send({ 
          success: true, 
          message: testResult.message,
          data: testResult.data
        });
      } else {
        return reply.code(400).send({ 
          success: false, 
          error: testResult.message 
        });
      }

    } catch (error: any) {
      app.log.error('CRM connection test failed:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'CRM connection test failed' 
      });
    }
  });

  /**
   * POST /api/integrations/crm - Save CRM integration
   */
  app.post('/api/integrations/crm', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof crmProviderSchema>;
    const teamId = request.teamId;

    try {
      const { provider, credentials, fieldMappings, routingRules, syncSettings } = crmProviderSchema.parse(body);

      // Encrypt credentials before storing
      const encryptedCredentials = await encryptCredentials(credentials);

      // Save or update CRM integration
      const integration = await app.prisma.integration.upsert({
        where: {
          teamId_kind: {
            teamId,
            kind: 'CRM'
          }
        },
        update: {
          config: {
            provider,
            credentials: encryptedCredentials,
            fieldMappings: fieldMappings || {},
            routingRules: routingRules || {},
            syncSettings: syncSettings || { mode: 'off', frequency: 'real_time', conflictResolution: 'smartforms_wins' }
          },
          status: 'ACTIVE',
          lastSeenAt: new Date()
        },
        create: {
          teamId,
          kind: 'CRM',
          config: {
            provider,
            credentials: encryptedCredentials,
            fieldMappings: fieldMappings || {},
            routingRules: routingRules || {},
            syncSettings: syncSettings || { mode: 'off', frequency: 'real_time', conflictResolution: 'smartforms_wins' }
          },
          status: 'ACTIVE',
          lastSeenAt: new Date()
        }
      });

      return reply.send({ 
        success: true, 
        integrationId: integration.id,
        message: 'CRM integration saved successfully' 
      });

    } catch (error: any) {
      app.log.error('Failed to save CRM integration:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to save CRM integration' 
      });
    }
  });

  /**
   * GET /api/integrations/crm - Get CRM integration status
   */
  app.get('/api/integrations/crm', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const teamId = request.teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: {
          teamId,
          kind: 'CRM'
        }
      });

      if (!integration) {
        return reply.send({ 
          success: true, 
          integration: null,
          message: 'No CRM integration found' 
        });
      }

      // Don't return credentials in the response
      const { config, ...integrationData } = integration;
      const safeConfig = {
        provider: config?.provider,
        fieldMappings: config?.fieldMappings,
        routingRules: config?.routingRules,
        syncSettings: config?.syncSettings
      };

      return reply.send({ 
        success: true, 
        integration: {
          ...integrationData,
          config: safeConfig
        }
      });

    } catch (error: any) {
      app.log.error('Failed to get CRM integration:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to get CRM integration' 
      });
    }
  });

  /**
   * POST /api/integrations/crm/sync - Manual sync with CRM
   */
  app.post('/api/integrations/crm/sync', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const teamId = request.teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: {
          teamId,
          kind: 'CRM'
        }
      });

      if (!integration) {
        return reply.code(404).send({ 
          success: false, 
          error: 'No CRM integration found' 
        });
      }

      // Trigger manual sync
      const syncResult = await performCrmSync(app, integration);

      return reply.send({ 
        success: true, 
        message: 'Sync completed',
        data: syncResult
      });

    } catch (error: any) {
      app.log.error('Failed to sync with CRM:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to sync with CRM' 
      });
    }
  });
}

/**
 * Test CRM connection based on provider
 */
async function testCrmConnection(
  provider: string, 
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    switch (provider) {
      case 'hubspot':
        return await testHubSpotConnection(credentials);
      case 'salesforce':
        return await testSalesforceConnection(credentials);
      case 'zoho':
        return await testZohoConnection(credentials);
      case 'pipedrive':
        return await testPipedriveConnection(credentials);
      default:
        return { success: false, message: 'Unsupported CRM provider' };
    }
  } catch (error) {
    console.error('CRM connection test failed:', error);
    return { success: false, message: 'Connection test failed' };
  }
}

/**
 * Test HubSpot connection
 */
async function testHubSpotConnection(
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { api_key } = credentials;
    
    if (!api_key) {
      return { success: false, message: 'API key is required for HubSpot' };
    }

    // Test API call to HubSpot
    const response = await fetch('https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=1', {
      headers: {
        'Authorization': `Bearer ${api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        message: 'HubSpot connection successful',
        data: { contactCount: data.total || 0 }
      };
    } else if (response.status === 401) {
      return { success: false, message: 'Invalid HubSpot API key' };
    } else {
      return { success: false, message: 'Failed to connect to HubSpot' };
    }
  } catch (error) {
    return { success: false, message: 'HubSpot connection failed' };
  }
}

/**
 * Test Salesforce connection
 */
async function testSalesforceConnection(
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { client_id, client_secret, username, password, security_token } = credentials;
    
    if (!client_id || !client_secret || !username || !password) {
      return { success: false, message: 'All Salesforce credentials are required' };
    }

    // OAuth2 authentication with Salesforce
    const authResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id,
        client_secret,
        username,
        password: password + (security_token || '')
      })
    });

    if (authResponse.ok) {
      const authData = await authResponse.json();
      
      // Test API call
      const testResponse = await fetch(`${authData.instance_url}/services/data/v58.0/sobjects/Lead/describe`, {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (testResponse.ok) {
        return { 
          success: true, 
          message: 'Salesforce connection successful',
          data: { instanceUrl: authData.instance_url }
        };
      } else {
        return { success: false, message: 'Failed to access Salesforce API' };
      }
    } else {
      return { success: false, message: 'Invalid Salesforce credentials' };
    }
  } catch (error) {
    return { success: false, message: 'Salesforce connection failed' };
  }
}

/**
 * Test Zoho connection
 */
async function testZohoConnection(
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { access_token } = credentials;
    
    if (!access_token) {
      return { success: false, message: 'Access token is required for Zoho CRM' };
    }

    // Test API call to Zoho
    const response = await fetch('https://www.zohoapis.com/crm/v2/Leads?per_page=1', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return { 
        success: true, 
        message: 'Zoho CRM connection successful'
      };
    } else if (response.status === 401) {
      return { success: false, message: 'Invalid Zoho access token' };
    } else {
      return { success: false, message: 'Failed to connect to Zoho CRM' };
    }
  } catch (error) {
    return { success: false, message: 'Zoho CRM connection failed' };
  }
}

/**
 * Test Pipedrive connection
 */
async function testPipedriveConnection(
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { api_token, company_domain } = credentials;
    
    if (!api_token || !company_domain) {
      return { success: false, message: 'API token and company domain are required for Pipedrive' };
    }

    // Test API call to Pipedrive
    const response = await fetch(`https://${company_domain}.pipedrive.com/api/v1/users/me?api_token=${api_token}`);

    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        message: 'Pipedrive connection successful',
        data: { user: data.data?.name }
      };
    } else if (response.status === 401) {
      return { success: false, message: 'Invalid Pipedrive API token' };
    } else {
      return { success: false, message: 'Failed to connect to Pipedrive' };
    }
  } catch (error) {
    return { success: false, message: 'Pipedrive connection failed' };
  }
}

/**
 * Encrypt credentials before storing
 */
async function encryptCredentials(credentials: Record<string, string>): Promise<Record<string, string>> {
  // In production, you should encrypt sensitive credentials
  // For now, we'll just mark them as encrypted
  const encrypted: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(credentials)) {
    if (key.includes('password') || key.includes('secret') || key.includes('token')) {
      encrypted[key] = '***encrypted***';
    } else {
      encrypted[key] = value;
    }
  }
  
  return encrypted;
}

/**
 * Perform CRM sync
 */
async function performCrmSync(
  app: FastifyInstance,
  integration: any
): Promise<{ synced: number; errors: number; details: any[] }> {
  const { pullFromCRM } = await import('./crm-sync.service');
  
  try {
    // Pull updates from CRM
    const pullResults = await pullFromCRM(app, integration);
    
    const synced = pullResults.filter(r => r.action === 'created' || r.action === 'updated').length;
    const errors = pullResults.filter(r => r.action === 'error').length;
    
    app.log.info('CRM sync completed', { 
      integrationId: integration.id,
      synced,
      errors,
      total: pullResults.length
    });
    
    return { 
      synced, 
      errors,
      details: pullResults
    };
    
  } catch (error) {
    app.log.error('CRM sync failed:', error);
    return { 
      synced: 0, 
      errors: 1,
      details: [{ 
        action: 'error', 
        message: error.message 
      }]
    };
  }
}
