# Lead Enrichment System

The SmartForms AI backend includes a comprehensive lead enrichment system that automatically enhances lead data with company information, mailbox analysis, and competitor detection.

## Overview

The enrichment system provides:
- **Company Data Enrichment** - Size, revenue, location, industry data
- **Mailbox Analysis** - Free email detection and quality scoring
- **Competitor Detection** - Configurable competitor and partner identification
- **Relationship Analysis** - Classify leads as prospects, competitors, partners, vendors
- **Risk Assessment** - Calculate risk levels based on multiple factors
- **Team Configuration** - Customizable settings per team

## Architecture

```
Lead Data → Company API → Mailbox Analysis → Competitor Check → Enriched Lead
    ↓           ↓              ↓                ↓               ↓
  Email      Clearbit      Free Domain     Team Config    fields.enrichment
  Domain     Hunter.io     Detection       Competitor         ↓
  Company    BuiltWith     Risk Score      Database      Timeline Event
```

## Core Enrichment Function

### enrichLead(lead) → Enhanced Lead Data

```typescript
const enrichedLead = await enrichLead(app, {
  email: "john@company.com",
  domain: "company.com", 
  company: "Acme Corp",
  name: "John Doe"
}, teamId);

// Returns lead with enrichment data
{
  ...originalLead,
  fields: {
    enrichment: {
      companySize: "Medium (100-1000)",
      revenue: "$50M",
      location: "San Francisco, CA",
      industry: "Technology",
      isFreeMailbox: false,
      isCompetitor: false,
      emailQuality: 85,
      relationship: "prospect",
      riskLevel: "low",
      enrichmentSources: ["company_api", "mailbox_analysis", "relationship_analysis"],
      enrichedAt: "2024-01-01T12:00:00Z"
    }
  }
}
```

## Company Data Enrichment

### Features

**Multi-Provider Support:**
- **Clearbit Company API** - Comprehensive company data
- **Hunter.io** - Company info and social profiles  
- **BuiltWith** - Technology stack detection
- **Domain Heuristics** - Smart inference from domain patterns

**Data Points Extracted:**
```typescript
{
  companySize: "Enterprise (10000+)",    // Standardized size categories
  revenue: "$100M+",                     // Annual revenue estimates
  location: "San Francisco, CA",         // Headquarters location
  industry: "Technology",                // Business sector
  founded: "2010",                       // Company founding year
  employees: 5000,                       // Employee count
  funding: "Series C ($100M)",           // Funding stage/amount
  techStack: ["React", "AWS", "Salesforce"], // Technology stack
  socialProfiles: {
    linkedin: "https://linkedin.com/company/acme",
    twitter: "https://twitter.com/acmecorp"
  }
}
```

**Smart Size Classification:**
- **Enterprise (10000+)** → Fortune 500, global corporations
- **Large (1000-5000)** → Established companies, regional leaders
- **Medium (100-1000)** → Growing businesses, mid-market
- **Startup (10-100)** → Early-stage companies, tech startups
- **Small (1-50)** → Small businesses, local companies

### Domain Analysis Heuristics

**Size Indicators:**
```typescript
// Enterprise indicators
"enterprise", "corp", "global", "international" → Enterprise (10000+)

// Large company indicators  
"group", "systems", "solutions", "technologies" → Large (1000-5000)

// Medium company indicators
"company", "inc", "llc" → Medium (100-1000)

// Startup indicators
"startup", "labs", "studio", ".io", ".ai" → Startup (10-100)
```

**Industry Detection:**
```typescript
// Technology
"tech", "software", "app", "digital", "cloud", ".io", ".ai" → Technology

// Finance
"bank", "finance", "capital", "invest", "fund" → Financial Services

// Healthcare  
"health", "medical", "pharma", "bio", "care" → Healthcare

// Education
"edu", "university", "school", "college", ".edu" → Education
```

**Location Inference:**
```typescript
// Country TLDs
".uk" → United Kingdom, ".ca" → Canada, ".au" → Australia
".de" → Germany, ".fr" → France, ".jp" → Japan

// Domain patterns
"usa", "america" → United States
"europe", "eu" → Europe  
"asia", "apac" → Asia Pacific
```

## Mailbox Analysis

### Free Email Detection

