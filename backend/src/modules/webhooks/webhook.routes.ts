import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { webhookAuth } from '../../middleware/auth';

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
      body: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          data: { type: 'object', additionalProperties: true },
          timestamp: { type: 'number' }
        },
        required: ['event', 'data']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            received: { type: 'boolean' },
            timestamp: { type: 'string' }
          },
          required: ['received', 'timestamp']
        }
      }
    }
  }, async (request, reply) => {
    const payload = request.body as z.infer<typeof webhookPayloadSchema>;

    try {
      // Log the webhook for debugging
      app.log.info('Webhook received:', {
        event: payload.event,
        timestamp: payload.timestamp || Date.now()
      } as any);

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
      app.log.error('Webhook processing failed:', error as any);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  /**
   * POST /webhooks/form/:formId - Form-specific webhook endpoint
   */
  app.post('/webhooks/form/:formId', {
    preHandler: [webhookAuth],
    schema: {
      params: {
        type: 'object',
        properties: {
          formId: { type: 'string' }
        },
        required: ['formId']
      },
      body: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          properties: {
            leadId: { type: 'string' },
            score: { type: 'number' }
          },
          required: ['leadId', 'score']
        }
      }
    }
  }, async (request, reply) => {
    const { formId } = request.params as { formId: string };
    const formData = request.body as Record<string, any>;

    try {
      // Create lead from form submission
      const leadId = await createLeadFromForm(app, formId, formData);
      const score = await calculateLeadScore(app, formData);

      // Update lead with calculated score
      await app.prisma.lead.update({
        where: { id: leadId },
        data: { 
          score, 
          scoreBand: score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW' 
        }
      });

      // Create unibox entry
      await createUniboxEntry(app, leadId, formData, 'form');

      return reply.send({
        leadId,
        score
      });

    } catch (error) {
      app.log.error('Form webhook processing failed:', error as any);
      return reply.code(500).send({ error: 'Form processing failed' });
    }
  });
}

// Helper functions for webhook processing
async function handleLeadCreated(app: FastifyInstance, data: any) {
  app.log.info('Processing lead.created webhook:', data as any);
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
    app.log.error('Error creating lead from form:', error as any);
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
  app.log.info('Processing form.submitted webhook:', data as any);
  
  try {
    // Extract form data
    const { formId, formData, source = 'form' } = data;
    
    if (!formId || !formData) {
      throw new Error('Missing formId or formData in webhook payload');
    }
    
    // Create lead from form submission
    const leadId = await createLeadFromForm(app, formId, formData);
    
    // Calculate lead score
    const score = await calculateLeadScore(app, formData);
    
    // Update lead with calculated score
    await app.prisma.lead.update({
      where: { id: leadId },
      data: { 
        score, 
        scoreBand: score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW' 
      }
    });
    
    // Create unibox message entry
    await createUniboxEntry(app, leadId, formData, source);
    
    app.log.info('Form submission processed successfully', { leadId, score });
    
    return { leadId, score };
  } catch (error) {
    app.log.error('Failed to process form submission:', error);
    throw error;
  }
}

/**
 * Create a unibox entry for the form submission
 */
async function createUniboxEntry(
  app: FastifyInstance,
  leadId: string,
  formData: Record<string, any>,
  source: string
): Promise<string> {
  try {
    // Get lead details
    const lead = await app.prisma.lead.findUnique({
      where: { id: leadId },
      include: { form: true }
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Create message for unibox
    const message = await app.prisma.message.create({
      data: {
        leadId,
        direction: 'IN',
        channel: 'FORM',
        subject: `New form submission: ${lead.form?.name || 'Website Form'}`,
        body: formatFormSubmissionMessage(formData, lead),
        meta: {
          formId: lead.formId,
          formName: lead.form?.name,
          source,
          submissionData: formData,
          timestamp: new Date().toISOString(),
          score: lead.score,
          scoreBand: lead.scoreBand
        },
        status: 'UNREAD'
      }
    });

    // Add timeline event
    await app.prisma.timelineEvent.create({
      data: {
        leadId,
        type: 'FORM_SUBMISSION',
        payload: {
          messageId: message.id,
          formId: lead.formId,
          formName: lead.form?.name,
          submittedData: formData,
          score: lead.score,
          scoreBand: lead.scoreBand,
          submittedAt: new Date().toISOString()
        }
      }
    });

    app.log.info('Created unibox entry for form submission', { 
      leadId, 
      messageId: message.id,
      score: lead.score 
    });

    return message.id;
  } catch (error) {
    app.log.error('Failed to create unibox entry:', error);
    throw error;
  }
}

/**
 * Format form submission data into a readable message
 */
function formatFormSubmissionMessage(
  formData: Record<string, any>,
  lead: any
): string {
  const lines = [
    `New form submission received from ${lead.name || lead.email}`,
    '',
    '📋 **Form Details:**'
  ];

  // Add key form fields
  if (lead.name) lines.push(`👤 **Name:** ${lead.name}`);
  if (lead.email) lines.push(`📧 **Email:** ${lead.email}`);
  if (lead.company) lines.push(`🏢 **Company:** ${lead.company}`);
  if (lead.phone) lines.push(`📞 **Phone:** ${lead.phone}`);

  lines.push('', '📝 **All Submitted Data:**');
  
  // Add all form fields
  Object.entries(formData).forEach(([key, value]) => {
    if (value && typeof value === 'string' && value.trim()) {
      const formattedKey = key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      lines.push(`• **${formattedKey}:** ${value}`);
    }
  });

  // Add scoring information
  lines.push('', '🎯 **Lead Score:**');
  lines.push(`Score: ${lead.score}/100 (${lead.scoreBand})`);

  // Add source information
  if (lead.utm) {
    lines.push('', '📊 **Source Information:**');
    if (lead.utm.source) lines.push(`• **Source:** ${lead.utm.source}`);
    if (lead.utm.medium) lines.push(`• **Medium:** ${lead.utm.medium}`);
    if (lead.utm.campaign) lines.push(`• **Campaign:** ${lead.utm.campaign}`);
  }

  return lines.join('\n');
}

async function handleCrmContactUpdated(app: FastifyInstance, data: any) {
  app.log.info('Processing crm.contact.updated webhook:', data as any);
  // TODO: Implement CRM sync logic
}
