import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';
import { EmailListener } from '../ingest/email.listener';

// Validation schemas
const emailProviderSchema = z.object({
  provider: z.enum(['gmail', 'imap', 'outlook']),
  credentials: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    imapHost: z.string().optional(),
    imapPort: z.string().optional(),
    secure: z.boolean().optional()
  }),
  enabled: z.boolean().default(true)
});

const testEmailSchema = z.object({
  provider: z.enum(['gmail', 'imap', 'outlook']),
  credentials: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    imapHost: z.string().optional(),
    imapPort: z.string().optional(),
    secure: z.boolean().optional()
  })
});

export async function registerEmailIntegrationRoutes(app: FastifyInstance) {
  
  /**
   * POST /api/integrations/email/test - Test email connection
   */
  app.post('/api/integrations/email/test', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof testEmailSchema>;
    const teamId = request.teamId;

    try {
      const { provider, credentials } = testEmailSchema.parse(body);

      // Test email connection
      const isValid = await testEmailConnection(provider, credentials);

      if (isValid) {
        return reply.send({ 
          success: true, 
          message: 'Email connection successful' 
        });
      } else {
        return reply.code(400).send({ 
          success: false, 
          error: 'Failed to connect to email server' 
        });
      }

    } catch (error: any) {
      app.log.error('Email connection test failed:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Email connection test failed' 
      });
    }
  });

  /**
   * POST /api/integrations/email - Save email integration
   */
  app.post('/api/integrations/email', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof emailProviderSchema>;
    const teamId = request.teamId;

    try {
      const { provider, credentials, enabled } = emailProviderSchema.parse(body);

      // Encrypt credentials before storing
      const encryptedCredentials = await encryptCredentials(credentials);

      // Save or update email integration
      const integration = await app.prisma.integration.upsert({
        where: {
          teamId_kind: {
            teamId,
            kind: 'EMAIL'
          }
        },
        update: {
          config: {
            provider,
            credentials: encryptedCredentials,
            enabled
          },
          status: enabled ? 'ACTIVE' : 'INACTIVE',
          lastSeenAt: new Date()
        },
        create: {
          teamId,
          kind: 'EMAIL',
          config: {
            provider,
            credentials: encryptedCredentials,
            enabled
          },
          status: enabled ? 'ACTIVE' : 'INACTIVE',
          lastSeenAt: new Date()
        }
      });

      // Start email listener if enabled
      if (enabled) {
        await startEmailListener(app, integration.id, provider, credentials);
      }

      return reply.send({ 
        success: true, 
        integrationId: integration.id,
        message: 'Email integration saved successfully' 
      });

    } catch (error: any) {
      app.log.error('Failed to save email integration:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to save email integration' 
      });
    }
  });

  /**
   * GET /api/integrations/email - Get email integration status
   */
  app.get('/api/integrations/email', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const teamId = request.teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: {
          teamId,
          kind: 'EMAIL'
        }
      });

      if (!integration) {
        return reply.send({ 
          success: true, 
          integration: null,
          message: 'No email integration found' 
        });
      }

      // Don't return credentials in the response
      const { config, ...integrationData } = integration;
      const safeConfig = {
        provider: config?.provider,
        enabled: config?.enabled,
        email: config?.credentials?.email // Only return email, not password
      };

      return reply.send({ 
        success: true, 
        integration: {
          ...integrationData,
          config: safeConfig
        }
      });

    } catch (error: any) {
      app.log.error('Failed to get email integration:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to get email integration' 
      });
    }
  });

  /**
   * DELETE /api/integrations/email - Delete email integration
   */
  app.delete('/api/integrations/email', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const teamId = request.teamId;

    try {
      const integration = await app.prisma.integration.findFirst({
        where: {
          teamId,
          kind: 'EMAIL'
        }
      });

      if (integration) {
        // Stop email listener
        await stopEmailListener(integration.id);

        // Delete integration
        await app.prisma.integration.delete({
          where: { id: integration.id }
        });
      }

      return reply.send({ 
        success: true, 
        message: 'Email integration deleted successfully' 
      });

    } catch (error: any) {
      app.log.error('Failed to delete email integration:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to delete email integration' 
      });
    }
  });
}

