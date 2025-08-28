# Social Media Ingestion System

The SmartForms AI backend includes comprehensive social media ingestion capabilities for LinkedIn CSV imports and Instagram DM processing.

## Overview

The social ingestion system provides:
- **LinkedIn CSV Import** - Bulk lead import with intelligent column mapping
- **Instagram DM Processing** - Real-time DM-to-lead conversion
- **Smart Data Extraction** - Extract company, phone, intent from social profiles
- **Complete Pipeline** - Dedupe → Enrichment → Scoring → Routing → SLA
- **Social Intelligence** - Engagement analysis, profile completeness scoring
- **Flexible Mapping** - Configurable column mapping for various CSV formats

## LinkedIn CSV Import

### Features

**Intelligent Column Mapping:**
- Auto-detect common LinkedIn export formats
- Flexible mapping for custom CSV structures
- Support for multiple name formats (firstName+lastName or fullName)
- Extract company, title, contact info, and social data

**Bulk Processing:**
- Process thousands of leads efficiently
- Batch database operations for performance
- Individual error isolation (continue on failures)
- Comprehensive progress tracking and reporting

**Advanced Options:**
- **Dry Run Mode** - Preview import without saving data
- **Deduplication Policy** - Skip, merge, or create new leads
- **Custom Source Tagging** - Track import source and campaign
- **Column Validation** - Detect missing required fields

### API Endpoints

#### Upload and Process CSV

```http
POST /ingest/linkedin-csv
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: linkedin_export.csv
- columnMapping: {
    "email": "Email Address",
    "firstName": "First Name", 
    "lastName": "Last Name",
    "company": "Company",
    "title": "Position"
  }
- skipFirstRow: true
- dedupePolicy: "merge"
- source: "linkedin_csv"
- dryRun: false
```

**Response:**
```json
{
  "success": true,
  "processed": 150,
  "created": 120,
  "merged": 25,
  "skipped": 3,
  "errors": 2,
  "results": [
    {
      "row": 1,
      "email": "john@company.com",
      "name": "John Doe",
      "action": "created",
      "leadId": "lead_123",
      "score": 75,
      "band": "MEDIUM",
      "ownerId": "owner_456"
    }
  ],
  "message": "LinkedIn CSV import completed: 120 created, 25 merged, 3 skipped, 2 errors",
  "dryRun": false
}
```

#### Get CSV Template

```http
GET /ingest/linkedin-csv/template
Authorization: Bearer <token>
```

**Response:**
```json
{
  "filename": "linkedin_import_template.csv",
  "headers": [
    "First Name", "Last Name", "Email Address", 
    "Company", "Position", "Phone", "Website"
  ],
  "sampleData": [
    {
      "First Name": "John",
      "Last Name": "Doe", 
      "Email Address": "john@company.com",
      "Company": "Acme Corp",
      "Position": "VP of Sales"
    }
  ],
  "columnMappingOptions": {
    "email": "Email Address, Email, E-mail",
    "firstName": "First Name, Given Name, fname",
    "company": "Company, Organization, Company Name"
  }
}
```

#### Analyze CSV Before Import

```http
POST /ingest/linkedin-csv/analyze
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: linkedin_export.csv
```

**Response:**
```json
{
  "totalRows": 150,
  "headers": ["First Name", "Last Name", "Email Address", "Company"],
  "sampleData": [
    {"First Name": "John", "Last Name": "Doe", "Email Address": "john@company.com"}
  ],
  "suggestedMapping": {
    "email": "Email Address",
    "firstName": "First Name",
    "lastName": "Last Name", 
    "company": "Company"
  },
  "issues": []
}
```

### Column Mapping Options

**Standard LinkedIn Export Fields:**
```json
{
  "email": "Email Address",
  "firstName": "First Name", 
  "lastName": "Last Name",
  "company": "Company",
  "title": "Position",
  "location": "Location",
  "industry": "Industry",
  "connectionDate": "Connected On",
  "linkedinUrl": "Profile URL"
}
```

**Sales Navigator Export Fields:**
```json
{
  "email": "Email",
  "fullName": "Full Name",
  "company": "Current Company",
  "title": "Current Title", 
  "location": "Location",
  "industry": "Industry"
}
```

**Custom CSV Fields:**
```json
{
  "email": "Contact Email",
  "fullName": "Contact Name",
  "company": "Organization",
  "phone": "Phone Number",
  "website": "Company Website",
  "notes": "Notes"
}
```

### Data Processing Pipeline

