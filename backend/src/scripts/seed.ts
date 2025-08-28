#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clean existing data (optional - comment out for production)
    console.log('🧹 Cleaning existing demo data...');
    await cleanExistingData();

    // Create demo users
    console.log('👥 Creating demo users...');
    const users = await createUsers();

    // Create demo team
    console.log('🏢 Creating demo team...');
    const team = await createTeam();

    // Create owners (AE_POOL_A)
    console.log('👨‍💼 Creating owners in AE_POOL_A...');
    const owners = await createOwners(users, team.id);

    // Create scoring configuration
    console.log('🎯 Creating scoring configuration...');
    const scoringConfig = await createScoringConfig(team.id, users[0].id);

    // Create scoring rules
    console.log('📋 Creating scoring rules...');
    await createScoringRules(team.id);

    // Create routing rules
    console.log('🛤️ Creating routing rules...');
    await createRoutingRules(team.id, owners);

    // Create SLA settings
    console.log('⏰ Creating SLA settings...');
    await createSLASettings(team.id);

    // Create sample leads
    console.log('📊 Creating sample leads...');
    await createSampleLeads(team.id, owners);

    // Create API keys
    console.log('🔑 Creating API keys...');
    await createApiKeys(team.id);

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📋 Demo Data Summary:');
    console.log(`Team: ${team.name} (ID: ${team.id})`);
    console.log(`Users: ${users.length}`);
    console.log(`Owners: ${owners.length}`);
    console.log('Scoring: Configured with realistic rules');
    console.log('SLA: 5/15/30 minute thresholds');
    console.log('Sample leads: Created with various sources and scores');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanExistingData() {
  // Delete in dependency order
  await prisma.sLAClock.deleteMany({ where: { lead: { team: { name: 'SmartForms Demo' } } } });
  await prisma.timelineEvent.deleteMany({ where: { lead: { team: { name: 'SmartForms Demo' } } } });
  await prisma.message.deleteMany({ where: { lead: { team: { name: 'SmartForms Demo' } } } });
  await prisma.leadDedupeKey.deleteMany({ where: { lead: { team: { name: 'SmartForms Demo' } } } });
  await prisma.lead.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.apiKey.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.credential.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.integration.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.sLASetting.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.routingRule.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.scoringRule.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.scoringConfig.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.owner.deleteMany({ where: { team: { name: 'SmartForms Demo' } } });
  await prisma.team.deleteMany({ where: { name: 'SmartForms Demo' } });
  await prisma.user.deleteMany({ 
    where: { 
      email: { 
        in: [
          'sarah.johnson@smartforms.demo',
          'mike.chen@smartforms.demo', 
          'emily.rodriguez@smartforms.demo',
          'david.kim@smartforms.demo',
          'admin@smartforms.demo'
        ]
      }
    }
  });
}

async function createUsers() {
  const users = [
    {
      email: 'sarah.johnson@smartforms.demo',
      role: 'OWNER' as const
    },
    {
      email: 'mike.chen@smartforms.demo',
      role: 'OWNER' as const
    },
    {
      email: 'emily.rodriguez@smartforms.demo',
      role: 'OWNER' as const
    },
    {
      email: 'david.kim@smartforms.demo',
      role: 'OWNER' as const
    },
    {
      email: 'admin@smartforms.demo',
      role: 'OWNER' as const
    }
  ];

  const createdUsers = [];
  for (const userData of users) {
    const user = await prisma.user.create({
      data: userData
    });
    createdUsers.push(user);
    console.log(`  ✓ Created user: ${user.email}`);
  }

  return createdUsers;
}

async function createTeam() {
  const team = await prisma.team.create({
    data: {
      name: 'SmartForms Demo',
      settings: {
        enrichment: {
          enabled: true,
          providers: ['clearbit', 'hunter'],
          autoEnrich: true
        },
        competitors: [
          'typeform.com',
          'jotform.com',
          'wufoo.com',
          'formstack.com',
          'cognito.com'
        ],
        partners: [
          'hubspot.com',
          'salesforce.com',
          'zapier.com'
        ],
        freeMailboxDomains: [
          'gmail.com',
          'yahoo.com',
          'hotmail.com',
          'outlook.com'
        ]
      }
    }
  });

  console.log(`  ✓ Created team: ${team.name}`);
  return team;
}

