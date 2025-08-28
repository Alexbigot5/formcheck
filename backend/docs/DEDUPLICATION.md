# Lead Deduplication System

The SmartForms AI backend includes a comprehensive lead deduplication system that prevents duplicate leads and intelligently merges related data.

## Overview

The deduplication system automatically:
- **Detects** potential duplicate leads using multiple matching strategies
- **Merges** duplicate leads while preserving all important data
- **Logs** all deduplication decisions for audit trails
- **Maintains** data integrity across messages, events, and relationships

## How It Works

### 1. Key Generation (`buildKeys`)

When a lead is processed, the system generates deduplication keys:

```typescript
interface DedupeKeys {
  emailHash?: string;    // SHA-256 hash of normalized email
  domain?: string;       // Company domain for business leads
  nameKey?: string;      // Normalized name for fuzzy matching
}
```

**Email Hash:**
- Normalizes email (lowercase, trimmed)
- Hashes with SHA-256 for privacy
- Primary matching strategy

**Domain Extraction:**
- Extracts from email domain
- Derives from company name
- Excludes personal email providers (Gmail, Yahoo, etc.)

**Name Key:**
- Removes prefixes/suffixes (Mr., Jr., etc.)
- Sorts name parts for consistent matching
- Enables fuzzy name matching

### 2. Duplicate Detection (`findDuplicate`)

The system uses configurable policies to find duplicates:

```typescript
interface DedupePolicy {
  emailExact: boolean;              // Exact email match
  domainFuzzy: boolean;             // Same domain + similar name
  nameFuzzy: boolean;               // Fuzzy name matching
  nameSimilarityThreshold: number;  // 0.0-1.0 similarity threshold
  domainNameThreshold: number;      // 0.0-1.0 domain+name threshold
  timeWindowHours?: number;         // Time-based filtering
  prioritizeRecent: boolean;        // Prefer recent leads
  prioritizeHighScore: boolean;     // Prefer high-scoring leads
}
```

**Matching Strategies:**
1. **Email Exact** (Highest Priority) - Perfect email hash match
2. **Domain Fuzzy** - Same domain + similar name (configurable threshold)
3. **Name Fuzzy** - Similar names across different domains

### 3. Lead Merging (`mergeLeads`)

When duplicates are found, the system intelligently merges them:

```typescript
interface MergeStrategy {
  scoreStrategy: 'highest' | 'latest' | 'sum' | 'average';
  dataStrategy: 'primary' | 'latest' | 'merge_non_null';
  messageStrategy: 'consolidate' | 'keep_primary';
  eventStrategy: 'consolidate' | 'keep_primary';
}
```

**Merge Process:**
1. **Determine Primary** - Higher score, more complete data, or older lead
2. **Consolidate Messages** - Transfer all messages to primary lead
3. **Merge Timeline Events** - Combine activity history
4. **Update Lead Data** - Merge fields based on strategy
5. **Calculate Final Score** - Apply scoring strategy
6. **Clean Up** - Delete duplicate lead and orphaned data

## Usage Examples

### Basic Lead Creation with Deduplication

```typescript
import { deduplicateLead } from './modules/dedupe';

const result = await deduplicateLead(app, {
  email: 'john@acme.com',
  name: 'John Doe',
  company: 'Acme Corp',
  source: 'website_form',
  score: 75
}, teamId);

console.log(result.action); // 'created', 'merged', or 'skipped'
```

### Custom Deduplication Policy

```typescript
const customPolicy = {
  emailExact: true,
  domainFuzzy: true,
  nameFuzzy: false,
  nameSimilarityThreshold: 0.9,
  domainNameThreshold: 0.8,
  timeWindowHours: 24, // Only check last 24 hours
  prioritizeHighScore: true
};

const result = await deduplicateLead(app, leadData, teamId, {
  policy: customPolicy
});
```

### Analyze Duplicates Without Creating

```typescript
const analysis = await analyzeDuplicates(app, {
  email: 'john@acme.com',
  name: 'John Doe'
}, teamId);

console.log(analysis.matches); // Array of potential matches
console.log(analysis.recommendation); // Recommended action
```

