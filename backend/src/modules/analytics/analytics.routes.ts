import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

// Validation schemas
const overviewQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
  timezone: z.string().optional().default('UTC')
});

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  // Note: Authentication is applied per route using preHandler option

  /**
   * GET /analytics/overview - Comprehensive analytics overview
   */
  app.get('/analytics/overview', { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { days, timezone } = request.query as z.infer<typeof overviewQuerySchema>;
    const teamId = (request as any).teamId;

    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Execute all analytics queries in parallel for better performance
      const [
        totalLeads,
        newLeads,
        sourceBreakdown,
        dailyLeads,
        slaData,
        scoreDistribution,
        ownerData
      ] = await Promise.all([
        // Total leads count
        app.prisma.lead.count({
          where: { teamId }
        }),

        // New leads in period
        app.prisma.lead.count({
          where: {
            teamId,
            createdAt: { gte: startDate }
          }
        }),

        // Source breakdown
        app.prisma.lead.groupBy({
          by: ['source'],
          where: {
            teamId,
            createdAt: { gte: startDate }
          },
          _count: { source: true }
        }),

        // Daily leads data
        app.prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
          SELECT 
            DATE(created_at AT TIME ZONE ${timezone}) as date,
            COUNT(*)::bigint as count
          FROM leads 
          WHERE team_id = ${teamId} 
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
          GROUP BY DATE(created_at AT TIME ZONE ${timezone})
          ORDER BY date ASC
        `,

        // SLA metrics
        app.prisma.sLAClock.findMany({
          where: {
            lead: { teamId },
            targetAt: { gte: startDate }
          },
          include: {
            lead: {
              select: { createdAt: true }
            }
          }
        }),

        // Score distribution
        app.prisma.lead.groupBy({
          by: ['scoreBand'],
          where: {
            teamId,
            createdAt: { gte: startDate }
          },
          _count: { scoreBand: true },
          _avg: { score: true }
        }),

        // Owner performance data
        app.prisma.lead.findMany({
          where: {
            teamId,
            createdAt: { gte: startDate },
            ownerId: { not: null }
          },
          include: {
            owner: {
              include: {
                user: {
                  select: { email: true }
                }
              }
            },
            slaClocks: true
          }
        })
      ]);

      // Process source breakdown
      const totalNewLeads = newLeads;
      const processedSourceBreakdown = sourceBreakdown.map(item => ({
        source: item.source,
        count: item._count.source,
        percentage: totalNewLeads > 0 ? (item._count.source / totalNewLeads) * 100 : 0
      })).sort((a, b) => b.count - a.count);

      // Process daily leads data
      const leadsPerDay = [];
      let cumulative = 0;
      
      // Create a complete date range
      const dateMap = new Map();
      dailyLeads.forEach(item => {
        dateMap.set(item.date, Number(item.count));
      });

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const count = dateMap.get(dateStr) || 0;
        cumulative += count;
        
        leadsPerDay.push({
          date: dateStr,
          count,
          cumulative
        });
      }

      // Process SLA metrics
      const slaClocks = slaData;
      const satisfiedSla = slaClocks.filter(clock => 
        clock.satisfiedAt && clock.satisfiedAt <= clock.targetAt
      );
      const escalatedSla = slaClocks.filter(clock => clock.escalatedAt);
      
      const slaHitRate = slaClocks.length > 0 ? 
        (satisfiedSla.length / slaClocks.length) * 100 : 0;

      // Calculate average response time (in minutes)
      const responseTimeSum = satisfiedSla.reduce((sum, clock) => {
        if (clock.satisfiedAt && clock.lead.createdAt) {
          const responseTime = clock.satisfiedAt.getTime() - clock.lead.createdAt.getTime();
          return sum + (responseTime / (1000 * 60)); // Convert to minutes
        }
        return sum;
      }, 0);

      const averageResponseTime = satisfiedSla.length > 0 ? 
        responseTimeSum / satisfiedSla.length : 0;

      // Response time distribution buckets (in minutes)
      const responseTimes = satisfiedSla.map(clock => {
        if (clock.satisfiedAt && clock.lead.createdAt) {
          return (clock.satisfiedAt.getTime() - clock.lead.createdAt.getTime()) / (1000 * 60);
        }
        return 0;
      }).filter(time => time > 0);

      const responseTimeDistribution = [
        { bucket: '0-15 min', count: 0, percentage: 0 },
        { bucket: '15-60 min', count: 0, percentage: 0 },
        { bucket: '1-4 hours', count: 0, percentage: 0 },
        { bucket: '4-24 hours', count: 0, percentage: 0 },
        { bucket: '1+ days', count: 0, percentage: 0 }
      ];

      responseTimes.forEach(time => {
        if (time <= 15) responseTimeDistribution[0].count++;
        else if (time <= 60) responseTimeDistribution[1].count++;
        else if (time <= 240) responseTimeDistribution[2].count++; // 4 hours
        else if (time <= 1440) responseTimeDistribution[3].count++; // 24 hours
        else responseTimeDistribution[4].count++;
      });

      const totalResponseTimes = responseTimes.length;
      responseTimeDistribution.forEach(bucket => {
        bucket.percentage = totalResponseTimes > 0 ? 
          (bucket.count / totalResponseTimes) * 100 : 0;
      });

      // Process score distribution
      const processedScoreDistribution = scoreDistribution.map(item => ({
        band: item.scoreBand,
        count: item._count.scoreBand,
        percentage: totalNewLeads > 0 ? (item._count.scoreBand / totalNewLeads) * 100 : 0
      }));

      // Calculate average score
      const allScores = await app.prisma.lead.findMany({
        where: {
          teamId,
          createdAt: { gte: startDate }
        },
        select: { score: true }
      });

      const averageScore = allScores.length > 0 ? 
        allScores.reduce((sum, lead) => sum + lead.score, 0) / allScores.length : 0;

      // Process top sources with detailed metrics
      const topSources = await Promise.all(
        processedSourceBreakdown.slice(0, 5).map(async (source) => {
          const sourceLeads = await app.prisma.lead.findMany({
            where: {
              teamId,
              source: source.source,
              createdAt: { gte: startDate }
            },
            select: { score: true, status: true }
          });

          const avgScore = sourceLeads.length > 0 ? 
            sourceLeads.reduce((sum, lead) => sum + lead.score, 0) / sourceLeads.length : 0;
          
          const convertedLeads = sourceLeads.filter(lead => 
            lead.status === 'CLOSED' || lead.status === 'IN_PROGRESS'
          ).length;
          
          const conversionRate = sourceLeads.length > 0 ? 
            (convertedLeads / sourceLeads.length) * 100 : 0;

          return {
            source: source.source,
            count: source.count,
            averageScore: Math.round(avgScore * 100) / 100,
            conversionRate: Math.round(conversionRate * 100) / 100
          };
        })
      );

      // Process owner performance
      const ownerStats = new Map();
      
      ownerData.forEach(lead => {
        if (!lead.owner) return;
        
        const ownerId = lead.ownerId!;
        const ownerName = lead.owner.user.email.split('@')[0];
        const ownerEmail = lead.owner.user.email;
        
        if (!ownerStats.has(ownerId)) {
          ownerStats.set(ownerId, {
            ownerId,
            ownerName,
            ownerEmail,
            assignedLeads: 0,
            responseTimes: [],
            slaHits: 0,
            totalSlas: 0
          });
        }
        
        const stats = ownerStats.get(ownerId);
        stats.assignedLeads++;
        
        // Process SLA data for this owner
        lead.slaClocks.forEach(clock => {
          stats.totalSlas++;
          if (clock.satisfiedAt && clock.satisfiedAt <= clock.targetAt) {
            stats.slaHits++;
            const responseTime = (clock.satisfiedAt.getTime() - lead.createdAt.getTime()) / (1000 * 60);
            stats.responseTimes.push(responseTime);
          }
        });
      });

      const ownerPerformance = Array.from(ownerStats.values()).map(stats => ({
        ownerId: stats.ownerId,
        ownerName: stats.ownerName,
        ownerEmail: stats.ownerEmail,
        assignedLeads: stats.assignedLeads,
        averageResponseTime: stats.responseTimes.length > 0 ? 
          Math.round((stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length) * 100) / 100 : 0,
        slaHitRate: stats.totalSlas > 0 ? 
          Math.round((stats.slaHits / stats.totalSlas) * 100 * 100) / 100 : 0
      })).sort((a, b) => b.assignedLeads - a.assignedLeads);

      // Calculate conversion rate (leads that moved to IN_PROGRESS or CLOSED)
      const convertedLeads = await app.prisma.lead.count({
        where: {
          teamId,
          createdAt: { gte: startDate },
          status: { in: ['IN_PROGRESS', 'CLOSED'] }
        }
      });

      const conversionRate = totalNewLeads > 0 ? (convertedLeads / totalNewLeads) * 100 : 0;

      // Check for meeting/booking conversions
      const meetingConversions = await app.prisma.lead.count({
        where: {
          teamId,
          createdAt: { gte: startDate },
          OR: [
            { source: { contains: 'meeting', mode: 'insensitive' } },
            { source: { contains: 'booked', mode: 'insensitive' } },
            { source: { contains: 'calendar', mode: 'insensitive' } },
            { 
              timelineEvents: {
                some: {
                  type: 'CALL_LOGGED'
                }
              }
            }
          ]
        }
      });

      const meetingConversionRate = totalNewLeads > 0 ? (meetingConversions / totalNewLeads) * 100 : 0;

      return reply.send({
        success: true,
        data: {
          summary: {
            totalLeads,
            newLeads: totalNewLeads,
            averageScore: Math.round(averageScore * 100) / 100,
            conversionRate: Math.round(conversionRate * 100) / 100,
            meetingConversions,
            meetingConversionRate: Math.round(meetingConversionRate * 100) / 100
          },
          sourceBreakdown: processedSourceBreakdown,
          leadsPerDay,
          slaMetrics: {
            hitRate: Math.round(slaHitRate * 100) / 100,
            averageResponseTime: Math.round(averageResponseTime * 100) / 100,
            totalSlaClocks: slaClocks.length,
            satisfiedCount: satisfiedSla.length,
            escalatedCount: escalatedSla.length
          },
          responseTimeDistribution,
          scoreDistribution: processedScoreDistribution,
          topSources,
          ownerPerformance
        }
      });

    } catch (error) {
      app.log.error('Analytics overview failed:', error as any);
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate analytics overview'
      });
    }
  });
}