async function createOwners(users: any[], teamId: string) {
  const owners = [];
  
  // Create AE_POOL_A with different capacities
  const ownerConfigs = [
    { userId: users[0].id, capacity: 50 }, // Sarah - Senior AE
    { userId: users[1].id, capacity: 40 }, // Mike - Mid-level AE
    { userId: users[2].id, capacity: 45 }, // Emily - Experienced AE
    { userId: users[3].id, capacity: 35 }, // David - Junior AE
  ];

  for (const config of ownerConfigs) {
    const owner = await prisma.owner.create({
      data: {
        userId: config.userId,
        teamId,
        capacity: config.capacity
      },
      include: {
        user: true
      }
    });
    owners.push(owner);
    console.log(`  ✓ Created owner: ${owner.user.email} (capacity: ${owner.capacity})`);
  }

  return owners;
}

async function createScoringConfig(teamId: string, createdBy: string) {
  const config = await prisma.scoringConfig.create({
    data: {
      teamId,
      createdBy,
      version: 1,
      weights: {
        urgency: 25,      // 25% weight
        engagement: 30,   // 30% weight  
        jobRole: 45       // 45% weight
      },
      bands: {
        high: 75,    // 75+ = HIGH
        medium: 50,  // 50-74 = MEDIUM
        low: 0       // 0-49 = LOW
      },
      negative: {
        competitor: -20,
        freeEmail: -10,
        invalidDomain: -15,
        spam: -30
      },
      enrichment: {
        companySize: {
          'enterprise': 20,
          'large': 15,
          'medium': 10,
          'small': 5,
          'startup': 0
        },
        industry: {
          'technology': 15,
          'finance': 12,
          'healthcare': 10,
          'manufacturing': 8,
          'retail': 5,
          'other': 0
        },
        revenue: {
          '100M+': 20,
          '50M-100M': 15,
          '10M-50M': 10,
          '1M-10M': 5,
          '<1M': 0
        }
      }
    }
  });

  console.log(`  ✓ Created scoring config (version ${config.version})`);
  return config;
}

async function createScoringRules(teamId: string) {
  const rules = [
    {
      type: 'IF_THEN' as const,
      enabled: true,
      order: 1,
      definition: {
        if: [
          { field: 'email', op: 'ends_with', value: '@gmail.com' },
          { field: 'email', op: 'ends_with', value: '@yahoo.com' },
          { field: 'email', op: 'ends_with', value: '@hotmail.com' }
        ],
        then: { adjust: -10, reason: 'Free email domain' }
      }
    },
    {
      type: 'IF_THEN' as const,
      enabled: true,
      order: 2,
      definition: {
        if: [
          { field: 'company', op: 'contains', value: 'enterprise' },
          { field: 'company', op: 'contains', value: 'corp' },
          { field: 'company', op: 'contains', value: 'inc' }
        ],
        then: { adjust: 15, reason: 'Enterprise company indicators' }
      }
    },
    {
      type: 'IF_THEN' as const,
      enabled: true,
      order: 3,
      definition: {
        if: [
          { field: 'domain', op: 'in', value: ['typeform.com', 'jotform.com', 'wufoo.com'] }
        ],
        then: { adjust: -25, reason: 'Competitor domain' }
      }
    },
    {
      type: 'WEIGHT' as const,
      enabled: true,
      order: 4,
      definition: {
        field: 'utm.source',
        weights: {
          'google-ads': 20,
          'linkedin': 15,
          'organic': 10,
          'referral': 12,
          'direct': 5,
          'social': 8
        }
      }
    },
    {
      type: 'IF_THEN' as const,
      enabled: true,
      order: 5,
      definition: {
        if: [
          { field: 'fields.title', op: 'contains', value: 'ceo' },
          { field: 'fields.title', op: 'contains', value: 'founder' },
          { field: 'fields.title', op: 'contains', value: 'president' }
        ],
        then: { adjust: 25, reason: 'Executive-level contact' }
      }
    }
  ];

  for (const ruleData of rules) {
    const rule = await prisma.scoringRule.create({
      data: {
        teamId,
        ...ruleData
      }
    });
    console.log(`  ✓ Created scoring rule: ${rule.type} (order: ${rule.order})`);
  }
}

