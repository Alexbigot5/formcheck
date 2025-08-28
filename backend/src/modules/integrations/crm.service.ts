import { FastifyInstance } from 'fastify';
import { getCredentials, refreshTokenIfNeeded, OAuthCredentials } from './credential.service.js';

export interface CRMField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'url' | 'textarea' | 'select';
  required: boolean;
  options?: string[]; // For select fields
  description?: string;
}

export interface CRMContact {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  properties: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  contactId?: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  message: string;
  payload?: any;
  duplicatePolicy?: 'skip' | 'update' | 'create_new';
}

/**
 * Get CRM fields for a specific provider
 */
export async function getCRMFields(
  app: FastifyInstance,
  teamId: string,
  provider: string,
  secret: string
): Promise<CRMField[]> {
  const credentials = await refreshTokenIfNeeded(app, teamId, provider, secret);
  
  if (!credentials) {
    throw new Error(`No valid credentials found for ${provider}`);
  }

  switch (provider) {
    case 'hubspot':
      return await getHubSpotFields(credentials);
    case 'salesforce':
      return await getSalesforceFields(credentials);
    default:
      throw new Error(`Unsupported CRM provider: ${provider}`);
  }
}

/**
 * Sync lead to CRM
 */
export async function syncLeadToCRM(
  app: FastifyInstance,
  teamId: string,
  provider: string,
  leadData: any,
  fieldMapping: Record<string, string>,
  secret: string,
  dryRun: boolean = false,
  duplicatePolicy: 'skip' | 'update' | 'create_new' = 'update'
): Promise<SyncResult> {
  const credentials = await refreshTokenIfNeeded(app, teamId, provider, secret);
  
  if (!credentials) {
    return {
      success: false,
      action: 'error',
      message: `No valid credentials found for ${provider}`
    };
  }

  // Map lead data to CRM fields
  const mappedData = mapLeadToCRMFields(leadData, fieldMapping);

  switch (provider) {
    case 'hubspot':
      return await syncToHubSpot(credentials, mappedData, dryRun, duplicatePolicy);
    case 'salesforce':
      return await syncToSalesforce(credentials, mappedData, dryRun, duplicatePolicy);
    default:
      return {
        success: false,
        action: 'error',
        message: `Unsupported CRM provider: ${provider}`
      };
  }
}

/**
 * Get HubSpot contact properties
 */
async function getHubSpotFields(credentials: OAuthCredentials): Promise<CRMField[]> {
  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.results.map((prop: any) => ({
      name: prop.name,
      label: prop.label,
      type: mapHubSpotFieldType(prop.type, prop.fieldType),
      required: prop.required || false,
      options: prop.options?.map((opt: any) => opt.value),
      description: prop.description
    }));
  } catch (error) {
    console.error('HubSpot fields fetch error:', error);
    throw new Error('Failed to fetch HubSpot fields');
  }
}

/**
 * Get Salesforce Contact fields
 */
