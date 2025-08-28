# Webhook Ingestion System

The SmartForms AI backend includes a comprehensive webhook ingestion system that processes incoming leads through a complete pipeline of normalization, enrichment, scoring, routing, and SLA management.

## Overview

The webhook ingestion system provides:
- **HMAC Verification** - Secure webhook authentication
- **Payload Normalization** - Convert various formats to standard lead fields
- **Lead Enrichment** - Enhance data with company and contact information
- **Complete Pipeline** - Dedupe → Enrichment → Scoring → Routing → SLA
- **Message Logging** - Save all webhook submissions as Messages
- **Timeline Events** - Complete audit trail of processing steps

## Processing Pipeline

```
Webhook → HMAC Verify → Normalize → Enrich → Score → Dedupe → Route → SLA → Save
```

### Step-by-Step Process

1. **HMAC Verification** - Validate webhook signature
2. **Payload Normalization** - Convert to standard lead format
3. **Lead Enrichment** - Enhance with additional data
4. **Scoring** - Calculate lead score and band
5. **Deduplication** - Check for and merge duplicates
6. **Routing** - Assign to appropriate owner/pool
7. **SLA Management** - Create response time targets
8. **Message Logging** - Save submission as Message record
9. **Timeline Events** - Log all processing steps

## Main Endpoint: POST /ingest/webhook

### HMAC Authentication

All webhook requests must include a valid HMAC signature in the `X-Signature` header:

```http
POST /ingest/webhook
Content-Type: application/json
X-Signature: sha256=abc123...

{
  "email": "john@company.com",
  "name": "John Doe",
  "company": "Acme Corp"
}
```

**Signature Calculation:**
```javascript
const signature = crypto
  .createHmac('sha256', HMAC_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');
```

### Flexible Payload Format

The webhook accepts various payload formats and automatically normalizes them:

```json
{
  // Basic contact info
  "email": "john@company.com",
  "name": "John Doe",
  "firstName": "John",
  "lastName": "Doe", 
  "phone": "+1-555-0123",
  "company": "Acme Corp",
  "website": "https://acme.com",
  
  // Form metadata
  "formId": "form_123",
  "formName": "Contact Form",
  "submissionId": "sub_456",
  "source": "website_form",
  
  // Custom fields
  "fields": {
    "title": "CEO",
    "budget": 50000,
    "employees": 100,
    "industry": "Technology"
  },
  
  // UTM tracking
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "brand"
  },
  "utm_source": "google",
  "utm_medium": "cpc",
  "gclid": "abc123",
  
  // Technical metadata
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "referrer": "https://google.com",
  "timestamp": 1640995200000
}
```

### Response Format

```json
{
  "leadId": "lead_12345",
  "score": 87,
  "band": "HIGH",
  "ownerId": "owner_67890",
  "pool": "AE_POOL_A", 
  "slaTargetAt": "2024-01-01T12:30:00Z",
  "action": "created",
  "messageId": "msg_11111",
  "timelineEvents": ["event_1", "event_2", "event_3"],
  "message": "Webhook processed successfully. New lead created with score 87 (HIGH). Routed to owner owner_67890 (AE_POOL_A). SLA target: 2024-01-01T12:30:00Z."
}
```

## Payload Normalization

The normalizer converts various webhook formats to a standard lead structure:

### Field Mapping

**Email Fields:**
- `email`, `email_address`, `emailAddress`, `user_email`, `contact_email`

**Name Fields:**
- `name`, `full_name`, `firstName` + `lastName`, `contact_name`

**Company Fields:**
- `company`, `company_name`, `organization`, `business_name`

**Phone Fields:**
- `phone`, `phone_number`, `mobile`, `work_phone`, `business_phone`

### Nested Field Support

```json
{
  "fields": {
    "firstName": "John",
    "lastName": "Doe",
    "company": "Acme Corp"
  },
  "customFields": {
    "title": "CEO",
    "budget": 50000
  }
}
```

### UTM Parameter Extraction

```json
{
  // Direct UTM object
  "utm": {
    "source": "google",
    "medium": "cpc"
  },
  
  // Individual fields
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "brand",
  
  // Additional tracking
  "gclid": "abc123",
  "referrer": "https://google.com"
}
```

## Lead Enrichment

The enrichment system enhances leads with additional data:

### Company Enrichment
- Industry classification
- Company size and employee count
- Revenue estimates
- Technology stack
- Founding year

### Contact Enrichment
- Job level and seniority
- Department and role
- Decision-making authority
- Contact preferences

### Geolocation Enrichment
- Country and region from IP
- City and timezone
- Market segmentation

### Social Profile Enrichment
- LinkedIn profiles
- Twitter handles
- GitHub accounts
- Professional networks

### Enrichment Response

```json
{
  "enrichment": {
    "companyData": {
      "industry": "Technology",
      "size": "51-200",
      "employees": 150,
      "revenue": "$25M",
      "founded": 2015,
      "technologies": ["React", "Node.js", "AWS"]
    },
    "contactData": {
      "jobLevel": "C-Level",
      "department": "Executive",
      "role": "Chief Executive Officer",
      "seniority": "Executive"
    },
    "geolocation": {
      "country": "United States",
      "region": "California", 
      "city": "San Francisco",
      "timezone": "America/Los_Angeles"
    },
    "socialProfiles": {
      "linkedin": "https://linkedin.com/in/john-doe"
    },
    "enrichmentSource": "smartforms_ai",
    "enrichedAt": "2024-01-01T12:00:00Z",
    "confidence": 85
  }
}
```

## Message and Timeline Logging

### Message Record

Every webhook submission is saved as a Message:

