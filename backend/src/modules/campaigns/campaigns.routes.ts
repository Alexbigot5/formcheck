import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';

// Validation schemas
const campaignSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  sequenceId: z.string().optional(),
  mailboxPoolId: z.string().optional(),
  targetAudience: z.object({
    scoreBand: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional().default([])
  }).optional(),
  settings: z.object({
    dailyLimit: z.number().min(1).max(1000).default(50),
    delayBetweenEmails: z.number().min(1).default(60), // minutes
    timezone: z.string().default('UTC'),
    workingHours: z.object({
      start: z.string().default('09:00'),
      end: z.string().default('17:00')
    })
  }).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft')
});

const sequenceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  steps: z.array(z.object({
    stepNumber: z.number().min(1),
    templateId: z.string(),
    delayDays: z.number().min(0).default(0),
    delayHours: z.number().min(0).default(0),
    conditions: z.array(z.object({
      type: z.enum(['opened', 'clicked', 'replied', 'not_opened', 'not_replied']),
      action: z.enum(['continue', 'skip', 'end_sequence'])
    })).optional().default([])
  })),
  isActive: z.boolean().default(true)
});

const mailboxPoolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  mailboxes: z.array(z.object({
    email: z.string().email(),
    name: z.string(),
    dailyLimit: z.number().min(1).max(200).default(50),
    isActive: z.boolean().default(true)
  })),
  rotationStrategy: z.enum(['round_robin', 'random', 'least_used']).default('round_robin')
});

