# Testing & Seeding Guide

This guide covers database seeding and comprehensive testing for the SmartForms AI backend.

## Database Seeding

### Quick Start

```bash
# Seed the database with demo data
npm run seed

# Clean existing demo data and re-seed
npm run seed:clean
```

### What Gets Seeded

The seeding script creates a complete demo environment:

#### 📊 **Demo Team: "SmartForms Demo"**
- Configured with enrichment settings
- Competitor and partner lists
- Free mailbox domain detection

#### 👥 **Users & Owners (AE_POOL_A)**
- **Sarah Johnson** (sarah.johnson@smartforms.demo) - Capacity: 50
- **Mike Chen** (mike.chen@smartforms.demo) - Capacity: 40  
- **Emily Rodriguez** (emily.rodriguez@smartforms.demo) - Capacity: 45
- **David Kim** (david.kim@smartforms.demo) - Capacity: 35
- **Admin User** (admin@smartforms.demo)

#### 🎯 **Scoring Configuration**
- **Weights**: Urgency (25%), Engagement (30%), Job Role (45%)
- **Bands**: HIGH (75+), MEDIUM (50-74), LOW (0-49)
- **Negative Scoring**: Competitors (-20), Free email (-10), Invalid domain (-15)
- **Enrichment Scoring**: Company size, industry, revenue-based scoring

#### 📋 **Scoring Rules**
1. **Free Email Penalty** (-10 points for Gmail, Yahoo, Hotmail)
2. **Enterprise Indicators** (+15 for enterprise, corp, inc)
3. **Competitor Detection** (-25 for competitor domains)
4. **UTM Source Weighting** (Google Ads: +20, LinkedIn: +15, etc.)
5. **Executive Detection** (+25 for CEO, Founder, President titles)

#### 🛤️ **Routing Rules**
1. **HIGH Score Band** → AE_POOL_A (5min SLA, Slack alert)
2. **Paid Leads** → AE_POOL_A (10min SLA for Google Ads + score >60)
3. **Enterprise Companies** → Sarah (direct assignment, 15min SLA)
4. **MEDIUM Score Band** → AE_POOL_A (30min SLA)
5. **LOW Score Band** → AE_POOL_A (60min SLA)

#### ⏰ **SLA Settings**
- **Priority 1**: 5 minutes
- **Priority 2**: 15 minutes  
- **Priority 3**: 30 minutes
- **Priority 4**: 60 minutes
- **Escalation**: 10min → notify manager, 30min → director, 60min → emergency
- **Business Hours**: Mon-Fri 9AM-6PM EST

#### 📊 **Sample Leads**
- **High-Value Enterprise Lead** (John Doe @ Acme Corp, Score: 85)
- **Startup Founder** (Sarah Wilson @ Startup.io, Score: 72)
- **Low-Value Gmail User** (Mike Test, Score: 35)
- **Competitor Lead** (Jane @ Typeform, Score: 15)
- **Enterprise CTO** (Robert @ MegaCorp, Score: 95)

#### 🔑 **API Keys**
- Production API Key (with IP allowlist)
- Development API Key (unrestricted)

### Seeding Script Features

- **Idempotent**: Safe to run multiple times
- **Clean Mode**: Removes existing demo data first
- **Comprehensive**: Creates complete working environment
- **Realistic Data**: Representative of real-world scenarios
- **Timeline Events**: Includes audit trail for sample leads

---

## Testing Framework

### Test Structure

```
src/
├── modules/
│   ├── scoring/__tests__/
│   │   └── engine.test.ts
│   ├── routing/__tests__/
│   │   └── engine.test.ts
│   └── dedupe/__tests__/
│       └── index.test.ts
└── __tests__/
    └── setup.ts
```

### Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run with UI (browser interface)
npm run test:ui

# Run with coverage report
npm run test:coverage

