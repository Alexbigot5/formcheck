# Lead Routing System

The SmartForms AI backend includes an intelligent lead routing system that automatically assigns leads to the right owners based on configurable rules and round-robin distribution.

## Overview

The routing system provides:
- **Rule-Based Routing** - Flexible IF_THEN logic for assignment
- **Round-Robin Distribution** - Fair load balancing across owner pools
- **Multiple Assignment Strategies** - Round-robin, least-loaded, weighted
- **SLA Management** - Automatic SLA clock creation
- **Alert Integration** - Slack, email, and webhook notifications
- **Detailed Tracing** - Complete audit trail of routing decisions

## Core Function: `routeLead`

```typescript
const result = await routeLead(app, lead, rules);
// Returns: { ownerId, pool, reason, trace[], alerts, sla, priority }
```

### Routing Process

1. **Rule Evaluation** - Test each rule in order until match found
2. **Pool Assignment** - Assign to specific owner or pool
3. **Owner Selection** - Use round-robin/least-loaded/weighted strategy
4. **Alert Generation** - Trigger notifications if configured
5. **SLA Setting** - Set response time targets
6. **Timeline Logging** - Record routing decision and trace

## Routing Rules Structure

```typescript
interface RoutingRule {
  id: string;
  teamId: string;
  name: string;
  definition: {
    if: Array<{
      field: string;
      op: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 
          'greater_equal' | 'less_equal' | 'contains' | 'not_contains' |
          'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in' |
          'exists' | 'not_exists';
      value: any;
    }>;
    then: {
      assign: string;        // Pool name or owner ID
      priority?: number;     // Assignment priority
      alert?: 'SLACK' | 'EMAIL' | 'WEBHOOK';
      webhook?: string;      // Webhook URL for alerts
      sla?: number;         // SLA in minutes
    };
  };
  enabled: boolean;
  order: number;          // Execution order
}
```

## Example Routing Rules

### High Score to AE Pool A
```typescript
{
  name: "High Score to AE Pool A",
  definition: {
    if: [
      { field: "scoreBand", op: "equals", value: "HIGH" }
    ],
    then: {
      assign: "AE_POOL_A",
      alert: "SLACK",
      sla: 15,
      priority: 1
    }
  },
  enabled: true,
  order: 1
}
```

### Enterprise Leads to Senior AEs
```typescript
{
  name: "Enterprise Leads to Senior AEs",
  definition: {
    if: [
      { field: "fields.employees", op: "greater_equal", value: 1000 },
      { field: "fields.budget", op: "greater_equal", value: 100000 }
    ],
    then: {
      assign: "SENIOR_AE_POOL",
      alert: "SLACK",
      sla: 10,
      priority: 1
    }
  },
  enabled: true,
  order: 2
}
```

### Decision Makers Priority Routing
```typescript
{
  name: "Decision Makers to AE Pool A", 
  definition: {
    if: [
      { field: "fields.title", op: "contains", value: "ceo" }
    ],
    then: {
      assign: "AE_POOL_A",
      alert: "EMAIL",
      sla: 20,
      priority: 2
    }
  },
  enabled: true,
  order: 3
}
```

## Owner Pools & Strategies

### Pool Configuration
```typescript
interface OwnerPool {
  name: string;
  owners: Array<{
    ownerId: string;
    capacity: number;
    currentLoad: number;
    isActive: boolean;
  }>;
  strategy: 'round_robin' | 'least_loaded' | 'weighted';
  lastAssignedIndex: number;
}
```

### Assignment Strategies

**Round Robin:**
- Cycles through available owners in order
- Fair distribution regardless of capacity
- Good for equal skill levels

**Least Loaded:**
- Assigns to owner with lowest current lead count
- Balances workload automatically
- Good for varying processing speeds

**Weighted:**
- Assigns based on owner capacity ratios
- Higher capacity owners get more leads
- Good for varying experience levels

### Default Pool Mapping
```typescript
// Pool assignment based on owner capacity
AE_POOL_A:      capacity >= 50  (High capacity AEs)
AE_POOL_B:      20 <= capacity < 50  (Medium capacity AEs)  
SDR_POOL:       capacity < 20   (SDRs and junior staff)
SENIOR_AE_POOL: capacity >= 100 (Senior AEs)
FAST_TRACK_POOL: capacity >= 30  (Fast response team)
```

