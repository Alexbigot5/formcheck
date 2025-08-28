# Lead Scoring System

The SmartForms AI backend includes a powerful, configurable lead scoring system that automatically evaluates and prioritizes leads based on multiple criteria.

## Overview

The scoring system provides:
- **Configurable Weights** - Base scoring for different lead attributes
- **Negative Rules** - Penalties for undesirable characteristics  
- **IF_THEN Rules** - Complex conditional logic with actions
- **Score Bands** - Automatic categorization (LOW/MEDIUM/HIGH)
- **Detailed Tracing** - Complete audit trail of scoring decisions

## Core Function: `applyScoring`

```typescript
const result = await applyScoring(app, lead, config, rules);
// Returns: { score, band, trace, tags, routing, sla }
```

### Scoring Process

1. **Base Weights** - Apply weights from `config.weights`
2. **Negative Rules** - Apply penalties from `config.negative`  
3. **IF_THEN Rules** - Execute conditional rules in order
4. **Weight Rules** - Apply additional weight-based rules
5. **Band Calculation** - Determine score band from final score

## Configuration Structure

### Scoring Config

```typescript
interface ScoringConfig {
  weights: Record<string, number>;     // Field weights
  bands: {                            // Score band thresholds
    low: { min: number; max: number };
    medium: { min: number; max: number };
    high: { min: number; max: number };
  };
  negative: Array<{                   // Penalty rules
    field: string;
    op: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
    value: any;
    penalty: number;
    reason: string;
  }>;
  enrichment: Record<string, any>;    // Additional metadata
  version: number;                    // Config version
}
```

### Scoring Rules

```typescript
interface ScoringRule {
  type: 'IF_THEN' | 'WEIGHT';
  definition: {
    // IF_THEN rules
    if?: Array<{
      field: string;
      op: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 
          'greater_equal' | 'less_equal' | 'contains' | 'not_contains' |
          'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in' |
          'exists' | 'not_exists';
      value: any;
    }>;
    then?: {
      add?: number;        // Add points
      multiply?: number;   // Multiply current score
      tag?: string;        // Add tag
      route?: string;      // Set routing
      sla?: number;        // Set SLA (minutes)
    };
    
    // WEIGHT rules
    weight?: number;
    field?: string;
  };
  enabled: boolean;
  order: number;          // Execution order
}
```

## Example Configurations

### Default Weights

```typescript
const weights = {
  'email': 5,                    // Has email address
  'name': 3,                     // Has name
  'company': 8,                  // Has company
  'phone': 4,                    // Has phone
  'fields.budget': 0.001,        // $1 = 0.001 points
  'fields.employees': 0.1,       // 1 employee = 0.1 points
  'fields.title': 5,             // Has job title
  'utm.source': 2,               // Has UTM source
  'utm.medium': 2                // Has UTM medium
};
```

### Sample IF_THEN Rules

```typescript
// High budget rule
{
  type: 'IF_THEN',
  definition: {
    if: [
      { field: 'fields.budget', op: 'greater_equal', value: 10000 }
    ],
    then: {
      add: 15,
      tag: 'high_budget',
      route: 'ae_pool_a',
      sla: 15
    }
  },
  enabled: true,
  order: 1
}

// Decision maker rule
{
  type: 'IF_THEN',
  definition: {
    if: [
      { field: 'fields.title', op: 'contains', value: 'ceo' },
      { field: 'fields.title', op: 'contains', value: 'founder' }
    ],
    then: {
      add: 20,
      tag: 'decision_maker',
      route: 'senior_ae_pool'
    }
  },
  enabled: true,
  order: 2
}
```

### Negative Rules

```typescript
const negative = [
  {
    field: 'email',
    op: 'contains',
    value: 'test',
    penalty: 20,
    reason: 'Test email detected'
  },
  {
    field: 'company',
    op: 'equals',
    value: '',
    penalty: 10,
    reason: 'Missing company information'
  }
];
```

## API Endpoints

### Test Scoring