**1. CSV Parsing:**
```typescript
// Parse with flexible options
const records = parse(csvContent, {
  columns: true,        // Use first row as headers
  skip_empty_lines: true,
  trim: true,
  relax_quotes: true
});
```

**2. Column Mapping:**
```typescript
// Flexible mapping with fallbacks
const getValue = (mappingKey: string): string | undefined => {
  const columnName = mapping[mappingKey];
  // Try exact match, then case-insensitive
  return row[columnName] || row[findCaseInsensitive(columnName)];
};
```

**3. Lead Data Extraction:**
```typescript
{
  email: "john@company.com",           // Required field
  name: "John Doe",                    // fullName or firstName+lastName
  company: "Acme Corp",                // Company name
  domain: "company.com",               // Extracted from email
  phone: "+1-555-123-4567",           // Phone number
  fields: {
    title: "VP of Sales",              // Job title
    location: "San Francisco, CA",     // Geographic location
    industry: "Technology",            // Industry sector
    connectionDate: "2024-01-15",      // LinkedIn connection date
    linkedinUrl: "https://linkedin.com/in/johndoe",
    importSource: "linkedin_csv",      // Source tracking
    importedAt: "2024-01-01T12:00:00Z" // Import timestamp
  },
  utm: {
    source: "linkedin",                // Traffic source
    medium: "csv_import",              // Import method
    campaign: "linkedin_connections"   // Campaign tracking
  }
}
```

## Instagram DM Processing

### Features

**Rich Profile Analysis:**
- Extract contact info from Instagram bio
- Analyze engagement level (followers, posts, ratio)
- Calculate profile completeness score
- Detect business vs personal accounts

**Message Intelligence:**
- Intent classification (inquiry, demo, pricing, support)
- Urgency detection (high, medium, normal)
- Context analysis (first message, story reply, post share)
- Attachment handling (images, videos, audio)

**Social Signals:**
- Follower-to-following ratio analysis
- Verification status tracking
- Business category detection
- Profile completeness scoring

### API Endpoints

#### Process Instagram DM

```http
POST /ingest/instagram/test
Content-Type: application/json
Authorization: Bearer <token>

{
  "messageId": "msg_instagram_123",
  "conversationId": "conv_456",
  "timestamp": "2024-01-01T12:00:00Z",
  "sender": {
    "id": "instagram_user_789",
    "username": "johndoe_business",
    "displayName": "John Doe",
    "profilePicture": "https://instagram.com/profile.jpg",
    "isVerified": true,
    "followerCount": 5000,
    "followingCount": 500,
    "postCount": 200,
    "bio": "CEO at Acme Corp 🏢 | Contact: john@acme.com | Building the future",
    "website": "https://acme.com",
    "businessCategory": "Business Services"
  },
  "message": {
    "text": "Hi! I'm interested in your product. Can we schedule a demo?",
    "type": "text"
  },
  "isFirstMessage": true,
  "integrationId": "integration_123"
}
```

**Response:**
```json
{
  "success": true,
  "leadId": "lead_789",
  "messageId": "msg_456",
  "action": "created",
  "score": 85,
  "band": "HIGH",
  "tags": ["inquiry", "verified_account", "business_profile"],
  "ownerId": "owner_123",
  "pool": "SALES_POOL",
  "sla": {
    "targetAt": "2024-01-01T12:30:00Z",
    "minutes": 30
  },
  "message": "Instagram DM from @johndoe_business processed successfully",
  "trace": {
    "enrichment": ["company_data_added", "social_profile_analyzed"],
    "scoring": ["base_score: 50", "verified_account: +10", "business_profile: +15", "inquiry_intent: +10"],
    "routing": ["high_score_rule_matched", "assigned_to_sales_pool"]
  }
}
```

#### Get Recent Instagram DMs

```http
GET /ingest/instagram/recent?limit=20&integrationId=integration_123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_456",
      "leadId": "lead_789",
      "username": "johndoe_business",
      "displayName": "John Doe",
      "messageType": "text",
      "text": "Hi! I'm interested in your product...",
      "createdAt": "2024-01-01T12:00:00Z",
      "lead": {
        "name": "John Doe",
        "company": "Acme Corp",
        "score": 85,
        "scoreBand": "HIGH"
      }
    }
  ],
  "total": 50
}
```

### Instagram Data Extraction

