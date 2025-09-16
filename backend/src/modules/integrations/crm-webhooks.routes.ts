import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

// Validation schemas for different CRM webhook payloads
const hubspotWebhookSchema = z.object({
  subscriptionId: z.number(),
  portalId: z.number(),
  appId: z.number(),
  eventId: z.number(),
  subscriptionType: z.string(),
  attemptNumber: z.number(),
  objectId: z.number(),
  changeSource: z.string(),
  eventType: z.string(),
  propertyName: z.string().optional(),
  propertyValue: z.any().optional()
});

const salesforceWebhookSchema = z.object({
  organizationId: z.string(),
  actionId: z.string(),
  sobjectType: z.string(),
  sobjectId: z.string(),
  changeType: z.enum(['created', 'updated', 'deleted']),
  changedFields: z.array(z.string()).optional(),
  sobject: z.record(z.any())
});

const zohoWebhookSchema = z.object({
  module: z.string(),
  operation: z.enum(['create', 'edit', 'delete']),
  resource_uri: z.string(),
  ids: z.array(z.string()),
  data: z.array(z.record(z.any()))
});

const pipedriveWebhookSchema = z.object({
  event: z.string(),
  user_id: z.number(),
  company_id: z.number(),
  timestamp: z.string(),
  data: z.record(z.any()),
  previous_data: z.record(z.any()).optional(),
  retry: z.number().optional()
});

