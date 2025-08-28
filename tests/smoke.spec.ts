import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  apiUrl: process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000',
  testUser: {
    email: 'test@example.com',
    password: 'test123',
    teamId: 'test-team-id'
  },
  testLead: {
    email: 'john.doe@acme.com',
    name: 'John Doe',
    company: 'Acme Corp',
    source: 'webhook_test',
    phone: '+1234567890'
  }
};

// Helper functions
class TestHelpers {
  constructor(private page: Page) {}

  async login() {
    console.log('🔐 Logging in...');
    await this.page.goto(`${TEST_CONFIG.baseUrl}/login`);
    
    // Fill login form
    await this.page.fill('input[type="email"]', TEST_CONFIG.testUser.email);
    await this.page.fill('input[type="password"]', TEST_CONFIG.testUser.password);
    await this.page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('**/dashboard');
    console.log('✅ Login successful');
  }

  async setupHubSpotIntegration() {
    console.log('🔗 Setting up HubSpot integration...');
    
    // Navigate to integrations page
    await this.page.goto(`${TEST_CONFIG.baseUrl}/integrations`);
    
    // Check if HubSpot is already connected
    const hubspotCard = this.page.locator('[data-testid="integration-hubspot"]');
    const isConnected = await hubspotCard.locator('text=CONNECTED').isVisible().catch(() => false);
    
    if (!isConnected) {
      // Mock the OAuth flow by directly setting the integration as connected via API
      await this.mockHubSpotConnection();
      await this.page.reload();
    }
    
    // Verify connection
    await expect(hubspotCard.locator('text=CONNECTED')).toBeVisible();
    console.log('✅ HubSpot integration ready');
  }