```json
{
  "id": "msg_12345",
  "leadId": "lead_67890",
  "direction": "IN",
  "channel": "FORM",
  "subject": "Form submission from website_form",
  "body": "{\n  \"email\": \"john@company.com\",\n  \"name\": \"John Doe\"\n}",
  "meta": {
    "originalPayload": { /* full webhook payload */ },
    "source": "website_form",
    "submissionId": "sub_456",
    "formId": "form_123",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  },
  "createdAt": "2024-01-01T12:00:00Z"
}
```

### Timeline Events

Multiple timeline events are created to track processing:

**1. Form Submission Event:**
```json
{
  "type": "FORM_SUBMISSION",
  "payload": {
    "action": "webhook_submission",
    "source": "website_form",
    "enrichment": { /* enriched data */ }
  }
}
```

**2. Scoring Event:**
```json
{
  "type": "SCORE_UPDATED", 
  "payload": {
    "action": "webhook_scoring",
    "score": 87,
    "band": "HIGH",
    "tags": ["enterprise", "high_value"],
    "trace": [ /* scoring trace */ ]
  }
}
```

**3. Routing Event:**
```json
{
  "type": "SCORE_UPDATED",
  "payload": {
    "action": "webhook_routing", 
    "ownerId": "owner_12345",
    "pool": "AE_POOL_A",
    "reason": "High score routing rule matched",
    "trace": [ /* routing trace */ ],
    "sla": 15
  }
}
```

## Test Endpoint

For development and testing, use the test endpoint without HMAC:

```http
POST /ingest/webhook/test
Content-Type: application/json

{
  "email": "test@company.com",
  "name": "Test User",
  "company": "Test Corp",
  "fields": {
    "title": "CEO",
    "budget": 100000
  }
}
```

**Test Response:**
```json
{
  "normalized": { /* normalized lead data */ },
  "enriched": { /* enriched lead data */ },
  "scoring": { /* scoring results */ },
  "routing": { /* routing results */ },
  "message": "Webhook test completed successfully"
}
```

## Error Handling

### Validation Errors

```json
{
  "error": "Invalid payload",
  "details": [
    "Lead must have either email or name",
    "Invalid email format"
  ]
}
```

### HMAC Verification Errors

```json
{
  "error": "Invalid signature"
}
```

### Processing Errors

```json
{
  "error": "Webhook ingestion failed",
  "details": "Database connection error"
}
```

## Integration Examples

### Typeform Integration

```javascript
// Typeform webhook payload
{
  "event_id": "01234567-89ab-cdef-0123-456789abcdef",
  "event_type": "form_response",
  "form_response": {
    "form_id": "lT4Z3j",
    "token": "a3a12ec67a1365927098a606107fbc130",
    "submitted_at": "2018-01-01T12:00:00Z",
    "definition": {
      "id": "lT4Z3j",
      "title": "Contact Form"
    },
    "answers": [
      {
        "type": "email",
        "email": "john@company.com"
      },
      {
        "type": "short_text", 
        "text": "John Doe"
      }
    ]
  }
}

// Normalized to:
{
  "email": "john@company.com",
  "name": "John Doe",
  "source": "typeform",
  "formId": "lT4Z3j",
  "submissionId": "a3a12ec67a1365927098a606107fbc130"
}
```

### HubSpot Integration

```javascript
// HubSpot webhook payload
{
  "subscriptionId": 12345,
  "portalId": 62515,
  "eventId": 1,
  "subscriptionType": "contact.creation",
  "attemptNumber": 0,
  "objectId": 123,
  "changeSource": "CRM_UI",
  "propertyName": "email",
  "propertyValue": "john@company.com"
}

// Normalized to:
{
  "email": "john@company.com", 
  "source": "hubspot",
  "sourceRef": "contact_123",
  "fields": {
    "hubspotContactId": 123,
    "changeSource": "CRM_UI"
  }
}
```

### Zapier Integration

```javascript
// Zapier webhook payload
{
  "email": "john@company.com",
  "first_name": "John",
  "last_name": "Doe",
  "company": "Acme Corp",
  "job_title": "CEO",
  "phone": "+1-555-0123",
  "website": "https://acme.com",
  "lead_source": "Google Ads",
  "utm_source": "google",
  "utm_medium": "cpc"
}

// Normalized to:
{
  "email": "john@company.com",
  "name": "John Doe", 
  "company": "Acme Corp",
  "phone": "+1-555-0123",
  "domain": "acme.com",
  "source": "zapier",
  "fields": {
    "title": "CEO",
    "leadSource": "Google Ads"
  },
  "utm": {
    "source": "google",
    "medium": "cpc"
  }
}
```

## Performance Considerations

### Optimization Tips

1. **Async Processing** - Consider queue-based processing for high volume
2. **Enrichment Caching** - Cache company data to reduce API calls
3. **Batch Operations** - Group database operations when possible
4. **Error Recovery** - Implement retry logic for failed enrichments

### Monitoring

Key metrics to track:
- **Webhook Success Rate** - % of successfully processed webhooks
- **Processing Time** - Average time from webhook to lead creation
- **Enrichment Success Rate** - % of leads successfully enriched
- **Routing Success Rate** - % of leads successfully assigned

### Rate Limiting

Consider implementing rate limiting for webhook endpoints:
- Per-source rate limits
- Global rate limits
- Burst protection
- Queue overflow handling

## Security Best Practices

1. **HMAC Verification** - Always verify webhook signatures
2. **IP Allowlisting** - Restrict webhook sources to known IPs
3. **Input Validation** - Validate all incoming data
4. **Sanitization** - Clean user input before storage
5. **Audit Logging** - Log all webhook processing events
6. **Error Handling** - Don't expose internal errors in responses

This webhook ingestion system provides enterprise-grade lead processing with complete flexibility, security, and auditability.