/**
 * Test email connection
 */
async function testEmailConnection(
  provider: string, 
  credentials: any
): Promise<boolean> {
  try {
    // For Gmail
    if (provider === 'gmail') {
      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
          user: credentials.email,
          pass: credentials.password
        }
      });

      await client.connect();
      await client.logout();
      return true;
    }

    // For IMAP
    if (provider === 'imap') {
      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: credentials.imapHost,
        port: parseInt(credentials.imapPort || '993'),
        secure: credentials.secure !== false,
        auth: {
          user: credentials.email,
          pass: credentials.password
        }
      });

      await client.connect();
      await client.logout();
      return true;
    }

    // For Outlook
    if (provider === 'outlook') {
      const { ImapFlow } = require('imapflow');
      const client = new ImapFlow({
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
        auth: {
          user: credentials.email,
          pass: credentials.password
        }
      });

      await client.connect();
      await client.logout();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Email connection test failed:', error);
    return false;
  }
}

/**
 * Encrypt credentials before storing
 */
async function encryptCredentials(credentials: any): Promise<any> {
  // In production, you should encrypt the password
  // For now, we'll just store it (this is not secure for production)
  return {
    ...credentials,
    password: '***encrypted***' // Replace with actual encryption
  };
}

/**
 * Start email listener for the integration
 */
async function startEmailListener(
  app: FastifyInstance,
  integrationId: string,
  provider: string,
  credentials: any
): Promise<void> {
  try {
    // Create and start email listener
    const listener = new EmailListener(integrationId, {
      provider,
      credentials,
      onMessage: async (message) => {
        await processIncomingEmail(app, integrationId, message);
      }
    });

    await listener.start();
    app.log.info('Email listener started', { integrationId, provider });
  } catch (error) {
    app.log.error('Failed to start email listener:', error);
  }
}

/**
 * Stop email listener
 */
async function stopEmailListener(integrationId: string): Promise<void> {
  // Implementation to stop the specific email listener
  // This would be managed by the EmailListenerManager
}

/**
 * Process incoming email and create unibox entry
 */
async function processIncomingEmail(
  app: FastifyInstance,
  integrationId: string,
  emailMessage: any
): Promise<void> {
  try {
    // Get integration details
    const integration = await app.prisma.integration.findUnique({
      where: { id: integrationId }
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Extract email details
    const { from, subject, text, html, date } = emailMessage;
    const senderEmail = from[0]?.address;
    const senderName = from[0]?.name;

    // Find or create lead
    let lead = await app.prisma.lead.findFirst({
      where: {
        email: senderEmail,
        teamId: integration.teamId
      }
    });

    if (!lead) {
      // Create new lead
      lead = await app.prisma.lead.create({
        data: {
          teamId: integration.teamId,
          email: senderEmail,
          name: senderName,
          source: 'email',
          sourceRef: integrationId,
          status: 'NEW',
          score: 0,
          scoreBand: 'LOW'
        }
      });
    }

    // Create message in unibox
    await app.prisma.message.create({
      data: {
        leadId: lead.id,
        direction: 'IN',
        channel: 'EMAIL',
        subject: subject || 'No Subject',
        body: html || text || '',
        meta: {
          from: senderEmail,
          fromName: senderName,
          receivedAt: date || new Date().toISOString(),
          integrationId
        },
        status: 'UNREAD'
      }
    });

    // Add timeline event
    await app.prisma.timelineEvent.create({
      data: {
        leadId: lead.id,
        type: 'EMAIL_RECEIVED',
        payload: {
          from: senderEmail,
          subject: subject || 'No Subject',
          receivedAt: date || new Date().toISOString()
        }
      }
    });

    app.log.info('Processed incoming email', { 
      leadId: lead.id, 
      from: senderEmail, 
      subject 
    });

  } catch (error) {
    app.log.error('Failed to process incoming email:', error);
  }
}
