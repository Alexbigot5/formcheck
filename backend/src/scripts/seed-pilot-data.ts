import { PrismaClient } from '@prisma/client';
import { loadEnv } from '../config/env';

const prisma = new PrismaClient();

async function seedPilotData() {
  console.log('🌱 Seeding pilot user data...');
  
  const pilotTeamId = 'pilot-team-2024';
  const pilotUserId = 'pilot-user-2024';
  
  try {
    // Clean existing pilot data
    await prisma.lead.deleteMany({ where: { teamId: pilotTeamId } });
    await prisma.form.deleteMany({ where: { teamId: pilotTeamId } });
    await prisma.emailTemplate.deleteMany({ where: { teamId: pilotTeamId } });
    
    console.log('✅ Cleaned existing pilot data');
    
    // Create sample leads with diverse sources and scores
    const sampleLeads = [
      {
        teamId: pilotTeamId,
        email: 'sarah.johnson@techcorp.com',
        name: 'Sarah Johnson',
        company: 'TechCorp Industries',
        phone: '+1-555-0123',
        source: 'linkedin',
        score: 85,
        scoreBand: 'HIGH' as const,
        status: 'NEW' as const,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        teamId: pilotTeamId,
        email: 'michael.chen@startup.io',
        name: 'Michael Chen',
        company: 'Startup.io',
        phone: '+1-555-0124',
        source: 'form',
        score: 72,
        scoreBand: 'MEDIUM' as const,
        status: 'ASSIGNED' as const,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        teamId: pilotTeamId,
        email: 'emily.rodriguez@enterprise.com',
        name: 'Emily Rodriguez',
        company: 'Enterprise Solutions',
        phone: '+1-555-0125',
        source: 'email',
        score: 91,
        scoreBand: 'HIGH' as const,
        status: 'IN_PROGRESS' as const,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      },
      {
        teamId: pilotTeamId,
        email: 'david.kim@consulting.biz',
        name: 'David Kim',
        company: 'Consulting Biz',
        phone: '+1-555-0126',
        source: 'webhook',
        score: 45,
        scoreBand: 'LOW' as const,
        status: 'NEW' as const,
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
      {
        teamId: pilotTeamId,
        email: 'lisa.thompson@marketing.co',
        name: 'Lisa Thompson',
        company: 'Marketing Co',
        phone: '+1-555-0127',
        source: 'instagram',
        score: 68,
        scoreBand: 'MEDIUM' as const,
        status: 'ASSIGNED' as const,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      }
    ];
    
    for (const lead of sampleLeads) {
      await prisma.lead.create({ data: lead });
    }
    
    console.log('✅ Created sample leads');
    
    // Create sample forms
    const sampleForms = [
      {
        teamId: pilotTeamId,
        name: 'Product Demo Request',
        slug: 'product-demo-pilot',
        description: 'Request a personalized demo of our product',
        isActive: true,
        fields: [
          { name: 'name', type: 'text', label: 'Full Name', required: true },
          { name: 'email', type: 'email', label: 'Email Address', required: true },
          { name: 'company', type: 'text', label: 'Company Name', required: true },
          { name: 'phone', type: 'tel', label: 'Phone Number', required: false },
          { name: 'interest', type: 'select', label: 'Interest Level', options: ['High', 'Medium', 'Low'], required: true }
        ],
        styling: {
          primaryColor: '#3b82f6',
          backgroundColor: '#ffffff',
          textColor: '#1f2937'
        },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      },
      {
        teamId: pilotTeamId,
        name: 'Newsletter Signup',
        slug: 'newsletter-pilot',
        description: 'Subscribe to our weekly newsletter',
        isActive: true,
        fields: [
          { name: 'email', type: 'email', label: 'Email Address', required: true },
          { name: 'name', type: 'text', label: 'First Name', required: false },
          { name: 'interests', type: 'checkbox', label: 'Interests', options: ['Technology', 'Marketing', 'Sales', 'Product'], required: false }
        ],
        styling: {
          primaryColor: '#10b981',
          backgroundColor: '#f9fafb',
          textColor: '#374151'
        },
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      }
    ];
    
    for (const form of sampleForms) {
      await prisma.form.create({ data: form });
    }
    
    console.log('✅ Created sample forms');
    
    // Create sample email templates
    const sampleTemplates = [
      {
        teamId: pilotTeamId,
        name: 'Welcome Email',
        subject: 'Welcome to SmartForms AI - Let\'s Get Started!',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #3b82f6;">Welcome to SmartForms AI!</h1>
            <p>Hi {{name}},</p>
            <p>Thank you for your interest in SmartForms AI. We're excited to help you streamline your lead generation process.</p>
            <p>Here's what you can expect:</p>
            <ul>
              <li>Intelligent lead scoring and routing</li>
              <li>Automated follow-up sequences</li>
              <li>Comprehensive analytics and reporting</li>
            </ul>
            <p>If you have any questions, feel free to reach out to our team.</p>
            <p>Best regards,<br>The SmartForms AI Team</p>
          </div>
        `,
        textContent: `Welcome to SmartForms AI!
        
Hi {{name}},

Thank you for your interest in SmartForms AI. We're excited to help you streamline your lead generation process.

Here's what you can expect:
- Intelligent lead scoring and routing
- Automated follow-up sequences  
- Comprehensive analytics and reporting

If you have any questions, feel free to reach out to our team.

Best regards,
The SmartForms AI Team`,
        isActive: true,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      },
      {
        teamId: pilotTeamId,
        name: 'Demo Follow-up',
        subject: 'Thanks for the demo - Next steps',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #10b981;">Thanks for the Demo!</h1>
            <p>Hi {{name}},</p>
            <p>It was great connecting with you during our demo session. I hope you found the SmartForms AI platform valuable for your lead generation needs.</p>
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Review the demo recording (attached)</li>
              <li>Consider which features would be most valuable for {{company}}</li>
              <li>Schedule a follow-up call to discuss implementation</li>
            </ol>
            <p>I'm here to answer any questions you might have.</p>
            <p>Best regards,<br>Your SmartForms AI Representative</p>
          </div>
        `,
        textContent: `Thanks for the Demo!

Hi {{name}},

It was great connecting with you during our demo session. I hope you found the SmartForms AI platform valuable for your lead generation needs.

Next Steps:
1. Review the demo recording (attached)
2. Consider which features would be most valuable for {{company}}
3. Schedule a follow-up call to discuss implementation

I'm here to answer any questions you might have.

Best regards,
Your SmartForms AI Representative`,
        isActive: true,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      }
    ];
    
    for (const template of sampleTemplates) {
      await prisma.emailTemplate.create({ data: template });
    }
    
    console.log('✅ Created sample email templates');
    
    // Create sample timeline events for leads
    const leads = await prisma.lead.findMany({ where: { teamId: pilotTeamId } });
    
    for (const lead of leads) {
      // Create form submission event
      await prisma.timelineEvent.create({
        data: {
          leadId: lead.id,
          type: 'FORM_SUBMISSION',
          title: 'Form Submitted',
          description: `Lead submitted ${lead.source} form`,
          payload: {
            source: lead.source,
            score: lead.score,
            company: lead.company
          },
          createdAt: lead.createdAt
        }
      });
      
      // Create scoring event
      await prisma.timelineEvent.create({
        data: {
          leadId: lead.id,
          type: 'SCORE_UPDATE',
          title: 'Lead Scored',
          description: `Lead scored ${lead.score} points (${lead.scoreBand} priority)`,
          payload: {
            score: lead.score,
            scoreBand: lead.scoreBand,
            factors: ['Company size', 'Industry match', 'Engagement level']
          },
          createdAt: new Date(lead.createdAt.getTime() + 5 * 60 * 1000) // 5 minutes after submission
        }
      });
      
      // Create assignment event for assigned leads
      if (lead.status === 'ASSIGNED' || lead.status === 'IN_PROGRESS') {
        await prisma.timelineEvent.create({
          data: {
            leadId: lead.id,
            type: 'ASSIGNMENT',
            title: 'Lead Assigned',
            description: 'Lead assigned to sales representative',
            payload: {
              assignedTo: 'Pilot User',
              reason: 'High score match'
            },
            createdAt: new Date(lead.createdAt.getTime() + 15 * 60 * 1000) // 15 minutes after submission
          }
        });
      }
    }
    
    console.log('✅ Created sample timeline events');
    
    console.log('🎉 Pilot data seeding completed successfully!');
    console.log('📧 Pilot login: pilot@smartforms.ai');
    console.log('🔑 Password: any password (mock auth enabled)');
    
  } catch (error) {
    console.error('❌ Error seeding pilot data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
if (require.main === module) {
  loadEnv();
  seedPilotData()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedPilotData };
