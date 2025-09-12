import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase, AuthenticatedRequest } from '../../middleware/supabase-auth';

// Validation schemas
const webhookLeadSchema = z.object({
  source: z.string().default('webhook'),
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  jobTitle: z.string().optional(),
  message: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  customFields: z.record(z.any()).optional().default({})
});

const emailIngestionSchema = z.object({
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  date: z.string().datetime().optional(),
  messageId: z.string().optional()
});

const socialMediaSchema = z.object({
  platform: z.enum(['linkedin', 'instagram', 'twitter', 'facebook']),
  username: z.string(),
  message: z.string(),
  profileUrl: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

export async function registerDemoIngestionRoutes(app: FastifyInstance) {
  /**
   * POST /api/ingest/webhook - Generic webhook lead ingestion
   */
  app.post('/api/ingest/webhook', {
    schema: { body: webhookLeadSchema }
  }, async (request, reply) => {
    const leadData = request.body as z.infer<typeof webhookLeadSchema>;

    try {
      // Create lead with scoring
      const lead = await createLeadFromWebhook(app, leadData);
      
      return reply.send({
        ok: true,
        data: {
          leadId: lead.id,
          score: lead.score,
          scoreBand: lead.scoreBand,
          message: 'Lead created successfully from webhook'
        }
      });

    } catch (error) {
      app.log.error('Webhook ingestion failed:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to process webhook' });
    }
  });

  /**
   * POST /api/ingest/email - Email ingestion endpoint
   */
  app.post('/api/ingest/email', {
    preHandler: [authenticateSupabase],
    schema: { body: emailIngestionSchema }
  }, async (request: AuthenticatedRequest, reply) => {
    const emailData = request.body as z.infer<typeof emailIngestionSchema>;
    const teamId = request.teamId!;

    try {
      // Parse email into lead data
      const leadData = parseEmailToLead(emailData);
      
      // Create lead
      const lead = await app.prisma.lead.create({
        data: {
          teamId,
          email: leadData.email,
          name: leadData.name,
          company: leadData.company,
          source: 'email',
          sourceRef: emailData.messageId || `email_${Date.now()}`,
          fields: {
            subject: emailData.subject,
            body: emailData.body,
            originalFrom: emailData.from,
            receivedAt: emailData.date || new Date().toISOString()
          },
          utm: {},
          score: calculateBasicScore(leadData),
          scoreBand: 'LOW',
          status: 'NEW'
        }
      });

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: lead.id,
          type: 'EMAIL_RECEIVED',
          payload: {
            from: emailData.from,
            subject: emailData.subject,
            body: emailData.body.substring(0, 500), // Truncate for storage
            receivedAt: new Date().toISOString()
          }
        }
      });

      return reply.send({
        ok: true,
        data: {
          leadId: lead.id,
          score: lead.score,
          message: 'Lead created from email successfully'
        }
      });

    } catch (error) {
      app.log.error('Email ingestion failed:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to process email' });
    }
  });

  /**
   * POST /api/ingest/social - Social media ingestion
   */
  app.post('/api/ingest/social', {
    preHandler: [authenticateSupabase],
    schema: { body: socialMediaSchema }
  }, async (request: AuthenticatedRequest, reply) => {
    const socialData = request.body as z.infer<typeof socialMediaSchema>;
    const teamId = request.teamId!;

    try {
      // Extract contact info from social media data
      const leadData = parseSocialMediaToLead(socialData);

      // Create lead
      const lead = await app.prisma.lead.create({
        data: {
          teamId,
          name: leadData.name,
          email: leadData.email,
          company: leadData.company,
          source: socialData.platform,
          sourceRef: socialData.username,
          fields: {
            platform: socialData.platform,
            username: socialData.username,
            message: socialData.message,
            profileUrl: socialData.profileUrl,
            timestamp: socialData.timestamp || new Date().toISOString()
          },
          utm: {
            source: socialData.platform,
            medium: 'social',
            campaign: 'organic'
          },
          score: calculateBasicScore(leadData),
          scoreBand: 'LOW',
          status: 'NEW'
        }
      });

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: lead.id,
          type: 'DM_RECEIVED',
          payload: {
            platform: socialData.platform,
            username: socialData.username,
            message: socialData.message,
            profileUrl: socialData.profileUrl,
            receivedAt: new Date().toISOString()
          }
        }
      });

      return reply.send({
        ok: true,
        data: {
          leadId: lead.id,
          score: lead.score,
          message: `Lead created from ${socialData.platform} successfully`
        }
      });

    } catch (error) {
      app.log.error('Social media ingestion failed:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to process social media data' });
    }
  });

  /**
   * GET /api/ingest/sources - Get ingestion source statistics
   */
  app.get('/api/ingest/sources', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId!;

    try {
      // Get lead counts by source
      const sourceStats = await app.prisma.lead.groupBy({
        by: ['source'],
        where: { teamId },
        _count: { source: true },
        orderBy: { _count: { source: 'desc' } }
      });

      // Get recent leads by source
      const recentLeads = await app.prisma.lead.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          source: true,
          email: true,
          name: true,
          score: true,
          createdAt: true
        }
      });

      // Calculate source performance
      const sourcePerformance = sourceStats.map(stat => ({
        source: stat.source,
        count: stat._count.source,
        percentage: Math.round((stat._count.source / sourceStats.reduce((acc, s) => acc + s._count.source, 0)) * 100)
      }));

      return reply.send({
        ok: true,
        data: {
          sourceStats: sourcePerformance,
          recentLeads: recentLeads.map(lead => ({
            ...lead,
            createdAt: lead.createdAt.toISOString()
          })),
          totalLeads: sourceStats.reduce((acc, s) => acc + s._count.source, 0)
        }
      });

    } catch (error) {
      app.log.error('Failed to get ingestion stats:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get ingestion statistics' });
    }
  });

  /**
   * POST /api/ingest/demo - Create demo leads for testing
   */
  app.post('/api/ingest/demo', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId!;

    try {
      // Create demo leads from different sources
      const demoLeads = [
        {
          email: 'sarah.johnson@techcorp.com',
          name: 'Sarah Johnson',
          company: 'TechCorp Solutions',
          source: 'form',
          score: 85,
          fields: { jobTitle: 'CTO', budget: '50000', timeline: 'immediate' }
        },
        {
          email: 'mike.chen@startup.io',
          name: 'Mike Chen',
          company: 'Startup.io',
          source: 'linkedin',
          score: 72,
          fields: { jobTitle: 'Founder', employees: '25' }
        },
        {
          email: 'lisa.rodriguez@enterprise.com',
          name: 'Lisa Rodriguez',
          company: 'Enterprise Corp',
          source: 'email',
          score: 91,
          fields: { jobTitle: 'VP Marketing', budget: '100000' }
        },
        {
          email: 'david.kim@agency.com',
          name: 'David Kim',
          company: 'Creative Agency',
          source: 'webhook',
          score: 45,
          fields: { jobTitle: 'Account Manager', company_size: 'small' }
        },
        {
          email: 'emma.wilson@consulting.com',
          name: 'Emma Wilson',
          company: 'Wilson Consulting',
          source: 'instagram',
          score: 38,
          fields: { jobTitle: 'Consultant', inquiry: 'pricing' }
        }
      ];

      const createdLeads = [];

      for (const leadData of demoLeads) {
        const lead = await app.prisma.lead.create({
          data: {
            teamId,
            email: leadData.email,
            name: leadData.name,
            company: leadData.company,
            source: leadData.source,
            sourceRef: `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            fields: leadData.fields,
            utm: {
              source: leadData.source,
              medium: leadData.source === 'form' ? 'website' : 'social',
              campaign: 'demo'
            },
            score: leadData.score,
            scoreBand: leadData.score >= 70 ? 'HIGH' : leadData.score >= 40 ? 'MEDIUM' : 'LOW',
            status: 'NEW'
          }
        });

        // Add timeline event
        await app.prisma.timelineEvent.create({
          data: {
            leadId: lead.id,
            type: 'FORM_SUBMISSION',
            payload: {
              source: leadData.source,
              demo: true,
              createdAt: new Date().toISOString()
            }
          }
        });

        createdLeads.push(lead);
      }

      return reply.send({
        ok: true,
        data: {
          message: `Created ${createdLeads.length} demo leads`,
          leads: createdLeads.map(lead => ({
            id: lead.id,
            email: lead.email,
            name: lead.name,
            source: lead.source,
            score: lead.score
          }))
        }
      });

    } catch (error) {
      app.log.error('Failed to create demo leads:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to create demo leads' });
    }
  });
}

// Helper functions
async function createLeadFromWebhook(app: FastifyInstance, leadData: any) {
  // Default team for webhook leads (you might want to determine this differently)
  const defaultTeamId = 'default-team-id';

  const lead = await app.prisma.lead.create({
    data: {
      teamId: defaultTeamId,
      email: leadData.email,
      name: leadData.name,
      phone: leadData.phone,
      company: leadData.company,
      source: leadData.source,
      sourceRef: `webhook_${Date.now()}`,
      fields: {
        ...leadData.customFields,
        jobTitle: leadData.jobTitle,
        website: leadData.website,
        message: leadData.message
      },
      utm: {
        source: leadData.utm_source || 'direct',
        medium: leadData.utm_medium || 'webhook',
        campaign: leadData.utm_campaign,
        term: leadData.utm_term,
        content: leadData.utm_content
      },
      score: calculateBasicScore(leadData),
      scoreBand: 'LOW',
      status: 'NEW'
    }
  });

  return lead;
}

function parseEmailToLead(emailData: any) {
  // Extract lead info from email
  const fromEmail = emailData.from;
  const name = fromEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  const domain = fromEmail.split('@')[1];
  const company = domain.split('.')[0].replace(/\b\w/g, (l: string) => l.toUpperCase());

  return {
    email: fromEmail,
    name,
    company,
    domain
  };
}

function parseSocialMediaToLead(socialData: any) {
  // Extract lead info from social media data
  const name = socialData.username.replace(/[._]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  
  return {
    name,
    email: `${socialData.username}@${socialData.platform}.com`, // Placeholder
    company: null
  };
}

function calculateBasicScore(leadData: any): number {
  let score = 0;

  // Basic scoring
  if (leadData.email) score += 10;
  if (leadData.name) score += 5;
  if (leadData.company) score += 15;
  if (leadData.phone) score += 8;

  // Job title scoring
  const title = (leadData.jobTitle || '').toLowerCase();
  if (title.includes('ceo') || title.includes('founder')) score += 25;
  else if (title.includes('cto') || title.includes('vp')) score += 20;
  else if (title.includes('director') || title.includes('manager')) score += 15;

  // Budget scoring
  if (leadData.budget) {
    const budget = parseFloat(leadData.budget);
    if (budget > 50000) score += 25;
    else if (budget > 10000) score += 15;
    else if (budget > 1000) score += 10;
  }

  return Math.min(score, 100);
}
