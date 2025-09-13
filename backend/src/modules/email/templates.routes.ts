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
  app.post('/api/email-templates', async (request: AuthenticatedRequest, reply) => {
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
  app.put('/api/email-templates/:id', async (request: AuthenticatedRequest, reply) => {
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
  app.delete('/api/email-templates/:id', async (request: AuthenticatedRequest, reply) => {
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
  app.post('/api/email-templates/compile', async (request: AuthenticatedRequest, reply) => {
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
          compiledSubject: compiledTemplate.subject,
          compiledBody: compiledTemplate.body 
        } 
      });

    } catch (error) {
      app.log.error('Template compilation failed:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to compile template' });
    }
  });

  /**
   * POST /api/email-templates/send - Send email using a template
   */
  app.post('/api/email-templates/send', async (request: AuthenticatedRequest, reply) => {
    const { templateId, leadId, sendAt, dryRun } = request.body as z.infer<typeof sendEmailSchema>;

    try {
      // For now, just return a mock response
      const result = {
        success: true,
        message: dryRun ? 'Dry run: Email would be sent' : 'Email sent successfully',
        details: {
          templateId,
          leadId,
          sendAt: sendAt || new Date().toISOString()
        }
      };

      return reply.send({ ok: true, data: result });

    } catch (error) {
      app.log.error('Failed to send email:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to send email' });
    }
  });

  /**
   * GET /api/email-templates/:id - Get a single email template
   */
  app.get('/api/email-templates/:id', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Return a mock template
      const template = {
        id,
        name: 'Sample Template',
        segment: 'warm',
        subject: 'Hello {{lead.name}}',
        body: 'Hi {{lead.name}}, this is a sample template.',
        variables: ['lead.name'],
        isActive: true,
        createdAt: new Date().toISOString()
      };

      return reply.send({ ok: true, data: { template } });

    } catch (error) {
      app.log.error('Failed to get email template:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get email template' });
    }
  });
}

function compileTemplate(template: { subject: string; body: string }, leadData: any) {
  let compiledSubject = template.subject;
  let compiledBody = template.body;

  const replacements: Record<string, any> = {
    '{{lead.name}}': leadData?.name || 'there',
    '{{campaign}}': leadData?.campaign || 'our campaign',
    '{{channel}}': leadData?.channel || 'web',
    '{{score}}': leadData?.score?.toString() || '0',
    '{{lead.jobRole}}': leadData?.jobRole || 'professional',
  };

  for (const [key, value] of Object.entries(replacements)) {
    compiledSubject = compiledSubject.replaceAll(key, String(value));
    compiledBody = compiledBody.replaceAll(key, String(value));
  }

  return { subject: compiledSubject, body: compiledBody };
}
