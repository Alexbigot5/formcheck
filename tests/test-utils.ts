import { Page, expect } from '@playwright/test';

// Test data generators
export const TestData = {
  generateLead: (overrides: any = {}) => ({
    email: `test.${Date.now()}@acme.com`,
    name: 'John Doe',
    company: 'Acme Corp',
    phone: '+1234567890',
    source: 'webhook_test',
    utm: {
      source: 'test',
      medium: 'webhook',
      campaign: 'smoke_test'
    },
    fields: {
      message: 'Test lead for automated testing',
      interest: 'Product Demo'
    },
    ...overrides
  }),

  generateRoutingRule: (overrides: any = {}) => ({
    name: `Test Rule ${Date.now()}`,
    field: 'company',
    operator: 'contains',
    value: 'Acme',
    assignTo: 'round_robin',
    enabled: true,
    ...overrides
  }),

  generateSLASettings: (overrides: any = {}) => ({
    priority1: 15, // 15 minutes
    priority2: 60, // 1 hour
    priority3: 240, // 4 hours
    escalationEnabled: true,
    escalation: {
      enabled: true,
      levels: [
        { minutes: 30, action: 'notify_manager' },
        { minutes: 120, action: 'escalate_team' }
      ]
    },
    businessHours: {
      enabled: true,
      timezone: 'UTC',
      schedule: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' }
      }
    },
    ...overrides
  })
};

// Page object helpers
export class PageHelpers {
  constructor(private page: Page) {}

  // Authentication helpers
  async login(email = 'test@example.com', password = 'test123') {
    await this.page.goto('/login');
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('**/dashboard');
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('text=Logout');
    await this.page.waitForURL('**/login');
  }

  // Navigation helpers
  async navigateToLeads() {
    await this.page.goto('/leads');
    await this.page.waitForSelector('[data-testid="leads-table"]');
  }

  async navigateToIntegrations() {
    await this.page.goto('/integrations');
    await this.page.waitForSelector('[data-testid="integrations-page"]');
  }

  async navigateToRouting() {
    await this.page.goto('/routing');
    await this.page.waitForSelector('[data-testid="routing-page"]');
  }

  async navigateToAnalytics() {
    await this.page.goto('/analytics');
    await this.page.waitForSelector('[data-testid="analytics-charts"]');
  }

  // Form helpers
  async fillForm(selector: string, data: Record<string, any>) {
    for (const [field, value] of Object.entries(data)) {
      const input = this.page.locator(`${selector} [name="${field}"]`);
      
      if (await input.getAttribute('type') === 'checkbox') {
        if (value) await input.check();
        else await input.uncheck();
      } else if (await input.locator('select').count() > 0) {
        await input.selectOption(value);
      } else {
        await input.fill(String(value));
      }
    }
  }

  async submitForm(selector: string) {
    await this.page.click(`${selector} button[type="submit"]`);
  }

  // Wait helpers
  async waitForToast(message?: string) {
    if (message) {
      await expect(this.page.locator(`text=${message}`)).toBeVisible();
    } else {
      await this.page.waitForSelector('[data-testid="toast"]');
    }
  }

  async waitForModal(selector = '[data-testid="modal"]') {
    await this.page.waitForSelector(selector);
  }

  async closeModal() {
    await this.page.click('[data-testid="modal-close"]');
  }

  // API helpers
  async makeAPICall(endpoint: string, options: any = {}) {
    const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000';
    
    return await this.page.evaluate(
      async ({ url, endpoint, options }) => {
        const response = await fetch(`${url}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
            ...options.headers
          },
          ...options
        });
        
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, data };
      },
      { url: apiUrl, endpoint, options }
    );
  }

  // Verification helpers
  async verifyLeadInTable(email: string) {
    await this.page.fill('input[placeholder*="Search"]', email);
    await this.page.press('input[placeholder*="Search"]', 'Enter');
    await this.page.waitForTimeout(1000);
    
    const leadRow = this.page.locator(`tr:has-text("${email}")`);
    await expect(leadRow).toBeVisible();
    return leadRow;
  }

  async verifyTimelineEvent(eventType: string) {
    const event = this.page.locator(`[data-testid="timeline-event"]:has-text("${eventType}")`);
    await expect(event).toBeVisible();
    return event;
  }

  async verifyScoreBadge(score?: number) {
    const badge = this.page.locator('[data-testid="score-badge"]');
    await expect(badge).toBeVisible();
    
    if (score) {
      await expect(badge).toContainText(String(score));
    }
    
    return badge;
  }

  async verifySLABadge(status?: string) {
    const badge = this.page.locator('[data-testid="sla-badge"]');
    await expect(badge).toBeVisible();
    
    if (status) {
      await expect(badge).toContainText(status);
    }
    
    return badge;
  }

  // Screenshot helpers
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  async takeElementScreenshot(selector: string, name: string) {
    const element = this.page.locator(selector);
    await element.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png` 
    });
  }
}

// Test assertions
export class TestAssertions {
  constructor(private page: Page) {}