async function createRoutingRules(teamId: string, owners: any[]) {
  const rules = [
    {
      enabled: true,
      order: 1,
      definition: {
        if: [
          { field: 'scoreBand', op: 'equals', value: 'HIGH' }
        ],
        then: {
          assign: 'AE_POOL_A',
          priority: 1,
          alert: 'SLACK',
          sla: 5 // 5 minutes for high-value leads
        }
      }
    },
    {
      enabled: true,
      order: 2,
      definition: {
        if: [
          { field: 'source', op: 'equals', value: 'google-ads' },
          { field: 'score', op: 'greater_than', value: 60 }
        ],
        then: {
          assign: 'AE_POOL_A',
          priority: 2,
          sla: 10 // 10 minutes for paid leads
        }
      }
    },
    {
      enabled: true,
      order: 3,
      definition: {
        if: [
          { field: 'fields.company_size', op: 'in', value: ['enterprise', 'large'] }
        ],
        then: {
          assign: owners[0].id, // Assign enterprise leads to Sarah (most experienced)
          priority: 1,
          alert: 'EMAIL',
          sla: 15
        }
      }
    },
    {
      enabled: true,
      order: 4,
      definition: {
        if: [
          { field: 'scoreBand', op: 'equals', value: 'MEDIUM' }
        ],
        then: {
          assign: 'AE_POOL_A',
          priority: 3,
          sla: 30 // 30 minutes for medium leads
        }
      }
    },
    {
      enabled: true,
      order: 5,
      definition: {
        if: [
          { field: 'scoreBand', op: 'equals', value: 'LOW' }
        ],
        then: {
          assign: 'AE_POOL_A',
          priority: 4,
          sla: 60 // 1 hour for low-priority leads
        }
      }
    }
  ];

  for (const ruleData of rules) {
    const rule = await prisma.routingRule.create({
      data: {
        teamId,
        ...ruleData
      }
    });
    console.log(`  ✓ Created routing rule: ${rule.order}`);
  }
}

async function createSLASettings(teamId: string) {
  const settings = await prisma.sLASetting.create({
    data: {
      teamId,
      thresholds: {
        priority1: 5,   // 5 minutes for highest priority
        priority2: 15,  // 15 minutes for high priority
        priority3: 30,  // 30 minutes for medium priority
        priority4: 60,  // 60 minutes for low priority
        escalation: {
          enabled: true,
          levels: [
            { minutes: 10, action: 'notify_manager' },
            { minutes: 30, action: 'escalate_to_director' },
            { minutes: 60, action: 'emergency_alert' }
          ]
        },
        business_hours: {
          enabled: true,
          timezone: 'America/New_York',
          schedule: {
            monday: { start: '09:00', end: '18:00' },
            tuesday: { start: '09:00', end: '18:00' },
            wednesday: { start: '09:00', end: '18:00' },
            thursday: { start: '09:00', end: '18:00' },
            friday: { start: '09:00', end: '18:00' },
            saturday: null,
            sunday: null
          }
        }
      }
    }
  });

  console.log(`  ✓ Created SLA settings with 5/15/30 minute thresholds`);
  return settings;
}

