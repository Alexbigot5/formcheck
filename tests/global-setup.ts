import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000';

  try {
    // Wait for services to be ready
    console.log('⏳ Waiting for services to be ready...');
    
    // Check frontend health
    let frontendReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        const response = await page.goto(baseUrl, { timeout: 5000 });
        if (response?.status() === 200) {
          frontendReady = true;
          break;
        }
      } catch (error) {
        console.log(`Frontend not ready, attempt ${i + 1}/30`);
        await page.waitForTimeout(2000);
      }
    }

    if (!frontendReady) {
      throw new Error('Frontend failed to start');
    }

    // Check backend health
    let backendReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        const response = await page.goto(`${apiUrl}/health`, { timeout: 5000 });
        if (response?.status() === 200) {
          backendReady = true;
          break;
        }
      } catch (error) {
        console.log(`Backend not ready, attempt ${i + 1}/30`);
        await page.waitForTimeout(2000);
      }
    }

    if (!backendReady) {
      throw new Error('Backend failed to start');
    }

    console.log('✅ Services are ready');

    // Setup test data
    await setupTestData(page, apiUrl);

    console.log('✅ Global setup completed');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function setupTestData(page: any, apiUrl: string) {
  console.log('📊 Setting up test data...');

  try {
    // Create test user and team
    await page.evaluate(async (apiUrl: string) => {
      // This would typically involve database seeding
      // For now, we'll create basic test data via API calls
      
      const testData = {
        user: {
          email: 'test@example.com',
          password: 'test123',
          role: 'OWNER'
        },
        team: {
          name: 'Test Team',
          settings: {}
        },
        apiKey: {
          name: 'Test API Key',
          key: 'test-api-key'
        }
      };

      console.log('Creating test user and team...');
      
      // In a real setup, you'd call your seeding endpoints or directly insert into DB
      // For this example, we'll assume the test data exists or is created by migrations
      
    }, apiUrl);

    // Create default scoring configuration
    await page.evaluate(async (apiUrl: string) => {
      try {
        const response = await fetch(`${apiUrl}/scoring/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key'
          },
          body: JSON.stringify({
            teamId: 'test-team-id'
          })
        });
        
        if (response.ok) {
          console.log('✅ Default scoring configuration created');
        }
      } catch (error) {
        console.log('ℹ️ Scoring configuration may already exist');
      }
    }, apiUrl);

    // Create test owner for routing
    await page.evaluate(async (apiUrl: string) => {
      try {
        const response = await fetch(`${apiUrl}/routing/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key'
          },
          body: JSON.stringify({
            teamId: 'test-team-id'
          })
        });
        
        if (response.ok) {
          console.log('✅ Default routing configuration created');
        }
      } catch (error) {
        console.log('ℹ️ Routing configuration may already exist');
      }
    }, apiUrl);

  } catch (error) {
    console.error('Failed to setup test data:', error);
    // Don't throw here - tests should handle missing data gracefully
  }
}

export default globalSetup;