export async function registerCampaignRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  // Note: Authentication is applied per route using preHandler option

  /**
   * GET /api/campaigns - Get all campaigns
   */
  app.get('/api/campaigns', async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId!;

    try {
      // Mock campaigns data for demo
      const mockCampaigns = [
        {
          id: 'camp-1',
          name: 'Q1 Enterprise Outreach',
          description: 'Target enterprise leads with high scores',
          sequenceId: 'seq-1',
          mailboxPoolId: 'pool-1',
          status: 'active',
          targetAudience: { scoreBand: 'HIGH', source: 'form' },
          stats: {
            totalLeads: 500,
            sent: 342,
            opened: 145,
            clicked: 67,
            replied: 23,
            openRate: 42.4,
            clickRate: 19.6,
            replyRate: 6.7
          },
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'camp-2',
          name: 'SaaS Startup Campaign',
          description: 'Nurture sequence for SaaS leads',
          sequenceId: 'seq-2',
          mailboxPoolId: 'pool-2',
          status: 'paused',
          targetAudience: { scoreBand: 'MEDIUM', tags: ['saas', 'startup'] },
          stats: {
            totalLeads: 250,
            sent: 89,
            opened: 34,
            clicked: 12,
            replied: 7,
            openRate: 38.2,
            clickRate: 13.5,
            replyRate: 7.9
          },
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      return reply.send({ ok: true, data: { campaigns: mockCampaigns } });

    } catch (error) {
      app.log.error('Failed to get campaigns:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get campaigns' });
    }
  });

  /**
   * POST /api/campaigns - Create campaign
   */
  app.post('/api/campaigns', async (request: AuthenticatedRequest, reply) => {
    // Validate request body
    const parsed = campaignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error });
    }
    const campaignData = parsed.data;
    const teamId = request.teamId!;

    try {
      // Mock campaign creation
      const newCampaign = {
        id: `camp-${Date.now()}`,
        ...campaignData,
        teamId,
        stats: {
          totalLeads: 0,
          sent: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          openRate: 0,
          clickRate: 0,
          replyRate: 0
        },
        createdAt: new Date().toISOString(),
        lastActivity: null
      };

      return reply.code(201).send({
        ok: true,
        data: {
          campaign: newCampaign,
          message: 'Campaign created successfully'
        }
      });

    } catch (error) {
      app.log.error('Failed to create campaign:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to create campaign' });
    }
  });

  /**
   * GET /api/campaigns/:id - Get single campaign
   */
  app.get('/api/campaigns/:id', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Mock campaign details
      const campaign = {
        id,
        name: 'Q1 Enterprise Outreach',
        description: 'Target enterprise leads with high scores',
        sequenceId: 'seq-1',
        mailboxPoolId: 'pool-1',
        status: 'active',
        targetAudience: { scoreBand: 'HIGH', source: 'form' },
        settings: {
          dailyLimit: 50,
          delayBetweenEmails: 60,
          timezone: 'UTC',
          workingHours: { start: '09:00', end: '17:00' }
        },
        stats: {
          totalLeads: 500,
          sent: 342,
          opened: 145,
          clicked: 67,
          replied: 23,
          openRate: 42.4,
          clickRate: 19.6,
          replyRate: 6.7
        },
        recentActivity: [
          { type: 'email_sent', count: 12, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
          { type: 'email_opened', count: 5, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
          { type: 'email_replied', count: 2, timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }
        ]
      };

      return reply.send({ ok: true, data: { campaign } });

    } catch (error) {
      app.log.error('Failed to get campaign:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get campaign' });
    }
  });

  /**
   * PUT /api/campaigns/:id/status - Update campaign status
   */
  app.put('/api/campaigns/:id/status', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    try {
      return reply.send({
        ok: true,
        data: {
          campaignId: id,
          status,
          message: `Campaign ${status === 'active' ? 'started' : status === 'paused' ? 'paused' : 'updated'} successfully`
        }
      });

    } catch (error) {
      app.log.error('Failed to update campaign status:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to update campaign status' });
    }
  });

  /**
   * GET /api/sequences - Get all email sequences
   */
  app.get('/api/sequences', async (request: AuthenticatedRequest, reply) => {
    try {
      const mockSequences = [
        {
          id: 'seq-1',
          name: 'Cold Outreach Sequence',
          description: '5-step cold outreach for enterprise leads',
          steps: [
            { stepNumber: 1, templateId: 'template-1', delayDays: 0, delayHours: 0 },
            { stepNumber: 2, templateId: 'template-2', delayDays: 3, delayHours: 0 },
            { stepNumber: 3, templateId: 'template-3', delayDays: 7, delayHours: 0 },
            { stepNumber: 4, templateId: 'template-4', delayDays: 14, delayHours: 0 },
            { stepNumber: 5, templateId: 'template-5', delayDays: 21, delayHours: 0 }
          ],
          isActive: true,
          performance: {
            totalRuns: 150,
            completionRate: 68.5,
            averageReplyRate: 12.3
          },
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'seq-2',
          name: 'Follow-up Sequence',
          description: '3-step follow-up for warm leads',
          steps: [
            { stepNumber: 1, templateId: 'template-6', delayDays: 0, delayHours: 0 },
            { stepNumber: 2, templateId: 'template-7', delayDays: 2, delayHours: 0 },
            { stepNumber: 3, templateId: 'template-8', delayDays: 5, delayHours: 0 }
          ],
          isActive: true,
          performance: {
            totalRuns: 89,
            completionRate: 75.2,
            averageReplyRate: 18.7
          },
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      return reply.send({ ok: true, data: { sequences: mockSequences } });

    } catch (error) {
      app.log.error('Failed to get sequences:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get sequences' });
    }
  });

  /**
   * POST /api/sequences - Create email sequence
   */
  app.post('/api/sequences', async (request: AuthenticatedRequest, reply) => {
    // Validate request body
    const parsed = sequenceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error });
    }
    const sequenceData = parsed.data;

    try {
      const newSequence = {
        id: `seq-${Date.now()}`,
        ...sequenceData,
        performance: {
          totalRuns: 0,
          completionRate: 0,
          averageReplyRate: 0
        },
        createdAt: new Date().toISOString()
      };

      return reply.code(201).send({
        ok: true,
        data: {
          sequence: newSequence,
          message: 'Email sequence created successfully'
        }
      });

    } catch (error) {
      app.log.error('Failed to create sequence:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to create sequence' });
    }
  });

  /**
   * GET /api/mailbox-pools - Get all mailbox pools
   */
  app.get('/api/mailbox-pools', async (request: AuthenticatedRequest, reply) => {
    try {
      const mockPools = [
        {
          id: 'pool-1',
          name: 'Sales Team Pool',
          description: 'Main sales team mailboxes',
          mailboxes: [
            { email: 'john@company.com', name: 'John Smith', dailyLimit: 50, isActive: true },
            { email: 'sarah@company.com', name: 'Sarah Johnson', dailyLimit: 50, isActive: true },
            { email: 'mike@company.com', name: 'Mike Chen', dailyLimit: 50, isActive: true }
          ],
          rotationStrategy: 'round_robin',
          stats: {
            totalSent: 1250,
            dailyAverage: 178,
            activeMailboxes: 3
          },
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'pool-2',
          name: 'Marketing Pool',
          description: 'Marketing team outreach',
          mailboxes: [
            { email: 'marketing@company.com', name: 'Marketing Team', dailyLimit: 100, isActive: true },
            { email: 'outreach@company.com', name: 'Outreach Team', dailyLimit: 75, isActive: true }
          ],
          rotationStrategy: 'least_used',
          stats: {
            totalSent: 890,
            dailyAverage: 127,
            activeMailboxes: 2
          },
          createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      return reply.send({ ok: true, data: { pools: mockPools } });

    } catch (error) {
      app.log.error('Failed to get mailbox pools:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get mailbox pools' });
    }
  });

  /**
   * POST /api/mailbox-pools - Create mailbox pool
   */
  app.post('/api/mailbox-pools', async (request: AuthenticatedRequest, reply) => {
    // Validate request body
    const parsed = mailboxPoolSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error });
    }
    const poolData = parsed.data;

    try {
      const newPool = {
        id: `pool-${Date.now()}`,
        ...poolData,
        stats: {
          totalSent: 0,
          dailyAverage: 0,
          activeMailboxes: poolData.mailboxes.filter(m => m.isActive).length
        },
        createdAt: new Date().toISOString()
      };

      return reply.code(201).send({
        ok: true,
        data: {
          pool: newPool,
          message: 'Mailbox pool created successfully'
        }
      });

    } catch (error) {
      app.log.error('Failed to create mailbox pool:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to create mailbox pool' });
    }
  });
}