## API Endpoints

### Test Routing

```http
POST /routing/test
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "ceo@enterprise.com",
  "name": "John CEO",
  "company": "Enterprise Corp", 
  "score": 95,
  "scoreBand": "HIGH",
  "fields": {
    "title": "CEO",
    "employees": 5000,
    "budget": 500000
  },
  "utm": {
    "source": "google",
    "medium": "cpc"
  }
}
```

**Response:**
```json
{
  "ownerId": "owner_12345",
  "pool": "SENIOR_AE_POOL",
  "reason": "Assigned to owner owner_12345 from pool SENIOR_AE_POOL",
  "trace": [
    {
      "step": "start",
      "result": "initialized",
      "reason": "Starting routing for lead with score 95 (HIGH)"
    },
    {
      "step": "rule_evaluation",
      "rule": "rule_enterprise",
      "result": false,
      "reason": "Evaluating rule \"Enterprise Leads to Senior AEs\""
    },
    {
      "step": "condition",
      "rule": "rule_enterprise",
      "condition": "fields.employees greater_equal 1000",
      "result": true,
      "reason": "Field 'fields.employees' with value '5000' matches condition"
    },
    {
      "step": "pool_assignment",
      "result": "owner_12345",
      "reason": "Selected owner owner_12345 from pool \"SENIOR_AE_POOL\" using least_loaded strategy"
    }
  ],
  "alerts": [
    {
      "type": "SLACK",
      "message": "Lead John CEO routed to SENIOR_AE_POOL via rule \"Enterprise Leads to Senior AEs\""
    }
  ],
  "sla": 10,
  "priority": 1
}
```

### Get Routing Rules

```http
GET /routing/rules
Authorization: Bearer <token>
```

### Create Routing Rule

```http
POST /routing/rules
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "VIP Customers Fast Track",
  "definition": {
    "if": [
      { "field": "fields.vip_status", "op": "equals", "value": true }
    ],
    "then": {
      "assign": "VIP_POOL",
      "alert": "SLACK", 
      "sla": 5,
      "priority": 1
    }
  },
  "enabled": true,
  "order": 1
}
```

### Get Owner Pools

```http
GET /routing/pools
Authorization: Bearer <token>
```

**Response:**
```json
{
  "pools": [
    {
      "name": "AE_POOL_A",
      "owners": 5,
      "strategy": "round_robin"
    },
    {
      "name": "SENIOR_AE_POOL", 
      "owners": 3,
      "strategy": "least_loaded"
    }
  ]
}
```

### Get Routing Statistics

```http
GET /routing/stats?days=30
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalLeads": 1250,
  "routedLeads": 1180,
  "unroutedLeads": 70,
  "poolDistribution": {
    "AE_POOL_A": 450,
    "AE_POOL_B": 380,
    "SDR_POOL": 280,
    "SENIOR_AE_POOL": 70
  },
  "avgRoutingTime": 2.3
}
```

## Integration with Lead Creation

The routing system is automatically integrated into the lead creation workflow:

1. **Lead Submitted** → `POST /api/leads`
2. **Apply Scoring** → Calculate score and band
3. **Run Deduplication** → Check for duplicates
4. **Apply Routing** → Assign to owner/pool based on rules
5. **Update Lead** → Set `lead.ownerId`
6. **Create SLA Clock** → Set response time target
7. **Log Timeline** → Record routing decision and trace
8. **Send Alerts** → Trigger notifications

**Enhanced Lead Response:**
```json
{
  "action": "created",
  "leadId": "lead123",
  "score": 95,
  "band": "HIGH", 
  "tags": ["enterprise", "decision_maker"],
  "ownerId": "owner_12345",
  "pool": "SENIOR_AE_POOL",
  "sla": 10,
  "message": "New lead created successfully with score 95 (HIGH) and routed to owner owner_12345 (SENIOR_AE_POOL)"
}
```

## Field Path Support

The routing system supports nested field paths using dot notation:

```typescript
// Direct fields
'scoreBand'       // lead.scoreBand
'company'         // lead.company

// Nested fields  
'fields.title'    // lead.fields.title
'utm.source'      // lead.utm.source
'fields.contact.role'  // lead.fields.contact.role
```

## Operators Reference

