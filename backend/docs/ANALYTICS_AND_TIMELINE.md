# Analytics & Timeline API

The SmartForms AI backend provides comprehensive analytics and timeline functionality to track lead interactions and performance metrics.

## Timeline API

### GET /leads/:id/timeline

Retrieve a merged, chronologically sorted timeline of all Messages and TimelineEvents for a specific lead.

#### Parameters

- **Path Parameters**:
  - `id` (string, required) - Lead ID (CUID format)

- **Query Parameters**:
  - `limit` (number, optional) - Number of items per page (1-100, default: 50)
  - `offset` (number, optional) - Number of items to skip (default: 0)

#### Response

```json
{
  "timeline": [
    {
      "id": "clx1234567890",
      "type": "message",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "data": {
        "direction": "IN",
        "channel": "EMAIL",
        "subject": "Inquiry about your product",
        "body": "I'm interested in learning more...",
        "meta": {
          "source": "contact_form",
          "messageId": "msg_123"
        },
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    },
    {
      "id": "clx0987654321",
      "type": "event",
      "timestamp": "2024-01-15T10:31:00.000Z",
      "data": {
        "type": "SCORE_UPDATED",
        "payload": {
          "action": "lead_scoring",
          "score": 85,
          "band": "HIGH",
          "reason": "High-value company domain"
        },
        "createdAt": "2024-01-15T10:31:00.000Z"
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 127,
    "hasMore": true
  }
}
```

#### Timeline Item Types

**Message Items** (`type: "message"`):
- `direction`: "IN" | "OUT"
- `channel`: "EMAIL" | "DM" | "FORM" | "WEBHOOK"
- `subject`: Message subject (optional)
- `body`: Message content
- `meta`: Additional metadata

**Event Items** (`type: "event"`):
- `type`: TimelineEventType enum value
- `payload`: Event-specific data structure

#### Timeline Event Types

- `FORM_SUBMISSION` - Lead submitted a form
- `EMAIL_RECEIVED` - Incoming email
- `EMAIL_SENT` - Outgoing email
- `DM_RECEIVED` - Direct message received
- `DM_SENT` - Direct message sent
- `CRM_SYNC` - Synced to CRM system
- `FOLLOW_UP` - Follow-up action taken
- `NOTE_ADDED` - Manual note added
- `CALL_LOGGED` - Phone call logged
- `STATUS_CHANGED` - Lead status updated
- `SCORE_UPDATED` - Lead score changed

#### Usage Examples

```javascript
// Get first 20 timeline items
const response = await fetch('/leads/clx123/timeline?limit=20', {
  headers: { 'Authorization': `Bearer ${jwt}` }
});

// Get next page
const nextPage = await fetch('/leads/clx123/timeline?limit=20&offset=20', {
  headers: { 'Authorization': `Bearer ${jwt}` }
});

// Process timeline items
const { timeline, pagination } = await response.json();
timeline.forEach(item => {
  if (item.type === 'message') {
    console.log(`Message: ${item.data.subject}`);
  } else {
    console.log(`Event: ${item.data.type}`);
  }
});
```

---

## Analytics API

### GET /analytics/overview

Comprehensive analytics dashboard providing insights into lead performance, sources, SLA metrics, and team performance.

#### Parameters

- **Query Parameters**:
  - `days` (number, optional) - Analysis period in days (1-365, default: 30)
  - `timezone` (string, optional) - Timezone for date calculations (default: "UTC")