**Comprehensive Provider List:**
```typescript
// Major providers
gmail.com, yahoo.com, hotmail.com, outlook.com, aol.com, icloud.com

// International providers
yandex.com, mail.ru, qq.com, 163.com, naver.com, web.de, orange.fr

// Privacy-focused
protonmail.com, tutanota.com, mailfence.com, hushmail.com

// Disposable/temporary
10minutemail.com, guerrillamail.com, mailinator.com, tempmail.org
```

**Risk Assessment:**
```typescript
{
  isFreeMailbox: true,
  provider: "Gmail",
  businessDomain: false,
  disposableEmail: false,
  riskLevel: "medium",        // low, medium, high
  confidence: 0.95
}
```

**Email Quality Scoring (0-100):**
```typescript
// Scoring factors
-60 points: Disposable email (throwaway.email)
-30 points: Free email (gmail.com)  
-25 points: Suspicious patterns (test@, temp@, admin@)
+10 points: Business domain indicators
-40 points: Invalid email format

// Quality categories
90-100: Excellent (business domain, validated)
70-89:  Good (business domain or high-quality free)
50-69:  Fair (free email, basic validation)
30-49:  Poor (suspicious patterns, low confidence)
0-29:   Very Poor (disposable, invalid format)
```

### Business Domain Detection

**Business Indicators:**
```typescript
// Domain patterns
"corp", "inc", "llc", "ltd", "company", "group", "enterprise"
"solutions", "systems", "technologies", "consulting", "services"

// Industry terms
"bank", "finance", "capital", "health", "medical", "pharma"
"law", "legal", "attorney", "real", "estate", "manufacturing"

// Structure analysis
mail.company.com, email.company.com → Business subdomain
short-domain.com (≤6 chars) → Likely business
```

## Competitor Detection

### Configuration System

**Team-Specific Competitor Lists:**
```json
{
  "competitors": [
    {
      "name": "Typeform",
      "domains": ["typeform.com", "typeform.io"],
      "keywords": ["typeform", "type form"],
      "type": "direct",
      "riskLevel": "high",
      "notes": "Direct form builder competitor"
    },
    {
      "name": "HubSpot", 
      "domains": ["hubspot.com"],
      "keywords": ["hubspot", "hub spot"],
      "type": "indirect",
      "riskLevel": "high",
      "notes": "CRM and marketing automation competitor"
    }
  ],
  "partnerCompanies": ["salesforce.com", "pipedrive.com"],
  "vendorCompanies": ["aws.amazon.com", "stripe.com"],
  "autoDetectKeywords": ["form builder", "survey tool", "automation"],
  "enabled": true
}
```

**Default Competitors Included:**
- **Direct Competitors** → Typeform, Jotform, Google Forms, Microsoft Forms, Formstack, Wufoo
- **Indirect Competitors** → Zapier, HubSpot (workflow/automation)
- **Partners** → Salesforce, Pipedrive, Zoho, Freshworks
- **Vendors** → AWS, Stripe, Twilio, SendGrid

### Detection Methods

**Domain Matching (95% confidence):**
```typescript
// Exact domain match
"typeform.com" → Typeform competitor detected

// Subdomain match  
"app.typeform.com" → Typeform competitor detected
```

**Company Name Matching (90% confidence):**
```typescript
// Exact company name
"Typeform Inc." → Typeform competitor detected

// Keyword matching
"Type Form Solutions" → Typeform competitor detected
```

**Email Pattern Matching (60% confidence):**
```typescript
// Email contains competitor keywords
"john@typeform-consulting.com" → Typeform-related detected
```

**Auto-Detection (60% confidence):**
```typescript
// Bio/company description contains keywords
"We build form builders like Typeform" → Competitor detected
```

### Relationship Classification

**Relationship Types:**
- **Competitor** → Direct or indirect business competitor
- **Partner** → Integration partner or channel partner
- **Vendor** → Service provider or supplier
- **Prospect** → Potential customer (default)
- **Unknown** → Insufficient data for classification

**Risk Levels:**
- **High Risk** → Direct competitors, high-threat companies
- **Medium Risk** → Indirect competitors, unknown relationships
- **Low Risk** → Partners, vendors, clear prospects

## API Endpoints

### Lead Enrichment

#### Single Lead Enrichment