### Preview Merge Operation

```typescript
const preview = await previewMerge(app, primaryLeadId, duplicateLeadId);

console.log(preview.dataChanges);        // What would change
console.log(preview.messagesToConsolidate); // Messages to move
console.log(preview.finalScore);        // Final calculated score
```

## API Endpoints

### Create Lead with Deduplication
```http
POST /api/leads
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "john@acme.com",
  "name": "John Doe",
  "company": "Acme Corp",
  "source": "website_form",
  "score": 75
}
```

**Response:**
```json
{
  "action": "merged",
  "leadId": "clp123...",
  "duplicateId": "clp456...",
  "message": "Lead merged with existing lead. Consolidated 3 messages and 5 events."
}
```

### Analyze Potential Duplicates
```http
POST /api/leads/analyze-dedupe
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "john@acme.com",
  "name": "John Doe"
}
```

### Preview Merge
```http
POST /api/leads/{primaryId}/merge/{duplicateId}/preview
Authorization: Bearer <token>
```

## Configuration

### Default Policies

```typescript
const DEFAULT_DEDUPE_POLICY = {
  emailExact: true,
  domainFuzzy: true,
  nameFuzzy: true,
  nameSimilarityThreshold: 0.8,
  domainNameThreshold: 0.7,
  timeWindowHours: 24 * 7, // 7 days
  prioritizeRecent: false,
  prioritizeHighScore: true
};

const DEFAULT_MERGE_STRATEGY = {
  scoreStrategy: 'highest',
  dataStrategy: 'merge_non_null',
  messageStrategy: 'consolidate',
  eventStrategy: 'consolidate'
};
```

## Audit Trail

All deduplication decisions are logged:

### Audit Table
```sql
INSERT INTO audits (
  team_id, entity_type, entity_id, action, after
) VALUES (
  'team123', 'Lead', 'lead123', 'dedupe_merged', 
  '{"decision": "duplicate_found_and_merged", "keys": {...}, "consolidatedMessages": 3}'
);
```

### Timeline Events
```sql
INSERT INTO timeline_events (
  lead_id, type, payload
) VALUES (
  'lead123', 'SCORE_UPDATED',
  '{"action": "deduplication", "decision": "duplicate_found_and_merged"}'
);
```

## Performance Considerations

### Indexes
The system relies on database indexes for performance:
- `leads(email)` - Email-based lookups
- `leads(domain)` - Domain-based queries
- `leads(created_at)` - Time window filtering
- `lead_dedupe_keys(email_hash)` - Primary deduplication index
- `lead_dedupe_keys(domain)` - Domain matching

### Optimization Tips
1. **Limit Time Windows** - Use `timeWindowHours` to reduce search scope
2. **Tune Thresholds** - Adjust similarity thresholds based on data quality
3. **Monitor Performance** - Watch query execution times for large datasets
4. **Batch Processing** - Consider async processing for high-volume imports

## Error Handling

The system includes comprehensive error handling:

```typescript
try {
  const result = await deduplicateLead(app, leadData, teamId);
} catch (error) {
  // System falls back to creating new lead without deduplication
  console.error('Deduplication failed:', error);
}
```

**Fallback Behavior:**
- If deduplication fails, creates new lead without merging
- Logs error for investigation
- Ensures lead creation always succeeds
- Maintains system reliability

## Security & Privacy

### Data Protection
- Email addresses are hashed using SHA-256
- Original emails never stored in dedupe keys
- Multi-tenant isolation prevents cross-team access

### Audit Compliance
- Complete audit trail of all merge decisions
- Immutable timeline events
- User attribution for all actions
- Regulatory compliance support

## Monitoring & Alerting

### Key Metrics
- Deduplication rate (% of leads merged)
- False positive rate (incorrect merges)
- Performance metrics (processing time)
- Error rates and fallback usage

### Recommended Alerts
- High error rates in deduplication
- Unusual merge patterns
- Performance degradation
- Data quality issues

This deduplication system ensures data quality while maintaining performance and providing complete auditability for enterprise compliance requirements.
