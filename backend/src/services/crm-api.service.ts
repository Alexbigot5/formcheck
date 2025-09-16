import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { getCredentials, refreshTokenIfNeeded } from '../modules/integrations/credential.service';

export interface CRMContact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  customFields: Record<string, any>;
  lastModified: Date;
}

export interface CRMSyncResult {
  success: boolean;
  contactId?: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  message: string;
  errors?: string[];
}

export interface CRMField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone';
  required: boolean;
  options?: string[];
}

/**
 * HubSpot CRM API Service
 */
export class HubSpotService {
  private baseUrl = 'https://api.hubapi.com';

  async getContacts(credentials: any, limit = 100, after?: string): Promise<{ contacts: CRMContact[], hasMore: boolean, nextAfter?: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/crm/v3/objects/contacts`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit,
          after,
          properties: 'email,firstname,lastname,company,phone,lastmodifieddate'
        }
      });

      const contacts: CRMContact[] = response.data.results.map((contact: any) => ({
        id: contact.id,
        email: contact.properties.email || '',
        firstName: contact.properties.firstname || '',
        lastName: contact.properties.lastname || '',
        company: contact.properties.company || '',
        phone: contact.properties.phone || '',
        customFields: contact.properties,
        lastModified: new Date(contact.properties.lastmodifieddate)
      }));

      return {
        contacts,
        hasMore: !!response.data.paging?.next,
        nextAfter: response.data.paging?.next?.after
      };
    } catch (error) {
      console.error('HubSpot API error:', error);
      throw new Error(`HubSpot API error: ${error.response?.data?.message || error.message}`);
    }
  }

  async createContact(credentials: any, contactData: Partial<CRMContact>): Promise<CRMSyncResult> {
    try {
      const properties: any = {
        email: contactData.email,
        firstname: contactData.firstName,
        lastname: contactData.lastName,
        company: contactData.company,
        phone: contactData.phone,
        ...contactData.customFields
      };

      const response = await axios.post(`${this.baseUrl}/crm/v3/objects/contacts`, {
        properties
      }, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        contactId: response.data.id,
        action: 'created',
        message: 'Contact created successfully in HubSpot'
      };
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Contact already exists, try to update
        return await this.updateContactByEmail(credentials, contactData);
      }

      return {
        success: false,
        action: 'error',
        message: `Failed to create HubSpot contact: ${error.response?.data?.message || error.message}`,
        errors: error.response?.data?.errors || []
      };
    }
  }

  async updateContactByEmail(credentials: any, contactData: Partial<CRMContact>): Promise<CRMSyncResult> {
    try {
      // First, find the contact by email
      const searchResponse = await axios.post(`${this.baseUrl}/crm/v3/objects/contacts/search`, {
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: contactData.email
          }]
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (searchResponse.data.results.length === 0) {
        // Contact doesn't exist, create it
        return await this.createContact(credentials, contactData);
      }

      const contactId = searchResponse.data.results[0].id;
      const properties: any = {
        firstname: contactData.firstName,
        lastname: contactData.lastName,
        company: contactData.company,
        phone: contactData.phone,
        ...contactData.customFields
      };

      await axios.patch(`${this.baseUrl}/crm/v3/objects/contacts/${contactId}`, {
        properties
      }, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        contactId,
        action: 'updated',
        message: 'Contact updated successfully in HubSpot'
      };
    } catch (error: any) {
      return {
        success: false,
        action: 'error',
        message: `Failed to update HubSpot contact: ${error.response?.data?.message || error.message}`,
        errors: error.response?.data?.errors || []
      };
    }
  }

  async getFields(credentials: any): Promise<CRMField[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/crm/v3/properties/contacts`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.results.map((field: any) => ({
        name: field.name,
        label: field.label,
        type: this.mapHubSpotFieldType(field.type),
        required: field.required || false,
        options: field.options?.map((opt: any) => opt.label) || []
      }));
    } catch (error) {
      console.error('HubSpot fields API error:', error);
      throw new Error(`Failed to fetch HubSpot fields: ${error.response?.data?.message || error.message}`);
    }
  }

  private mapHubSpotFieldType(hubspotType: string): CRMField['type'] {
    switch (hubspotType) {
      case 'string':
      case 'enumeration':
        return 'string';
      case 'number':
        return 'number';
      case 'bool':
        return 'boolean';
      case 'date':
      case 'datetime':
        return 'date';
      default:
        return 'string';
    }
  }
}

/**
 * Salesforce CRM API Service
 */
