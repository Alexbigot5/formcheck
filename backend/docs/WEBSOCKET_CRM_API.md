# WebSocket & CRM API Implementation

This document describes the newly implemented WebSocket server and enhanced CRM API integration features.

## WebSocket Server

### Overview
The WebSocket server provides real-time communication between the backend and frontend, enabling instant updates for leads, form submissions, CRM sync events, and analytics.

### Features
- **Authentication**: WebSocket connections are authenticated using JWT tokens
- **Team Isolation**: Messages are scoped to specific teams
- **Event Subscriptions**: Clients can subscribe to specific event types
- **Heartbeat/Ping-Pong**: Automatic connection health monitoring
- **Reconnection**: Frontend automatically reconnects on connection loss

### WebSocket Endpoint
```
ws://localhost:4000/ws (development)
wss://your-domain.com/ws (production)
```

### Message Format
```typescript
interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}
```

### Client Authentication
```javascript
// After WebSocket connection is established
ws.send(JSON.stringify({
  type: 'authenticate',
  data: { token: 'your-jwt-token' },
  timestamp: new Date().toISOString()
}));
```

### Event Subscriptions
```javascript
// Subscribe to lead updates and form submissions
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { events: ['lead_update', 'form_submission'] },
  timestamp: new Date().toISOString()
}));
```

### Supported Event Types
- `lead_update`: Lead created, updated, deleted, or assigned
- `form_submission`: New form submission received
- `analytics_update`: Dashboard analytics updated
- `crm_sync`: CRM synchronization events
- `ping`/`pong`: Heartbeat messages

## WebSocket API Routes

### Broadcast Message
```http
POST /api/ws/broadcast
Authorization: Bearer <token>

{
  "type": "custom_event",
  "data": { "message": "Hello team!" },
  "targetTeam": "optional-team-id"
}
```

### Lead Update Notification
```http
POST /api/ws/lead-update
Authorization: Bearer <token>

{
  "leadId": "lead-uuid",
  "leadData": { "name": "John Doe", "email": "john@example.com" },
  "action": "created"
}
```

### Form Submission Notification
```http
POST /api/ws/form-submission
Authorization: Bearer <token>

{
  "formId": "form-uuid",
  "submissionData": { "name": "Jane Doe", "email": "jane@example.com" },
  "leadId": "optional-lead-uuid"
}
```

### CRM Sync Notification
```http
POST /api/ws/crm-sync
Authorization: Bearer <token>

{
  "provider": "hubspot",
  "action": "created",
  "contactId": "crm-contact-id",
  "leadId": "lead-uuid",
  "success": true,
  "message": "Contact synced successfully"
}
```

## Enhanced CRM API Integration

### Overview
The CRM API service provides direct integration with HubSpot, Salesforce, and other CRM platforms using stored OAuth credentials.

### Supported CRM Providers
- **HubSpot**: Full contact management, custom fields, search
- **Salesforce**: Contact/Lead management, custom objects
- **Zoho** (planned): Contact management
- **Pipedrive** (planned): Deal and contact management

### CRM API Features
- **Real API Connections**: Direct integration with CRM APIs
- **Credential Management**: Encrypted storage and automatic token refresh
- **Field Mapping**: Dynamic field discovery and mapping
- **Sync Operations**: Create, update, and search contacts
- **Error Handling**: Comprehensive error reporting and retry logic
- **WebSocket Integration**: Real-time sync status updates

## CRM API Routes

### Get CRM Fields
```http
GET /api/integrations/crm/fields/{provider}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "provider": "hubspot",
    "fields": [
      {
        "name": "email",
        "label": "Email",
        "type": "email",
        "required": true
      }
    ]
  }
}
```

### Get CRM Contacts
```http
GET /api/integrations/crm/contacts/{provider}?limit=100
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "hubspot-contact-id",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "company": "Acme Corp",
        "customFields": { ... }
      }
    ],
    "hasMore": false
  }
}
```

