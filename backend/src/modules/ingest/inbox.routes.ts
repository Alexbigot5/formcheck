import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';
import { EmailListenerManager } from './email.listener';

// Global email listener manager instance
let emailListenerManager: EmailListenerManager | null = null;

// Validation schemas
const manualSyncSchema = z.object({
  integrationId: z.string().cuid().optional()
});

export async function registerInboxRoutes(app: FastifyInstance) {
  // Initialize email listener manager
  emailListenerManager = new EmailListenerManager(app);
  
  // Start email listeners on server startup
  await emailListenerManager.startAllListeners();

  // Apply authentication to all routes
  app.addHook('preHandler', authenticate);

  /**
   * POST /ingest/inbox/sync - Manual inbox sync for testing
   */
  app.post('/ingest/inbox/sync', {
    const { integrationId } = request.body as z.infer<typeof manualSyncSchema>;
    const teamId = (request as any).teamId;

    try {
      app.log.info('Manual inbox sync requested', { teamId, integrationId });

      let results: any[] = [];

      if (integrationId) {
        // Sync specific integration
        const integration = await app.prisma.integration.findFirst({
          where: { 
            id: integrationId, 
            teamId,
            kind: 'INBOX'
          }
        });

        if (!integration) {
          return reply.code(404).send({ 
            error: 'Integration not found or not accessible' 
          });
        }

        if (!emailListenerManager) {
          return reply.code(500).send({ 
            error: 'Email listener manager not initialized' 
          });
        }

        const result = await emailListenerManager.manualSync(integrationId);
        results.push(result);

      } else {
        // Sync all integrations for team
        const integrations = await app.prisma.integration.findMany({
          where: { 
            teamId,
            kind: 'INBOX',
            status: { not: 'DISCONNECTED' }
          }
        });

        if (!emailListenerManager) {
          return reply.code(500).send({ 
            error: 'Email listener manager not initialized' 
          });
        }

        for (const integration of integrations) {
          try {
            const result = await emailListenerManager.manualSync(integration.id);
            results.push(result);
          } catch (error) {
            app.log.error('Failed to sync integration:', error, {
              integrationId: integration.id
            });
            results.push({
              processed: 0,
              errors: 1,
              messages: [{
                messageId: 'sync_error',
                error: error instanceof Error ? error.message : 'Unknown error'
              }]
            });
          }
        }
      }

      // Aggregate results
      const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      const allMessages = results.flatMap(r => r.messages || []);

      const message = integrationId 
        ? `Manual sync completed for integration ${integrationId}`
        : `Manual sync completed for ${results.length} integrations`;

      return reply.send({
        success: true,
        processed: totalProcessed,
        errors: totalErrors,
        messages: allMessages,
        message: `${message}. Processed ${totalProcessed} emails with ${totalErrors} errors.`
      });

    } catch (error) {
      app.log.error('Manual inbox sync failed:', error);
      return reply.code(500).send({ 
        error: 'Manual sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /ingest/inbox/status - Get inbox integration status
   */
  app.get('/ingest/inbox/status', {
    const teamId = (request as any).teamId;

    try {
      const integrations = await app.prisma.integration.findMany({
        where: { 
          teamId,
          kind: 'INBOX'
        },
        select: {
          id: true,
          status: true,
          lastSeenAt: true,
          lastSyncAt: true,
          error: true
        }
      });

      const integrationsWithStatus = integrations.map(integration => ({
        id: integration.id,
        status: integration.status as 'CONNECTED' | 'DISCONNECTED' | 'ERROR',
        lastSeenAt: integration.lastSeenAt?.toISOString() || null,
        lastSyncAt: integration.lastSyncAt?.toISOString() || null,
        error: integration.error,
        listenerActive: emailListenerManager?.getListener(integration.id) !== undefined
      }));

      const totalActive = integrationsWithStatus.filter(i => i.listenerActive).length;
      const totalConfigured = integrations.length;

      return reply.send({
        integrations: integrationsWithStatus,
        totalActive,
        totalConfigured
      });

    } catch (error) {
      app.log.error('Failed to get inbox status:', error);
      return reply.code(500).send({ 
        error: 'Failed to get inbox status' 
      });
    }
  });

  /**
   * POST /ingest/inbox/start - Start email listener for integration
   */
  app.post('/ingest/inbox/start', {
    const { integrationId } = request.body as { integrationId: string };
    const teamId = (request as any).teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: { 
          id: integrationId, 
          teamId,
          kind: 'INBOX'
        }
      });

      if (!integration) {
        return reply.code(404).send({ 
          error: 'Integration not found or not accessible' 
        });
      }

      if (!emailListenerManager) {
        return reply.code(500).send({ 
          error: 'Email listener manager not initialized' 
        });
      }

      // Check if listener is already running
      if (emailListenerManager.getListener(integrationId)) {
        return reply.send({
          success: true,
          message: 'Email listener is already running'
        });
      }

      // Start the listener
      await emailListenerManager.startListener(integration);

      return reply.send({
        success: true,
        message: 'Email listener started successfully'
      });

    } catch (error) {
      app.log.error('Failed to start email listener:', error);
      return reply.code(500).send({ 
        error: 'Failed to start email listener',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /ingest/inbox/stop - Stop email listener for integration
   */
  app.post('/ingest/inbox/stop', {
    const { integrationId } = request.body as { integrationId: string };
    const teamId = (request as any).teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: { 
          id: integrationId, 
          teamId,
          kind: 'INBOX'
        }
      });

      if (!integration) {
        return reply.code(404).send({ 
          error: 'Integration not found or not accessible' 
        });
      }

      if (!emailListenerManager) {
        return reply.code(500).send({ 
          error: 'Email listener manager not initialized' 
        });
      }

      const listener = emailListenerManager.getListener(integrationId);
      if (!listener) {
        return reply.send({
          success: true,
          message: 'Email listener is not running'
        });
      }

      // Stop the listener
      await listener.stop();

      return reply.send({
        success: true,
        message: 'Email listener stopped successfully'
      });

    } catch (error) {
      app.log.error('Failed to stop email listener:', error);
      return reply.code(500).send({ 
        error: 'Failed to stop email listener',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /ingest/inbox/recent - Get recent email messages
   */
  app.get('/ingest/inbox/recent', {
    const { limit, integrationId } = request.query as { limit: number; integrationId?: string };
    const teamId = (request as any).teamId;

    try {
      const where: any = {
        channel: 'EMAIL',
        direction: 'IN',
        lead: { teamId }
      };

      if (integrationId) {
        where['meta.integrationId'] = integrationId;
      }

      const [messages, total] = await Promise.all([
        app.prisma.message.findMany({
          where,
          include: {
            lead: {
              select: {
                email: true,
                name: true,
                company: true,
                score: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit
        }),
        app.prisma.message.count({ where })
      ]);

      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        leadId: msg.leadId,
        subject: msg.subject || 'No Subject',
        from: (msg.meta as any)?.from?.address || 'Unknown',
        createdAt: msg.createdAt.toISOString(),
        lead: msg.lead
      }));

      return reply.send({
        messages: formattedMessages,
        total
      });

    } catch (error) {
      app.log.error('Failed to get recent messages:', error);
      return reply.code(500).send({ 
        error: 'Failed to get recent messages' 
      });
    }
  });

  // Graceful shutdown handler
  app.addHook('onClose', async () => {
    if (emailListenerManager) {
      app.log.info('Stopping email listeners...');
      await emailListenerManager.stopAllListeners();
    }
  });
}

/**
 * Get email listener manager instance
 */
export function getEmailListenerManager(): EmailListenerManager | null {
  return emailListenerManager;
}