```http
POST /scoring/test
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "john.doe@acme.com",
  "name": "John Doe",
  "company": "Acme Corp",
  "fields": {
    "budget": 50000,
    "title": "CEO",
    "employees": 100
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
  "score": 87,
  "band": "HIGH",
  "trace": [
    {
      "step": "weights",
      "field": "email",
      "value": "john.doe@acme.com",
      "operation": "weight_application",
      "points": 5,
      "total": 5,
      "reason": "Field 'email' with value 'john.doe@acme.com' applied weight 5 for 5 points"
    },
    {
      "step": "if_then",
      "rule": "rule123",
      "operation": "rule_application", 
      "points": 15,
      "total": 87,
      "reason": "IF_THEN rule triggered: budget >= 10000 → add 15 points"
    }
  ],
  "tags": ["high_budget", "decision_maker"],
  "routing": "ae_pool_a",
  "sla": 15
}
```

### Get Configuration

```http
GET /scoring/config
Authorization: Bearer <token>
```

### Update Configuration

```http
POST /scoring/config
Content-Type: application/json
Authorization: Bearer <token>

{
  "weights": {
    "email": 5,
    "company": 10
  },
  "bands": {
    "low": { "min": 0, "max": 30 },
    "medium": { "min": 31, "max": 70 },
    "high": { "min": 71, "max": 100 }
  },
  "negative": []
}
```

### Create Scoring Rule

```http
POST /scoring/rules
Content-Type: application/json
Authorization: Bearer <token>

{
  "type": "IF_THEN",
  "definition": {
    "if": [
      { "field": "fields.budget", "op": "greater_equal", "value": 10000 }
    ],
    "then": {
      "add": 15,
      "tag": "high_budget",
      "route": "ae_pool_a",
      "sla": 15
    }
  },
  "enabled": true,
  "order": 1
}
```

### Batch Testing

```http
POST /scoring/batch-test
Content-Type: application/json
Authorization: Bearer <token>

{
  "leads": [
    {
      "email": "lead1@company.com",
      "name": "Lead One",
      "fields": { "budget": 5000 }
    },
    {
      "email": "lead2@enterprise.com", 
      "name": "Lead Two",
      "fields": { "budget": 50000 }
    }
  ]
}
```

## Field Path Support

The scoring system supports nested field paths using dot notation:

```typescript
// Direct fields
'email'           // lead.email
'company'         // lead.company

// Nested fields  
'fields.budget'   // lead.fields.budget
'utm.source'      // lead.utm.source
'fields.contact.title'  // lead.fields.contact.title
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

## Integration with Lead Creation

The scoring system is automatically integrated into the lead creation workflow:

1. **Lead Submission** → `POST /api/leads`
2. **Apply Scoring** → Calculate score, band, tags
3. **Run Deduplication** → Check for duplicates with scored lead
4. **Create/Merge Lead** → Store final lead with score
5. **Log Timeline** → Record scoring trace and decisions

## Performance Considerations

### Optimization Tips

1. **Order Rules by Impact** - Place high-impact rules first
2. **Limit Rule Complexity** - Avoid deeply nested conditions
3. **Use Efficient Operators** - Prefer `equals` over `regex`
4. **Monitor Execution Time** - Track scoring performance

### Caching

The system caches scoring configurations:
- Configurations cached per team
- Rules cached and ordered by execution priority
- Cache invalidated on configuration updates

## Monitoring & Analytics

### Key Metrics
- Average scoring time per lead
- Score distribution across bands
- Rule execution frequency
- Configuration version usage

### Debugging Tools
- **Scoring Trace** - Step-by-step execution log
- **Rule Testing** - Test individual rules
- **Batch Testing** - Test multiple leads simultaneously
- **Configuration History** - Track configuration changes

## Best Practices

### Rule Design
1. **Start Simple** - Begin with basic weight rules
2. **Test Thoroughly** - Use `/scoring/test` extensively  
3. **Monitor Impact** - Track conversion rates by score band
4. **Iterate Gradually** - Make incremental improvements

### Configuration Management
1. **Version Control** - All changes create new versions
2. **A/B Testing** - Test new configurations on subsets
3. **Rollback Plan** - Keep previous configurations accessible
4. **Documentation** - Document rule business logic

### Performance
1. **Rule Ordering** - Optimize execution order
2. **Condition Efficiency** - Use fast operators when possible
3. **Batch Operations** - Process multiple leads together
4. **Monitoring** - Track scoring performance metrics

This scoring system provides enterprise-grade lead qualification with complete flexibility and auditability.