#### Response Structure

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalLeads": 1250,
      "newLeads": 89,
      "averageScore": 67.5,
      "conversionRate": 23.6
    },
    "sourceBreakdown": [
      {
        "source": "website_form",
        "count": 45,
        "percentage": 50.6
      }
    ],
    "leadsPerDay": [
      {
        "date": "2024-01-15",
        "count": 12,
        "cumulative": 89
      }
    ],
    "slaMetrics": {
      "hitRate": 87.3,
      "averageResponseTime": 45.2,
      "totalSlaClocks": 156,
      "satisfiedCount": 136,
      "escalatedCount": 8
    },
    "responseTimeDistribution": [
      {
        "bucket": "0-15 min",
        "count": 45,
        "percentage": 33.1
      }
    ],
    "scoreDistribution": [
      {
        "band": "HIGH",
        "count": 23,
        "percentage": 25.8
      }
    ],
    "topSources": [
      {
        "source": "website_form",
        "count": 45,
        "averageScore": 72.3,
        "conversionRate": 31.1
      }
    ],
    "ownerPerformance": [
      {
        "ownerId": "clx123",
        "ownerName": "john.doe",
        "ownerEmail": "john.doe@company.com",
        "assignedLeads": 23,
        "averageResponseTime": 38.7,
        "slaHitRate": 91.3
      }
    ]
  }
}
```

#### Detailed Response Fields

**Summary Metrics**:
- `totalLeads`: Total leads across all time
- `newLeads`: Leads created in the specified period
- `averageScore`: Mean lead score for the period
- `conversionRate`: Percentage of leads that progressed to IN_PROGRESS or CLOSED

**Source Breakdown**:
- Ordered by count (highest first)
- Includes percentage of total new leads

**Leads Per Day**:
- Daily lead counts for the entire period
- Includes cumulative totals
- Missing days filled with zero counts

**SLA Metrics**:
- `hitRate`: Percentage of SLAs met on time
- `averageResponseTime`: Mean response time in minutes
- `totalSlaClocks`: Total SLA tracking instances
- `satisfiedCount`: SLAs satisfied within target time
- `escalatedCount`: SLAs that escalated

**Response Time Distribution**:
- Bucketed response times with counts and percentages
- Buckets: 0-15 min, 15-60 min, 1-4 hours, 4-24 hours, 1+ days

**Score Distribution**:
- Breakdown by score bands (LOW, MEDIUM, HIGH)
- Counts and percentages

**Top Sources** (Top 5):
- Source performance metrics
- Average score and conversion rate per source

**Owner Performance**:
- Individual team member metrics
- Response times and SLA hit rates
- Ordered by assigned lead count

#### Usage Examples

```javascript
// Get 30-day analytics overview
const response = await fetch('/analytics/overview', {
  headers: { 'Authorization': `Bearer ${jwt}` }
});

// Get 7-day overview in EST timezone
const weeklyData = await fetch('/analytics/overview?days=7&timezone=America/New_York', {
  headers: { 'Authorization': `Bearer ${jwt}` }
});

// Process analytics data
const { data } = await response.json();

// Display summary
console.log(`New leads: ${data.summary.newLeads}`);
console.log(`Average score: ${data.summary.averageScore}`);
console.log(`SLA hit rate: ${data.slaMetrics.hitRate}%`);

// Chart leads per day
data.leadsPerDay.forEach(day => {
  console.log(`${day.date}: ${day.count} leads (${day.cumulative} total)`);
});

// Analyze top sources
data.topSources.forEach(source => {
  console.log(`${source.source}: ${source.count} leads, ${source.averageScore} avg score`);
});
```

#### Performance Considerations

- All queries are optimized with parallel execution
- Database indexes on key fields (createdAt, teamId, source, etc.)
- Response time distribution calculated in-memory for better performance
- Large datasets automatically paginated at database level

#### Timezone Support

The `timezone` parameter accepts standard IANA timezone identifiers:
- `UTC` (default)
- `America/New_York`
- `Europe/London`
- `Asia/Tokyo`
- etc.

Date groupings and calculations respect the specified timezone.

---

## Error Handling

Both endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "statusCode": 404,
  "message": "Lead not found"
}
```

Common error codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid JWT)
- `404` - Not Found (lead doesn't exist or not accessible)
- `500` - Internal Server Error (database/system error)

---

## Authentication

Both endpoints require JWT authentication:

```javascript
const response = await fetch('/leads/123/timeline', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});
```

Team isolation is enforced - users can only access data for their team.

---

## Rate Limiting

Standard rate limiting applies:
- 100 requests per minute per user
- 1000 requests per minute per team
- Analytics endpoint has additional caching (5-minute cache for identical queries)

---

## Data Privacy

- All data is scoped to the authenticated user's team
- Personal information in messages is not filtered (ensure GDPR compliance at application level)
- Timeline data includes full message content and metadata
- Analytics data is aggregated but may contain identifiable patterns
