# Email Ingestion System

The SmartForms AI backend includes a comprehensive email ingestion system that monitors IMAP inboxes in real-time and processes incoming emails through the complete lead pipeline.

## Overview

The email ingestion system provides:
- **IMAP IDLE Monitoring** - Real-time email detection using imapflow
- **Smart Email Parsing** - Extract sender, company, phone from email content
- **Complete Pipeline** - Dedupe → Enrichment → Scoring → Routing → SLA
- **Message Logging** - Save emails as Message records with direction IN, channel EMAIL
- **Integration Tracking** - Update Integration.lastSeenAt for monitoring
- **Manual Sync** - Testing endpoint for manual inbox synchronization

## Architecture

```
IMAP Server → IDLE Listener → Email Parser → Lead Pipeline → Database
     ↓              ↓              ↓              ↓           ↓
   Gmail         ImapFlow      Extract Data    Score/Route   Save
  Outlook      Real-time      Company/Phone   Assign SLA   Message
   Yahoo        Monitor       Signature       Update Lead  Timeline
```

## Configuration

### Environment Variables

```bash
# IMAP Configuration (Required)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=leads@yourcompany.com
IMAP_PASS=your_app_password
IMAP_SECURE=true

# Database and other configs
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret
HMAC_SECRET=your_hmac_secret
```

### IMAP Setup Examples

**Gmail:**
```bash
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=leads@yourcompany.com
IMAP_PASS=your_app_password  # Use App Password, not regular password
IMAP_SECURE=true
```

**Outlook/Office 365:**
```bash
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_USER=leads@yourcompany.com
IMAP_PASS=your_password
IMAP_SECURE=true
```

**Yahoo:**
```bash
IMAP_HOST=imap.mail.yahoo.com
IMAP_PORT=993
IMAP_USER=leads@yourcompany.com
IMAP_PASS=your_app_password
IMAP_SECURE=true
```

## Email Processing Pipeline

### 1. Real-time Monitoring

The system uses IMAP IDLE to monitor inboxes in real-time:

```typescript
// Automatic startup on server start
await emailListenerManager.startAllListeners();

// IDLE listener detects new emails instantly
client.on('exists', async (data) => {
  await processNewEmails();
});
```

### 2. Email Parsing

Extracts comprehensive lead data from emails:

```typescript
interface ParsedEmailData {
  email: string;           // Sender email address
  name: string;            // Extracted from display name or email
  company?: string;        // From domain or signature
  domain: string;          // Email domain
  phone?: string;          // Extracted from content/signature
  fields: {
    emailSubject: string;
    emailDate: string;
    title?: string;        // Job title from signature
    website?: string;      // Company website
    emailType: string;     // inquiry, demo_request, support, etc.
    urgency: string;       // high, medium, normal
    budgetMention?: string;
    timeline?: string;
    companySize?: string;
  };
}
```

### 3. Smart Content Extraction

**Company Detection:**
- Non-personal domains → Company name from domain
- Personal domains → Extract from email signature
- Signature patterns → Company Inc/LLC/Corp detection

**Phone Extraction:**
- US format: (555) 123-4567, 555-123-4567, +1-555-123-4567
- International: +44-20-1234-5678
- Labeled: "Phone: 555-123-4567", "Mobile: ..."

**Job Title Extraction:**
- Signature patterns: "CEO", "VP of Sales", "Marketing Director"
- Common titles: Manager, Director, VP, President, etc.
- Position indicators in email signatures

**Email Type Classification:**
- **Inquiry** → "inquiry", "interested", "quote"
- **Demo Request** → "demo", "demonstration"
- **Support** → "support", "help", "issue"
- **Partnership** → "partnership", "collaborate"

### 4. Complete Lead Processing

Each email goes through the full pipeline:

1. **Email Parsing** → Extract lead data
2. **Enrichment** → Add company/contact data
3. **Scoring** → Calculate lead score and band
4. **Deduplication** → Check for existing leads
5. **Routing** → Assign to appropriate owner/pool
6. **SLA Management** → Set response time targets
7. **Message Logging** → Save as Message record
8. **Timeline Events** → Log processing steps

## API Endpoints

### Manual Sync

```http
POST /ingest/inbox/sync
Content-Type: application/json
Authorization: Bearer <token>

{
  "integrationId": "integration_123"  // Optional, sync specific integration
}
```

**Response:**
```json
{
  "success": true,
  "processed": 5,
  "errors": 0,
  "messages": [
    {
      "messageId": "msg_abc123",
      "leadId": "lead_456"
    }
  ],
  "message": "Manual sync completed for integration integration_123. Processed 5 emails with 0 errors."
}
```

### Integration Status

```http
GET /ingest/inbox/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "integrations": [
    {
      "id": "integration_123",
      "status": "CONNECTED",
      "lastSeenAt": "2024-01-01T12:00:00Z",
      "lastSyncAt": "2024-01-01T11:55:00Z",
      "error": null,
      "listenerActive": true
    }
  ],
  "totalActive": 1,
  "totalConfigured": 1
}
```

### Start/Stop Listeners

```http
POST /ingest/inbox/start
Content-Type: application/json
Authorization: Bearer <token>

{
  "integrationId": "integration_123"
}
```

