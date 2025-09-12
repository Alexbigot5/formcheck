#!/usr/bin/env node

// Simple production server without TypeScript compilation
const { execSync, spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting SmartForms Backend (Simple Mode)...');

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Generate Prisma client if needed
try {
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (error) {
  console.warn('⚠️ Warning: Could not generate Prisma client:', error.message);
}

// Start the TypeScript server using tsx
console.log('🎯 Starting TypeScript server with tsx...');

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
