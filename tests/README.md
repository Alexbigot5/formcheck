# SmartForms AI - E2E Testing with Playwright

This directory contains end-to-end tests for the SmartForms AI application using Playwright.

## 🚀 Quick Start

### Prerequisites

1. **Install Dependencies**:
   ```bash
   npm install
   npx playwright install
   ```

2. **Environment Setup**:
   Create a `.env.test` file in the project root:
   ```env
   PLAYWRIGHT_BASE_URL=http://localhost:3000
   PLAYWRIGHT_API_URL=http://localhost:8000
   DATABASE_URL=postgresql://user:password@localhost:5432/smartforms_test
   TEST_API_KEY=test-api-key-12345
   TEST_HMAC_SECRET=test-hmac-secret-67890
   ```

3. **Test Database**:
   - Create a separate test database
   - Run migrations: `cd backend && npm run migrate:test`
   - Seed test data: `cd backend && npm run seed:test`

### Running Tests

```bash
# Run all tests
npm test

# Run smoke tests only
npm run test:smoke

# Run with browser UI visible
npm run test:headed

# Run with Playwright UI
npm run test:ui

# Debug mode
npm run test:debug

# View test report
npm run test:report
```

## 📋 Test Structure

### Main Test Files

- **`smoke.spec.ts`** - Complete lead lifecycle smoke test
- **`test-utils.ts`** - Shared utilities and helpers
- **`global-setup.ts`** - Global test setup and data seeding
- **`global-teardown.ts`** - Global cleanup

### Test Scenarios

#### 🔥 Smoke Test (`smoke.spec.ts`)

**Complete Lead Lifecycle:**
1. ✅ Login to application
2. ✅ Setup HubSpot integration (mock mode)
3. ✅ Create routing rule for lead assignment
4. ✅ Configure SLA settings with thresholds
5. ✅ POST webhook test lead via API
6. ✅ Verify lead appears in inbox with score and SLA badges
7. ✅ Open lead detail page
8. ✅ Run dry-run CRM sync and verify preview
9. ✅ Execute real CRM sync
10. ✅ Verify timeline shows ROUTED, SLA scheduled, and CRM sync events

**Additional Tests:**
- **Inbox Pagination & Filtering** - Search, filter, sort, pagination
- **Timeline Pagination** - Large timeline handling with infinite scroll
- **Performance Tests** - Page load times and API response times
- **Error Handling** - Network failures and invalid data

## 🛠️ Test Configuration

### Playwright Config (`playwright.config.ts`)

```typescript
// Multi-browser testing
projects: [
  { name: 'chromium' },
  { name: 'firefox' },
  { name: 'webkit' },
  { name: 'Mobile Chrome' },
  { name: 'Mobile Safari' }
]

// Auto-start services
webServer: [
  { command: 'npm run dev', url: 'http://localhost:3000' },
  { command: 'cd backend && npm run dev', url: 'http://localhost:8000' }
]
```

### Test Data Management

**Global Setup:**
- Creates test user and team
- Initializes scoring configuration
- Sets up routing defaults
- Verifies services are ready

**Global Teardown:**
- Cleans up test leads
- Removes test routing rules
- Resets SLA settings
- Disconnects test integrations

## 📊 Test Utilities

### Page Helpers (`test-utils.ts`)

```typescript
import { createTestHelpers } from './test-utils';

test('example', async ({ page }) => {
  const { page: pageHelper, assert, perf, db } = createTestHelpers(page);
  
  // Login
  await pageHelper.login();
  
  // Navigate
  await pageHelper.navigateToLeads();
  
  // Create test data
  const lead = await db.createTestLead(TestData.generateLead());
  
  // Verify
  await assert.assertElementVisible('[data-testid="leads-table"]');
  
  // Measure performance
  const loadTime = await perf.measurePageLoad('/leads');
  expect(loadTime).toBeLessThan(3000);
});
```

### Test Data Generators

```typescript
// Generate realistic test data
const testLead = TestData.generateLead({
  company: 'Custom Corp',
  source: 'custom_source'
});

const routingRule = TestData.generateRoutingRule({
  field: 'score',
  operator: 'greater_than',
  value: '80'
});

const slaSettings = TestData.generateSLASettings({
  priority1: 30, // 30 minutes for high priority
  escalationEnabled: true
});
```