  async assertPageTitle(title: string) {
    await expect(this.page).toHaveTitle(new RegExp(title));
  }

  async assertURL(pattern: string) {
    await expect(this.page).toHaveURL(new RegExp(pattern));
  }

  async assertElementVisible(selector: string) {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  async assertElementHidden(selector: string) {
    await expect(this.page.locator(selector)).toBeHidden();
  }

  async assertElementText(selector: string, text: string) {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  async assertElementCount(selector: string, count: number) {
    await expect(this.page.locator(selector)).toHaveCount(count);
  }

  async assertFormValue(selector: string, value: string) {
    await expect(this.page.locator(selector)).toHaveValue(value);
  }

  async assertAPIResponse(response: any, expectedStatus: number) {
    expect(response.status).toBe(expectedStatus);
    expect(response.ok).toBe(expectedStatus < 400);
  }
}

// Performance helpers
export class PerformanceHelpers {
  constructor(private page: Page) {}

  async measurePageLoad(url: string): Promise<number> {
    const start = Date.now();
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    return Date.now() - start;
  }

  async measureAPICall(endpoint: string, options: any = {}): Promise<number> {
    const start = Date.now();
    await this.page.evaluate(
      async ({ endpoint, options }) => {
        await fetch(endpoint, options);
      },
      { endpoint, options }
    );
    return Date.now() - start;
  }

  async getPageMetrics() {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      };
    });
  }
}

// Database helpers (for test data management)
export class DatabaseHelpers {
  constructor(private page: Page) {}

  async createTestLead(leadData: any) {
    return await this.page.evaluate(
      async ({ leadData, apiUrl }) => {
        const response = await fetch(`${apiUrl}/ingest/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key'
          },
          body: JSON.stringify(leadData)
        });
        
        const data = await response.json();
        return { ok: response.ok, data };
      },
      { leadData, apiUrl: process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000' }
    );
  }

  async deleteTestLead(leadId: string) {
    return await this.page.evaluate(
      async ({ leadId, apiUrl }) => {
        const response = await fetch(`${apiUrl}/api/leads/${leadId}?confirm=true`, {
          method: 'DELETE',
          headers: {
            'X-API-Key': 'test-api-key'
          }
        });
        
        return { ok: response.ok };
      },
      { leadId, apiUrl: process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000' }
    );
  }

  async cleanupTestData() {
    // Clean up all test leads, rules, etc.
    await this.page.evaluate(async ({ apiUrl }) => {
      // Delete test leads
      const leadsResponse = await fetch(`${apiUrl}/api/leads?search=@acme.com&pageSize=100`, {
        headers: { 'X-API-Key': 'test-api-key' }
      });
      
      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json();
        const testLeads = leadsData.leads.filter((lead: any) => 
          lead.email?.includes('@acme.com') || lead.source === 'webhook_test'
        );
        
        for (const lead of testLeads) {
          await fetch(`${apiUrl}/api/leads/${lead.id}?confirm=true`, {
            method: 'DELETE',
            headers: { 'X-API-Key': 'test-api-key' }
          });
        }
      }
    }, { apiUrl: process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000' });
  }
}

// Export all helpers
export function createTestHelpers(page: Page) {
  return {
    page: new PageHelpers(page),
    assert: new TestAssertions(page),
    perf: new PerformanceHelpers(page),
    db: new DatabaseHelpers(page)
  };
}
