import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import pino from 'pino';
import { loadEnv } from './config/env';
import prismaPlugin from './plugins/prisma';
import websocketPlugin from './plugins/websocket';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerAuthRoutes } from './modules/auth/auth.routes';
import { registerSupabaseAuthRoutes } from './modules/auth/supabase-auth.routes';
import { registerDemoCrmRoutes } from './modules/integrations/demo-crm.routes';
import { registerEmailTemplateRoutes } from './modules/email/templates.routes';
import { registerDemoIngestionRoutes } from './modules/ingest/demo-ingestion.routes';
import { registerCampaignRoutes } from './modules/campaigns/campaigns.routes';
import { registerDashboardRoutes } from './modules/analytics/dashboard.routes';
import { registerFormRoutes } from './modules/forms/forms.routes';
import { registerLeadRoutes } from './modules/leads/leads.routes';
import { registerIntegrationRoutes } from './modules/integrations/integrations.routes';
import { registerWebhookRoutes } from './modules/webhooks/webhook.routes';
import { registerScoringRoutes } from './modules/scoring/routes';
import { registerRoutingRoutes } from './modules/routing/routes';
import { registerWebhookIngestionRoutes, registerInboxRoutes, registerLinkedInRoutes, registerLinkedInAnalysisRoute, registerInstagramRoutes } from './modules/ingest/index';
import { registerEnrichmentRoutes } from './modules/enrich/index';
import { registerAnalyticsRoutes } from './modules/analytics/analytics.routes';
import { registerCrmSyncRoutes } from './modules/crm/sync.routes';
import { registerOAuthRoutes } from './modules/oauth/oauth.routes';
import { registerEmailIntegrationRoutes } from './modules/integrations/email.routes';
import { registerCrmIntegrationRoutes } from './modules/integrations/crm.routes';
import { registerCrmWebhookRoutes } from './modules/integrations/crm-webhooks.routes';
import { registerMessageReplyRoutes } from './modules/messages/reply.routes';
import { registerWebSocketRoutes } from './modules/websocket/websocket.routes';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    sendSuccess: (data: any, statusCode?: number) => any;
    sendError: (error: string, statusCode?: number) => any;
  }
  interface FastifyReply {
    sendSuccess: (data: any, statusCode?: number) => any;
    sendError: (error: string, statusCode?: number) => any;
  }
}

async function buildServer() {
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    console.error('Failed to load environment variables:', error);
    throw error;
  }
  
  const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  });

  const app = Fastify({ logger });
  
  // Log environment info for debugging
  app.log.info('Starting server with environment:', {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    FRONTEND_URL: env.FRONTEND_URL,
    DATABASE_URL: env.DATABASE_URL ? 'Set' : 'Not set',
    JWT_SECRET: env.JWT_SECRET ? 'Set' : 'Not set'
  });

  // Configure CORS for frontend origin
  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:3000', // Next.js default
    'http://localhost:8080', // Vite default
    'http://localhost:5173', // Vite alternative port
  ];
  
  try {
    await app.register(cors, { 
      origin: env.NODE_ENV === 'development' ? allowedOrigins : [env.FRONTEND_URL],
      credentials: true,
    });
    app.log.info('CORS plugin registered successfully');
    
    await app.register(fastifyJwt, { secret: env.JWT_SECRET });
    app.log.info('JWT plugin registered successfully');
    
    await app.register(prismaPlugin);
    app.log.info('Prisma plugin registered successfully');
    
    await app.register(websocketPlugin);
    app.log.info('WebSocket plugin registered successfully');
  } catch (error) {
    app.log.error('Failed to register core plugins:', error);
    throw error;
  }

  // Add reply decorators before registering routes
  app.decorateReply('sendSuccess', function(data: any, statusCode: number = 200) {
    return this.code(statusCode).send({ ok: true, data });
  });
  
  app.decorateReply('sendError', function(error: string, statusCode: number = 400) {
    return this.code(statusCode).send({ ok: false, error });
  });

  // Register routes
  await registerHealthRoutes(app);
  await registerSupabaseAuthRoutes(app); // Use Supabase auth instead
  await registerDemoCrmRoutes(app); // Demo CRM endpoints
  await registerEmailTemplateRoutes(app); // Email templates
  await registerDemoIngestionRoutes(app); // Lead ingestion
  await registerCampaignRoutes(app); // Email campaigns
  await registerDashboardRoutes(app); // Dashboard & Analytics
  await registerFormRoutes(app);
  await registerLeadRoutes(app);
  await registerIntegrationRoutes(app);
  await registerWebhookRoutes(app);
  await registerScoringRoutes(app);
  await registerRoutingRoutes(app);
  await registerWebhookIngestionRoutes(app);
  await registerInboxRoutes(app);
  await registerLinkedInRoutes(app);
  await registerLinkedInAnalysisRoute(app);
  await registerInstagramRoutes(app);
  await registerEnrichmentRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerCrmSyncRoutes(app);
  await registerOAuthRoutes(app);
  await registerEmailIntegrationRoutes(app);
  await registerCrmIntegrationRoutes(app);
  await registerCrmWebhookRoutes(app);
  await registerMessageReplyRoutes(app);
  await registerWebSocketRoutes(app);

  // Reply decorators have been moved before route registration

  app.get('/', async () => ({ ok: true, service: 'up', name: 'SmartForms AI Backend', version: '0.1.0' }));

  return { app, env };
}

async function start() {
  console.log('=== STARTING SERVER ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
  console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);
  
  try {
    console.log('Building server...');
    const { app, env } = await buildServer();
    console.log('Server built successfully, starting to listen...');
    
    // Use Railway's PORT and bind to 0.0.0.0
    const PORT = Number(process.env.PORT || env.PORT || 3000);
    const HOST = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port: PORT, host: HOST });
    console.log(`=== SERVER STARTED ON http://${HOST}:${PORT} ===`);
    app.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('=== SERVER STARTUP FAILED ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Add immediate console log to verify code is running
console.log('🚀 SERVER.TS LOADED - VERSION 2.0');
console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  hasDB: !!process.env.DATABASE_URL,
  hasJWT: !!process.env.JWT_SECRET
});

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { buildServer };


