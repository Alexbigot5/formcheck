import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';
import { EmailService } from '../../services/email.service';

// Validation schemas
const replyEmailSchema = z.object({
  body: z.string().min(1),
  subject: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string()
  })).optional()
});

const forwardEmailSchema = z.object({
  to: z.string().email(),
  body: z.string().min(1),
  subject: z.string().optional(),
  includeOriginal: z.boolean().default(true)
});

const bulkReplySchema = z.object({
  messageIds: z.array(z.string()),
  body: z.string().min(1),
  subject: z.string().optional(),
  useTemplate: z.boolean().default(false),
  templateId: z.string().optional()
});

export async function registerMessageReplyRoutes(app: FastifyInstance) {
  
  /**
   * POST /api/messages/:messageId/reply - Reply to a message
   */
  app.post('/api/messages/:messageId/reply', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { messageId } = request.params as { messageId: string };
    const body = request.body as z.infer<typeof replyEmailSchema>;
    const teamId = request.teamId;

    try {
      const { body: emailBody, subject, attachments } = replyEmailSchema.parse(body);

      // Get original message and lead
      const message = await app.prisma.message.findUnique({
        where: { id: messageId },
        include: { 
          lead: {
            include: { team: true }
          }
        }
      });

      if (!message) {
        return reply.code(404).send({ 
          success: false, 
          error: 'Message not found' 
        });
      }

      if (message.lead.teamId !== teamId) {
        return reply.code(403).send({ 
          success: false, 
          error: 'Access denied' 
        });
      }

      // Get team email configuration
      const emailConfig = await getTeamEmailConfig(app, teamId);
      if (!emailConfig) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Email configuration not found. Please set up email integration first.' 
        });
      }

      // Initialize email service
      const emailService = new EmailService(emailConfig);

      // Prepare reply email
      const replySubject = subject || `Re: ${message.subject || 'No Subject'}`;
      const replyTo = message.lead.email;
      
      // Add email signature if configured
      const finalBody = await addEmailSignature(emailBody, teamId);

      // Send email
      const emailResult = await emailService.sendReply({
        to: replyTo,
        subject: replySubject,
        body: finalBody,
        replyTo: emailConfig.fromEmail,
        attachments: attachments || []
      });

      if (!emailResult.success) {
        return reply.code(500).send({ 
          success: false, 
          error: emailResult.error || 'Failed to send email' 
        });
      }

      // Create outgoing message record
      const sentMessage = await app.prisma.message.create({
        data: {
          leadId: message.leadId,
          direction: 'OUT',
          channel: 'EMAIL',
          subject: replySubject,
          body: finalBody,
          status: 'SENT',
          meta: { 
            replyToMessageId: messageId,
            emailId: emailResult.messageId,
            sentAt: new Date().toISOString(),
            attachmentCount: attachments?.length || 0
          }
        }
      });

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: message.leadId,
          type: 'EMAIL_SENT',
          payload: {
            messageId: sentMessage.id,
            subject: replySubject,
            sentTo: replyTo,
            sentAt: new Date().toISOString(),
            isReply: true,
            replyToMessageId: messageId
          }
        }
      });

      // Mark original message as replied
      await app.prisma.message.update({
        where: { id: messageId },
        data: { 
          status: 'REPLIED',
          meta: {
            ...message.meta as any,
            repliedAt: new Date().toISOString(),
            replyMessageId: sentMessage.id
          }
        }
      });

      return reply.send({
        success: true,
        messageId: sentMessage.id,
        message: 'Reply sent successfully'
      });

    } catch (error: any) {
      app.log.error('Failed to send reply:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to send reply' 
      });
    }
  });

  /**
   * POST /api/messages/:messageId/forward - Forward a message
   */
  app.post('/api/messages/:messageId/forward', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { messageId } = request.params as { messageId: string };
    const body = request.body as z.infer<typeof forwardEmailSchema>;
    const teamId = request.teamId;

    try {
      const { to, body: emailBody, subject, includeOriginal } = forwardEmailSchema.parse(body);

      // Get original message
      const message = await app.prisma.message.findUnique({
        where: { id: messageId },
        include: { lead: true }
      });

      if (!message || message.lead.teamId !== teamId) {
        return reply.code(404).send({ 
          success: false, 
          error: 'Message not found' 
        });
      }

      // Get email configuration
      const emailConfig = await getTeamEmailConfig(app, teamId);
      if (!emailConfig) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Email configuration not found' 
        });
      }

      const emailService = new EmailService(emailConfig);

      // Prepare forward email
      const forwardSubject = subject || `Fwd: ${message.subject || 'No Subject'}`;
      let forwardBody = emailBody;

      if (includeOriginal) {
        forwardBody += `\n\n--- Forwarded Message ---\n`;
        forwardBody += `From: ${message.lead.email}\n`;
        forwardBody += `Subject: ${message.subject}\n`;
        forwardBody += `Date: ${message.createdAt.toISOString()}\n\n`;
        forwardBody += message.body;
      }

      // Send forwarded email
      const emailResult = await emailService.sendEmail({
        to,
        subject: forwardSubject,
        body: forwardBody,
        from: emailConfig.fromEmail
      });

      if (!emailResult.success) {
        return reply.code(500).send({ 
          success: false, 
          error: 'Failed to forward email' 
        });
      }

      // Create forwarded message record
      const forwardedMessage = await app.prisma.message.create({
        data: {
          leadId: message.leadId,
          direction: 'OUT',
          channel: 'EMAIL',
          subject: forwardSubject,
          body: forwardBody,
          status: 'SENT',
          meta: { 
            forwardedFromMessageId: messageId,
            forwardedTo: to,
            emailId: emailResult.messageId,
            sentAt: new Date().toISOString()
          }
        }
      });

      return reply.send({
        success: true,
        messageId: forwardedMessage.id,
        message: 'Email forwarded successfully'
      });

    } catch (error: any) {
      app.log.error('Failed to forward email:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to forward email' 
      });
    }
  });

  /**
   * POST /api/messages/bulk-reply - Send bulk replies
   */
  app.post('/api/messages/bulk-reply', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof bulkReplySchema>;
    const teamId = request.teamId;

    try {
      const { messageIds, body: emailBody, subject, useTemplate, templateId } = bulkReplySchema.parse(body);

      // Get messages
      const messages = await app.prisma.message.findMany({
        where: {
          id: { in: messageIds },
          lead: { teamId }
        },
        include: { lead: true }
      });

      if (messages.length === 0) {
        return reply.code(404).send({ 
          success: false, 
          error: 'No messages found' 
        });
      }

      // Get email configuration
      const emailConfig = await getTeamEmailConfig(app, teamId);
      if (!emailConfig) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Email configuration not found' 
        });
      }

      const emailService = new EmailService(emailConfig);

      // Get template if specified
      let templateContent = emailBody;
      if (useTemplate && templateId) {
        const template = await app.prisma.emailTemplate.findFirst({
          where: { id: templateId, teamId }
        });
        if (template) {
          templateContent = template.body;
        }
      }

      const results = [];

      // Send replies to each message
      for (const message of messages) {
        try {
          // Personalize content
          const personalizedBody = personalizeEmailContent(templateContent, message.lead);
          const personalizedSubject = subject || `Re: ${message.subject || 'No Subject'}`;

          // Send email
          const emailResult = await emailService.sendReply({
            to: message.lead.email,
            subject: personalizedSubject,
            body: personalizedBody,
            replyTo: emailConfig.fromEmail
          });

          if (emailResult.success) {
            // Create message record
            const sentMessage = await app.prisma.message.create({
              data: {
                leadId: message.leadId,
                direction: 'OUT',
                channel: 'EMAIL',
                subject: personalizedSubject,
                body: personalizedBody,
                status: 'SENT',
                meta: { 
                  replyToMessageId: message.id,
                  bulkReply: true,
                  templateId,
                  sentAt: new Date().toISOString()
                }
              }
            });

            results.push({
              messageId: message.id,
              leadEmail: message.lead.email,
              status: 'sent',
              sentMessageId: sentMessage.id
            });

            // Mark original as replied
            await app.prisma.message.update({
              where: { id: message.id },
              data: { status: 'REPLIED' }
            });

          } else {
            results.push({
              messageId: message.id,
              leadEmail: message.lead.email,
              status: 'failed',
              error: emailResult.error
            });
          }

        } catch (error) {
          results.push({
            messageId: message.id,
            leadEmail: message.lead.email,
            status: 'failed',
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;

      return reply.send({
        success: true,
        message: `Bulk reply completed: ${successful} sent, ${failed} failed`,
        results,
        summary: { successful, failed, total: results.length }
      });

    } catch (error: any) {
      app.log.error('Failed to send bulk replies:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to send bulk replies' 
      });
    }
  });

  /**
   * GET /api/messages/:messageId/conversation - Get email conversation thread
   */
  app.get('/api/messages/:messageId/conversation', { 
    preHandler: [authenticateSupabase] 
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { messageId } = request.params as { messageId: string };
    const teamId = request.teamId;

    try {
      // Get the message
      const message = await app.prisma.message.findUnique({
        where: { id: messageId },
        include: { lead: true }
      });

      if (!message || message.lead.teamId !== teamId) {
        return reply.code(404).send({ 
          success: false, 
          error: 'Message not found' 
        });
      }

      // Get all messages for this lead in the same email thread
      const conversationMessages = await app.prisma.message.findMany({
        where: {
          leadId: message.leadId,
          channel: 'EMAIL',
          OR: [
            { subject: message.subject },
            { subject: `Re: ${message.subject}` },
            { subject: message.subject?.replace('Re: ', '') }
          ]
        },
        orderBy: { createdAt: 'asc' },
        include: {
          lead: {
            select: { email: true, name: true }
          }
        }
      });

      return reply.send({
        success: true,
        conversation: conversationMessages.map(msg => ({
          id: msg.id,
          direction: msg.direction,
          subject: msg.subject,
          body: msg.body,
          status: msg.status,
          createdAt: msg.createdAt.toISOString(),
          from: msg.direction === 'IN' ? msg.lead.email : 'You',
          isReply: msg.meta?.replyToMessageId ? true : false
        }))
      });

    } catch (error: any) {
      app.log.error('Failed to get conversation:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to get conversation' 
      });
    }
  });
}