## 🎯 Key Features Tested

### Lead Management
- ✅ Lead creation via webhook
- ✅ Lead scoring and band assignment
- ✅ Lead routing based on rules
- ✅ SLA clock creation and tracking
- ✅ Lead detail view and actions

### Inbox Functionality
- ✅ Pagination (standard and infinite scroll)
- ✅ Search and filtering
- ✅ Sorting by multiple fields
- ✅ Real-time updates and refresh
- ✅ SLA status indicators

### Timeline System
- ✅ Event chronological ordering
- ✅ Message and event display
- ✅ Pagination for large timelines
- ✅ Event type icons and formatting

### CRM Integration
- ✅ OAuth connection flow (mocked)
- ✅ Field mapping configuration
- ✅ Dry-run sync with preview
- ✅ Real sync execution
- ✅ Timeline event logging

### Routing & SLA
- ✅ Rule creation and management
- ✅ SLA threshold configuration
- ✅ Escalation settings
- ✅ Business hours support

## 🐛 Debugging Tests

### Common Issues

1. **Services Not Ready**:
   ```bash
   # Check if services are running
   curl http://localhost:3000
   curl http://localhost:8000/health
   ```

2. **Database Issues**:
   ```bash
   # Reset test database
   cd backend
   npm run db:reset:test
   npm run migrate:test
   ```

3. **Authentication Failures**:
   - Verify test user exists in database
   - Check API key configuration
   - Ensure JWT tokens are valid

### Debug Mode

```bash
# Run specific test in debug mode
npx playwright test smoke.spec.ts --debug

# Use VS Code extension
# Install "Playwright Test for VSCode"
# Set breakpoints and run tests
```

### Screenshots and Videos

Tests automatically capture:
- Screenshots on failure
- Videos on failure
- Full page traces for debugging

Files are saved in `test-results/` directory.

## 📈 Performance Benchmarks

Expected performance thresholds:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Dashboard Load | < 5s | Initial dashboard page load |
| Leads Inbox | < 3s | Leads table with data |
| Analytics Page | < 4s | Charts and data visualization |
| API Response | < 2s | Lead list API call |
| Search Results | < 1s | Filtered search results |

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 📝 Writing New Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { createTestHelpers, TestData } from './test-utils';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    const helpers = createTestHelpers(page);
    
    // Arrange
    await helpers.page.login();
    const testData = TestData.generateLead();
    
    // Act
    const result = await helpers.db.createTestLead(testData);
    
    // Assert
    await helpers.assert.assertAPIResponse(result, 201);
  });
});
```

### Best Practices

1. **Use Page Object Pattern** - Encapsulate page interactions
2. **Generate Test Data** - Use factories for realistic data
3. **Clean Up After Tests** - Always clean up test data
4. **Use Descriptive Names** - Clear test and variable names
5. **Test Real User Flows** - Focus on end-to-end scenarios
6. **Handle Async Operations** - Proper waits and timeouts
7. **Verify Visual Elements** - Check UI state and feedback

## 🚀 Advanced Features

### Custom Matchers

```typescript
// Custom assertion for lead status
await expect(leadRow).toHaveLeadStatus('IN_PROGRESS');

// Custom assertion for SLA countdown
await expect(slaElement).toHaveSLAStatus('due_soon');
```

### Parallel Execution

Tests run in parallel by default. Use `test.describe.serial()` for dependent tests.

### Cross-browser Testing

All tests run across Chrome, Firefox, Safari, and mobile browsers automatically.

### Visual Regression Testing

```typescript
// Compare screenshots
await expect(page).toHaveScreenshot('dashboard.png');

// Compare specific elements
await expect(page.locator('.chart')).toHaveScreenshot('chart.png');
```

## 📞 Support

For test-related issues:

1. Check the test output and screenshots in `test-results/`
2. Run tests in debug mode: `npm run test:debug`
3. Review the Playwright documentation: https://playwright.dev/
4. Check the application logs for API errors

---

**Happy Testing! 🎉**
