# CRM Integration System

The SmartForms AI backend provides comprehensive CRM integration support for HubSpot and Salesforce with secure credential storage, field mapping, and automated sync capabilities.

## Features

- **Secure OAuth Flow** - Complete OAuth 2.0 implementation for HubSpot & Salesforce
- **AES-256-GCM Encryption** - Military-grade encryption for storing OAuth tokens
- **Field Mapping** - Flexible mapping between lead fields and CRM properties
- **Dry Run Support** - Preview sync payloads without writing to CRM
- **Duplicate Handling** - Configurable policies for handling existing contacts
- **Timeline Logging** - Complete audit trail of sync operations
- **Auto Token Refresh** - Automatic refresh of expired access tokens

## Architecture

### Core Components

1. **Credential Service** (`credential.service.ts`)
   - Secure storage and retrieval of OAuth tokens
   - Automatic token refresh management
   - AES-256-GCM encryption with PBKDF2 key derivation

2. **CRM Service** (`crm.service.ts`)
   - Provider-specific API integrations
   - Field type mapping and validation
   - Sync operations with duplicate handling

3. **Integration Routes** (`integrations.routes.ts`)
   - OAuth flow endpoints
   - Field discovery and mapping
   - Sync endpoints with comprehensive error handling

### Security

- **Encryption**: AES-256-GCM with 100,000 PBKDF2 iterations
- **Key Derivation**: PBKDF2 with SHA-512 and random salts
- **Token Storage**: Encrypted JSON in PostgreSQL with team isolation
- **Access Control**: JWT-based authentication with team-level permissions

## API Endpoints

### OAuth Management

#### Start OAuth Flow
```http
GET /integrations/:kind/start
```
- **Parameters**: `kind` (hubspot|salesforce)
- **Response**: Authorization URL and state parameter
- **Authentication**: Required (JWT)

#### OAuth Callback
```http
POST /integrations/:kind/callback
```
- **Parameters**: `kind` (hubspot|salesforce)
- **Body**: `{ code: string, state?: string }`
- **Response**: Connection status and success message
- **Authentication**: Required (JWT)

#### Disconnect Integration
```http
DELETE /integrations/:kind/disconnect
```
- **Parameters**: `kind` (hubspot|salesforce)
- **Response**: Disconnection status
- **Authentication**: Required (JWT)

### Field Management

#### Get CRM Fields
```http
GET /integrations/:kind/fields
```
- **Parameters**: `kind` (hubspot|salesforce)
- **Response**: Array of available CRM fields with metadata
- **Authentication**: Required (JWT)

Example Response:
```json
{
  "success": true,
  "fields": [
    {
      "name": "email",
      "label": "Email Address",
      "type": "email",
      "required": true,
      "description": "Primary email address"
    },
    {
      "name": "company",
      "label": "Company Name",
      "type": "string",
      "required": false
    }
  ]
}
```

#### Save Field Mapping
```http
POST /integrations/:kind/mapping
```
- **Parameters**: `kind` (hubspot|salesforce)
- **Body**: `{ mapping: Record<string, string> }`
- **Response**: Save confirmation
- **Authentication**: Required (JWT)

Example Body:
```json
{
  "mapping": {
    "email": "email",
    "name": "firstname",
    "company": "company",
    "phone": "phone"
  }
}
```

### CRM Sync

#### Sync Lead to CRM
```http
POST /crm/sync/lead/:id?dryRun=true
```
- **Parameters**: `id` (lead ID), `dryRun` (optional boolean)
- **Body**: `{ provider: string, duplicatePolicy?: string }`
- **Response**: Sync result with contact ID and action taken
- **Authentication**: Required (JWT)

Query Parameters:
- `dryRun=true` - Preview payload without writing to CRM
- `dryRun=false` - Execute actual sync (default)

Body Options:
- `duplicatePolicy`: "skip" | "update" | "create_new" (default: "update")

Example Response:
```json
{
  "success": true,
  "contactId": "12345",
  "action": "created",
  "message": "Contact created successfully",
  "payload": {
    "email": "john@example.com",
    "firstname": "John",
    "company": "Acme Corp"
  }
}
```

### Status Monitoring

#### Get Integration Status
```http
GET /integrations/status
```
- **Response**: Status of all integrations
- **Authentication**: Required (JWT)

Example Response:
```json
{
  "success": true,
  "integrations": {
    "hubspot": {
      "connected": true,
      "lastSync": "2024-01-15T10:30:00Z"
    },
    "salesforce": {
      "connected": false,
      "error": "Credentials expired"
    },
    "slack": {
      "connected": true
    }
  }
}
```

## Provider-Specific Implementation

### HubSpot Integration

**OAuth Scopes**: 
- `crm.objects.contacts.write`
- `crm.objects.contacts.read` 
- `crm.schemas.contacts.read`