### Comparison Operators
- `equals` / `not_equals` - Exact value matching
- `greater_than` / `less_than` - Numeric comparison
- `greater_equal` / `less_equal` - Numeric comparison with equality

### String Operators
- `contains` / `not_contains` - Substring matching (case-insensitive)
- `starts_with` / `ends_with` - Prefix/suffix matching
- `regex` - Regular expression matching

### Array Operators
- `in` / `not_in` - Value in array
- `exists` / `not_exists` - Field presence check

## Default Routing Rules

The system includes sensible defaults:

1. **High Score → AE Pool A** (SLA: 15 min, Slack alert)
2. **Enterprise Leads → Senior AE Pool** (SLA: 10 min, Slack alert)
3. **Decision Makers → AE Pool A** (SLA: 20 min, Email alert)
4. **Medium Score → AE Pool B** (SLA: 30 min)
5. **Low Score → SDR Pool** (SLA: 60 min)
6. **Paid Search → Fast Track Pool** (SLA: 5 min, Slack alert)

## SLA Management

### Automatic SLA Clock Creation
When a routing rule sets an SLA, the system automatically:
- Creates `SLAClock` record with target time
- Calculates `targetAt` as current time + SLA minutes
- Links to lead for monitoring and escalation

### SLA Monitoring
```sql
-- Find leads approaching SLA breach
SELECT l.*, s.targetAt 
FROM leads l 
JOIN sla_clocks s ON l.id = s.leadId 
WHERE s.targetAt < NOW() + INTERVAL '15 minutes'
  AND s.satisfiedAt IS NULL;
```

## Alert System

### Supported Alert Types

**Slack Alerts:**
- Instant notifications to configured channels
- Rich formatting with lead details
- Links to lead management interface

**Email Alerts:**
- Notifications to owner or manager emails
- Customizable templates
- Lead summary and context

**Webhook Alerts:**
- HTTP POST to custom endpoints
- JSON payload with lead and routing data
- Integration with external systems

### Alert Payload Example
```json
{
  "type": "lead_routed",
  "leadId": "lead123",
  "lead": {
    "name": "John Doe",
    "email": "john@company.com",
    "company": "Acme Corp",
    "score": 85
  },
  "routing": {
    "ownerId": "owner_456",
    "pool": "AE_POOL_A",
    "rule": "High Score to AE Pool A",
    "sla": 15,
    "priority": 1
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Performance Considerations

### Optimization Tips

1. **Order Rules by Frequency** - Place most common matches first
2. **Limit Rule Complexity** - Avoid deeply nested conditions  
3. **Use Efficient Operators** - Prefer `equals` over `regex`
4. **Monitor Pool Balance** - Ensure pools have adequate capacity

### Caching Strategy

- **Rules Cache** - Rules cached per team with TTL
- **Pool State** - Owner capacity and load cached
- **Round-Robin State** - Last assigned index persisted
- **Cache Invalidation** - Updates trigger cache refresh

## Monitoring & Analytics

### Key Metrics
- **Routing Success Rate** - % of leads successfully assigned
- **Average Routing Time** - Time from submission to assignment
- **Pool Distribution** - Lead distribution across pools
- **SLA Compliance** - % of leads meeting SLA targets
- **Owner Utilization** - Load distribution across owners

### Debugging Tools
- **Routing Trace** - Step-by-step execution log
- **Rule Testing** - Test individual rules against sample leads
- **Batch Testing** - Test multiple leads simultaneously
- **Pool Analytics** - Owner capacity and load analysis

## Best Practices

### Rule Design
1. **Start Simple** - Begin with basic score-based routing
2. **Test Thoroughly** - Use `/routing/test` extensively
3. **Monitor Performance** - Track routing success rates
4. **Iterate Gradually** - Make incremental improvements

### Pool Management
1. **Balance Capacity** - Ensure adequate coverage
2. **Monitor Load** - Track owner utilization
3. **Adjust Strategies** - Optimize based on performance
4. **Plan for Growth** - Scale pools with team size

### SLA Management
1. **Set Realistic Targets** - Based on team capabilities
2. **Monitor Compliance** - Track SLA performance
3. **Escalate Appropriately** - Handle SLA breaches
4. **Adjust as Needed** - Refine based on data

This routing system provides enterprise-grade lead assignment with complete flexibility, fairness, and auditability.