export async function registerCrmWebhookRoutes(app: FastifyInstance) {
  
  /**
   * POST /webhooks/crm/hubspot - HubSpot webhook endpoint
   */
  app.post('/webhooks/crm/hubspot', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          'x-hubspot-signature': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Verify HubSpot signature
      const signature = request.headers['x-hubspot-signature'] as string;
      if (!verifyHubSpotSignature(request.body, signature)) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      const webhookData = hubspotWebhookSchema.parse(request.body);
      
      // Process HubSpot webhook
      await processHubSpotWebhook(app, webhookData);
      
      return reply.send({ success: true });

    } catch (error: any) {
      app.log.error('HubSpot webhook processing failed:', error);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  /**
   * POST /webhooks/crm/salesforce - Salesforce webhook endpoint
   */
  app.post('/webhooks/crm/salesforce', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          'authorization': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Verify Salesforce authentication
      const auth = request.headers.authorization as string;
      if (!verifySalesforceAuth(auth)) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const webhookData = salesforceWebhookSchema.parse(request.body);
      
      // Process Salesforce webhook
      await processSalesforceWebhook(app, webhookData);
      
      return reply.send({ success: true });

    } catch (error: any) {
      app.log.error('Salesforce webhook processing failed:', error);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  /**
   * POST /webhooks/crm/zoho - Zoho webhook endpoint
   */
  app.post('/webhooks/crm/zoho', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          'x-zoho-webhook-signature': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Verify Zoho signature
      const signature = request.headers['x-zoho-webhook-signature'] as string;
      if (!verifyZohoSignature(request.body, signature)) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      const webhookData = zohoWebhookSchema.parse(request.body);
      
      // Process Zoho webhook
      await processZohoWebhook(app, webhookData);
      
      return reply.send({ success: true });

    } catch (error: any) {
      app.log.error('Zoho webhook processing failed:', error);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  /**
   * POST /webhooks/crm/pipedrive - Pipedrive webhook endpoint
   */
  app.post('/webhooks/crm/pipedrive', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          'authorization': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Verify Pipedrive authentication
      const auth = request.headers.authorization as string;
      if (!verifyPipedriveAuth(auth)) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const webhookData = pipedriveWebhookSchema.parse(request.body);
      
      // Process Pipedrive webhook
      await processPipedriveWebhook(app, webhookData);
      
      return reply.send({ success: true });

    } catch (error: any) {
      app.log.error('Pipedrive webhook processing failed:', error);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });
}

/**
 * Process HubSpot webhook
 */
async function processHubSpotWebhook(
  app: FastifyInstance,
  webhookData: z.infer<typeof hubspotWebhookSchema>
): Promise<void> {
  try {
    // Find integration for this portal
    const integration = await app.prisma.integration.findFirst({
      where: {
        kind: 'CRM',
        'config.provider': 'hubspot',
        'config.portalId': webhookData.portalId.toString()
      }
    });

    if (!integration) {
      app.log.warn('No integration found for HubSpot webhook', { portalId: webhookData.portalId });
      return;
    }

    // Only process contact updates
    if (webhookData.subscriptionType !== 'contact.propertyChange') {
      return;
    }

    // Get the full contact data from HubSpot
    const contactData = await fetchHubSpotContact(
      integration.config.credentials.api_key,
      webhookData.objectId
    );

    if (contactData) {
      await syncSingleContact(app, integration, contactData, 'hubspot');
    }

  } catch (error) {
    app.log.error('Failed to process HubSpot webhook:', error);
  }
}

/**
 * Process Salesforce webhook
 */
async function processSalesforceWebhook(
  app: FastifyInstance,
  webhookData: z.infer<typeof salesforceWebhookSchema>
): Promise<void> {
  try {
    // Find integration for this organization
    const integration = await app.prisma.integration.findFirst({
      where: {
        kind: 'CRM',
        'config.provider': 'salesforce',
        'config.organizationId': webhookData.organizationId
      }
    });

    if (!integration) {
      app.log.warn('No integration found for Salesforce webhook', { 
        organizationId: webhookData.organizationId 
      });
      return;
    }

    // Only process Lead updates
    if (webhookData.sobjectType !== 'Lead') {
      return;
    }

    // Process the change
    await syncSingleContact(app, integration, webhookData.sobject, 'salesforce');

  } catch (error) {
    app.log.error('Failed to process Salesforce webhook:', error);
  }
}

/**
 * Process Zoho webhook
 */
async function processZohoWebhook(
  app: FastifyInstance,
  webhookData: z.infer<typeof zohoWebhookSchema>
): Promise<void> {
  try {
    // Find integration for Zoho
    const integration = await app.prisma.integration.findFirst({
      where: {
        kind: 'CRM',
        'config.provider': 'zoho'
      }
    });

    if (!integration) {
      app.log.warn('No integration found for Zoho webhook');
      return;
    }

    // Only process Lead module updates
    if (webhookData.module !== 'Leads') {
      return;
    }

    // Process each lead in the webhook
    for (const leadData of webhookData.data) {
      await syncSingleContact(app, integration, leadData, 'zoho');
    }

  } catch (error) {
    app.log.error('Failed to process Zoho webhook:', error);
  }
}

/**
 * Process Pipedrive webhook
 */
async function processPipedriveWebhook(
  app: FastifyInstance,
  webhookData: z.infer<typeof pipedriveWebhookSchema>
): Promise<void> {
  try {
    // Find integration for this company
    const integration = await app.prisma.integration.findFirst({
      where: {
        kind: 'CRM',
        'config.provider': 'pipedrive',
        'config.companyId': webhookData.company_id.toString()
      }
    });

    if (!integration) {
      app.log.warn('No integration found for Pipedrive webhook', { 
        companyId: webhookData.company_id 
      });
      return;
    }

    // Only process person events
    if (!webhookData.event.startsWith('person.')) {
      return;
    }

    // Process the person data
    await syncSingleContact(app, integration, webhookData.data, 'pipedrive');

  } catch (error) {
    app.log.error('Failed to process Pipedrive webhook:', error);
  }
}

/**
 * Sync a single contact from CRM webhook
 */
async function syncSingleContact(
  app: FastifyInstance,
  integration: any,
  contactData: any,
  provider: string
): Promise<void> {
  try {
    // Import the sync service
    const { syncCrmContactToLead } = await import('./crm-sync.service');
    
    // Convert contact data to standard format
    const standardContact = convertToStandardContact(contactData, provider);
    
    if (!standardContact.email) {
      app.log.debug('Skipping contact without email', { provider, contactId: standardContact.id });
      return;
    }

    // Sync the contact
    const result = await syncCrmContactToLead(
      app,
      standardContact,
      integration.config.fieldMappings || {},
      integration.config.syncSettings || { conflictResolution: 'crm_wins' },
      integration.teamId
    );

    app.log.info('Webhook contact synced', {
      provider,
      contactId: standardContact.id,
      leadId: result.leadId,
      action: result.action
    });

  } catch (error) {
    app.log.error('Failed to sync webhook contact:', error);
  }
}

/**
 * Convert provider-specific contact data to standard format
 */
function convertToStandardContact(contactData: any, provider: string): any {
  switch (provider) {
    case 'hubspot':
      return {
        id: contactData.id || contactData.vid,
        email: contactData.properties?.email || contactData['email'],
        name: `${contactData.properties?.firstname || ''} ${contactData.properties?.lastname || ''}`.trim(),
        company: contactData.properties?.company,
        phone: contactData.properties?.phone,
        lastModified: contactData.properties?.lastmodifieddate || new Date().toISOString(),
        customFields: contactData.properties || contactData
      };
      
    case 'salesforce':
      return {
        id: contactData.Id,
        email: contactData.Email,
        name: contactData.Name || contactData.FirstName + ' ' + contactData.LastName,
        company: contactData.Company,
        phone: contactData.Phone,
        lastModified: contactData.LastModifiedDate || new Date().toISOString(),
        customFields: contactData
      };
      
    case 'zoho':
      return {
        id: contactData.id,
        email: contactData.Email,
        name: `${contactData.First_Name || ''} ${contactData.Last_Name || ''}`.trim(),
        company: contactData.Company,
        phone: contactData.Phone,
        lastModified: contactData.Modified_Time || new Date().toISOString(),
        customFields: contactData
      };
      
    case 'pipedrive':
      return {
        id: contactData.id?.toString(),
        email: contactData.email?.[0]?.value || contactData.email,
        name: contactData.name,
        company: contactData.org_name,
        phone: contactData.phone?.[0]?.value || contactData.phone,
        lastModified: contactData.update_time || new Date().toISOString(),
        customFields: contactData
      };
      
    default:
      return contactData;
  }
}

/**
 * Fetch full contact data from HubSpot
 */
async function fetchHubSpotContact(apiKey: string, contactId: number): Promise<any> {
  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,company,phone,lastmodifieddate`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch HubSpot contact:', error);
    return null;
  }
}

// Signature verification functions
function verifyHubSpotSignature(payload: any, signature: string): boolean {
  // Implement HubSpot signature verification
  // This should use your HubSpot client secret to verify the webhook
  return true; // Placeholder - implement actual verification
}

function verifySalesforceAuth(auth: string): boolean {
  // Implement Salesforce authentication verification
  return true; // Placeholder - implement actual verification
}

function verifyZohoSignature(payload: any, signature: string): boolean {
  // Implement Zoho signature verification
  return true; // Placeholder - implement actual verification
}

function verifyPipedriveAuth(auth: string): boolean {
  // Implement Pipedrive authentication verification
  return true; // Placeholder - implement actual verification
}
