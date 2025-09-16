import { FastifyInstance } from 'fastify';

export interface SyncResult {
  leadId: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  message: string;
  crmId?: string;
  error?: string;
}

export interface CRMContact {
  id: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  lastModified: string;
  customFields: Record<string, any>;
}

/**
 * Pull contacts from CRM and sync to SmartForms
 */
export async function pullFromCRM(
  app: FastifyInstance,
  integration: any
): Promise<SyncResult[]> {
  const { provider, credentials, fieldMappings, syncSettings } = integration.config;
  
  try {
    let crmContacts: CRMContact[] = [];
    
    switch (provider) {
      case 'hubspot':
        crmContacts = await pullFromHubSpot(credentials, syncSettings);
        break;
      case 'salesforce':
        crmContacts = await pullFromSalesforce(credentials, syncSettings);
        break;
      case 'zoho':
        crmContacts = await pullFromZoho(credentials, syncSettings);
        break;
      case 'pipedrive':
        crmContacts = await pullFromPipedrive(credentials, syncSettings);
        break;
      default:
        throw new Error(`Unsupported CRM provider: ${provider}`);
    }

    app.log.info(`Pulled ${crmContacts.length} contacts from ${provider}`);

    // Process each contact
    const results: SyncResult[] = [];
    for (const contact of crmContacts) {
      try {
        const result = await syncCrmContactToLead(
          app, 
          contact, 
          fieldMappings, 
          syncSettings,
          integration.teamId
        );
        results.push(result);
      } catch (error) {
        results.push({
          leadId: '',
          action: 'error',
          message: `Failed to sync contact ${contact.email}`,
          crmId: contact.id,
          error: error.message
        });
      }
    }

    return results;

  } catch (error) {
    app.log.error('Failed to pull from CRM:', error);
    throw error;
  }
}

/**
 * Pull contacts from HubSpot
 */
async function pullFromHubSpot(
  credentials: any, 
  syncSettings: any
): Promise<CRMContact[]> {
  const { api_key } = credentials;
  const { frequency } = syncSettings;
  
  // Calculate time filter based on frequency
  const timeFilter = getTimeFilter(frequency);
  
  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,company,phone,lastmodifieddate&lastmodifieddate__gte=${timeFilter}`,
      {
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.results.map((contact: any) => ({
      id: contact.id,
      email: contact.properties.email,
      name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
      company: contact.properties.company,
      phone: contact.properties.phone,
      lastModified: contact.properties.lastmodifieddate,
      customFields: contact.properties
    }));

  } catch (error) {
    console.error('Failed to pull from HubSpot:', error);
    throw error;
  }
}

/**
 * Pull contacts from Salesforce
 */
async function pullFromSalesforce(
  credentials: any,
  syncSettings: any
): Promise<CRMContact[]> {
  const { client_id, client_secret, username, password, security_token } = credentials;
  const { frequency } = syncSettings;
  
  try {
    // Get OAuth token
    const authResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id,
        client_secret,
        username,
        password: password + (security_token || '')
      })
    });

    if (!authResponse.ok) {
      throw new Error('Salesforce authentication failed');
    }

    const authData = await authResponse.json();
    const timeFilter = getTimeFilter(frequency);
    
    // Query contacts
    const soqlQuery = `SELECT Id, Email, Name, Company, Phone, LastModifiedDate FROM Lead WHERE LastModifiedDate >= ${timeFilter} LIMIT 100`;
    
    const response = await fetch(
      `${authData.instance_url}/services/data/v58.0/query/?q=${encodeURIComponent(soqlQuery)}`,
      {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.records.map((record: any) => ({
      id: record.Id,
      email: record.Email,
      name: record.Name,
      company: record.Company,
      phone: record.Phone,
      lastModified: record.LastModifiedDate,
      customFields: record
    }));

  } catch (error) {
    console.error('Failed to pull from Salesforce:', error);
    throw error;
  }
}

/**
 * Pull contacts from Zoho
 */
async function pullFromZoho(
  credentials: any,
  syncSettings: any
): Promise<CRMContact[]> {
  const { access_token } = credentials;
  const { frequency } = syncSettings;
  
  try {
    const timeFilter = getTimeFilter(frequency);
    
    const response = await fetch(
      `https://www.zohoapis.com/crm/v2/Leads?per_page=100&modified_time=${timeFilter}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Zoho API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return (data.data || []).map((lead: any) => ({
      id: lead.id,
      email: lead.Email,
      name: `${lead.First_Name || ''} ${lead.Last_Name || ''}`.trim(),
      company: lead.Company,
      phone: lead.Phone,
      lastModified: lead.Modified_Time,
      customFields: lead
    }));

  } catch (error) {
    console.error('Failed to pull from Zoho:', error);
    throw error;
  }
}

/**
 * Pull contacts from Pipedrive
 */