async function getSalesforceFields(credentials: OAuthCredentials): Promise<CRMField[]> {
  try {
    const response = await fetch(`${credentials.instanceUrl}/services/data/v58.0/sobjects/Contact/describe`, {
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.fields
      .filter((field: any) => field.createable || field.updateable)
      .map((field: any) => ({
        name: field.name,
        label: field.label,
        type: mapSalesforceFieldType(field.type),
        required: !field.nillable && !field.defaultedOnCreate,
        options: field.picklistValues?.map((opt: any) => opt.value),
        description: field.inlineHelpText
      }));
  } catch (error) {
    console.error('Salesforce fields fetch error:', error);
    throw new Error('Failed to fetch Salesforce fields');
  }
}

/**
 * Sync lead to HubSpot
 */
async function syncToHubSpot(
  credentials: OAuthCredentials,
  mappedData: Record<string, any>,
  dryRun: boolean,
  duplicatePolicy: string
): Promise<SyncResult> {
  try {
    const payload = {
      properties: mappedData
    };

    if (dryRun) {
      return {
        success: true,
        action: 'created',
        message: 'Dry run successful - payload validated',
        payload
      };
    }

    // Check for existing contact by email
    let existingContact = null;
    if (mappedData.email) {
      try {
        const searchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: mappedData.email
              }]
            }]
          })
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          existingContact = searchData.results?.[0];
        }
      } catch (searchError) {
        console.warn('HubSpot contact search failed:', searchError);
      }
    }

    // Handle duplicate policy
    if (existingContact) {
      if (duplicatePolicy === 'skip') {
        return {
          success: true,
          contactId: existingContact.id,
          action: 'skipped',
          message: 'Contact already exists, skipped per duplicate policy'
        };
      } else if (duplicatePolicy === 'update') {
        // Update existing contact
        const updateResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existingContact.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!updateResponse.ok) {
          throw new Error(`HubSpot update failed: ${updateResponse.statusText}`);
        }

        const updatedContact = await updateResponse.json();
        return {
          success: true,
          contactId: updatedContact.id,
          action: 'updated',
          message: 'Contact updated successfully',
          payload
        };
      }
    }

    // Create new contact
    const createResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(`HubSpot create failed: ${errorData.message || createResponse.statusText}`);
    }

    const newContact = await createResponse.json();
    return {
      success: true,
      contactId: newContact.id,
      action: 'created',
      message: 'Contact created successfully',
      payload
    };

  } catch (error) {
    return {
      success: false,
      action: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Sync lead to Salesforce
 */
async function syncToSalesforce(
  credentials: OAuthCredentials,
  mappedData: Record<string, any>,
  dryRun: boolean,
  duplicatePolicy: string
): Promise<SyncResult> {
  try {
    if (dryRun) {
      return {
        success: true,
        action: 'created',
        message: 'Dry run successful - payload validated',
        payload: mappedData
      };
    }

    // Check for existing contact by email
    let existingContact = null;
    if (mappedData.Email) {
      try {
        const soql = `SELECT Id FROM Contact WHERE Email = '${mappedData.Email}' LIMIT 1`;
        const searchResponse = await fetch(`${credentials.instanceUrl}/services/data/v58.0/query/?q=${encodeURIComponent(soql)}`, {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          existingContact = searchData.records?.[0];
        }
      } catch (searchError) {
        console.warn('Salesforce contact search failed:', searchError);
      }
    }

    // Handle duplicate policy
    if (existingContact) {
      if (duplicatePolicy === 'skip') {
        return {
          success: true,
          contactId: existingContact.Id,
          action: 'skipped',
          message: 'Contact already exists, skipped per duplicate policy'
        };
      } else if (duplicatePolicy === 'update') {
        // Update existing contact
        const updateResponse = await fetch(`${credentials.instanceUrl}/services/data/v58.0/sobjects/Contact/${existingContact.Id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mappedData)
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(`Salesforce update failed: ${errorData[0]?.message || updateResponse.statusText}`);
        }

        return {
          success: true,
          contactId: existingContact.Id,
          action: 'updated',
          message: 'Contact updated successfully',
          payload: mappedData
        };
      }
    }

    // Create new contact
    const createResponse = await fetch(`${credentials.instanceUrl}/services/data/v58.0/sobjects/Contact`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mappedData)
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(`Salesforce create failed: ${errorData[0]?.message || createResponse.statusText}`);
    }

    const result = await createResponse.json();
    return {
      success: true,
      contactId: result.id,
      action: 'created',
      message: 'Contact created successfully',
      payload: mappedData
    };

  } catch (error) {
    return {
      success: false,
      action: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Map lead data to CRM fields using field mapping
 */
function mapLeadToCRMFields(leadData: any, fieldMapping: Record<string, string>): Record<string, any> {
  const mapped: Record<string, any> = {};

  for (const [leadField, crmField] of Object.entries(fieldMapping)) {
    if (leadData[leadField] !== undefined && leadData[leadField] !== null) {
      mapped[crmField] = leadData[leadField];
    }
  }

  return mapped;
}

/**
 * Map HubSpot field types to standard types
 */
function mapHubSpotFieldType(type: string, fieldType?: string): CRMField['type'] {
  switch (type) {
    case 'string':
      return fieldType === 'textarea' ? 'textarea' : 'string';
    case 'number':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'datetime':
    case 'date':
      return 'date';
    case 'enumeration':
      return 'select';
    default:
      return 'string';
  }
}

/**
 * Map Salesforce field types to standard types
 */
function mapSalesforceFieldType(type: string): CRMField['type'] {
  switch (type) {
    case 'string':
    case 'id':
      return 'string';
    case 'textarea':
      return 'textarea';
    case 'int':
    case 'double':
    case 'currency':
    case 'percent':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
      return 'date';
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'url':
      return 'url';
    case 'picklist':
    case 'multipicklist':
      return 'select';
    default:
      return 'string';
  }
}
