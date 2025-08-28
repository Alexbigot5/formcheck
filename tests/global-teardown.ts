import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000';

  try {
    // Cleanup test data
    await cleanupTestData(page, apiUrl);
    
    console.log('✅ Global teardown completed');

  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here - we don't want to fail the entire test run due to cleanup issues
  } finally {
    await browser.close();
  }
}

async function cleanupTestData(page: any, apiUrl: string) {
  console.log('🗑️ Cleaning up test data...');

  try {
    // Delete test leads
    await page.evaluate(async (apiUrl: string) => {
      try {
        // Get all test leads (those with test email domains or specific markers)
        const response = await fetch(`${apiUrl}/api/leads?search=@acme.com&pageSize=100`, {
          headers: {
            'X-API-Key': 'test-api-key'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const testLeads = data.leads.filter((lead: any) => 
            lead.email?.includes('@acme.com') || 
            lead.source === 'webhook_test' ||
            lead.company === 'Acme Corp'
          );
          
          // Delete each test lead
          for (const lead of testLeads) {
            await fetch(`${apiUrl}/api/leads/${lead.id}?confirm=true`, {
              method: 'DELETE',
              headers: {
                'X-API-Key': 'test-api-key'
              }
            });
          }
          
          console.log(`🗑️ Deleted ${testLeads.length} test leads`);
        }
      } catch (error) {
        console.log('ℹ️ No test leads to cleanup or cleanup failed:', error);
      }
    }, apiUrl);

    // Cleanup test routing rules
    await page.evaluate(async (apiUrl: string) => {
      try {
        const response = await fetch(`${apiUrl}/routing/rules`, {
          headers: {
            'X-API-Key': 'test-api-key'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const testRules = data.rules.filter((rule: any) => 
            rule.name?.includes('Test') || 
            rule.name?.includes('test')
          );
          
          // Delete each test rule
          for (const rule of testRules) {
            await fetch(`${apiUrl}/routing/rules/${rule.id}`, {
              method: 'DELETE',
              headers: {
                'X-API-Key': 'test-api-key'
              }
            });
          }
          
          console.log(`🗑️ Deleted ${testRules.length} test routing rules`);
        }
      } catch (error) {
        console.log('ℹ️ No test routing rules to cleanup or cleanup failed:', error);
      }
    }, apiUrl);

    // Reset SLA settings to defaults
    await page.evaluate(async (apiUrl: string) => {
      try {
        await fetch(`${apiUrl}/sla/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key'
          },
          body: JSON.stringify({
            thresholds: {
              priority1: 30,
              priority2: 120,
              priority3: 480
            }
          })
        });
        
        console.log('🔄 Reset SLA settings to defaults');
      } catch (error) {
        console.log('ℹ️ Failed to reset SLA settings:', error);
      }
    }, apiUrl);

    // Cleanup test integrations (keep them disconnected)
    await page.evaluate(async (apiUrl: string) => {
      try {
        // Disconnect test integrations
        const integrations = ['hubspot', 'salesforce', 'pipedrive'];
        
        for (const integration of integrations) {
          await fetch(`${apiUrl}/integrations/${integration}/disconnect`, {
            method: 'POST',
            headers: {
              'X-API-Key': 'test-api-key'
            }
          });
        }
        
        console.log('🔌 Disconnected test integrations');
      } catch (error) {
        console.log('ℹ️ Failed to disconnect integrations:', error);
      }
    }, apiUrl);

  } catch (error) {
    console.error('Failed to cleanup test data:', error);
    // Continue with teardown even if cleanup fails
  }
}

export default globalTeardown;