```http
POST /ingest/inbox/stop
Content-Type: application/json
Authorization: Bearer <token>

{
  "integrationId": "integration_123"
}
```

### Recent Email Messages

```http
GET /ingest/inbox/recent?limit=20&integrationId=integration_123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_123",
      "leadId": "lead_456",
      "subject": "Inquiry about your product",
      "from": "john@company.com",
      "createdAt": "2024-01-01T12:00:00Z",
      "lead": {
        "email": "john@company.com",
        "name": "John Doe",
        "company": "Acme Corp",
        "score": 75
      }
    }
  ],
  "total": 50
}
```

## Message and Timeline Logging

### Email Message Record

```json
{
  "id": "msg_12345",
  "leadId": "lead_67890",
  "direction": "IN",
  "channel": "EMAIL",
  "subject": "Inquiry about your product",
  "body": "Hi, I'm interested in learning more about your product...",
  "meta": {
    "messageId": "<abc123@gmail.com>",
    "from": {
      "address": "john@company.com",
      "name": "John Doe"
    },
    "to": [
      {
        "address": "leads@yourcompany.com",
        "name": "Leads"
      }
    ],
    "date": "2024-01-01T12:00:00Z",
    "headers": { /* email headers */ },
    "attachments": [
      {
        "filename": "requirements.pdf",
        "contentType": "application/pdf",
        "size": 1024000
      }
    ],
    "source": "imap",
    "integrationId": "integration_123"
  },
  "createdAt": "2024-01-01T12:00:00Z"
}
```

### Timeline Events

**1. Email Received:**
```json
{
  "type": "EMAIL_RECEIVED",
  "payload": {
    "action": "email_received",
    "subject": "Inquiry about your product",
    "messageId": "<abc123@gmail.com>",
    "enrichment": { /* enriched data */ },
    "source": "imap"
  }
}
```

**2. Scoring Event:**
```json
{
  "type": "SCORE_UPDATED",
  "payload": {
    "action": "email_scoring",
    "score": 75,
    "band": "MEDIUM",
    "tags": ["inquiry", "enterprise"],
    "trace": [ /* scoring trace */ ]
  }
}
```

**3. Routing Event:**
```json
{
  "type": "SCORE_UPDATED",
  "payload": {
    "action": "email_routing",
    "ownerId": "owner_123",
    "pool": "SALES_POOL",
    "reason": "Medium score routing rule matched",
    "sla": 30
  }
}
```

## Advanced Features

### Email Content Analysis

**Signature Parsing:**
- Extract job titles, company names, contact info
- Detect company websites and social profiles
- Parse structured signature blocks

**Intent Detection:**
- Classify email type (inquiry, demo, support)
- Detect urgency level (high, medium, normal)
- Extract budget and timeline mentions

**Company Size Detection:**
- "50 employees", "team of 20", "100-person company"
- Correlate with domain and enrichment data

### Attachment Handling

```json
{
  "attachments": [
    {
      "filename": "requirements.pdf",
      "contentType": "application/pdf",
      "size": 1024000
    },
    {
      "filename": "company_profile.docx",
      "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "size": 512000
    }
  ]
}
```

### Error Handling and Resilience

**Connection Management:**
- Automatic reconnection with exponential backoff
- Maximum retry attempts with circuit breaker
- Graceful degradation on connection failures

**Email Processing Errors:**
- Continue processing other emails on individual failures
- Log detailed error information for debugging
- Mark problematic emails as seen to avoid reprocessing

**Integration Status Tracking:**
- Real-time status updates (CONNECTED/DISCONNECTED/ERROR)
- Last seen timestamp tracking
- Error message logging and alerting

## Performance Considerations

### Optimization Strategies

**Connection Pooling:**
- Reuse IMAP connections across requests
- Implement connection health checks
- Handle connection timeouts gracefully

**Batch Processing:**
- Process multiple emails in batches
- Limit concurrent processing to avoid overload
- Queue management for high-volume inboxes

**Memory Management:**
- Stream large email attachments
- Clean up parsed email objects
- Monitor memory usage and implement limits

### Monitoring and Alerting

**Key Metrics:**
- **Email Processing Rate** - Emails processed per minute
- **Connection Uptime** - % of time IMAP connections are active
- **Processing Latency** - Time from email receipt to lead creation
- **Error Rate** - % of emails that fail processing
- **Integration Health** - Status of all configured integrations

**Recommended Alerts:**
- IMAP connection failures
- High email processing error rates
- Unusual email volume spikes
- Integration status changes

## Security Considerations

### Email Security

**Authentication:**
- Use app passwords instead of regular passwords
- Support OAuth 2.0 for modern email providers
- Rotate credentials regularly

**Data Privacy:**
- Hash sensitive email content
- Implement data retention policies
- Support GDPR compliance requirements

**Access Control:**
- Team-based email integration isolation
- Role-based access to email data
- Audit logging for email access

### Best Practices

1. **Credential Management** - Use environment variables, never hardcode
2. **Connection Security** - Always use TLS/SSL for IMAP connections
3. **Rate Limiting** - Respect email provider rate limits
4. **Error Logging** - Log errors without exposing sensitive data
5. **Monitoring** - Track integration health and performance
6. **Backup Strategy** - Ensure email data is backed up appropriately

This email ingestion system provides enterprise-grade email processing with complete automation, security, and auditability.