/**
 * Get team email configuration
 */
async function getTeamEmailConfig(app: FastifyInstance, teamId: string): Promise<any> {
  const integration = await app.prisma.integration.findFirst({
    where: {
      teamId,
      kind: 'EMAIL',
      status: 'ACTIVE'
    }
  });

  if (!integration || !integration.config) {
    return null;
  }

  const config = integration.config as any;
  return {
    provider: config.provider,
    credentials: config.credentials,
    fromEmail: config.credentials.email,
    smtpConfig: getSMTPConfig(config.provider, config.credentials)
  };
}

/**
 * Get SMTP configuration for different providers
 */
function getSMTPConfig(provider: string, credentials: any): any {
  switch (provider) {
    case 'gmail':
      return {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: credentials.email,
          pass: credentials.password // This should be an app password
        }
      };
      
    case 'outlook':
      return {
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
          user: credentials.email,
          pass: credentials.password
        }
      };
      
    case 'imap':
      return {
        host: credentials.smtpHost || credentials.imapHost,
        port: parseInt(credentials.smtpPort || '587'),
        secure: credentials.smtpSecure || false,
        auth: {
          user: credentials.email,
          pass: credentials.password
        }
      };
      
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}

/**
 * Add email signature to message body
 */
async function addEmailSignature(body: string, teamId: string): Promise<string> {
  // You can implement team-specific email signatures here
  // For now, just return the body as-is
  return body + '\n\n---\nSent from SmartForms AI';
}

/**
 * Personalize email content with lead data
 */
function personalizeEmailContent(content: string, lead: any): string {
  const placeholders: Record<string, string> = {
    '{{lead.name}}': lead.name || 'there',
    '{{lead.email}}': lead.email || '',
    '{{lead.company}}': lead.company || 'your company',
    '{{lead.phone}}': lead.phone || ''
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }

  return result;
}