async function createSampleLeads(teamId: string, owners: any[]) {
  const sampleLeads = [
    {
      email: 'john.doe@acmecorp.com',
      name: 'John Doe',
      company: 'Acme Corp',
      domain: 'acmecorp.com',
      phone: '+1-555-0123',
      source: 'website_form',
      sourceRef: 'contact-form',
      fields: {
        title: 'VP of Sales',
        company_size: 'enterprise',
        industry: 'technology',
        interest: 'lead generation',
        budget: '50k-100k',
        timeline: '3-6 months'
      },
      utm: {
        source: 'google-ads',
        medium: 'cpc',
        campaign: 'lead-gen-q1',
        term: 'form builder'
      },
      score: 85,
      scoreBand: 'HIGH' as const
    },
    {
      email: 'sarah.wilson@startup.io',
      name: 'Sarah Wilson',
      company: 'Startup.io',
      domain: 'startup.io',
      source: 'linkedin',
      fields: {
        title: 'Founder',
        company_size: 'startup',
        industry: 'technology',
        interest: 'automation'
      },
      utm: {
        source: 'linkedin',
        medium: 'social',
        campaign: 'founder-outreach'
      },
      score: 72,
      scoreBand: 'MEDIUM' as const
    },
    {
      email: 'mike.test@gmail.com',
      name: 'Mike Test',
      company: 'Freelancer',
      source: 'organic',
      fields: {
        title: 'Consultant',
        interest: 'basic forms'
      },
      utm: {
        source: 'organic',
        medium: 'search'
      },
      score: 35,
      scoreBand: 'LOW' as const
    },
    {
      email: 'competitor@typeform.com',
      name: 'Jane Smith',
      company: 'Typeform',
      domain: 'typeform.com',
      source: 'direct',
      fields: {
        title: 'Product Manager',
        interest: 'competitive research'
      },
      score: 15, // Low due to competitor penalty
      scoreBand: 'LOW' as const
    },
    {
      email: 'enterprise.buyer@megacorp.com',
      name: 'Robert Enterprise',
      company: 'MegaCorp Inc',
      domain: 'megacorp.com',
      phone: '+1-555-0199',
      source: 'referral',
      fields: {
        title: 'Chief Technology Officer',
        company_size: 'enterprise',
        industry: 'finance',
        budget: '500k+',
        timeline: 'immediate'
      },
      utm: {
        source: 'referral',
        medium: 'partner'
      },
      score: 95,
      scoreBand: 'HIGH' as const
    }
  ];

  for (let i = 0; i < sampleLeads.length; i++) {
    const leadData = sampleLeads[i];
    const assignedOwner = owners[i % owners.length]; // Round-robin assignment

    const lead = await prisma.lead.create({
      data: {
        ...leadData,
        teamId,
        ownerId: assignedOwner.id,
        status: i < 2 ? 'ASSIGNED' : 'NEW',
        createdAt: new Date(Date.now() - (i * 2 * 60 * 60 * 1000)) // Stagger creation times
      }
    });

    // Create SLA clock
    await prisma.sLAClock.create({
      data: {
        leadId: lead.id,
        targetAt: new Date(lead.createdAt.getTime() + (leadData.scoreBand === 'HIGH' ? 5 : 30) * 60 * 1000)
      }
    });

    // Create sample timeline events
    await prisma.timelineEvent.create({
      data: {
        leadId: lead.id,
        type: 'FORM_SUBMISSION',
        payload: {
          action: 'lead_created',
          source: leadData.source,
          score: leadData.score,
          band: leadData.scoreBand
        }
      }
    });

    if (i < 2) {
      // Add assignment event for first two leads
      await prisma.timelineEvent.create({
        data: {
          leadId: lead.id,
          type: 'STATUS_CHANGED',
          payload: {
            action: 'lead_assigned',
            ownerId: assignedOwner.id,
            ownerEmail: assignedOwner.user.email,
            previousStatus: 'NEW',
            newStatus: 'ASSIGNED'
          }
        }
      });
    }

    console.log(`  ✓ Created lead: ${lead.email} (${lead.scoreBand}, assigned to ${assignedOwner.user.email})`);
  }
}

async function createApiKeys(teamId: string) {
  const keyData = [
    {
      name: 'Production API Key',
      ipAllowlist: ['192.168.1.0/24', '10.0.0.0/8']
    },
    {
      name: 'Development API Key',
      ipAllowlist: null
    }
  ];

  for (const keyConfig of keyData) {
    const apiKey = `sf_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const createdKey = await prisma.apiKey.create({
      data: {
        teamId,
        name: keyConfig.name,
        keyHash,
        ipAllowlist: keyConfig.ipAllowlist
      }
    });

    console.log(`  ✓ Created API key: ${keyConfig.name}`);
    console.log(`    Key: ${apiKey}`);
  }
}

// Run the seeding
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Seeding failed:', e);
      process.exit(1);
    });
}

export { main as seedDatabase };
