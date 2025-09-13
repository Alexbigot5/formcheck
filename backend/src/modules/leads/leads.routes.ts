import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';
import { deduplicateLead, analyzeDuplicates, previewMerge } from '../dedupe/index';
import { applyScoring, getScoringConfig, getScoringRules, initializeDefaultScoringConfig } from '../scoring/index';
import { routeLead, getRoutingRules, initializeDefaultRoutingRules } from '../routing/index';

// Validation schemas
const createLeadSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  domain: z.string().max(100).optional(),
  source: z.string().min(1).max(50),
  sourceRef: z.string().max(100).optional(),
  fields: z.record(z.any()).default({}),
  utm: z.record(z.any()).default({}),
  score: z.number().int().min(0).max(100).default(0),
  scoreBand: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW')
});

const updateLeadSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  domain: z.string().max(100).optional(),
  score: z.number().int().min(0).max(100).optional(),
  scoreBand: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z.enum(['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED']).optional(),
  ownerId: z.string().cuid().optional()
});

const analyzeDedupeSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  company: z.string().optional(),
  domain: z.string().optional()
});

export async function registerLeadRoutes(app: FastifyInstance) {
  // Apply authentication to all routes except webhook endpoints
  app.addHook('preHandler', authenticate);

  /**
   * POST /api/leads - Create a new lead with deduplication
   */
  app.post('/api/leads', async (request: AuthenticatedRequest, reply) => {
    // Validate request body
    const parsed = createLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid request body', details: parsed.error });
    }
    const leadData = parsed.data;
    const teamId = (request as any).teamId;

    try {
      // Step 1: Apply scoring to lead data
      let config = await getScoringConfig(app, teamId);
      let rules = await getScoringRules(app, teamId);

      // Initialize default scoring config if none exists
      if (!config) {
        const userId = (request as any).user?.id || 'system';
        const initialized = await initializeDefaultScoringConfig(app, teamId, userId);
        config = initialized.config;
        rules = initialized.rules;
      }

      // Apply scoring (ensure source is provided)
      const leadWithSource = { ...leadData, source: leadData.source || 'manual' };
      const scoringResult = await applyScoring(app, leadWithSource as any, config, rules);
      
      // Update lead data with scoring results
      const enrichedLeadData = {
        ...leadData,
        score: scoringResult.score,
        scoreBand: scoringResult.band
      };

      // Step 2: Run deduplication with scored lead
      const result = await deduplicateLead(app, enrichedLeadData, teamId);

      // Step 3: Apply routing if lead was created
      let routingResult = null;
      if (result.action === 'created') {
        // Get routing rules
        let routingRules = await getRoutingRules(app, teamId);
        
        // Initialize default routing rules if none exist
        if (routingRules.length === 0) {
          routingRules = await initializeDefaultRoutingRules(app, teamId);
        }

        // Apply routing
        const enrichedLeadWithSource = { ...enrichedLeadData, source: enrichedLeadData.source || 'manual' };
        routingResult = await routeLead(app, enrichedLeadWithSource as any, routingRules, teamId);

        // Update lead with routing assignment
        if (routingResult.ownerId) {
          await app.prisma.lead.update({
            where: { id: result.leadId },
            data: { ownerId: routingResult.ownerId }
          });
        }

        // Create SLA clock if SLA is set
        if (routingResult.sla) {
          await app.prisma.sLAClock.create({
            data: {
              leadId: result.leadId,
              targetAt: new Date(Date.now() + routingResult.sla * 60 * 1000) // Convert minutes to milliseconds
            }
          });
        }

        // Log routing timeline event
        await app.prisma.timelineEvent.create({
          data: {
            leadId: result.leadId,
            type: 'SCORE_UPDATED', // Using existing enum value for routing
            payload: {
              action: 'lead_routed',
              ownerId: routingResult.ownerId,
              pool: routingResult.pool,
              reason: routingResult.reason,
              trace: routingResult.trace,
              alerts: routingResult.alerts,
              sla: routingResult.sla,
              priority: routingResult.priority
            }
          }
        });

        // Log scoring trace
        await app.prisma.timelineEvent.create({
          data: {
            leadId: result.leadId,
            type: 'SCORE_UPDATED',
            payload: {
              action: 'initial_scoring',
              score: scoringResult.score,
              band: scoringResult.band,
              tags: scoringResult.tags,
              trace: JSON.parse(JSON.stringify(scoringResult.trace)),
              routing: scoringResult.routing,
              sla: scoringResult.sla
            } as any
          }
        });
      }

      let message = '';
      switch (result.action) {
        case 'created':
          const routingInfo = routingResult 
            ? routingResult.ownerId 
              ? ` and routed to owner ${routingResult.ownerId}${routingResult.pool ? ` (${routingResult.pool})` : ''}`
              : routingResult.pool 
                ? ` and routed to pool ${routingResult.pool}`
                : ' (no routing assignment)'
            : '';
          message = `New lead created successfully with score ${scoringResult.score} (${scoringResult.band})${routingInfo}`;
          break;
        case 'merged':
          message = `Lead merged with existing lead. Consolidated ${result.mergeResult?.consolidatedMessages || 0} messages and ${result.mergeResult?.consolidatedEvents || 0} events.`;
          break;
        case 'skipped':
          message = 'Duplicate lead detected but merge was skipped';
          break;
      }

      const statusCode = result.action === 'created' ? 201 : 200;

      return reply.code(statusCode).send({
        action: result.action,
        leadId: result.leadId,
        duplicateId: result.duplicateId,
        score: scoringResult.score,
        band: scoringResult.band,
        tags: scoringResult.tags,
        ownerId: routingResult?.ownerId || null,
        pool: routingResult?.pool || null,
        sla: routingResult?.sla || null,
        message
      });

    } catch (error) {
      app.log.error('Lead creation failed:', error as any);
      return reply.code(500).send({ error: 'Failed to create lead' });
    }
  });

  /**
   * GET /api/leads - List leads with filtering and pagination
   */
  app.get('/api/leads', async (request: AuthenticatedRequest, reply) => {
    const { 
      page, 
      pageSize, 
      limit, 
      status, 
      source, 
      scoreBand, 
      ownerId, 
      search, 
      sla,
      sort,
      order,
      filter
    } = request.query as any;
    
    // Use pageSize if provided, otherwise fall back to limit for backward compatibility
    const actualLimit = pageSize || limit;
    const teamId = (request as any).teamId;

    try {
      const where: any = { teamId };

      // Apply filters
      if (status) where.status = status;
      if (source) where.source = source;
      if (scoreBand) where.scoreBand = scoreBand;
      if (ownerId) where.ownerId = ownerId;
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
          { domain: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Apply complex filters if provided
      if (filter) {
        try {
          const complexFilters = JSON.parse(filter);
          Object.assign(where, complexFilters);
        } catch (error) {
          // Ignore invalid filter JSON
        }
      }

      // SLA filtering
      if (sla) {
        const now = new Date();
        if (sla === 'overdue') {
          where.slaClocks = {
            some: {
              targetAt: { lt: now },
              satisfiedAt: null
            }
          };
        } else if (sla === 'due_soon') {
          const soonThreshold = new Date(now.getTime() + (30 * 60 * 1000)); // 30 minutes
          where.slaClocks = {
            some: {
              targetAt: { lte: soonThreshold, gte: now },
              satisfiedAt: null
            }
          };
        }
      }

      const [leads, total] = await Promise.all([
        app.prisma.lead.findMany({
          where,
          include: {
            owner: {
              include: { user: { select: { email: true, name: true } } }
            },
            slaClocks: {
              where: { satisfiedAt: null },
              orderBy: { targetAt: 'asc' },
              take: 1
            }
          },
          orderBy: { [sort]: order },
          skip: (page - 1) * actualLimit,
          take: actualLimit
        }),
        app.prisma.lead.count({ where })
      ]);

      // Add SLA status to each lead
      const leadsWithSLA = leads.map(lead => {
        const activeSLA = lead.slaClocks[0];
        let slaStatus = null;
        let slaCountdown = null;

        if (activeSLA) {
          const now = new Date();
          const targetTime = new Date(activeSLA.targetAt);
          const timeDiff = targetTime.getTime() - now.getTime();
          
          slaStatus = timeDiff < 0 ? 'overdue' : 
                     timeDiff < (30 * 60 * 1000) ? 'due_soon' : 'on_track';
          
          slaCountdown = {
            targetAt: activeSLA.targetAt,
            minutesRemaining: Math.ceil(timeDiff / (60 * 1000)),
            isOverdue: timeDiff < 0,
            status: slaStatus
          };
        }

        return {
          ...lead,
          slaStatus,
          slaCountdown,
          ownerName: lead.owner?.user ? 
            lead.owner.user.name || lead.owner.user.email :
            null
        };
      });

      return reply.send({
        leads: leadsWithSLA,
        pagination: {
          page,
          pageSize: actualLimit,
          limit: actualLimit, // Keep for backward compatibility
          total,
          totalPages: Math.ceil(total / actualLimit),
          hasNextPage: page < Math.ceil(total / actualLimit),
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      app.log.error('Failed to list leads:', error as any);
      return reply.code(500).send({ error: 'Failed to list leads' });
    }
  });

  /**
   * GET /api/leads/:id - Get lead details
   */
  app.get('/api/leads/:id', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const teamId = (request as any).teamId;

    try {
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId },
        include: {
          owner: {
            include: { user: { select: { email: true } } }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50
          },
          timelineEvents: {
            orderBy: { createdAt: 'desc' },
            take: 50
          },
          dedupeKeys: true,
          slaClocks: true
        }
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      return reply.send(lead);

    } catch (error) {
      app.log.error('Failed to get lead:', error as any);
      return reply.code(500).send({ error: 'Failed to get lead' });
    }
  });

  /**
   * GET /leads/:id/timeline - Get merged timeline of Messages + TimelineEvents
   */
  app.get('/leads/:id/timeline', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { limit, offset } = request.query as { limit: number; offset: number };
    const teamId = (request as any).teamId;

    try {
      // Verify lead belongs to team
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId },
        select: { id: true }
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      // Check total timeline size first
      const [totalMessages, totalEvents] = await Promise.all([
        app.prisma.message.count({ where: { leadId: id } }),
        app.prisma.timelineEvent.count({ where: { leadId: id } })
      ]);

      const totalItems = totalMessages + totalEvents;

      // For large timelines (>200 items), use more efficient pagination
      let messages: any[] = [];
      let timelineEvents: any[] = [];

      if (totalItems > 200) {
        // Use cursor-based pagination for better performance with large datasets
        const batchSize = Math.min(limit * 2, 100);
        
        // Get a larger batch to ensure we have enough items after sorting
        [messages, timelineEvents] = await Promise.all([
          app.prisma.message.findMany({
            where: { leadId: id },
            orderBy: { createdAt: 'desc' },
            take: batchSize
          }),
          app.prisma.timelineEvent.findMany({
            where: { leadId: id },
            orderBy: { createdAt: 'desc' },
            take: batchSize
          })
        ]);
      } else {
        // For smaller timelines, get all items
        [messages, timelineEvents] = await Promise.all([
          app.prisma.message.findMany({
            where: { leadId: id },
            orderBy: { createdAt: 'desc' }
          }),
          app.prisma.timelineEvent.findMany({
            where: { leadId: id },
            orderBy: { createdAt: 'desc' }
          })
        ]);
      }

      // Merge and sort timeline items
      const timelineItems = [];

      // Add messages
      messages.forEach(message => {
        timelineItems.push({
          id: message.id,
          type: 'message' as const,
          timestamp: message.createdAt.toISOString(),
          sortKey: message.createdAt.getTime(),
          data: {
            direction: message.direction,
            channel: message.channel,
            subject: message.subject,
            body: message.body,
            meta: message.meta,
            createdAt: message.createdAt.toISOString()
          }
        });
      });

      // Add timeline events
      timelineEvents.forEach(event => {
        timelineItems.push({
          id: event.id,
          type: 'event' as const,
          timestamp: event.createdAt.toISOString(),
          sortKey: event.createdAt.getTime(),
          data: {
            type: event.type,
            payload: event.payload,
            createdAt: event.createdAt.toISOString()
          }
        });
      });

      // Sort by timestamp descending
      timelineItems.sort((a, b) => b.sortKey - a.sortKey);

      // Apply pagination
      const paginatedItems = timelineItems.slice(offset, offset + limit);
      const total = totalItems;

      // Remove sortKey from response
      const responseItems = paginatedItems.map(({ sortKey, ...item }) => item);

      return reply.send({
        timeline: responseItems,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total
        }
      });

    } catch (error) {
      app.log.error('Failed to get timeline:', error as any);
      return reply.code(500).send({ error: 'Failed to get timeline' });
    }
  });

  /**
   * PUT /api/leads/:id - Update lead
   */
  app.put('/api/leads/:id', {
    const { id } = request.params as { id: string };
    const updateData = request.body as z.infer<typeof updateLeadSchema>;
    const teamId = (request as any).teamId;

    try {
      // Ensure lead belongs to team
      const existingLead = await app.prisma.lead.findFirst({
        where: { id, teamId }
      });

      if (!existingLead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      const updatedLead = await app.prisma.lead.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      // Log update in timeline
      await app.prisma.timelineEvent.create({
        data: {
          leadId: id,
          type: 'SCORE_UPDATED',
          payload: {
            action: 'lead_updated',
            changes: updateData,
            updatedBy: (request as any).user?.id || (request as any).apiKey?.id
          }
        }
      });

      return reply.send(updatedLead);

    } catch (error) {
      app.log.error('Failed to update lead:', error as any);
      return reply.code(500).send({ error: 'Failed to update lead' });
    }
  });

  /**
   * POST /api/leads/analyze-dedupe - Analyze potential duplicates without creating
   */
  app.post('/api/leads/analyze-dedupe', {
    const leadData = request.body as z.infer<typeof analyzeDedupeSchema>;
    const teamId = (request as any).teamId;

    try {
      const analysis = await analyzeDuplicates(app, leadData, teamId);
      return reply.send(analysis);

    } catch (error) {
      app.log.error('Duplicate analysis failed:', error as any);
      return reply.code(500).send({ error: 'Failed to analyze duplicates' });
    }
  });

  /**
   * POST /api/leads/:primaryId/merge/:duplicateId/preview - Preview merge operation
   */
  app.post('/api/leads/:primaryId/merge/:duplicateId/preview', {
    const { primaryId, duplicateId } = request.params as { primaryId: string; duplicateId: string };

    try {
      const preview = await previewMerge(app, primaryId, duplicateId);
      return reply.send(preview);

    } catch (error) {
      app.log.error('Merge preview failed:', error as any);
      return reply.code(500).send({ error: 'Failed to preview merge' });
    }
  });

  /**
   * POST /api/leads/:id/timeline - Add timeline event
   */
  app.post('/api/leads/:id/timeline', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const { type, payload } = request.body as any;
    const teamId = (request as any).teamId;

    try {
      // Ensure lead belongs to team
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId }
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      const event = await app.prisma.timelineEvent.create({
        data: {
          leadId: id,
          type,
          payload: {
            ...payload,
            createdBy: (request as any).user?.id || (request as any).apiKey?.id
          }
        }
      });

      return reply.send(event);

    } catch (error) {
      app.log.error('Failed to create timeline event:', error as any);
      return reply.code(500).send({ error: 'Failed to create timeline event' });
    }
  });

  /**
   * PUT /leads/:id/score - Update lead score
   */
  app.put('/leads/:id/score', async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const { score, scoreBand, reason } = request.body as { score: number; scoreBand: string; reason?: string };
    const teamId = (request as any).teamId;
    const userId = (request as any).user?.id || 'system';

    try {
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId }
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      // Update the lead score
      const updatedLead = await app.prisma.lead.update({
        where: { id },
        data: {
          score,
          scoreBand: scoreBand as any
        },
        include: {
          owner: {
            include: { user: { select: { email: true, name: true } } }
          }
        }
      });

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: id,
          type: 'SCORE_UPDATED',
          payload: {
            oldScore: lead.score,
            newScore: score,
            oldScoreBand: lead.scoreBand,
            newScoreBand: scoreBand,
            reason: reason || 'Manual score update',
            updatedBy: userId
          }
        }
      });

      return reply.send({
        lead: updatedLead,
        message: `Lead score updated to ${score} (${scoreBand})`
      });

    } catch (error) {
      app.log.error('Failed to update lead score:', error as any);
      return reply.code(500).send({ error: 'Failed to update lead score' });
    }
  });

  /**
   * PUT /leads/:id/assign - Assign lead to owner
   */
  app.put('/leads/:id/assign', {
    const { id } = request.params as { id: string };
    const { ownerId, reason, sla } = request.body as { ownerId: string; reason?: string; sla?: number };
    const teamId = (request as any).teamId;
    const userId = (request as any).user?.id || 'system';

    try {
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId }
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      // Verify owner exists and belongs to team
      const owner = await app.prisma.owner.findFirst({
        where: { id: ownerId, teamId },
        include: { user: { select: { email: true, name: true } } }
      });

      if (!owner) {
        return reply.code(404).send({ error: 'Owner not found' });
      }

      // Update the lead
      const updatedLead = await app.prisma.lead.update({
        where: { id },
        data: {
          ownerId,
          status: 'ASSIGNED'
        },
        include: {
          owner: {
            include: { user: { select: { email: true, name: true } } }
          }
        }
      });

      // Create SLA clock if specified
      if (sla) {
        const targetAt = new Date(Date.now() + (sla * 60 * 1000));
        await app.prisma.sLAClock.create({
          data: {
            leadId: id,
            targetAt
          }
        });
      }

      // Add timeline event
      await app.prisma.timelineEvent.create({
        data: {
          leadId: id,
          type: 'STATUS_CHANGED',
          payload: {
            oldOwnerId: lead.ownerId,
            newOwnerId: ownerId,
            ownerEmail: owner.user.email,
            ownerName: owner.user.name || owner.user.email,
            reason: reason || 'Manual assignment',
            sla: sla || null,
            assignedBy: userId
          }
        }
      });

      return reply.send({
        lead: updatedLead,
        message: `Lead assigned to ${owner.user.name || owner.user.email}`
      });

    } catch (error) {
      app.log.error('Failed to assign lead:', error as any);
      return reply.code(500).send({ error: 'Failed to assign lead' });
    }
  });

  /**
   * POST /messages - Create message and handle first touch SLA
   */
  app.post('/messages', async (request: AuthenticatedRequest, reply) => {
    const { leadId, direction, channel, subject, body, meta } = request.body as any;
    const teamId = (request as any).teamId;
    const userId = (request as any).user?.id || 'system';

    try {
      // Verify lead belongs to team
      const lead = await app.prisma.lead.findFirst({
        where: { id: leadId, teamId }
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      // Create the message
      const message = await app.prisma.message.create({
        data: {
          leadId,
          direction,
          channel,
          subject,
          body,
          meta
        }
      });

      let slaUpdate = null;

      // If this is an outbound message (first touch), satisfy any active SLA clocks
      if (direction === 'OUT') {
        const activeSLAs = await app.prisma.sLAClock.findMany({
          where: {
            leadId,
            satisfiedAt: null
          },
          orderBy: { targetAt: 'asc' }
        });

        if (activeSLAs.length > 0) {
          const now = new Date();
          const firstSLA = activeSLAs[0];

          // Mark the first SLA as satisfied
          await app.prisma.sLAClock.update({
            where: { id: firstSLA.id },
            data: { satisfiedAt: now }
          });

          // Add timeline event for SLA satisfaction
          await app.prisma.timelineEvent.create({
            data: {
              leadId,
              type: 'STATUS_CHANGED',
              payload: {
                slaId: firstSLA.id,
                targetAt: firstSLA.targetAt.toISOString(),
                satisfiedAt: now.toISOString(),
                satisfiedBy: userId,
                messageId: message.id,
                responseTime: Math.round((now.getTime() - firstSLA.targetAt.getTime()) / (60 * 1000)) // minutes
              }
            }
          });

          slaUpdate = {
            satisfied: true,
            clockId: firstSLA.id
          };
        }

        // Update lead status to IN_PROGRESS if it's NEW or ASSIGNED
        if (lead.status === 'NEW' || lead.status === 'ASSIGNED') {
          await app.prisma.lead.update({
            where: { id: leadId },
            data: { status: 'IN_PROGRESS' }
          });
        }
      }

      return reply.send({
        message,
        slaUpdate
      });

    } catch (error) {
      app.log.error('Failed to create message:', error as any);
      return reply.code(500).send({ error: 'Failed to create message' });
    }
  });

  /**
   * DELETE /leads/:id - Delete lead (GDPR)
   */
  app.delete('/leads/:id', {
    const { id } = request.params as { id: string };
    const { confirm } = request.query as { confirm?: string };
    const teamId = (request as any).teamId;

    try {
      const lead = await app.prisma.lead.findFirst({
        where: { id, teamId }
      });

      if (!lead) {
        return reply.code(404).send({ error: 'Lead not found' });
      }

      if (confirm !== 'true') {
        return reply.code(400).send({ 
          error: 'Confirmation required',
          message: 'Add ?confirm=true to confirm deletion. This action cannot be undone.'
        });
      }

      // Count related items before deletion
      const [messageCount, eventCount, slaCount, dedupeCount] = await Promise.all([
        app.prisma.message.count({ where: { leadId: id } }),
        app.prisma.timelineEvent.count({ where: { leadId: id } }),
        app.prisma.sLAClock.count({ where: { leadId: id } }),
        app.prisma.leadDedupeKey.count({ where: { leadId: id } })
      ]);

      // Delete all related data (Prisma cascade should handle this, but being explicit)
      await Promise.all([
        app.prisma.message.deleteMany({ where: { leadId: id } }),
        app.prisma.timelineEvent.deleteMany({ where: { leadId: id } }),
        app.prisma.sLAClock.deleteMany({ where: { leadId: id } }),
        app.prisma.leadDedupeKey.deleteMany({ where: { leadId: id } })
      ]);

      // Delete the lead
      await app.prisma.lead.delete({ where: { id } });

      return reply.send({
        message: 'Lead and all associated data permanently deleted',
        deletedItems: {
          lead: true,
          messages: messageCount,
          timelineEvents: eventCount,
          slaClocks: slaCount,
          dedupeKeys: dedupeCount
        }
      });

    } catch (error) {
      app.log.error('Failed to delete lead:', error as any);
      return reply.code(500).send({ error: 'Failed to delete lead' });
    }
  });
}
