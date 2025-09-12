#!/usr/bin/env node

// Simple production starter script
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting SmartForms Backend...');

// Set NODE_ENV if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Start the server using tsx
const server = spawn('npx', ['tsx', 'src/server.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  server.kill('SIGTERM');
});