export class SalesforceService {
  async getContacts(credentials: any, limit = 200): Promise<{ contacts: CRMContact[], hasMore: boolean }> {
    try {
      const query = `SELECT Id, Email, FirstName, LastName, Company, Phone, LastModifiedDate FROM Contact LIMIT ${limit}`;
      const response = await axios.get(`${credentials.instanceUrl}/services/data/v57.0/query`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: { q: query }
      });

      const contacts: CRMContact[] = response.data.records.map((contact: any) => ({
        id: contact.Id,
        email: contact.Email || '',
        firstName: contact.FirstName || '',
        lastName: contact.LastName || '',
        company: contact.Company || '',
        phone: contact.Phone || '',
        customFields: contact,
        lastModified: new Date(contact.LastModifiedDate)
      }));

      return {
        contacts,
        hasMore: !response.data.done
      };
    } catch (error) {
      console.error('Salesforce API error:', error);
      throw new Error(`Salesforce API error: ${error.response?.data?.message || error.message}`);
    }
  }

  async createContact(credentials: any, contactData: Partial<CRMContact>): Promise<CRMSyncResult> {
    try {
      const sobject = {
        Email: contactData.email,
        FirstName: contactData.firstName,
        LastName: contactData.lastName || 'Unknown', // LastName is required in Salesforce
        Company: contactData.company,
        Phone: contactData.phone
      };

      const response = await axios.post(`${credentials.instanceUrl}/services/data/v57.0/sobjects/Contact`, sobject, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        contactId: response.data.id,
        action: 'created',
        message: 'Contact created successfully in Salesforce'
      };
    } catch (error: any) {
      // Check for duplicate email error
      if (error.response?.data?.[0]?.errorCode === 'DUPLICATE_VALUE') {
        return await this.updateContactByEmail(credentials, contactData);
      }

      return {
        success: false,
        action: 'error',
        message: `Failed to create Salesforce contact: ${error.response?.data?.[0]?.message || error.message}`,
        errors: error.response?.data?.map((e: any) => e.message) || []
      };
    }
  }

  async updateContactByEmail(credentials: any, contactData: Partial<CRMContact>): Promise<CRMSyncResult> {
    try {
      // Find contact by email
      const query = `SELECT Id FROM Contact WHERE Email = '${contactData.email}' LIMIT 1`;
      const searchResponse = await axios.get(`${credentials.instanceUrl}/services/data/v57.0/query`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: { q: query }
      });

      if (searchResponse.data.records.length === 0) {
        return await this.createContact(credentials, contactData);
      }

      const contactId = searchResponse.data.records[0].Id;
      const sobject = {
        FirstName: contactData.firstName,
        LastName: contactData.lastName,
        Company: contactData.company,
        Phone: contactData.phone
      };

      await axios.patch(`${credentials.instanceUrl}/services/data/v57.0/sobjects/Contact/${contactId}`, sobject, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        contactId,
        action: 'updated',
        message: 'Contact updated successfully in Salesforce'
      };
    } catch (error: any) {
      return {
        success: false,
        action: 'error',
        message: `Failed to update Salesforce contact: ${error.response?.data?.[0]?.message || error.message}`,
        errors: error.response?.data?.map((e: any) => e.message) || []
      };
    }
  }

  async getFields(credentials: any): Promise<CRMField[]> {
    try {
      const response = await axios.get(`${credentials.instanceUrl}/services/data/v57.0/sobjects/Contact/describe`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.fields
        .filter((field: any) => field.updateable || field.createable)
        .map((field: any) => ({
          name: field.name,
          label: field.label,
          type: this.mapSalesforceFieldType(field.type),
          required: field.nillable === false,
          options: field.picklistValues?.map((opt: any) => opt.label) || []
        }));
    } catch (error) {
      console.error('Salesforce fields API error:', error);
      throw new Error(`Failed to fetch Salesforce fields: ${error.response?.data?.message || error.message}`);
    }
  }

  private mapSalesforceFieldType(salesforceType: string): CRMField['type'] {
    switch (salesforceType) {
      case 'string':
      case 'textarea':
      case 'picklist':
        return 'string';
      case 'double':
      case 'int':
      case 'currency':
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
      default:
        return 'string';
    }
  }
}

/**
 * Main CRM API Service
 */
export class CRMApiService {
  private hubspot = new HubSpotService();
  private salesforce = new SalesforceService();

  async syncContactToCRM(
    app: FastifyInstance,
    teamId: string,
    provider: string,
    contactData: Partial<CRMContact>,
    secret: string
  ): Promise<CRMSyncResult> {
    try {
      const credentials = await refreshTokenIfNeeded(app, teamId, provider, secret);
      
      if (!credentials) {
        return {
          success: false,
          action: 'error',
          message: `No valid credentials found for ${provider}`
        };
      }

      switch (provider.toLowerCase()) {
        case 'hubspot':
          return await this.hubspot.createContact(credentials, contactData);
        case 'salesforce':
          return await this.salesforce.createContact(credentials, contactData);
        default:
          return {
            success: false,
            action: 'error',
            message: `Unsupported CRM provider: ${provider}`
          };
      }
    } catch (error: any) {
      app.log.error('CRM sync error:', error);
      return {
        success: false,
        action: 'error',
        message: `CRM sync failed: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  async getContactsFromCRM(
    app: FastifyInstance,
    teamId: string,
    provider: string,
    secret: string,
    limit = 100
  ): Promise<{ contacts: CRMContact[], hasMore: boolean }> {
    try {
      const credentials = await refreshTokenIfNeeded(app, teamId, provider, secret);
      
      if (!credentials) {
        throw new Error(`No valid credentials found for ${provider}`);
      }

      switch (provider.toLowerCase()) {
        case 'hubspot':
          return await this.hubspot.getContacts(credentials, limit);
        case 'salesforce':
          return await this.salesforce.getContacts(credentials, limit);
        default:
          throw new Error(`Unsupported CRM provider: ${provider}`);
      }
    } catch (error: any) {
      app.log.error('CRM fetch error:', error);
      throw error;
    }
  }

  async getCRMFields(
    app: FastifyInstance,
    teamId: string,
    provider: string,
    secret: string
  ): Promise<CRMField[]> {
    try {
      const credentials = await refreshTokenIfNeeded(app, teamId, provider, secret);
      
      if (!credentials) {
        throw new Error(`No valid credentials found for ${provider}`);
      }

      switch (provider.toLowerCase()) {
        case 'hubspot':
          return await this.hubspot.getFields(credentials);
        case 'salesforce':
          return await this.salesforce.getFields(credentials);
        default:
          throw new Error(`Unsupported CRM provider: ${provider}`);
      }
    } catch (error: any) {
      app.log.error('CRM fields fetch error:', error);
      throw error;
    }
  }
}

export const crmApiService = new CRMApiService();
