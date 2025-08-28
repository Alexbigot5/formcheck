import { FastifyInstance } from 'fastify';
import { encryptCredentials, decryptCredentials } from '../../utils/encryption.js';

export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  instanceUrl?: string; // For Salesforce
  scope?: string;
}

export interface StoredCredential {
  id: string;
  provider: string;
  credentials: OAuthCredentials;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Store encrypted OAuth credentials for a team
 */
export async function storeCredentials(
  app: FastifyInstance,
  teamId: string,
  provider: string,
  credentials: OAuthCredentials,
  secret: string
): Promise<StoredCredential> {
  try {
    const encryptedData = encryptCredentials(credentials, secret);
    
    // Upsert credential record
    const credentialRecord = await app.prisma.credential.upsert({
      where: {
        teamId_provider: {
          teamId,
          provider
        }
      },
      update: {
        encrypted: { data: encryptedData },
        updatedAt: new Date()
      },
      create: {
        teamId,
        provider,
        encrypted: { data: encryptedData }
      }
    });

    return {
      id: credentialRecord.id,
      provider: credentialRecord.provider,
      credentials,
      createdAt: credentialRecord.createdAt,
      updatedAt: credentialRecord.updatedAt
    };
  } catch (error) {
    app.log.error('Failed to store credentials:', error);
    throw new Error('Failed to store credentials');
  }
}

/**
 * Retrieve and decrypt OAuth credentials for a team
 */
export async function getCredentials(
  app: FastifyInstance,
  teamId: string,
  provider: string,
  secret: string
): Promise<OAuthCredentials | null> {
  try {
    const credentialRecord = await app.prisma.credential.findFirst({
      where: {
        teamId,
        provider
      }
    });

    if (!credentialRecord || !credentialRecord.encrypted) {
      return null;
    }

    const encryptedData = (credentialRecord.encrypted as any).data;
    if (!encryptedData) {
      return null;
    }

    const credentials = decryptCredentials(encryptedData, secret);
    return credentials as OAuthCredentials;
  } catch (error) {
    app.log.error('Failed to retrieve credentials:', error);
    return null;
  }
}

/**
 * Delete stored credentials for a team and provider
 */
export async function deleteCredentials(
  app: FastifyInstance,
  teamId: string,
  provider: string
): Promise<boolean> {
  try {
    await app.prisma.credential.deleteMany({
      where: {
        teamId,
        provider
      }
    });
    return true;
  } catch (error) {
    app.log.error('Failed to delete credentials:', error);
    return false;
  }
}

/**
 * Check if credentials exist and are valid (not expired)
 */
export async function hasValidCredentials(
  app: FastifyInstance,
  teamId: string,
  provider: string,
  secret: string
): Promise<boolean> {
  try {
    const credentials = await getCredentials(app, teamId, provider, secret);
    
    if (!credentials) {
      return false;
    }

    // Check if token is expired (if expiresAt is provided)
    if (credentials.expiresAt && credentials.expiresAt < Date.now()) {
      return false;
    }

    return true;
  } catch (error) {
    app.log.error('Failed to check credentials validity:', error);
    return false;
  }
}

/**
 * Refresh OAuth token if needed
 */
export async function refreshTokenIfNeeded(
  app: FastifyInstance,
  teamId: string,
  provider: string,
  secret: string
): Promise<OAuthCredentials | null> {
  try {
    const credentials = await getCredentials(app, teamId, provider, secret);
    
    if (!credentials || !credentials.refreshToken) {
      return null;
    }

    // Check if token needs refresh (expires in next 5 minutes)
    const needsRefresh = credentials.expiresAt && 
      credentials.expiresAt < (Date.now() + 5 * 60 * 1000);

    if (!needsRefresh) {
      return credentials;
    }

    // Refresh token based on provider
    let refreshedCredentials: OAuthCredentials | null = null;
    
    if (provider === 'hubspot') {
      refreshedCredentials = await refreshHubSpotToken(credentials.refreshToken);
    } else if (provider === 'salesforce') {
      refreshedCredentials = await refreshSalesforceToken(credentials.refreshToken, credentials.instanceUrl);
    }

    if (refreshedCredentials) {
      // Store updated credentials
      await storeCredentials(app, teamId, provider, refreshedCredentials, secret);
      return refreshedCredentials;
    }

    return credentials;
  } catch (error) {
    app.log.error('Failed to refresh token:', error);
    return null;
  }
}

/**
 * Refresh HubSpot access token
 */
async function refreshHubSpotToken(refreshToken: string): Promise<OAuthCredentials | null> {
  try {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope
    };
  } catch (error) {
    console.error('HubSpot token refresh error:', error);
    return null;
  }
}

/**
 * Refresh Salesforce access token
 */
async function refreshSalesforceToken(refreshToken: string, instanceUrl?: string): Promise<OAuthCredentials | null> {
  try {
    const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
    
    const response = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.SALESFORCE_CLIENT_ID!,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Salesforce token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Salesforce doesn't always return new refresh token
      instanceUrl: data.instance_url || instanceUrl,
      scope: data.scope
    };
  } catch (error) {
    console.error('Salesforce token refresh error:', error);
    return null;
  }
}