**Profile Analysis:**
```typescript
{
  // Basic info
  instagramUsername: "johndoe_business",
  instagramId: "instagram_user_789",
  instagramDisplayName: "John Doe",
  instagramVerified: true,
  
  // Engagement metrics
  instagramFollowers: 5000,
  instagramFollowing: 500,
  instagramPosts: 200,
  engagementLevel: "high",        // high, medium, low, minimal
  profileCompleteness: "complete", // complete, good, basic, minimal
  
  // Content
  instagramBio: "CEO at Acme Corp...",
  instagramProfilePicture: "https://...",
  instagramBusinessCategory: "Business Services",
  
  // Message context
  messageText: "Hi! I'm interested...",
  messageType: "text",
  messageIntent: "inquiry",       // inquiry, demo_request, pricing_inquiry, etc.
  urgency: "medium",              // high, medium, normal
  isFirstMessage: true,
  replyToStory: false,
  hasAttachments: false
}
```

**Bio Data Extraction:**
- **Email Detection** → `john@company.com` from bio
- **Company Extraction** → "CEO at Acme Corp", "🏢 Acme Corp"
- **Phone Extraction** → Phone numbers with emoji indicators
- **Website Detection** → Company websites in bio links

**Engagement Scoring:**
```typescript
// High engagement (influencer/business)
followers > 10000 && follower/following ratio > 2

// Medium engagement (active user)  
followers > 1000 && posts > 50

// Low engagement (regular user)
followers > 100

// Minimal engagement (new/inactive)
followers <= 100
```

**Profile Completeness:**
```typescript
// Scoring factors (0-7 points)
- Has display name
- Has bio text
- Has website link
- Has profile picture
- Is business account
- Has 10+ followers
- Has 5+ posts

// Ratings
7-6 points: "complete"
5-4 points: "good"  
3-2 points: "basic"
1-0 points: "minimal"
```

## Message and Timeline Logging

### LinkedIn CSV Message

```json
{
  "direction": "IN",
  "channel": "FORM",
  "subject": "LinkedIn Import - John Doe",
  "body": "{\"First Name\":\"John\",\"Last Name\":\"Doe\",...}",
  "meta": {
    "source": "linkedin_csv",
    "filename": "connections_export.csv",
    "rowNumber": 15,
    "originalData": { /* original CSV row */ },
    "columnMapping": { /* used mapping */ }
  }
}
```

### Instagram DM Message

```json
{
  "direction": "IN", 
  "channel": "DM",
  "subject": "Instagram DM from @johndoe_business",
  "body": "Hi! I'm interested in your product...",
  "meta": {
    "messageId": "msg_instagram_123",
    "conversationId": "conv_456", 
    "sender": { /* Instagram profile data */ },
    "messageType": "text",
    "attachments": [],
    "isFirstMessage": true,
    "source": "instagram_dm",
    "integrationId": "integration_123"
  }
}
```

### Timeline Events

**LinkedIn Import Event:**
```json
{
  "type": "SCORE_UPDATED",
  "payload": {
    "action": "linkedin_csv_import",
    "source": "linkedin_csv",
    "rowNumber": 15,
    "filename": "connections_export.csv",
    "dedupeAction": "created",
    "score": 65,
    "band": "MEDIUM",
    "routing": {
      "ownerId": "owner_123",
      "pool": "SALES_POOL",
      "reason": "Medium score routing rule"
    }
  }
}
```

**Instagram DM Events:**
```json
{
  "type": "EMAIL_RECEIVED", 
  "payload": {
    "action": "instagram_dm_received",
    "messageId": "msg_instagram_123",
    "username": "johndoe_business",
    "messageType": "text",
    "isFirstMessage": true,
    "source": "instagram_dm"
  }
}
```

## Configuration Examples

### LinkedIn CSV Column Mappings

**Standard LinkedIn Export:**
```json
{
  "email": "Email Address",
  "firstName": "First Name",
  "lastName": "Last Name", 
  "company": "Company",
  "title": "Position",
  "location": "Location",
  "connectionDate": "Connected On",
  "linkedinUrl": "Profile URL"
}
```

**Sales Navigator Export:**
```json
{
  "email": "Email",
  "fullName": "Full Name",
  "company": "Current Company", 
  "title": "Current Title",
  "industry": "Industry",
  "location": "Location"
}
```

**Custom CRM Export:**
```json
{
  "email": "Contact Email",
  "fullName": "Contact Name",
  "company": "Account Name",
  "phone": "Phone Number",
  "website": "Company Website",
  "notes": "Description"
}
```

### Instagram Integration Setup

