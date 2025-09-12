import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateSupabase, AuthenticatedRequest } from '../../middleware/supabase-auth';

// Validation schemas
const analyticsQuerySchema = z.object({
  dateRange: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  source: z.string().optional(),
  scoreBand: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional()
});

export async function registerDashboardRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  app.addHook('preHandler', authenticateSupabase);

  /**
   * GET /api/dashboard/overview - Get dashboard overview metrics
   */
  app.get('/api/dashboard/overview', {
    schema: { querystring: analyticsQuerySchema }
  }, async (request: AuthenticatedRequest, reply) => {
    const { dateRange, groupBy } = request.query as z.infer<typeof analyticsQuerySchema>;
    const teamId = request.teamId!;

    try {
      // Get actual lead counts from database
      const totalLeads = await app.prisma.lead.count({
        where: { teamId }
      });

      const recentLeads = await app.prisma.lead.count({
        where: {
          teamId,
          createdAt: {
            gte: new Date(Date.now() - getDaysFromRange(dateRange) * 24 * 60 * 60 * 1000)
          }
        }
      });

      // Get leads by score band
      const leadsByScoreBand = await app.prisma.lead.groupBy({
        by: ['scoreBand'],
        where: { teamId },
        _count: { scoreBand: true }
      });

      // Get leads by source
      const leadsBySource = await app.prisma.lead.groupBy({
        by: ['source'],
        where: { teamId },
        _count: { source: true },
        orderBy: { _count: { source: 'desc' } }
      });

      // Calculate conversion rates and other metrics
      const overview = {
        totalLeads,
        newLeads: recentLeads,
        conversionRate: totalLeads > 0 ? Math.round((recentLeads / totalLeads) * 100 * 100) / 100 : 0,
        averageScore: 67.5, // Mock for now
        scoreBands: {
          HIGH: leadsByScoreBand.find(l => l.scoreBand === 'HIGH')?._count.scoreBand || 0,
          MEDIUM: leadsByScoreBand.find(l => l.scoreBand === 'MEDIUM')?._count.scoreBand || 0,
          LOW: leadsByScoreBand.find(l => l.scoreBand === 'LOW')?._count.scoreBand || 0
        },
        sourceBreakdown: leadsBySource.map(source => ({
          source: source.source,
          count: source._count.source,
          percentage: totalLeads > 0 ? Math.round((source._count.source / totalLeads) * 100 * 100) / 100 : 0
        })),
        trends: {
          leadsGrowth: 12.5, // Mock percentage growth
          scoreImprovement: 8.3,
          conversionGrowth: 15.2
        }
      };

      return reply.send({ ok: true, data: overview });

    } catch (error) {
      app.log.error('Failed to get dashboard overview:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get dashboard overview' });
    }
  });

  /**
   * GET /api/dashboard/pipeline - Get lead pipeline data
   */
  app.get('/api/dashboard/pipeline', async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId!;

    try {
      // Get leads by status
      const leadsByStatus = await app.prisma.lead.groupBy({
        by: ['status'],
        where: { teamId },
        _count: { status: true }
      });

      // Get recent activity
      const recentActivity = await app.prisma.timelineEvent.findMany({
        where: {
          lead: { teamId }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          lead: {
            select: {
              name: true,
              email: true,
              company: true,
              score: true
            }
          }
        }
      });

      const pipeline = {
        stages: [
          {
            name: 'New',
            count: leadsByStatus.find(l => l.status === 'NEW')?._count.status || 0,
            value: 0, // Mock value
            color: '#3B82F6'
          },
          {
            name: 'Assigned',
            count: leadsByStatus.find(l => l.status === 'ASSIGNED')?._count.status || 0,
            value: 0,
            color: '#F59E0B'
          },
          {
            name: 'In Progress',
            count: leadsByStatus.find(l => l.status === 'IN_PROGRESS')?._count.status || 0,
            value: 0,
            color: '#10B981'
          },
          {
            name: 'Closed',
            count: leadsByStatus.find(l => l.status === 'CLOSED')?._count.status || 0,
            value: 0,
            color: '#6B7280'
          }
        ],
        recentActivity: recentActivity.map(event => ({
          id: event.id,
          type: event.type,
          leadName: event.lead.name || 'Unknown',
          leadEmail: event.lead.email,
          leadCompany: event.lead.company,
          leadScore: event.lead.score,
          timestamp: event.createdAt.toISOString(),
          payload: event.payload
        }))
      };

      return reply.send({ ok: true, data: pipeline });

    } catch (error) {
      app.log.error('Failed to get pipeline data:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get pipeline data' });
    }
  });

  /**
   * GET /api/dashboard/performance - Get performance metrics
   */
  app.get('/api/dashboard/performance', {
    schema: { querystring: analyticsQuerySchema }
  }, async (request: AuthenticatedRequest, reply) => {
    const { dateRange } = request.query as z.infer<typeof analyticsQuerySchema>;
    const teamId = request.teamId!;

    try {
      const days = getDaysFromRange(dateRange);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get leads created over time
      const leadsOverTime = await app.prisma.lead.groupBy({
        by: ['createdAt'],
        where: {
          teamId,
          createdAt: { gte: startDate }
        },
        _count: { createdAt: true }
      });

      // Generate time series data
      const timeSeries = generateTimeSeriesData(startDate, days, leadsOverTime);

      // Mock performance data
      const performance = {
        timeSeries,
        metrics: {
          totalLeads: await app.prisma.lead.count({ where: { teamId } }),
          conversionRate: 12.5,
          averageScore: 67.5,
          topSources: [
            { source: 'form', count: 45, percentage: 35.2 },
            { source: 'linkedin', count: 32, percentage: 25.0 },
            { source: 'email', count: 28, percentage: 21.9 },
            { source: 'webhook', count: 23, percentage: 17.9 }
          ],
          scoreDistribution: {
            HIGH: 28,
            MEDIUM: 45,
            LOW: 27
          },
          trends: {
            leadsChange: '+12.5%',
            scoreChange: '+8.3%',
            conversionChange: '+15.2%'
          }
        }
      };

      return reply.send({ ok: true, data: performance });

    } catch (error) {
      app.log.error('Failed to get performance metrics:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get performance metrics' });
    }
  });

  /**
   * GET /api/dashboard/integrations - Get integrations status
   */
  app.get('/api/dashboard/integrations', async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId!;

    try {
      // Get integration statuses
      const integrations = await app.prisma.integration.findMany({
        where: { teamId },
        select: {
          kind: true,
          status: true,
          lastSeenAt: true,
          lastSyncAt: true,
          error: true
        }
      });

      // Mock integration health data
      const integrationsStatus = {
        summary: {
          total: 5,
          connected: 3,
          errors: 1,
          pending: 1
        },
        integrations: [
          {
            name: 'HubSpot',
            type: 'CRM',
            status: 'connected',
            health: 'healthy',
            lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            syncedLeads: 45,
            errors: 0
          },
          {
            name: 'Salesforce',
            type: 'CRM',
            status: 'error',
            health: 'error',
            lastSync: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            syncedLeads: 0,
            errors: 3,
            errorMessage: 'Authentication expired'
          },
          {
            name: 'Slack',
            type: 'Communication',
            status: 'connected',
            health: 'healthy',
            lastSync: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            notifications: 12,
            errors: 0
          },
          {
            name: 'LinkedIn',
            type: 'Social',
            status: 'connected',
            health: 'healthy',
            lastSync: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            leadsIngested: 23,
            errors: 0
          },
          {
            name: 'Mailchimp',
            type: 'Email',
            status: 'pending',
            health: 'pending',
            lastSync: null,
            syncedContacts: 0,
            errors: 0
          }
        ]
      };

      return reply.send({ ok: true, data: integrationsStatus });

    } catch (error) {
      app.log.error('Failed to get integrations status:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get integrations status' });
    }
  });

  /**
   * GET /api/dashboard/recent-leads - Get recent leads
   */
  app.get('/api/dashboard/recent-leads', {
    schema: {
      querystring: z.object({
        limit: z.coerce.number().min(1).max(50).default(10)
      })
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { limit } = request.query as { limit: number };
    const teamId = request.teamId!;

    try {
      const recentLeads = await app.prisma.lead.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          company: true,
          source: true,
          score: true,
          scoreBand: true,
          status: true,
          createdAt: true
        }
      });

      return reply.send({
        ok: true,
        data: {
          leads: recentLeads.map(lead => ({
            ...lead,
            createdAt: lead.createdAt.toISOString()
          }))
        }
      });

    } catch (error) {
      app.log.error('Failed to get recent leads:', error);
      return reply.code(500).send({ ok: false, error: 'Failed to get recent leads' });
    }
  });
}

// Helper functions
function getDaysFromRange(range: string): number {
  switch (range) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case '1y': return 365;
    default: return 30;
  }
}

function generateTimeSeriesData(startDate: Date, days: number, leadData: any[]): any[] {
  const timeSeries = [];
  const dataMap = new Map();

  // Create map of dates to counts
  leadData.forEach(item => {
    const date = new Date(item.createdAt).toISOString().split('T')[0];
    dataMap.set(date, (dataMap.get(date) || 0) + item._count.createdAt);
  });

  // Generate series for each day
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    timeSeries.push({
      date: dateStr,
      leads: dataMap.get(dateStr) || 0,
      timestamp: date.toISOString()
    });
  }

  return timeSeries;
}