```http
POST /enrich/lead
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "john@company.com",
  "domain": "company.com",
  "company": "Acme Corp",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "enrichedLead": {
    "email": "john@company.com",
    "domain": "company.com", 
    "company": "Acme Corp",
    "name": "John Doe",
    "fields": {
      "enrichment": {
        "companySize": "Medium (100-1000)",
        "revenue": "$50M",
        "location": "San Francisco, CA",
        "industry": "Technology",
        "isFreeMailbox": false,
        "isCompetitor": false,
        "emailQuality": 85,
        "relationship": "prospect",
        "riskLevel": "low",
        "enrichmentSources": ["company_api", "mailbox_analysis"],
        "enrichedAt": "2024-01-01T12:00:00Z"
      }
    }
  },
  "message": "Lead enrichment completed successfully"
}
```

#### Batch Lead Enrichment

```http
POST /enrich/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "leads": [
    {"email": "john@company1.com", "company": "Company 1"},
    {"email": "jane@company2.com", "company": "Company 2"}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "processed": 2,
  "enrichedLeads": [
    { /* enriched lead 1 */ },
    { /* enriched lead 2 */ }
  ],
  "message": "Batch enrichment completed: 2 leads processed"
}
```

### Enrichment Statistics

```http
GET /enrich/stats?days=30
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalEnriched": 500,
  "enrichmentRate": 0.85,
  "sourceBreakdown": {
    "company_api": 450,
    "mailbox_analysis": 500,
    "relationship_analysis": 480
  },
  "qualityMetrics": {
    "averageEmailQuality": 72.5,
    "freeMailboxRate": 0.35,
    "competitorRate": 0.05,
    "businessDomainRate": 0.65
  }
}
```

### Competitor Management

#### Get Competitor Configuration

```http
GET /enrich/competitors
Authorization: Bearer <token>
```

#### Update Competitor Configuration

```http
PUT /enrich/competitors
Content-Type: application/json
Authorization: Bearer <token>

{
  "competitors": [
    {
      "name": "Custom Competitor",
      "domains": ["competitor.com"],
      "keywords": ["competitor", "rival"],
      "type": "direct",
      "riskLevel": "high"
    }
  ],
  "enabled": true
}
```

#### Add Single Competitor

```http
POST /enrich/competitors
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "New Competitor",
  "domains": ["newcompetitor.com"],
  "keywords": ["new competitor"],
  "type": "direct", 
  "riskLevel": "medium",
  "notes": "Recently identified competitor"
}
```

#### Remove Competitor

```http
DELETE /enrich/competitors/Typeform
Authorization: Bearer <token>
```

#### Competitor Statistics

```http
GET /enrich/competitors/stats?days=30
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalCompetitorLeads": 25,
  "competitorBreakdown": [
    {
      "name": "Typeform",
      "count": 15,
      "type": "direct",
      "riskLevel": "high"
    },
    {
      "name": "HubSpot",
      "count": 10, 
      "type": "indirect",
      "riskLevel": "high"
    }
  ],
  "recentTrends": [
    {"date": "2024-01-01", "count": 3},
    {"date": "2024-01-02", "count": 5}
  ]
}
```

## Enrichment Data Structure

### Complete Enrichment Object

```json
{
  "companySize": "Medium (100-1000)",
  "revenue": "$50M", 
  "location": "San Francisco, CA",
  "industry": "Technology",
  "isFreeMailbox": false,
  "isCompetitor": false,
  "emailQuality": 85,
  "relationship": "prospect",
  "riskLevel": "low",
  "enrichmentSources": [
    "company_api",
    "mailbox_analysis", 
    "relationship_analysis"
  ],
  "enrichedAt": "2024-01-01T12:00:00Z"
}
```

### Team Settings Structure

**Enrichment Configuration:**
```json
{
  "enrichment": {
    "competitors": {
      "enabled": true,
      "competitors": [
        {
          "name": "Typeform",
          "domains": ["typeform.com"],
          "keywords": ["typeform"],
          "type": "direct",
          "riskLevel": "high"
        }
      ],
      "partnerCompanies": ["salesforce.com"],
      "vendorCompanies": ["stripe.com"],
      "autoDetectKeywords": ["form builder"]
    },
    "customFreeDomains": ["company-email.com"],
    "companyApiEnabled": true,
    "mailboxAnalysisEnabled": true,
    "competitorDetectionEnabled": true
  }
}
```

## Integration with Lead Pipeline

### Pipeline Integration

The enrichment system is integrated into the complete lead processing pipeline:

```typescript
// In webhook ingestion, email processing, CSV import, etc.
const enrichedLead = await enrichLead(app, leadData, teamId);

// Enrichment data is available for scoring and routing
const scoringResult = await applyScoring(app, enrichedLead, config, rules);
const routingResult = await routeLead(app, enrichedLead, routingRules);
```