**Integration Record:**
```json
{
  "kind": "INSTAGRAM",
  "status": "CONNECTED",
  "auth": {
    "accessToken": "instagram_access_token",
    "userId": "instagram_business_account_id",
    "pageId": "instagram_page_id"
  },
  "settings": {
    "autoProcessDMs": true,
    "minFollowerThreshold": 100,
    "businessAccountsOnly": false,
    "keywordFilters": ["product", "demo", "pricing"],
    "responseTemplates": {
      "inquiry": "Thanks for your interest! We'll get back to you soon.",
      "demo_request": "Great! Let's schedule a demo."
    }
  }
}
```

## Advanced Features

### Smart Data Extraction

**LinkedIn Bio Parsing:**
```typescript
// Extract from various bio formats
"CEO at Acme Corp | Building the future"
"VP Sales @ TechCorp | john@techcorp.com"
"🏢 Startup Founder | 📧 contact@startup.io"
"Director of Marketing, BigCorp Inc."
```

**Instagram Bio Intelligence:**
```typescript
// Company detection patterns
"CEO @acmecorp 🏢"
"Founder of TechStartup"
"Working at BigCompany"
"💼 Business Development @ Corp"

// Contact extraction
"📧 contact@company.com"
"📞 +1-555-123-4567" 
"🌐 company.com"
"DM for business inquiries"
```

### Engagement Analysis

**LinkedIn Connection Quality:**
- Recent connection date → Higher priority
- Mutual connections → Increased scoring
- Profile completeness → Trust signals
- Industry relevance → Targeted scoring

**Instagram Engagement Scoring:**
```typescript
// Engagement factors
{
  followerCount: 5000,           // Reach potential
  followingRatio: 10,            // 5000/500 = selective following
  postFrequency: "active",       // 200 posts = regular content
  businessAccount: true,         // Professional presence
  verifiedAccount: true,         // Platform verification
  bioCompleteness: "complete",   // Full profile information
  websitePresent: true,          // Business website
  contactInfoAvailable: true     // Email/phone in bio
}

// Calculated engagement level
"high"    → Influencer/business with strong metrics
"medium"  → Active user with good engagement  
"low"     → Regular user with basic activity
"minimal" → New or inactive account
```

### Deduplication Strategies

**LinkedIn CSV Deduplication:**
- **Email Hash** → Primary matching on email address
- **Name + Company** → Fuzzy matching for variations
- **LinkedIn URL** → Direct profile URL matching
- **Domain + Name** → Company email pattern matching

**Instagram DM Deduplication:**
- **Instagram ID** → Unique platform identifier
- **Username** → Handle-based matching
- **Bio Email** → Email extracted from bio
- **Website Domain** → Company website matching

### Error Handling

**CSV Import Errors:**
```json
{
  "row": 15,
  "action": "error", 
  "error": "Invalid email format"
}
```

**Common Issues:**
- Missing required email field
- Invalid CSV format or encoding
- Malformed phone numbers
- Empty or duplicate rows
- Column mapping mismatches

**Instagram DM Errors:**
```json
{
  "error": "Instagram DM processing failed",
  "details": "Invalid sender profile data"
}
```

**Error Recovery:**
- Continue processing on individual failures
- Log detailed error information
- Provide specific error messages for debugging
- Track error rates for monitoring

## Performance Optimization

### CSV Import Performance

**Batch Processing:**
- Process records in chunks of 100
- Batch database operations
- Parallel enrichment requests
- Memory-efficient streaming for large files

**Database Optimization:**
- Bulk insert operations
- Index optimization for deduplication
- Connection pooling
- Transaction batching

### Instagram DM Performance

**Real-time Processing:**
- Async pipeline processing
- Non-blocking DM handling
- Queue management for high volume
- Rate limiting compliance

**Memory Management:**
- Stream large attachments
- Clean up processed data
- Monitor memory usage
- Implement processing limits

## Security and Privacy

### Data Protection

**LinkedIn CSV Security:**
- Secure file upload handling
- Temporary file cleanup
- Access control on import data
- Audit logging for imports

**Instagram DM Security:**
- Webhook signature verification
- Rate limiting and abuse protection
- PII handling compliance
- Message content encryption

### Compliance

**GDPR Compliance:**
- Data retention policies
- Right to deletion
- Data portability
- Consent management

**Platform Compliance:**
- LinkedIn Terms of Service
- Instagram API Guidelines
- Data usage restrictions
- Rate limiting compliance

This social media ingestion system provides comprehensive lead capture from LinkedIn networks and Instagram interactions with enterprise-grade processing and intelligence.