  async mockHubSpotConnection() {
    // Directly create integration record via API for testing
    await this.page.evaluate(async (config) => {
      const response = await fetch(`${config.apiUrl}/integrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          kind: 'HUBSPOT',
          status: 'CONNECTED',
          auth: {
            access_token: 'mock_token_' + Date.now(),
            refresh_token: 'mock_refresh_' + Date.now(),
            expires_in: 3600,
            token_type: 'Bearer'
          },
          settings: {
            hub_id: '12345',
            hub_domain: 'test-domain',
            app_id: 'test-app',
            user: 'test@example.com'
          }
        })
      });
      return response.ok;
    }, { apiUrl: TEST_CONFIG.apiUrl });
  }

  async createRoutingRule() {
    console.log('⚡ Creating routing rule...');
    
    await this.page.goto(`${TEST_CONFIG.baseUrl}/routing`);
    
    // Create a simple routing rule
    await this.page.click('button:has-text("Add Rule")');
    
    // Fill rule form
    await this.page.fill('input[name="name"]', 'Test Routing Rule');
    await this.page.selectOption('select[name="field"]', 'company');
    await this.page.selectOption('select[name="operator"]', 'contains');
    await this.page.fill('input[name="value"]', 'Acme');
    await this.page.selectOption('select[name="assignTo"]', 'round_robin'); // or specific owner
    
    await this.page.click('button:has-text("Save Rule")');
    
    // Verify rule was created
    await expect(this.page.locator('text=Test Routing Rule')).toBeVisible();
    console.log('✅ Routing rule created');
  }

  async createSLASettings() {
    console.log('⏰ Setting up SLA settings...');
    
    // Navigate to SLA tab in routing page
    await this.page.click('button:has-text("SLA")');
    
    // Set priority thresholds
    await this.page.fill('input[name="priority1"]', '15'); // 15 minutes for high priority
    await this.page.fill('input[name="priority2"]', '60'); // 60 minutes for medium priority
    await this.page.fill('input[name="priority3"]', '240'); // 4 hours for low priority
    
    // Enable escalation
    await this.page.check('input[name="escalationEnabled"]');
    
    await this.page.click('button:has-text("Save SLA Settings")');
    
    // Verify settings saved
    await expect(this.page.locator('text=SLA settings saved')).toBeVisible();
    console.log('✅ SLA settings configured');
  }

  async postWebhookTestLead() {
    console.log('📨 Posting webhook test lead...');
    
    // Use the webhook test endpoint
    const response = await this.page.evaluate(async (config) => {
      const webhookPayload = {
        email: config.testLead.email,
        name: config.testLead.name,
        company: config.testLead.company,
        phone: config.testLead.phone,
        source: config.testLead.source,
        utm: {
          source: 'test',
          medium: 'webhook',
          campaign: 'smoke_test'
        },
        fields: {
          message: 'This is a test lead created via webhook for smoke testing',
          interest: 'Product Demo'
        }
      };
      
      const response = await fetch(`${config.apiUrl}/ingest/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key' // Use test API key
        },
        body: JSON.stringify(webhookPayload)
      });
      
      const result = await response.json();
      return { ok: response.ok, data: result };
    }, { apiUrl: TEST_CONFIG.apiUrl, testLead: TEST_CONFIG.testLead });
    
    if (!response.ok) {
      throw new Error(`Failed to create webhook lead: ${JSON.stringify(response.data)}`);
    }
    
    console.log('✅ Webhook test lead posted');
    return response.data.leadId;
  }

  async verifyLeadInInbox(leadId?: string) {
    console.log('📋 Verifying lead appears in inbox...');
    
    await this.page.goto(`${TEST_CONFIG.baseUrl}/leads`);
    
    // Wait for leads to load
    await this.page.waitForSelector('[data-testid="leads-table"]', { timeout: 10000 });
    
    // Search for our test lead
    await this.page.fill('input[placeholder*="Search"]', TEST_CONFIG.testLead.email);
    await this.page.press('input[placeholder*="Search"]', 'Enter');
    
    // Wait for search results
    await this.page.waitForTimeout(2000);
    
    // Verify lead appears in table
    const leadRow = this.page.locator(`tr:has-text("${TEST_CONFIG.testLead.email}")`);
    await expect(leadRow).toBeVisible();
    
    // Verify score badge is present
    const scoreBadge = leadRow.locator('[data-testid="score-badge"]');
    await expect(scoreBadge).toBeVisible();
    
    // Verify SLA badge is present
    const slaBadge = leadRow.locator('[data-testid="sla-badge"]');
    await expect(slaBadge).toBeVisible();
    
    // Get the lead ID from the row if not provided
    if (!leadId) {
      leadId = await leadRow.getAttribute('data-lead-id');
    }
    
    console.log(`✅ Lead verified in inbox with ID: ${leadId}`);
    return leadId;
  }

  async openLeadDetail(leadId: string) {
    console.log('🔍 Opening lead detail...');
    
    // Click on the lead row to open detail
    const leadRow = this.page.locator(`tr[data-lead-id="${leadId}"]`);
    await leadRow.click();
    
    // Wait for lead detail page to load
    await this.page.waitForURL(`**/leads/${leadId}`);
    await this.page.waitForSelector('[data-testid="lead-detail"]');
    
    console.log('✅ Lead detail opened');
  }

  async runDryRunSync() {
    console.log('🧪 Running dry-run CRM sync...');
    
    // Click on CRM sync action
    await this.page.click('button:has-text("Sync to CRM")');
    
    // Wait for sync modal
    await this.page.waitForSelector('[data-testid="crm-sync-modal"]');
    
    // Click dry run button
    await this.page.click('button:has-text("Preview Sync")');
    
    // Wait for dry run results
    await this.page.waitForSelector('[data-testid="sync-preview"]');
    
    // Verify preview shows data
    await expect(this.page.locator('text=Preview')).toBeVisible();
    await expect(this.page.locator('[data-testid="sync-payload"]')).toBeVisible();
    
    console.log('✅ Dry-run sync completed');
  }

  async runRealSync() {
    console.log('💾 Running real CRM sync...');
    
    // Click the actual sync button
    await this.page.click('button:has-text("Sync to HubSpot")');
    
    // Wait for sync completion
    await this.page.waitForSelector('text=Sync completed successfully', { timeout: 15000 });
    
    // Close the modal
    await this.page.click('button:has-text("Close")');
    
    console.log('✅ Real CRM sync completed');
  }

  async verifyTimelineEvents() {
    console.log('📅 Verifying timeline events...');
    
    // Wait for timeline to load
    await this.page.waitForSelector('[data-testid="timeline"]');
    
    // Check for ROUTED event
    const routedEvent = this.page.locator('[data-testid="timeline-event"]:has-text("ROUTED")');
    await expect(routedEvent).toBeVisible();
    
    // Check for SLA scheduled event
    const slaEvent = this.page.locator('[data-testid="timeline-event"]:has-text("SLA")');
    await expect(slaEvent).toBeVisible();
    
    // Check for CRM sync event
    const crmSyncEvent = this.page.locator('[data-testid="timeline-event"]:has-text("CRM_SYNC")');
    await expect(crmSyncEvent).toBeVisible();
    
    console.log('✅ All timeline events verified');
  }

  async cleanup(leadId?: string) {
    console.log('🧹 Cleaning up test data...');
    
    if (leadId) {
      // Delete the test lead
      await this.page.evaluate(async (config) => {
        await fetch(`${config.apiUrl}/api/leads/${config.leadId}?confirm=true`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
      }, { apiUrl: TEST_CONFIG.apiUrl, leadId });
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Main smoke test
test.describe('SmartForms AI - Complete Lead Lifecycle Smoke Test', () => {
  let helpers: TestHelpers;
  let testLeadId: string;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test.afterEach(async () => {
    // Cleanup after each test
    if (testLeadId) {
      await helpers.cleanup(testLeadId);
    }
  });

  test('Complete lead lifecycle: webhook → inbox → routing → SLA → CRM sync', async () => {
    // Step 1: Login
    await helpers.login();

    // Step 2: Setup HubSpot integration
    await helpers.setupHubSpotIntegration();

    // Step 3: Create routing rule
    await helpers.createRoutingRule();

    // Step 4: Configure SLA settings
    await helpers.createSLASettings();

    // Step 5: Post webhook test lead
    const webhookResult = await helpers.postWebhookTestLead();
    testLeadId = webhookResult.leadId;

    // Step 6: Verify lead appears in inbox with score and SLA
    const verifiedLeadId = await helpers.verifyLeadInInbox(testLeadId);
    testLeadId = verifiedLeadId || testLeadId;

    // Step 7: Open lead detail
    await helpers.openLeadDetail(testLeadId);

    // Step 8: Run dry-run sync
    await helpers.runDryRunSync();

    // Step 9: Run real sync
    await helpers.runRealSync();

    // Step 10: Verify timeline shows all events
    await helpers.verifyTimelineEvents();

    console.log('🎉 Smoke test completed successfully!');
  });

  test('Inbox pagination and filtering', async () => {
    await helpers.login();

    // Navigate to leads inbox
    await helpers.page.goto(`${TEST_CONFIG.baseUrl}/leads`);

    // Test search functionality
    await helpers.page.fill('input[placeholder*="Search"]', 'test');
    await helpers.page.press('input[placeholder*="Search"]', 'Enter');
    await helpers.page.waitForTimeout(1000);

    // Test filtering
    await helpers.page.selectOption('select[name="status"]', 'NEW');
    await helpers.page.waitForTimeout(1000);

    // Test sorting
    await helpers.page.click('button:has-text("Score")');
    await helpers.page.waitForTimeout(1000);

    // Test pagination if available
    const nextButton = helpers.page.locator('button:has-text("Next")');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await helpers.page.waitForTimeout(1000);
    }

    // Test infinite scroll mode
    const viewModeSelect = helpers.page.locator('select[name="viewMode"]');
    if (await viewModeSelect.isVisible()) {
      await helpers.page.selectOption('select[name="viewMode"]', 'infinite');
      await helpers.page.waitForTimeout(1000);
    }

    console.log('✅ Inbox pagination and filtering test completed');
  });

  test('Timeline pagination for large datasets', async () => {
    await helpers.login();

    // Create a lead with many timeline events (simulate)
    const leadWithManyEvents = await helpers.postWebhookTestLead();
    
    // Navigate to lead detail
    await helpers.openLeadDetail(leadWithManyEvents.leadId);

    // Check if timeline pagination is active
    const timelinePaginationAlert = helpers.page.locator('text=Large Timeline - Using Pagination');
    
    if (await timelinePaginationAlert.isVisible()) {
      console.log('📄 Timeline pagination detected');
      
      // Test load more functionality
      const loadMoreButton = helpers.page.locator('button:has-text("Load more events")');
      if (await loadMoreButton.isVisible()) {
        await loadMoreButton.click();
        await helpers.page.waitForTimeout(2000);
      }
    }

    console.log('✅ Timeline pagination test completed');
    
    // Cleanup
    testLeadId = leadWithManyEvents.leadId;
  });
});

// Performance tests
test.describe('Performance Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test('Page load performance', async () => {
    await helpers.login();

    // Test dashboard load time
    const dashboardStart = Date.now();
    await helpers.page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
    await helpers.page.waitForLoadState('networkidle');
    const dashboardTime = Date.now() - dashboardStart;
    
    expect(dashboardTime).toBeLessThan(5000); // Should load in under 5s
    console.log(`📊 Dashboard loaded in ${dashboardTime}ms`);

    // Test leads inbox load time
    const inboxStart = Date.now();
    await helpers.page.goto(`${TEST_CONFIG.baseUrl}/leads`);
    await helpers.page.waitForSelector('[data-testid="leads-table"]');
    const inboxTime = Date.now() - inboxStart;
    
    expect(inboxTime).toBeLessThan(3000); // Should load in under 3s
    console.log(`📋 Leads inbox loaded in ${inboxTime}ms`);

    // Test analytics page load time
    const analyticsStart = Date.now();
    await helpers.page.goto(`${TEST_CONFIG.baseUrl}/analytics`);
    await helpers.page.waitForSelector('[data-testid="analytics-charts"]');
    const analyticsTime = Date.now() - analyticsStart;
    
    expect(analyticsTime).toBeLessThan(4000); // Should load in under 4s
    console.log(`📈 Analytics loaded in ${analyticsTime}ms`);
  });

  test('API response times', async () => {
    await helpers.login();

    // Test leads API performance
    const leadsApiStart = Date.now();
    const response = await helpers.page.evaluate(async (config) => {
      const response = await fetch(`${config.apiUrl}/api/leads?page=1&pageSize=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      return { ok: response.ok, time: Date.now() };
    }, { apiUrl: TEST_CONFIG.apiUrl });
    
    const leadsApiTime = response.time - leadsApiStart;
    expect(leadsApiTime).toBeLessThan(2000); // API should respond in under 2s
    console.log(`🔌 Leads API responded in ${leadsApiTime}ms`);
  });
});

// Error handling tests
test.describe('Error Handling', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test('Handles network errors gracefully', async () => {
    await helpers.login();

    // Simulate network failure
    await helpers.page.route('**/api/leads**', route => route.abort());

    // Navigate to leads page
    await helpers.page.goto(`${TEST_CONFIG.baseUrl}/leads`);

    // Should show error message
    await expect(helpers.page.locator('text=Failed to load leads')).toBeVisible();

    console.log('✅ Network error handling verified');
  });

  test('Handles invalid data gracefully', async () => {
    await helpers.login();

    // Try to create lead with invalid data
    const invalidLeadResult = await helpers.page.evaluate(async (config) => {
      try {
        const response = await fetch(`${config.apiUrl}/ingest/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key'
          },
          body: JSON.stringify({
            email: 'invalid-email', // Invalid email format
            name: '', // Empty name
            company: null // Null company
          })
        });
        
        return { ok: response.ok, status: response.status };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }, { apiUrl: TEST_CONFIG.apiUrl });

    // Should handle validation errors
    expect(invalidLeadResult.ok).toBeFalsy();
    console.log('✅ Invalid data handling verified');
  });
});