### Sync Contact to CRM
```http
POST /api/integrations/crm/sync-contact
Authorization: Bearer <token>

{
  "provider": "hubspot",
  "contactData": {
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Acme Corp",
    "phone": "+1-555-0123"
  }
}

Response:
{
  "success": true,
  "data": {
    "success": true,
    "contactId": "hubspot-contact-id",
    "action": "created",
    "message": "Contact created successfully in HubSpot"
  }
}
```

## HubSpot Integration

### Required Credentials
```json
{
  "accessToken": "pat-na1-...",
  "refreshToken": "optional",
  "expiresAt": 1234567890000
}
```

### Supported Operations
- Create/update contacts
- Search contacts by email
- Fetch contact properties
- Custom field mapping

### API Endpoints Used
- `GET /crm/v3/objects/contacts` - List contacts
- `POST /crm/v3/objects/contacts` - Create contact
- `PATCH /crm/v3/objects/contacts/{id}` - Update contact
- `POST /crm/v3/objects/contacts/search` - Search contacts
- `GET /crm/v3/properties/contacts` - Get contact properties

## Salesforce Integration

### Required Credentials
```json
{
  "accessToken": "00D...",
  "refreshToken": "5Aep...",
  "instanceUrl": "https://your-org.salesforce.com"
}
```

### Supported Operations
- Create/update contacts
- Search contacts via SOQL
- Fetch object metadata
- Custom field support

### API Endpoints Used
- `GET /services/data/v57.0/query` - SOQL queries
- `POST /services/data/v57.0/sobjects/Contact` - Create contact
- `PATCH /services/data/v57.0/sobjects/Contact/{id}` - Update contact
- `GET /services/data/v57.0/sobjects/Contact/describe` - Get metadata

## Testing

### Run Tests
```bash
cd backend
tsx src/scripts/test-websocket-crm.ts
```

### Manual Testing

#### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:4000/ws');
ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', JSON.parse(event.data));
```

#### CRM API Testing
```bash
# Test HubSpot fields (requires authentication)
curl -X GET "http://localhost:4000/api/integrations/crm/fields/hubspot" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test contact sync
curl -X POST "http://localhost:4000/api/integrations/crm/sync-contact" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "hubspot",
    "contactData": {
      "email": "test@example.com",
      "firstName": "Test",
      "lastName": "User"
    }
  }'
```

## Environment Variables

### Required
```env
SECRET_VAULT_KEY=your-encryption-key-for-credentials
JWT_SECRET=your-jwt-secret
DATABASE_URL=your-postgres-connection-string
```

### Optional
```env
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URL=your-hubspot-redirect-url
SALESFORCE_CLIENT_ID=your-salesforce-client-id
SALESFORCE_CLIENT_SECRET=your-salesforce-client-secret
SALESFORCE_REDIRECT_URL=your-salesforce-redirect-url
SALESFORCE_LOGIN_URL=https://login.salesforce.com
```

## Architecture

### WebSocket Flow
1. Client connects to `/ws`
2. Client sends authentication message with JWT
3. Server validates token and associates connection with team
4. Client subscribes to event types
5. Server broadcasts events to subscribed clients
6. Heartbeat maintains connection health

### CRM Sync Flow
1. Form submission triggers WebSocket notification
2. If CRM integration is active, contact sync is attempted
3. CRM API service handles provider-specific logic
4. Sync result is broadcast via WebSocket
5. Frontend updates UI in real-time

### Error Handling
- WebSocket: Automatic reconnection with exponential backoff
- CRM API: Retry logic for transient failures
- Authentication: Token refresh for expired credentials
- Validation: Input validation and sanitization

## Security Considerations

- All WebSocket connections require JWT authentication
- CRM credentials are encrypted at rest
- API tokens are automatically refreshed
- Team isolation prevents cross-team data access
- Input validation prevents injection attacks

## Performance

- WebSocket connections are lightweight and persistent
- CRM API calls are rate-limited per provider requirements
- Credential caching reduces database queries
- Async operations prevent blocking
- Connection pooling for database efficiency
