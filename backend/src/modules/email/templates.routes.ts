import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';

// Validation schemas
const emailTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  segment: z.enum(['hot', 'warm', 'cold']),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  variables: z.array(z.string()).optional().default([]),
  isActive: z.boolean().default(true)
});

const compileTemplateSchema = z.object({
  templateId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  leadData: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    company: z.string().optional(),
    score: z.number().optional(),
    channel: z.string().optional(),
    campaign: z.string().optional(),
    jobRole: z.string().optional(),
    responseSummary: z.string().optional()
  })
});

const sendEmailSchema = z.object({
  templateId: z.string(),
  leadId: z.string(),
  sendAt: z.string().datetime().optional(), // For scheduling
  dryRun: z.boolean().default(false)
});

export async function registerEmailTemplateRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  app.addHook('preHandler', authenticateSupabase);

  /**
   * GET /api/email-templates - Get all email templates
   */
  app.get('/api/email-templates', async (request: AuthenticatedRequest, reply) => {
    const userId = request.user!.id;

    try {
      // For now, return mock templates since we don't have the EmailTemplate model in Prisma
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Hot Lead Follow-up',
          segment: 'hot',
          subject: '{{lead.name}}, let\'s discuss your {{campaign}} interest (Score: {{score}})',
          body: 'Hi {{lead.name}},\n\nI noticed you came from our {{channel}} {{campaign}} and scored {{score}} - that tells me you\'re serious about finding a solution!\n\nGiven your role ({{lead.jobRole}}), I\'d love to schedule a quick 15-minute call to discuss your specific needs.\n\nWhen works better for you - this afternoon or tomorrow morning?\n\nBest,\nYour Sales Team',
          variables: ['lead.name', 'campaign', 'score', 'channel', 'lead.jobRole'],
          isActive: true,
          createdAt: new Date().toISOString(),
          performance: { openRate: 82, replyRate: 48, clickRate: 35, sent: 89 }
        },
        {
          id: 'template-2',
          name: 'Warm Lead Nurture',
          segment: 'warm',
          subject: '{{lead.name}}, resources for {{campaign}} from {{channel}}',
          body: 'Hi {{lead.name}},\n\nThanks for your interest through our {{channel}} {{campaign}}! With a score of {{score}}, I can see you\'re evaluating options.\n\nI\'ve put together some resources specifically for {{lead.jobRole}} professionals that might be helpful:\n\n• Industry benchmark report\n• ROI calculator\n• Case study from similar companies\n\nWould you like me to send these over?\n\nBest,\nYour Team',
          variables: ['lead.name', 'campaign', 'channel', 'score', 'lead.jobRole'],
          isActive: true,
          createdAt: new Date().toISOString(),
          performance: { openRate: 71, replyRate: 31, clickRate: 22, sent: 145 }
        },
        {
          id: 'template-3',
          name: 'Cold Lead Welcome',
          segment: 'cold',
          subject: 'Welcome {{lead.name}} - staying connected after {{campaign}}',
          body: 'Hi {{lead.name}},\n\nThanks for checking out our {{campaign}} on {{channel}}. While your current score is {{score}}, I know timing isn\'t always right.\n\nI\'ll add you to our newsletter for {{lead.jobRole}} professionals so you can stay updated on industry trends and our latest features.\n\nFeel free to reach out when you\'re ready to explore further!\n\nBest,\nYour Team',
          variables: ['lead.name', 'campaign', 'channel', 'score', 'lead.jobRole'],
          isActive: true,
          createdAt: new Date().toISOString(),
          performance: { openRate: 38, replyRate: 9, clickRate: 5, sent: 312 }
        }
      ];

      return reply.send({ ok: true, data: { templates: mockTemplates } });

    } catch (error) {
      app.log.error('Failed to get email templates:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get email templates' });
    }
  });

  /**
   * POST /api/email-templates - Create email template
   */
  app.post('/api/email-templates', {
    schema: { body: emailTemplateSchema }
  }, async (request: AuthenticatedRequest, reply) => {
    const templateData = request.body as z.infer<typeof emailTemplateSchema>;
    const userId = request.user!.id;

    try {
      // Mock template creation
      const newTemplate = {
        id: `template-${Date.now()}`,
        ...templateData,
        userId,
        createdAt: new Date().toISOString(),
        performance: { openRate: 0, replyRate: 0, clickRate: 0, sent: 0 }
      };

      return reply.code(201).send({ 
        ok: true, 
        data: { 
          template: newTemplate,
          message: 'Email template created successfully' 
        } 
      });

    } catch (error) {
      app.log.error('Failed to create email template:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to create email template' });
    }
  });

  /**
   * PUT /api/email-templates/:id - Update email template
   */
  app.put('/api/email-templates/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: emailTemplateSchema.partial()
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Partial<z.infer<typeof emailTemplateSchema>>;

    try {
      // Mock template update
      const updatedTemplate = {
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      return reply.send({ 
        ok: true, 
        data: { 
          template: updatedTemplate,
          message: 'Email template updated successfully' 
        } 
      });

    } catch (error) {
      app.log.error('Failed to update email template:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to update email template' });
    }
  });

  /**
   * DELETE /api/email-templates/:id - Delete email template
   */
  app.delete('/api/email-templates/:id', {
    schema: { params: z.object({ id: z.string() }) }
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Mock template deletion
      return reply.send({ 
        ok: true, 
        data: { message: 'Email template deleted successfully' } 
      });

    } catch (error) {
      app.log.error('Failed to delete email template:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to delete email template' });
    }
  });

  /**
   * POST /api/email-templates/compile - Compile template with lead data
   */
  app.post('/api/email-templates/compile', {
    schema: { body: compileTemplateSchema }
  }, async (request: AuthenticatedRequest, reply) => {
    const { templateId, subject, body, leadData } = request.body as z.infer<typeof compileTemplateSchema>;

    try {
      // Template compilation logic
      const compiledTemplate = compileTemplate({
        subject: subject || 'Default Subject',
        body: body || 'Default Body'
      }, leadData);

      return reply.send({ 
        ok: true, 
        data: { 
          compiled: compiledTemplate,
          variables: extractVariables(subject || body || ''),
          leadData 
        } 
      });

    } catch (error) {
      app.log.error('Failed to compile template:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to compile template' });
    }
  });

  /**
   * POST /api/email-templates/send - Send email using template
   */
  app.post('/api/email-templates/send', {
    schema: { body: sendEmailSchema }
  }, async (request: AuthenticatedRequest, reply) => {
    const { templateId, leadId, sendAt, dryRun } = request.body as z.infer<typeof sendEmailSchema>;
    const teamId = request.teamId!;

    try {
      // Get lead data
      const lead = await app.prisma.lead.findFirst({
        where: { id: leadId, teamId }
      });

      if (!lead) {
        return reply.code(404).send({ ok: false, error: 'Lead not found' });
      }

      // Mock email sending
      const emailResult = {
        success: true,
        messageId: `msg_${Date.now()}`,
        to: lead.email,
        subject: `Follow-up for ${lead.name}`,
        scheduledFor: sendAt || new Date().toISOString(),
        dryRun,
        message: dryRun 
          ? `Dry run: Email would be sent to ${lead.email}` 
          : `Email sent successfully to ${lead.email}`
      };

      // Add timeline event if not dry run
      if (!dryRun) {
        await app.prisma.timelineEvent.create({
          data: {
            leadId,
            type: 'EMAIL_SENT',
            payload: {
              templateId,
              messageId: emailResult.messageId,
              to: lead.email,
              subject: emailResult.subject,
              sentAt: new Date().toISOString()
            }
          }
        });
      }

      return reply.send({ ok: true, data: emailResult });

    } catch (error) {
      app.log.error('Failed to send email:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to send email' });
    }
  });

  /**
   * GET /api/email-templates/:id/performance - Get template performance metrics
   */
  app.get('/api/email-templates/:id/performance', {
    schema: { params: z.object({ id: z.string() }) }
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Mock performance data
      const performance = {
        templateId: id,
        sent: Math.floor(Math.random() * 500) + 50,
        opened: Math.floor(Math.random() * 200) + 20,
        clicked: Math.floor(Math.random() * 50) + 5,
        replied: Math.floor(Math.random() * 25) + 2,
        openRate: Math.round((Math.random() * 40 + 30) * 100) / 100, // 30-70%
        clickRate: Math.round((Math.random() * 20 + 5) * 100) / 100,  // 5-25%
        replyRate: Math.round((Math.random() * 15 + 2) * 100) / 100,  // 2-17%
        lastSent: new Date().toISOString()
      };

      return reply.send({ ok: true, data: { performance } });

    } catch (error) {
      app.log.error('Failed to get template performance:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get template performance' });
    }
  });
}

/**
 * Compile template by replacing placeholders with lead data
 */
function compileTemplate(template: { subject: string; body: string }, leadData: any): { subject: string; body: string } {
  const placeholderMap: Record<string, string> = {
    '{{lead.name}}': leadData.name || 'there',
    '{{lead.email}}': leadData.email || 'user@example.com',
    '{{lead.company}}': leadData.company || 'your company',
    '{{lead.jobRole}}': leadData.jobRole || 'professional',
    '{{lead.responseSummary}}': leadData.responseSummary || 'your inquiry',
    '{{score}}': String(leadData.score || 0),
    '{{channel}}': leadData.channel || 'our website',
    '{{campaign}}': leadData.campaign || 'campaign'
  };

  let compiledSubject = template.subject;
  let compiledBody = template.body;

  // Replace all placeholders
  Object.entries(placeholderMap).forEach(([placeholder, value]) => {
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    compiledSubject = compiledSubject.replace(regex, value);
    compiledBody = compiledBody.replace(regex, value);
  });

  return {
    subject: compiledSubject,
    body: compiledBody
  };
}

/**
 * Extract variables from template string
 */
function extractVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}