async function pullFromPipedrive(
  credentials: any,
  syncSettings: any
): Promise<CRMContact[]> {
  const { api_token, company_domain } = credentials;
  const { frequency } = syncSettings;
  
  try {
    const timeFilter = getTimeFilter(frequency);
    
    const response = await fetch(
      `https://${company_domain}.pipedrive.com/api/v1/persons?api_token=${api_token}&limit=100&start=0`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Pipedrive API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return (data.data || []).map((person: any) => ({
      id: person.id.toString(),
      email: person.email?.[0]?.value,
      name: person.name,
      company: person.org_name,
      phone: person.phone?.[0]?.value,
      lastModified: person.update_time,
      customFields: person
    })).filter((contact: CRMContact) => contact.email); // Only contacts with email

  } catch (error) {
    console.error('Failed to pull from Pipedrive:', error);
    throw error;
  }
}

/**
 * Sync CRM contact to SmartForms lead
 */
async function syncCrmContactToLead(
  app: FastifyInstance,
  contact: CRMContact,
  fieldMappings: Record<string, string>,
  syncSettings: any,
  teamId: string
): Promise<SyncResult> {
  try {
    // Find existing lead
    const existingLead = await app.prisma.lead.findFirst({
      where: {
        OR: [
          { email: contact.email },
          { externalId: contact.id }
        ],
        teamId
      }
    });

    // Map CRM fields to SmartForms fields
    const mappedData = mapCrmFieldsToLead(contact, fieldMappings);

    if (existingLead) {
      // Handle conflict resolution
      const resolvedData = await resolveConflict(
        existingLead,
        mappedData,
        syncSettings.conflictResolution
      );

      // Update existing lead
      const updatedLead = await app.prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          ...resolvedData,
          externalId: contact.id,
          lastSyncedAt: new Date()
        }
      });

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: updatedLead.id,
          type: 'CRM_SYNC_UPDATE',
          payload: {
            crmId: contact.id,
            changes: resolvedData,
            syncedAt: new Date().toISOString()
          }
        }
      });

      return {
        leadId: updatedLead.id,
        action: 'updated',
        message: `Lead updated from CRM`,
        crmId: contact.id
      };

    } else {
      // Create new lead
      const newLead = await app.prisma.lead.create({
        data: {
          teamId,
          ...mappedData,
          externalId: contact.id,
          source: 'crm',
          sourceRef: contact.id,
          status: 'NEW',
          score: 0,
          scoreBand: 'LOW',
          lastSyncedAt: new Date()
        }
      });

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: newLead.id,
          type: 'CRM_SYNC_CREATE',
          payload: {
            crmId: contact.id,
            syncedAt: new Date().toISOString()
          }
        }
      });

      return {
        leadId: newLead.id,
        action: 'created',
        message: `Lead created from CRM`,
        crmId: contact.id
      };
    }

  } catch (error) {
    console.error('Failed to sync CRM contact:', error);
    throw error;
  }
}

/**
 * Resolve conflicts between local lead and CRM contact
 */
async function resolveConflict(
  localLead: any,
  crmData: any,
  strategy: 'smartforms_wins' | 'crm_wins' | 'newest_wins'
): Promise<any> {
  switch (strategy) {
    case 'smartforms_wins':
      // Keep local data, only update if local field is empty
      return {
        ...crmData,
        ...Object.fromEntries(
          Object.entries(localLead).filter(([key, value]) => 
            value !== null && value !== undefined && value !== ''
          )
        )
      };
      
    case 'crm_wins':
      // CRM data overwrites local data
      return crmData;
      
    case 'newest_wins':
      // Compare timestamps and use newest
      const localTime = new Date(localLead.updatedAt || localLead.createdAt);
      const crmTime = new Date(crmData.lastModified);
      
      return crmTime > localTime ? crmData : {
        ...crmData,
        ...Object.fromEntries(
          Object.entries(localLead).filter(([key, value]) => 
            value !== null && value !== undefined && value !== ''
          )
        )
      };
      
    default:
      return crmData;
  }
}

/**
 * Map CRM fields to SmartForms lead fields
 */
function mapCrmFieldsToLead(
  contact: CRMContact,
  fieldMappings: Record<string, string>
): any {
  const mapped: any = {
    email: contact.email,
    name: contact.name,
    company: contact.company,
    phone: contact.phone,
    fields: {}
  };

  // Apply custom field mappings
  for (const [smartformsField, crmField] of Object.entries(fieldMappings)) {
    if (contact.customFields[crmField]) {
      if (['email', 'name', 'company', 'phone'].includes(smartformsField)) {
        mapped[smartformsField] = contact.customFields[crmField];
      } else {
        mapped.fields[smartformsField] = contact.customFields[crmField];
      }
    }
  }

  return mapped;
}

/**
 * Get time filter based on sync frequency
 */
function getTimeFilter(frequency: string): string {
  const now = new Date();
  
  switch (frequency) {
    case 'real_time':
      // Last 5 minutes
      return new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    case 'hourly':
      // Last hour
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case 'daily':
      // Last 24 hours
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    default:
      // Last hour as default
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  }
}
