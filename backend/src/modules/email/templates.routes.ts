import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';

// Validation schemas
const emailTemplateSchema = z.object({
  name: z.string().min(1),
  segment: z.enum(['hot', 'warm', 'cold']),
  subject: z.string().min(1),
  body: z.string().min(1)
});

const sendEmailSchema = z.object({
  templateId: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  segment: z.enum(['hot', 'warm', 'cold']),
  leadIds: z.array(z.string()).optional(),
  dryRun: z.boolean().default(false)
});

export async function registerEmailTemplateRoutes(app: FastifyInstance) {
  
  /**
   * GET /api/email-templates - Get all email templates
   */
  app.get('/api/email-templates', async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId;

    try {
      const templates = await app.prisma.emailTemplate.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({
        success: true,
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          segment: template.segment,
          subject: template.subject,
          body: template.body,
          createdAt: template.createdAt.toISOString(),
          performance: template.performance || {
            openRate: 0,
            replyRate: 0,
            clickRate: 0,
            sent: 0
          }
        }))
      });

    } catch (error: any) {
      app.log.error('Failed to get email templates:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to get email templates' 
      });
    }
  });

  /**
   * POST /api/email-templates - Create new email template
   */
  app.post('/api/email-templates', async (request: AuthenticatedRequest, reply) => {
    const body = request.body as z.infer<typeof emailTemplateSchema>;
    const teamId = request.teamId;

    try {
      const { name, segment, subject, body: templateBody } = emailTemplateSchema.parse(body);

      const template = await app.prisma.emailTemplate.create({
        data: {
          teamId,
          name,
          segment,
          subject,
          body: templateBody,
          performance: {
            openRate: 0,
            replyRate: 0,
            clickRate: 0,
            sent: 0
          }
        }
      });

      return reply.send({
        success: true,
        templateId: template.id,
        message: 'Email template created successfully'
      });

    } catch (error: any) {
      app.log.error('Failed to create email template:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to create email template' 
      });
    }
  });

  /**
   * PUT /api/email-templates/:id - Update email template
   */
  app.put('/api/email-templates/:id', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as z.infer<typeof emailTemplateSchema>;
    const teamId = request.teamId;

    try {
      const { name, segment, subject, body: templateBody } = emailTemplateSchema.parse(body);

      const template = await app.prisma.emailTemplate.update({
        where: { 
          id,
          teamId // Ensure user can only update their own templates
        },
        data: {
          name,
          segment,
          subject,
          body: templateBody
        }
      });

      return reply.send({
        success: true,
        message: 'Email template updated successfully'
      });

    } catch (error: any) {
      app.log.error('Failed to update email template:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to update email template' 
      });
    }
  });

  /**
   * DELETE /api/email-templates/:id - Delete email template
   */
  app.delete('/api/email-templates/:id', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const teamId = request.teamId;

    try {
      await app.prisma.emailTemplate.delete({
        where: { 
          id,
          teamId // Ensure user can only delete their own templates
        }
      });

      return reply.send({
        success: true,
        message: 'Email template deleted successfully'
      });

    } catch (error: any) {
      app.log.error('Failed to delete email template:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to delete email template' 
      });
    }
  });

  /**
   * GET /api/email-templates/stats - Get email template performance stats
   */
  app.get('/api/email-templates/stats', async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId;

    try {
      // Get campaign statistics grouped by segment
      const stats = await app.prisma.emailCampaign.groupBy({
        by: ['segment'],
        where: { teamId },
        _avg: {
          openRate: true,
          replyRate: true,
          clickRate: true
        },
        _sum: {
          sent: true
        }
      });

      const performanceStats = {
        hot: { openRate: 0, replyRate: 0, clickRate: 0, sent: 0 },
        warm: { openRate: 0, replyRate: 0, clickRate: 0, sent: 0 },
        cold: { openRate: 0, replyRate: 0, clickRate: 0, sent: 0 }
      };

      stats.forEach(stat => {
        if (stat.segment === 'hot' || stat.segment === 'warm' || stat.segment === 'cold') {
          performanceStats[stat.segment] = {
            openRate: stat._avg.openRate || 0,
            replyRate: stat._avg.replyRate || 0,
            clickRate: stat._avg.clickRate || 0,
            sent: stat._sum.sent || 0
          };
        }
      });

      return reply.send({
        success: true,
        stats: performanceStats
      });

    } catch (error: any) {
      app.log.error('Failed to get email template stats:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to get email template stats' 
      });
    }
  });

  /**
   * POST /api/email-templates/send - Send emails using template
   */
  app.post('/api/email-templates/send', async (request: AuthenticatedRequest, reply) => {
    const body = request.body as z.infer<typeof sendEmailSchema>;
    const teamId = request.teamId;

    try {
      const { templateId, subject, body: emailBody, segment, leadIds, dryRun } = sendEmailSchema.parse(body);

      // Get leads to send to
      let leads;
      if (leadIds && leadIds.length > 0) {
        leads = await app.prisma.lead.findMany({
          where: {
            id: { in: leadIds },
            teamId
          }
        });
      } else {
        // Auto-select leads based on segment and scoring
        const scoreFilter = getScoreFilterForSegment(segment);
        leads = await app.prisma.lead.findMany({
          where: {
            teamId,
            ...scoreFilter,
            status: { not: 'CLOSED' }
          },
          take: 100 // Limit to prevent spam
        });
      }

      if (leads.length === 0) {
        return reply.send({
          success: true,
          message: 'No leads found matching criteria',
          results: []
        });
      }

      if (dryRun) {
        return reply.send({
          success: true,
          message: `Dry run: Would send to ${leads.length} leads`,
          results: leads.map(lead => ({
            leadId: lead.id,
            email: lead.email,
            status: 'would_send'
          }))
        });
      }

      // Send emails
      const results = await sendEmailsToLeads(app, leads, {
        subject,
        body: emailBody,
        segment,
        templateId
      });

      // Create campaign record
      const campaign = await app.prisma.emailCampaign.create({
        data: {
          teamId,
          templateId,
          segment,
          subject,
          body: emailBody,
          sent: results.filter(r => r.status === 'sent').length,
          openRate: 0,
          replyRate: 0,
          clickRate: 0
        }
      });

      return reply.send({
        success: true,
        message: `Emails sent successfully`,
        campaignId: campaign.id,
        results
      });

    } catch (error: any) {
      app.log.error('Failed to send emails:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to send emails' 
      });
    }
  });
}

