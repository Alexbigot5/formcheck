import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { webhookAuth } from '../../middleware/auth.js';

// Validation schemas
const webhookPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.any()),
  timestamp: z.number().optional()
});

export async function registerWebhookRoutes(app: FastifyInstance) {
  
  /**
   * POST /webhooks/generic - Generic webhook endpoint with HMAC verification
   */
  app.post('/webhooks/generic', {
    preHandler: [webhookAuth],
    schema: {
      body: webhookPayloadSchema,
      response: {
        200: z.object({
          received: z.boolean(),
          timestamp: z.string()
        })
      }
    }
  }, async (request, reply) => {
    const payload = request.body as z.infer<typeof webhookPayloadSchema>;

    try {
      // Log the webhook for debugging
      app.log.info('Webhook received:', {
        event: payload.event,
        timestamp: payload.timestamp || Date.now()
      });

      // TODO: Process webhook based on event type
      // This is where you'd implement lead creation, CRM sync, etc.
      
      switch (payload.event) {
        case 'lead.created':
          await handleLeadCreated(app, payload.data);
          break;
        case 'form.submitted':
          await handleFormSubmitted(app, payload.data);
          break;
        case 'crm.contact.updated':
          await handleCrmContactUpdated(app, payload.data);
          break;
        default:
          app.log.warn(`Unknown webhook event: ${payload.event}`);
      }

      return reply.send({
        received: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      app.log.error('Webhook processing failed:', error);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  /**
   * POST /webhooks/form/:formId - Form-specific webhook endpoint
   */
  app.post('/webhooks/form/:formId', {
    preHandler: [webhookAuth],
    schema: {
      params: z.object({
        formId: z.string().cuid()
      }),
      body: z.record(z.any()),
      response: {
        200: z.object({
          leadId: z.string(),
          score: z.number()
        })
      }
    }
  }, async (request, reply) => {
    const { formId } = request.params as { formId: string };
    const formData = request.body as Record<string, any>;

    try {
      // TODO: Create lead from form submission
      const leadId = await createLeadFromForm(app, formId, formData);
      const score = await calculateLeadScore(app, formData);

      return reply.send({
        leadId,
        score
      });

    } catch (error) {
      app.log.error('Form webhook processing failed:', error);
      return reply.code(500).send({ error: 'Form processing failed' });
    }
  });
}

// Helper functions for webhook processing
async function handleLeadCreated(app: FastifyInstance, data: any) {
  app.log.info('Processing lead.created webhook:', data);
  // TODO: Implement lead creation logic
}

/**
 * Create lead from form submission
 */
async function createLeadFromForm(
  app: FastifyInstance,
  formId: string,
  formData: Record<string, any>
): Promise<string> {
  try {
    // Get form to determine team
    const form = await app.prisma.form.findUnique({
      where: { id: formId },
      include: { team: true }
    });

    if (!form) {
      throw new Error('Form not found');
    }

    // Extract standard fields from form data
    const email = formData.email || formData.Email || formData.EMAIL;
    const name = formData.name || formData.Name || formData.fullName || formData.full_name;
    const phone = formData.phone || formData.Phone || formData.phoneNumber;
    const company = formData.company || formData.Company || formData.companyName;

    // Extract UTM parameters
    const utm = {
      source: formData.utm_source || formData.utmSource || 'form',
      medium: formData.utm_medium || formData.utmMedium || 'website',
      campaign: formData.utm_campaign || formData.utmCampaign || form.name,
      term: formData.utm_term || formData.utmTerm,
      content: formData.utm_content || formData.utmContent
    };

    // Create lead
    const lead = await app.prisma.lead.create({
      data: {
        formId,
        teamId: form.teamId!,
        email,
        name,
        phone,
        company,
        source: 'form',
        sourceRef: formId,
        fields: formData, // Store all form data
        utm,
        score: 0, // Will be calculated next
        scoreBand: 'LOW',
        status: 'NEW'
      }
    });

    // Add timeline event
    await app.prisma.timelineEvent.create({
      data: {
        leadId: lead.id,
        type: 'FORM_SUBMISSION',
        payload: {
          formId,
          formName: form.name,
          submittedData: formData,
          submittedAt: new Date().toISOString()
        }
      }
    });

    return lead.id;
  } catch (error) {
    app.log.error('Error creating lead from form:', error);
    throw error;
  }
}

/**
 * Calculate lead score (simplified version)
 */
async function calculateLeadScore(
  app: FastifyInstance,
  formData: Record<string, any>
): Promise<number> {
  let score = 0;

  // Basic scoring logic
  if (formData.email) score += 10;
  if (formData.name) score += 5;
  if (formData.company) score += 15;
  if (formData.phone) score += 8;
  if (formData.budget && parseFloat(formData.budget) > 10000) score += 20;
  if (formData.timeline === 'immediate' || formData.timeline === 'asap') score += 15;

  // Company size scoring
  const companySize = formData.companySize || formData.company_size;
  if (companySize) {
    if (companySize === 'enterprise' || companySize === '500+') score += 25;
    else if (companySize === 'large' || companySize === '100-500') score += 15;
    else if (companySize === 'medium' || companySize === '50-100') score += 10;
  }

  // Job title scoring
  const title = (formData.title || formData.jobTitle || '').toLowerCase();
  if (title.includes('ceo') || title.includes('founder') || title.includes('president')) score += 20;
  else if (title.includes('director') || title.includes('vp') || title.includes('manager')) score += 15;
  else if (title.includes('lead') || title.includes('head')) score += 10;

  return Math.min(score, 100); // Cap at 100
}

async function handleFormSubmitted(app: FastifyInstance, data: any) {
  app.log.info('Processing form.submitted webhook:', data);
  // TODO: Implement form submission logic
}

async function handleCrmContactUpdated(app: FastifyInstance, data: any) {
  app.log.info('Processing crm.contact.updated webhook:', data);
  // TODO: Implement CRM sync logic
}

async function createLeadFromForm(app: FastifyInstance, formId: string, formData: Record<string, any>): Promise<string> {
  // TODO: Implement lead creation from form data
  app.log.info('Creating lead from form:', { formId, formData });
  return 'temp-lead-id';
}

async function calculateLeadScore(app: FastifyInstance, formData: Record<string, any>): Promise<number> {
  // TODO: Implement lead scoring logic
  app.log.info('Calculating lead score:', formData);
  return 50; // Default score
}