**API Endpoints**:
- Properties: `GET /crm/v3/properties/contacts`
- Create: `POST /crm/v3/objects/contacts`
- Update: `PATCH /crm/v3/objects/contacts/{id}`
- Search: `POST /crm/v3/objects/contacts/search`

**Field Type Mapping**:
- `string` → `string`
- `textarea` → `textarea`
- `number` → `number`
- `bool` → `boolean`
- `datetime/date` → `date`
- `enumeration` → `select`

### Salesforce Integration

**OAuth Scopes**:
- `api` - Full API access
- `refresh_token` - Token refresh capability

**API Endpoints**:
- Describe: `GET /services/data/v58.0/sobjects/Contact/describe`
- Create: `POST /services/data/v58.0/sobjects/Contact`
- Update: `PATCH /services/data/v58.0/sobjects/Contact/{id}`
- Query: `GET /services/data/v58.0/query/?q=SELECT...`

**Field Type Mapping**:
- `string/id` → `string`
- `textarea` → `textarea`
- `int/double/currency/percent` → `number`
- `boolean` → `boolean`
- `date/datetime` → `date`
- `email` → `email`
- `phone` → `phone`
- `url` → `url`
- `picklist/multipicklist` → `select`

## Environment Variables

Required environment variables:

```bash
# Encryption
SECRET_VAULT_KEY="your-256-bit-secret-key"

# HubSpot
HUBSPOT_CLIENT_ID="your-hubspot-client-id"
HUBSPOT_CLIENT_SECRET="your-hubspot-client-secret"
HUBSPOT_REDIRECT_URL="https://yourdomain.com/oauth/hubspot/callback"

# Salesforce
SALESFORCE_CLIENT_ID="your-salesforce-client-id"
SALESFORCE_CLIENT_SECRET="your-salesforce-client-secret"
SALESFORCE_REDIRECT_URL="https://yourdomain.com/oauth/salesforce/callback"
SALESFORCE_LOGIN_URL="https://login.salesforce.com"

# Optional: Slack
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

## Database Schema

### Credentials Table
```sql
CREATE TABLE credentials (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, provider)
);
```

### Integrations Table
```sql
CREATE TABLE integrations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'HUBSPOT', 'SALESFORCE', etc.
  status TEXT NOT NULL, -- 'CONNECTED', 'DISCONNECTED', 'ERROR'
  auth JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}', -- Field mappings stored here
  last_seen_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE(team_id, kind)
);
```

## Usage Examples

### Complete Integration Flow

1. **Start OAuth Flow**:
```javascript
const response = await fetch('/integrations/hubspot/start', {
  headers: { 'Authorization': `Bearer ${jwt}` }
});
const { authUrl, state } = await response.json();
// Redirect user to authUrl
```

2. **Handle OAuth Callback**:
```javascript
const response = await fetch('/integrations/hubspot/callback', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ code, state })
});
```

3. **Get Available Fields**:
```javascript
const response = await fetch('/integrations/hubspot/fields', {
  headers: { 'Authorization': `Bearer ${jwt}` }
});
const { fields } = await response.json();
```

4. **Configure Field Mapping**:
```javascript
const mapping = {
  email: 'email',
  name: 'firstname', 
  company: 'company',
  phone: 'phone'
};

await fetch('/integrations/hubspot/mapping', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ mapping })
});
```

5. **Sync Lead (Dry Run)**:
```javascript
const response = await fetch(`/crm/sync/lead/${leadId}?dryRun=true`, {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ 
    provider: 'hubspot',
    duplicatePolicy: 'update'
  })
});
const preview = await response.json();
```

6. **Execute Sync**:
```javascript
const response = await fetch(`/crm/sync/lead/${leadId}`, {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ 
    provider: 'hubspot',
    duplicatePolicy: 'update'
  })
});
const result = await response.json();
```

## Error Handling

The system provides comprehensive error handling:

- **Authentication Errors**: Invalid or expired credentials
- **API Rate Limits**: Automatic retry with exponential backoff
- **Field Validation**: Type checking and required field validation
- **Duplicate Detection**: Configurable handling of existing contacts
- **Network Issues**: Timeout and connection error handling

## Security Considerations

- **Token Encryption**: All OAuth tokens encrypted at rest
- **Team Isolation**: Credentials scoped to team level
- **Audit Logging**: All sync operations logged to timeline
- **Access Control**: JWT-based authentication required
- **Key Rotation**: Support for encryption key rotation
- **Secure Transmission**: HTTPS required for all endpoints

## Monitoring & Observability

- **Timeline Events**: All CRM operations logged
- **Integration Status**: Real-time connection monitoring
- **Error Tracking**: Detailed error messages and codes
- **Sync Statistics**: Last sync timestamps and success rates
- **Token Health**: Automatic detection of expired credentials