# Run specific service tests
npm run test:scoring
npm run test:routing
npm run test:dedupe
```

### Test Coverage

The test suite provides comprehensive coverage:

#### 🎯 **Scoring Engine Tests** (`scoring/engine.test.ts`)

**Core Functions:**
- `calculateBaseScore()` - Base scoring algorithm
- `applyRules()` - Rule-based adjustments
- `determineBand()` - Score band classification
- `applyScoring()` - End-to-end scoring workflow

**Test Categories:**
- **Happy Path**: High-value leads, enterprise contacts, executives
- **Edge Cases**: Missing data, null values, malformed inputs
- **Negative Scoring**: Competitors, free emails, invalid domains
- **Rule Processing**: IF_THEN rules, WEIGHT rules, complex conditions
- **Performance**: Large rule sets, complex nested data
- **Error Handling**: Invalid configs, circular references

**Coverage Areas:**
- Job role detection and scoring
- UTM parameter weighting
- Enrichment data integration
- Company size and industry scoring
- Email domain analysis

#### 🛤️ **Routing Engine Tests** (`routing/engine.test.ts`)

**Core Functions:**
- `evaluateCondition()` - Individual condition evaluation
- `checkRuleConditions()` - Multi-condition rule matching
- `selectOwnerFromPool()` - Load balancing algorithm
- `routeLead()` - Complete routing workflow

**Test Categories:**
- **Condition Operators**: equals, greater_than, contains, regex, in, exists
- **Field Path Resolution**: Nested object access, array handling
- **Pool Assignment**: Utilization-based selection, capacity management
- **Rule Priority**: Order-based processing, first-match wins
- **Direct Assignment**: Specific owner routing
- **Error Scenarios**: No matching rules, database errors, empty pools

**Coverage Areas:**
- All comparison operators (>, <, >=, <=, ==, !=)
- String operations (contains, starts_with, ends_with, regex)
- Array operations (in, not_in)
- Existence checks (exists, not_exists)
- Complex nested field paths
- Owner utilization calculations

#### 🔄 **Deduplication Tests** (`dedupe/index.test.ts`)

**Core Functions:**
- `buildKeys()` - Dedupe key generation
- `calculateSimilarity()` - Lead similarity scoring
- `findDuplicates()` - Duplicate detection
- `deduplicateLead()` - Complete deduplication workflow

**Test Categories:**
- **Key Generation**: Email hashing, name normalization, domain extraction
- **Similarity Detection**: Email matches, name variations, phone formats
- **Merge Strategies**: High-confidence merges, skip policies
- **Performance**: Large datasets, concurrent operations
- **Data Quality**: Special characters, internationalization, null handling

**Coverage Areas:**
- Email normalization and hashing
- Name standardization (special chars, accents)
- Phone number format variations
- Company name similarity
- Domain-based matching
- Confidence scoring algorithms

### Test Configuration

#### Vitest Setup (`vitest.config.ts`)
- **Environment**: Node.js
- **Coverage**: V8 provider with 80% thresholds
- **Timeout**: 10 seconds for async operations
- **Globals**: Available in all test files
- **Aliases**: `@` and `~` path shortcuts

#### Test Setup (`src/__tests__/setup.ts`)
- **Environment Variables**: Test-specific configuration
- **Mock Dependencies**: Prisma, crypto, axios
- **Global Utilities**: Mock app and database
- **Auto-Reset**: Clears mocks between tests

### Mock Strategy

#### Database Mocking
- **Prisma Client**: Fully mocked with vi.fn()
- **Transaction Support**: Mocked $transaction method
- **Query Methods**: All CRUD operations mocked
- **Relationships**: Include/select patterns supported

#### External Service Mocking
- **Crypto Functions**: Deterministic test outputs
- **HTTP Requests**: Axios mocked for API calls
- **File System**: No real file operations in tests

#### App Context Mocking
- **Fastify Instance**: Complete app mock
- **Logging**: Silent test logging
- **Configuration**: Test-specific settings

### Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| Functions | 80%+ | ✅ |
| Lines | 80%+ | ✅ |
| Branches | 80%+ | ✅ |
| Statements | 80%+ | ✅ |

### Performance Benchmarks

- **Scoring**: <100ms for complex rules
- **Routing**: <50ms for large rule sets
- **Deduplication**: <1s for 1000+ potential matches
- **Database Operations**: Mocked for speed

---

## Development Workflow

### 1. **Setup Development Environment**
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed demo data
npm run seed
```

### 2. **Test-Driven Development**
```bash
# Start test watcher
npm run test:watch

# Write failing test
# Implement feature
# Verify test passes
# Refactor if needed
```

### 3. **Pre-Commit Checks**
```bash
# Run all tests
npm test

# Check coverage
npm run test:coverage

# Verify seeding works
npm run seed:clean
```

### 4. **CI/CD Integration**
The test suite is designed for continuous integration:
- No external dependencies
- Fast execution (<30 seconds)
- Comprehensive coverage
- Clear error reporting

---

## Troubleshooting

### Common Issues

#### **Tests Timing Out**
```bash
# Increase timeout in vitest.config.ts
testTimeout: 15000  # 15 seconds
```

#### **Database Connection Errors**
```bash
# Check test environment variables
echo $DATABASE_URL
# Should be test database, not production
```

#### **Mock Not Working**
```bash
# Clear module cache
vi.resetModules()

# Re-import after mocking
const module = await import('./module.js')
```

#### **Seeding Fails**
```bash
# Check database connection
npm run prisma:migrate

# Verify environment variables
cat .env

# Run with debug output
DEBUG=* npm run seed
```

### Performance Issues

#### **Slow Tests**
- Check for real database calls (should be mocked)
- Reduce test data size
- Use `vi.spyOn()` instead of full mocks

#### **Memory Leaks**
- Clear mocks in `afterEach()`
- Avoid global state in tests
- Use `vi.restoreAllMocks()`

---

## Best Practices

### Test Writing
1. **Descriptive Names**: Test what, not how
2. **Single Responsibility**: One assertion per test
3. **Arrange-Act-Assert**: Clear test structure
4. **Mock External Dependencies**: Keep tests isolated
5. **Test Edge Cases**: Null, undefined, empty values

### Seeding Strategy
1. **Idempotent**: Safe to run multiple times
2. **Realistic Data**: Representative scenarios
3. **Complete Workflows**: End-to-end functionality
4. **Clean Separation**: Demo vs production data
5. **Documentation**: Clear data relationships

### Performance
1. **Parallel Tests**: Use Vitest's parallel execution
2. **Mock Heavy Operations**: Database, API calls
3. **Minimal Data**: Only what's needed for tests
4. **Fast Feedback**: <30 second test runs
5. **Coverage Balance**: Quality over quantity

This testing and seeding infrastructure provides a solid foundation for maintaining code quality and enabling rapid development iterations.