### Scoring Integration

**Enrichment-Based Scoring Rules:**
```json
{
  "if": [
    {"field": "enrichment.companySize", "op": "=", "value": "Enterprise (10000+)"}
  ],
  "then": {
    "add": 25,
    "tag": "enterprise_prospect"
  }
}

{
  "if": [
    {"field": "enrichment.isCompetitor", "op": "=", "value": true}
  ],
  "then": {
    "add": -50,
    "tag": "competitor_lead"
  }
}

{
  "if": [
    {"field": "enrichment.isFreeMailbox", "op": "=", "value": true}
  ],
  "then": {
    "add": -10,
    "tag": "free_email"
  }
}
```

### Routing Integration

**Enrichment-Based Routing Rules:**
```json
{
  "if": [
    {"field": "enrichment.relationship", "op": "=", "value": "competitor"}
  ],
  "then": {
    "assign": "COMPETITOR_POOL",
    "alert": "SLACK",
    "priority": "high"
  }
}

{
  "if": [
    {"field": "enrichment.companySize", "op": "in", "value": ["Enterprise (10000+)", "Large (1000-5000)"]}
  ],
  "then": {
    "assign": "ENTERPRISE_POOL",
    "sla": 15
  }
}
```

## Performance and Caching

### Caching Strategy

**Company Data Caching:**
- Cache enrichment data for 30 days per domain
- Reuse cached data across leads from same company
- Smart cache invalidation on data updates

**Batch Processing:**
- Process leads in batches of 10 to respect API rate limits
- Parallel processing within batches for performance
- Graceful degradation on API failures

### Rate Limiting

**External API Management:**
- Track API usage per provider
- Implement exponential backoff on rate limits
- Fallback to heuristics when APIs unavailable

**Performance Optimization:**
- Parallel enrichment operations (company + mailbox + competitor)
- Efficient database queries with proper indexing
- Memory-efficient processing for large batches

## Security and Privacy

### Data Protection

**Sensitive Data Handling:**
- Hash email addresses for caching
- Encrypt enrichment data at rest
- Implement data retention policies
- Support GDPR deletion requests

**API Security:**
- Secure credential storage for external APIs
- Rate limiting and abuse protection
- Audit logging for all enrichment activities
- Team-based access control

### Compliance

**Privacy Compliance:**
- GDPR-compliant data processing
- User consent management
- Data portability support
- Right to deletion implementation

**Business Compliance:**
- Respect external API terms of service
- Implement proper attribution
- Monitor data usage and costs
- Maintain data accuracy standards

## Monitoring and Alerting

### Key Metrics

**Enrichment Performance:**
- **Enrichment Rate** → % of leads successfully enriched
- **API Response Time** → Average latency for external APIs
- **Cache Hit Rate** → % of requests served from cache
- **Error Rate** → % of enrichment failures

**Data Quality:**
- **Email Quality Score** → Average email quality across leads
- **Free Mailbox Rate** → % of leads with free email addresses
- **Competitor Detection Rate** → % of competitor leads identified
- **Business Domain Rate** → % of leads with business email domains

### Recommended Alerts

**System Health:**
- Enrichment error rate > 10%
- API response time > 5 seconds
- Cache hit rate < 50%
- External API quota approaching limits

**Business Intelligence:**
- Competitor lead spike (>5% increase)
- Low email quality trend (<60 average)
- High free mailbox rate (>50%)
- Unusual industry/size distribution

## Advanced Features

### Custom Enrichment Providers

**Plugin Architecture:**
```typescript
interface EnrichmentProvider {
  name: string;
  enrich(domain: string, company?: string): Promise<CompanyEnrichmentData>;
  isAvailable(): boolean;
  getRateLimit(): number;
}

// Register custom provider
registerEnrichmentProvider(new CustomProvider());
```

### Machine Learning Enhancement

**Pattern Recognition:**
- Learn from successful enrichments
- Improve domain-to-company-size mapping
- Enhance competitor detection accuracy
- Optimize API provider selection

**Predictive Scoring:**
- Predict lead quality based on enrichment data
- Score company fit based on historical conversions
- Risk assessment using multiple enrichment factors

This enrichment system provides enterprise-grade lead intelligence with comprehensive data enhancement, competitor detection, and team-specific customization.

