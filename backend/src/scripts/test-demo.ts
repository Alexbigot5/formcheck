#!/usr/bin/env tsx

/**
 * Demo script to test core services with seeded data
 */

import { PrismaClient } from '@prisma/client';
import { applyScoring } from '../modules/scoring/engine.js';
import { routeLead } from '../modules/routing/engine.js';
import { deduplicateLead } from '../modules/dedupe/index.js';

const prisma = new PrismaClient();

// Mock Fastify app for demo
const mockApp = {
  prisma,
  log: {
    debug: console.log,
    info: console.log,
    warn: console.warn,
    error: console.error,
  },
} as any;

async function main() {
  console.log('🧪 Testing Core Services with Seeded Data\n');

  try {
    // Get demo team
    const team = await prisma.team.findFirst({
      where: { name: 'SmartForms Demo' }
    });

    if (!team) {
      console.error('❌ Demo team not found. Please run: npm run seed');
      return;
    }

    console.log(`✅ Found demo team: ${team.name}`);

    // Test 1: Scoring Service
    console.log('\n🎯 Testing Scoring Service...');
    await testScoringService(team.id);

    // Test 2: Routing Service  
    console.log('\n🛤️ Testing Routing Service...');
    await testRoutingService(team.id);

    // Test 3: Deduplication Service
    console.log('\n🔄 Testing Deduplication Service...');
    await testDeduplicationService(team.id);

    console.log('\n✅ All services tested successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function testScoringService(teamId: string) {
  // Get scoring config and rules
  const [config, rules] = await Promise.all([
    prisma.scoringConfig.findFirst({ where: { teamId } }),
    prisma.scoringRule.findMany({ where: { teamId, enabled: true } })
  ]);

  // Test different lead scenarios
  const testLeads = [
    {
      email: 'ceo@enterprise.com',
      name: 'John CEO',
      company: 'Enterprise Corp',
      fields: {
        title: 'Chief Executive Officer',
        company_size: 'enterprise',
        industry: 'technology'
      },
      utm: { source: 'google-ads' }
    },
    {
      email: 'user@gmail.com',
      name: 'Basic User',
      fields: { title: 'Student' }
    },
    {
      email: 'competitor@typeform.com',
      company: 'Typeform',
      domain: 'typeform.com',
      fields: { title: 'Product Manager' }
    }
  ];

  for (const lead of testLeads) {
    const result = await applyScoring(mockApp, lead, config, rules);
    console.log(`  📊 ${lead.email}: Score ${result.score} (${result.band}) - ${result.tags.join(', ')}`);
  }
}

async function testRoutingService(teamId: string) {
  // Get routing rules
  const rules = await prisma.routingRule.findMany({
    where: { teamId, enabled: true },
    orderBy: { order: 'asc' }
  });

  // Test different lead scenarios
  const testLeads = [
    {
      email: 'high-value@enterprise.com',
      score: 90,
      scoreBand: 'HIGH' as const,
      source: 'website_form'
    },
    {
      email: 'paid-lead@company.com',
      score: 75,
      scoreBand: 'MEDIUM' as const,
      source: 'google-ads'
    },
    {
      email: 'enterprise@bigcorp.com',
      score: 70,
      scoreBand: 'MEDIUM' as const,
      fields: { company_size: 'enterprise' }
    },
    {
      email: 'low-value@small.com',
      score: 30,
      scoreBand: 'LOW' as const,
      source: 'organic'
    }
  ];

  for (const lead of testLeads) {
    const result = await routeLead(mockApp, lead, rules);
    const assignment = result.ownerId ? `Owner ${result.ownerId}` : result.pool || 'Unassigned';
    console.log(`  🎯 ${lead.email}: ${assignment} (Priority ${result.priority || 'N/A'}, SLA: ${result.sla || 'N/A'}min)`);
  }
}

async function testDeduplicationService(teamId: string) {
  // Test duplicate detection scenarios
  const testScenarios = [
    {
      name: 'New unique lead',
      lead: {
        email: 'unique@newcompany.com',
        name: 'Unique User',
        company: 'New Company'
      }
    },
    {
      name: 'Potential duplicate (same domain)',
      lead: {
        email: 'another@acmecorp.com',
        name: 'Another User',
        company: 'Acme Corp'
      }
    },
    {
      name: 'Exact duplicate attempt',
      lead: {
        email: 'john.doe@acmecorp.com',
        name: 'John Doe',
        company: 'Acme Corp'
      }
    }
  ];

  for (const scenario of testScenarios) {
    try {
      const result = await deduplicateLead(mockApp, scenario.lead, teamId);
      console.log(`  🔍 ${scenario.name}: ${result.action.toUpperCase()} - ${result.message}`);
      
      if (result.duplicateId) {
        console.log(`    📎 Merged with lead: ${result.duplicateId}`);
      }
    } catch (error) {
      console.log(`  ❌ ${scenario.name}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Run the demo
if (require.main === module) {
  main().catch(console.error);
}

export { main as runDemo };
