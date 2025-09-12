import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';

export async function registerOAuthRoutes(app: FastifyInstance) {
  // Apply authentication to OAuth start routes
  app.addHook('preHandler', authenticate);

  /**
   * GET /oauth/hubspot/start - Start HubSpot OAuth flow
   */
  app.get('/oauth/hubspot/start', {
    schema: {
      querystring: z.object({
        redirectUrl: z.string().url().optional()
      }),
      response: {
        302: z.object({
          location: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { redirectUrl } = request.query as { redirectUrl?: string };
    const teamId = (request as any).teamId;
    const userId = (request as any).user?.id;

    try {
      // HubSpot OAuth configuration
      const clientId = process.env.HUBSPOT_CLIENT_ID;
      const redirectUri = `${process.env.FRONTEND_URL}/oauth/callback/hubspot`;
      
      if (!clientId) {
        return reply.code(500).send({ error: 'HubSpot OAuth not configured' });
      }

      // Store state information for validation
      const state = Buffer.from(JSON.stringify({
        teamId,
        userId,
        provider: 'hubspot',
        redirectUrl: redirectUrl || '/integrations',
        timestamp: Date.now()
      })).toString('base64');

      // HubSpot OAuth URL
      const scopes = [
        'contacts',
        'companies',
        'deals',
        'tickets',
        'oauth',
        'crm.objects.contacts.read',
        'crm.objects.contacts.write',
        'crm.objects.companies.read',
        'crm.objects.companies.write'
      ].join(' ');

      const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('response_type', 'code');

      return reply.redirect(302, authUrl.toString());

    } catch (error) {
      app.log.error('HubSpot OAuth start failed:', error);
      return reply.code(500).send({ error: 'Failed to start HubSpot OAuth' });
    }
  });

  /**
   * GET /oauth/salesforce/start - Start Salesforce OAuth flow
   */
  app.get('/oauth/salesforce/start', {
    schema: {
      querystring: z.object({
        redirectUrl: z.string().url().optional()
      }),
      response: {
        302: z.object({
          location: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { redirectUrl } = request.query as { redirectUrl?: string };
    const teamId = (request as any).teamId;
    const userId = (request as any).user?.id;

    try {
      // Salesforce OAuth configuration
      const clientId = process.env.SALESFORCE_CLIENT_ID;
      const redirectUri = `${process.env.FRONTEND_URL}/oauth/callback/salesforce`;
      
      if (!clientId) {
        return reply.code(500).send({ error: 'Salesforce OAuth not configured' });
      }

      // Store state information for validation
      const state = Buffer.from(JSON.stringify({
        teamId,
        userId,
        provider: 'salesforce',
        redirectUrl: redirectUrl || '/integrations',
        timestamp: Date.now()
      })).toString('base64');

      // Salesforce OAuth URL
      const authUrl = new URL('https://login.salesforce.com/services/oauth2/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'api refresh_token');
      authUrl.searchParams.set('state', state);

      return reply.redirect(302, authUrl.toString());

    } catch (error) {
      app.log.error('Salesforce OAuth start failed:', error);
      return reply.code(500).send({ error: 'Failed to start Salesforce OAuth' });
    }
  });

  /**
   * POST /oauth/hubspot/callback - Handle HubSpot OAuth callback
   */
  app.post('/oauth/hubspot/callback', {
    schema: {
      body: z.object({
        code: z.string(),
        state: z.string()
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          redirectUrl: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { code, state } = request.body as { code: string; state: string };

    try {
      // Decode and validate state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      
      if (stateData.provider !== 'hubspot') {
        return reply.code(400).send({ error: 'Invalid OAuth state' });
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.HUBSPOT_CLIENT_ID!,
          client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
          redirect_uri: `${process.env.FRONTEND_URL}/oauth/callback/hubspot`,
          code
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokens = await tokenResponse.json();

      // Get account info
      const accountResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokens.access_token);
      const accountInfo = await accountResponse.json();

      // Store integration
      await app.prisma.integration.upsert({
        where: {
          teamId_kind: {
            teamId: stateData.teamId,
            kind: 'HUBSPOT'
          }
        },
        update: {
          status: 'CONNECTED',
          auth: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            token_type: tokens.token_type,
            scope: tokens.scope
          },
          settings: {
            hub_id: accountInfo.hub_id,
            hub_domain: accountInfo.hub_domain,
            app_id: accountInfo.app_id,
            user: accountInfo.user,
            scopes: accountInfo.scopes
          },
          lastSeenAt: new Date(),
          error: null
        },
        create: {
          teamId: stateData.teamId,
          kind: 'HUBSPOT',
          status: 'CONNECTED',
          auth: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            token_type: tokens.token_type,
            scope: tokens.scope
          },
          settings: {
            hub_id: accountInfo.hub_id,
            hub_domain: accountInfo.hub_domain,
            app_id: accountInfo.app_id,
            user: accountInfo.user,
            scopes: accountInfo.scopes
          },
          lastSeenAt: new Date()
        }
      });

      return reply.send({
        success: true,
        message: 'HubSpot integration connected successfully',
        redirectUrl: stateData.redirectUrl
      });

    } catch (error) {
      app.log.error('HubSpot OAuth callback failed:', error);
      return reply.code(500).send({ error: 'Failed to complete HubSpot OAuth' });
    }
  });

  /**
   * POST /oauth/salesforce/callback - Handle Salesforce OAuth callback
   */
  app.post('/oauth/salesforce/callback', {
    schema: {
      body: z.object({
        code: z.string(),
        state: z.string()
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          redirectUrl: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { code, state } = request.body as { code: string; state: string };

    try {
      // Decode and validate state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      
      if (stateData.provider !== 'salesforce') {
        return reply.code(400).send({ error: 'Invalid OAuth state' });
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.SALESFORCE_CLIENT_ID!,
          client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
          redirect_uri: `${process.env.FRONTEND_URL}/oauth/callback/salesforce`,
          code
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokens = await tokenResponse.json();

      // Get user info
      const userResponse = await fetch(tokens.id, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });
      const userInfo = await userResponse.json();

      // Store integration
      await app.prisma.integration.upsert({
        where: {
          teamId_kind: {
            teamId: stateData.teamId,
            kind: 'SALESFORCE'
          }
        },
        update: {
          status: 'CONNECTED',
          auth: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            instance_url: tokens.instance_url,
            id: tokens.id,
            token_type: tokens.token_type,
            issued_at: tokens.issued_at,
            signature: tokens.signature
          },
          settings: {
            organization_id: userInfo.organization_id,
            user_id: userInfo.user_id,
            username: userInfo.username,
            display_name: userInfo.display_name,
            email: userInfo.email,
            urls: userInfo.urls
          },
          lastSeenAt: new Date(),
          error: null
        },
        create: {
          teamId: stateData.teamId,
          kind: 'SALESFORCE',
          status: 'CONNECTED',
          auth: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            instance_url: tokens.instance_url,
            id: tokens.id,
            token_type: tokens.token_type,
            issued_at: tokens.issued_at,
            signature: tokens.signature
          },
          settings: {
            organization_id: userInfo.organization_id,
            user_id: userInfo.user_id,
            username: userInfo.username,
            display_name: userInfo.display_name,
            email: userInfo.email,
            urls: userInfo.urls
          },
          lastSeenAt: new Date()
        }
      });

      return reply.send({
        success: true,
        message: 'Salesforce integration connected successfully',
        redirectUrl: stateData.redirectUrl
      });

    } catch (error) {
      app.log.error('Salesforce OAuth callback failed:', error);
      return reply.code(500).send({ error: 'Failed to complete Salesforce OAuth' });
    }
  });
}