/**
 * Get score filter for segment
 */
function getScoreFilterForSegment(segment: string) {
  switch (segment) {
    case 'hot':
      return { score: { gte: 80 } };
    case 'warm':
      return { score: { gte: 60, lt: 80 } };
    case 'cold':
      return { score: { lt: 60 } };
    default:
      return {};
  }
}

/**
 * Send emails to leads
 */
async function sendEmailsToLeads(
  app: FastifyInstance,
  leads: any[],
  emailData: {
    subject: string;
    body: string;
    segment: string;
    templateId?: string;
  }
): Promise<{ leadId: string; email: string; status: 'sent' | 'failed'; error?: string }[]> {
  const results = [];

  for (const lead of leads) {
    try {
      // Replace placeholders in email
      const personalizedSubject = replacePlaceholders(emailData.subject, lead);
      const personalizedBody = replacePlaceholders(emailData.body, lead);

      // Here you would integrate with your email service provider
      // For now, we'll simulate sending
      
      // Create message record
      await app.prisma.message.create({
        data: {
          leadId: lead.id,
          direction: 'OUT',
          channel: 'EMAIL',
          subject: personalizedSubject,
          body: personalizedBody,
          meta: {
            templateId: emailData.templateId,
            segment: emailData.segment,
            sentAt: new Date().toISOString()
          },
          status: 'SENT'
        }
      });

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: lead.id,
          type: 'EMAIL_SENT',
          payload: {
            subject: personalizedSubject,
            segment: emailData.segment,
            templateId: emailData.templateId,
            sentAt: new Date().toISOString()
          }
        }
      });

      results.push({
        leadId: lead.id,
        email: lead.email,
        status: 'sent'
      });

    } catch (error) {
      results.push({
        leadId: lead.id,
        email: lead.email,
        status: 'failed',
        error: 'Failed to send email'
      });
    }
  }

  return results;
}

/**
 * Replace placeholders in email content
 */
function replacePlaceholders(content: string, lead: any): string {
  const placeholders: Record<string, string> = {
    '{{lead.name}}': lead.name || 'there',
    '{{lead.email}}': lead.email || '',
    '{{lead.company}}': lead.company || 'your company',
    '{{lead.jobRole}}': lead.fields?.jobRole || 'professional',
    '{{lead.responseSummary}}': lead.fields?.responseSummary || '',
    '{{channel}}': lead.source || 'our website',
    '{{campaign}}': lead.utm?.campaign || 'campaign',
    '{{score}}': lead.score?.toString() || '0'
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }

  return result;
}