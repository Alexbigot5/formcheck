/**
 * Test script for WebSocket and CRM API implementations
 * Run with: tsx src/scripts/test-websocket-crm.ts
 */

import WebSocket from 'ws';
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const WS_URL = process.env.WS_URL || 'ws://localhost:4000';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  error?: any;
}

const results: TestResult[] = [];

function addResult(test: string, success: boolean, message: string, error?: any) {
  results.push({ test, success, message, error });
  const status = success ? '✅' : '❌';
  console.log(`${status} ${test}: ${message}`);
  if (error) {
    console.log(`   Error: ${error.message || error}`);
  }
}

async function testHealthEndpoint() {
  try {
    const response = await axios.get(`${BASE_URL}/`);
    if (response.data.ok && response.data.service === 'up') {
      addResult('Health Check', true, 'Server is running');
      return true;
    } else {
      addResult('Health Check', false, 'Unexpected health response');
      return false;
    }
  } catch (error) {
    addResult('Health Check', false, 'Server not responding', error);
    return false;
  }
}

async function testWebSocketConnection() {
  return new Promise<boolean>((resolve) => {
    try {
      const ws = new WebSocket(`${WS_URL}/ws`);
      let connected = false;
      
      const timeout = setTimeout(() => {
        if (!connected) {
          addResult('WebSocket Connection', false, 'Connection timeout');
          ws.close();
          resolve(false);
        }
      }, 5000);

      ws.on('open', () => {
        connected = true;
        clearTimeout(timeout);
        addResult('WebSocket Connection', true, 'Connected successfully');
        
        // Test ping/pong
        ws.send(JSON.stringify({
          type: 'ping',
          data: {},
          timestamp: new Date().toISOString()
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            addResult('WebSocket Ping/Pong', true, 'Heartbeat working');
          }
        } catch (error) {
          addResult('WebSocket Message Parse', false, 'Failed to parse message', error);
        }
      });

      ws.on('close', () => {
        resolve(true);
      });

      ws.on('error', (error) => {
        addResult('WebSocket Connection', false, 'Connection error', error);
        resolve(false);
      });

      // Close connection after tests
      setTimeout(() => {
        ws.close();
      }, 2000);

    } catch (error) {
      addResult('WebSocket Connection', false, 'Failed to create connection', error);
      resolve(false);
    }
  });
}

async function testCRMRoutes() {
  // Test without authentication (should fail)
  try {
    await axios.get(`${BASE_URL}/api/integrations/crm/fields/hubspot`);
    addResult('CRM Auth Protection', false, 'Route not protected');
  } catch (error: any) {
    if (error.response?.status === 401) {
      addResult('CRM Auth Protection', true, 'Routes properly protected');
    } else {
      addResult('CRM Auth Protection', false, 'Unexpected error', error);
    }
  }

  // Test route existence
  try {
    await axios.get(`${BASE_URL}/api/integrations/crm/fields/invalid-provider`, {
      headers: { 'Authorization': 'Bearer fake-token' }
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      addResult('CRM Routes Available', true, 'Routes are registered and protected');
    } else {
      addResult('CRM Routes Available', false, 'Unexpected response', error);
    }
  }
}

async function testWebSocketRoutes() {
  // Test WebSocket broadcast route without auth
  try {
    await axios.post(`${BASE_URL}/api/ws/broadcast`, {
      type: 'test',
      data: { message: 'test' }
    });
    addResult('WebSocket Route Auth', false, 'Route not protected');
  } catch (error: any) {
    if (error.response?.status === 401) {
      addResult('WebSocket Route Auth', true, 'WebSocket routes properly protected');
    } else {
      addResult('WebSocket Route Auth', false, 'Unexpected error', error);
    }
  }
}

async function runTests() {
  console.log('🧪 Testing WebSocket and CRM API implementations...\n');

  // Test 1: Health check
  const serverRunning = await testHealthEndpoint();
  
  if (!serverRunning) {
    console.log('\n❌ Server is not running. Please start the server first.');
    return;
  }

  // Test 2: WebSocket connection
  await testWebSocketConnection();

  // Test 3: CRM API routes
  await testCRMRoutes();

  // Test 4: WebSocket API routes
  await testWebSocketRoutes();

  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! WebSocket and CRM implementations are working.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the implementation.');
  }

  // Detailed results
  console.log('\nDetailed Results:');
  results.forEach(result => {
    console.log(`- ${result.test}: ${result.success ? 'PASS' : 'FAIL'} - ${result.message}`);
  });
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
