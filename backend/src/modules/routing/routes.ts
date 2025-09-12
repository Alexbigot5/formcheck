import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';
import { routeLead, type Lead, type RoutingResult } from './engine';
import { 
  getRoutingRules, 
  upsertRoutingRule, 
  updateRoutingRule,
  deleteRoutingRule,
  reorderRoutingRules,
  validateRoutingRule,
  initializeDefaultRoutingRules,
  getOwnerPools,
  getRoutingStats
} from './config';

// Validation schemas
const testRoutingSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  company: z.string().optional(),
  domain: z.string().optional(),
  source: z.string().default('test'),
  score: z.number().min(0).max(100).default(50),
  scoreBand: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  fields: z.record(z.any()).default({}),
  utm: z.record(z.any()).default({})
});

const routingRuleSchema = z.object({
  name: z.string().min(1).max(200),
  definition: z.object({
    if: z.array(z.object({
      field: z.string(),
      op: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'contains', 'not_contains', 'starts_with', 'ends_with', 'regex', 'in', 'not_in', 'exists', 'not_exists']),
      value: z.any()
    })).min(1),
    then: z.object({
      assign: z.string().min(1),
      priority: z.number().int().min(1).optional(),
      alert: z.enum(['SLACK', 'EMAIL', 'WEBHOOK']).optional(),
      webhook: z.string().url().optional(),
      sla: z.number().int().min(1).optional()
    })
  }),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0)
});

export async function registerRoutingRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  app.addHook('preHandler', authenticate);

  /**
   * POST /routing/test - Test routing rules against sample lead
   */
  app.post('/routing/test', {
    schema: {
      body: testRoutingSchema,
      response: {
        200: z.object({
          ownerId: z.string().nullable(),
          pool: z.string().nullable(),
          reason: z.string(),
          trace: z.array(z.any()),
          alerts: z.array(z.any()),
          sla: z.number().optional(),
          priority: z.number().optional()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const leadData = request.body as z.infer<typeof testRoutingSchema>;
    const teamId = (request as any).teamId;

    try {
      // Get routing rules
      let rules = await getRoutingRules(app, teamId);

      // Initialize default rules if none exist
      if (rules.length === 0) {
        rules = await initializeDefaultRoutingRules(app, teamId);
      }

      // Apply routing
      const result = await routeLead(app, leadData as Lead, rules, teamId);

      return reply.send(result);

    } catch (error) {
      app.log.error('Routing test failed:', error as any);
      return reply.code(500).send({ error: 'Failed to test routing' });
    }
  });

  /**
   * GET /routing/rules - Get routing rules
   */
  app.get('/routing/rules', {
    schema: {
      response: {
        200: z.object({
          rules: z.array(z.any())
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = (request as any).teamId;

    try {
      const rules = await getRoutingRules(app, teamId);
      return reply.send({ rules });

    } catch (error) {
      app.log.error('Failed to get routing rules:', error as any);
      return reply.code(500).send({ error: 'Failed to get routing rules' });
    }
  });

  /**
   * POST /routing/rules - Create routing rule
   */
  app.post('/routing/rules', {
    schema: {
      body: routingRuleSchema,
      response: {
        201: z.object({
          rule: z.any(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const ruleData = request.body as z.infer<typeof routingRuleSchema>;
    const teamId = (request as any).teamId;

    try {
      // Validate rule
      const validation = validateRoutingRule(ruleData);
      if (!validation.valid) {
        return reply.code(400).send({ 
          error: 'Invalid routing rule', 
          details: validation.errors 
        });
      }

      const rule = await upsertRoutingRule(app, teamId, ruleData as any);

      return reply.code(201).send({
        rule,
        message: 'Routing rule created successfully'
      });

    } catch (error) {
      app.log.error('Failed to create routing rule:', error as any);
      return reply.code(500).send({ error: 'Failed to create routing rule' });
    }
  });

  /**
   * PUT /routing/rules/:id - Update routing rule
   */
  app.put('/routing/rules/:id', {
    schema: {
      params: z.object({
        id: z.string().cuid()
      }),
      body: routingRuleSchema.partial(),
      response: {
        200: z.object({
          rule: z.any(),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Partial<z.infer<typeof routingRuleSchema>>;
    const teamId = (request as any).teamId;

    try {
      // Validate updates
      if (Object.keys(updates).length > 0) {
        const validation = validateRoutingRule(updates);
        if (!validation.valid) {
          return reply.code(400).send({ 
            error: 'Invalid routing rule updates', 
            details: validation.errors 
          });
        }
      }

      const rule = await updateRoutingRule(app, id, teamId, updates as any);

      return reply.send({
        rule,
        message: 'Routing rule updated successfully'
      });

    } catch (error) {
      app.log.error('Failed to update routing rule:', error as any);
      return reply.code(500).send({ error: 'Failed to update routing rule' });
    }
  });

  /**
   * DELETE /routing/rules/:id - Delete routing rule
   */
  app.delete('/routing/rules/:id', {
    schema: {
      params: z.object({
        id: z.string().cuid()
      }),
      response: {
        200: z.object({
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const teamId = (request as any).teamId;

    try {
      await deleteRoutingRule(app, id, teamId);

      return reply.send({
        message: 'Routing rule deleted successfully'
      });

    } catch (error) {
      app.log.error('Failed to delete routing rule:', error as any);
      return reply.code(500).send({ error: 'Failed to delete routing rule' });
    }
  });

  /**
   * POST /routing/rules/reorder - Reorder routing rules
   */
  app.post('/routing/rules/reorder', {
    schema: {
      body: z.object({
        ruleIds: z.array(z.string().cuid())
      }),
      response: {
        200: z.object({
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { ruleIds } = request.body as { ruleIds: string[] };
    const teamId = (request as any).teamId;

    try {
      await reorderRoutingRules(app, teamId, ruleIds);

      return reply.send({
        message: 'Routing rules reordered successfully'
      });

    } catch (error) {
      app.log.error('Failed to reorder routing rules:', error as any);
      return reply.code(500).send({ error: 'Failed to reorder routing rules' });
    }
  });

  /**
   * POST /routing/initialize - Initialize default routing rules
   */
  app.post('/routing/initialize', {
    schema: {
      response: {
        200: z.object({
          rules: z.array(z.any()),
          message: z.string()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = (request as any).teamId;

    try {
      const rules = await initializeDefaultRoutingRules(app, teamId);

      return reply.send({
        rules,
        message: 'Default routing rules initialized successfully'
      });

    } catch (error) {
      app.log.error('Failed to initialize routing rules:', error as any);
      return reply.code(500).send({ error: 'Failed to initialize routing rules' });
    }
  });

  /**
   * GET /owners - Get owners with pools and capacities
   */
  app.get('/owners', {
    schema: {
      response: {
        200: z.object({
          owners: z.array(z.object({
            id: z.string(),
            userId: z.string(),
            email: z.string(),
            name: z.string().optional(),
            capacity: z.number(),
            currentLoad: z.number(),
            isActive: z.boolean(),
            pool: z.string()
          })),
          pools: z.array(z.object({
            name: z.string(),
            owners: z.number(),
            strategy: z.string(),
            roundRobinState: z.object({
              lastAssignedIndex: z.number(),
              nextOwner: z.string().optional()
            }).optional()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = (request as any).teamId;

    try {
      // Get owners with their details
      const owners = await app.prisma.owner.findMany({
        where: { teamId },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            }
          },
          _count: {
            select: {
              leads: {
                where: {
                  status: { in: ['NEW', 'IN_PROGRESS'] }
                }
              }
            }
          }
        }
      });

      // Get pools info
      const pools = await getOwnerPools(app, teamId);
      
      // Calculate pool assignments and round robin state
      const poolsWithState = pools.map(pool => {
        const poolOwners = owners.filter(owner => {
          // Simple pool assignment logic based on capacity
          if (pool.name === 'AE_POOL_A') return owner.capacity >= 50;
          if (pool.name === 'AE_POOL_B') return owner.capacity >= 20 && owner.capacity < 50;
          if (pool.name === 'SDR_POOL') return owner.capacity < 20;
          if (pool.name === 'SENIOR_AE_POOL') return owner.capacity >= 100;
          return false;
        });

        return {
          ...pool,
          roundRobinState: pool.strategy === 'round_robin' ? {
            lastAssignedIndex: 0, // This would be stored in a separate table in production
            nextOwner: poolOwners[0]?.id
          } : undefined
        };
      });

      const formattedOwners = owners.map(owner => ({
        id: owner.id,
        userId: owner.userId,
        email: owner.user.email,
        name: owner.user.name || undefined,
        capacity: owner.capacity,
        currentLoad: owner._count.leads,
        isActive: owner._count.leads < owner.capacity,
        pool: owner.capacity >= 100 ? 'SENIOR_AE_POOL' :
              owner.capacity >= 50 ? 'AE_POOL_A' :
              owner.capacity >= 20 ? 'AE_POOL_B' : 'SDR_POOL'
      }));

      return reply.send({ 
        owners: formattedOwners,
        pools: poolsWithState
      });

    } catch (error) {
      app.log.error('Failed to get owners:', error as any);
      return reply.code(500).send({ error: 'Failed to get owners' });
    }
  });

  /**
   * GET /routing/pools - Get owner pools
   */
  app.get('/routing/pools', {
    schema: {
      response: {
        200: z.object({
          pools: z.array(z.object({
            name: z.string(),
            owners: z.number(),
            strategy: z.string()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = (request as any).teamId;

    try {
      const pools = await getOwnerPools(app, teamId);
      return reply.send({ pools });

    } catch (error) {
      app.log.error('Failed to get owner pools:', error as any);
      return reply.code(500).send({ error: 'Failed to get owner pools' });
    }
  });

  /**
   * GET /routing/stats - Get routing statistics
   */
  app.get('/routing/stats', {
    schema: {
      querystring: z.object({
        days: z.coerce.number().min(1).max(365).default(30)
      }),
      response: {
        200: z.object({
          totalLeads: z.number(),
          routedLeads: z.number(),
          unroutedLeads: z.number(),
          poolDistribution: z.record(z.number()),
          avgRoutingTime: z.number()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { days } = request.query as { days: number };
    const teamId = (request as any).teamId;

    try {
      const stats = await getRoutingStats(app, teamId, days);
      return reply.send(stats);

    } catch (error) {
      app.log.error('Failed to get routing stats:', error as any);
      return reply.code(500).send({ error: 'Failed to get routing stats' });
    }
  });

  /**
   * POST /routing/batch-test - Test routing against multiple leads
   */
  app.post('/routing/batch-test', {
    schema: {
      body: z.object({
        leads: z.array(testRoutingSchema).max(100) // Limit to 100 leads per batch
      }),
      response: {
        200: z.object({
          results: z.array(z.object({
            lead: z.any(),
            routing: z.any()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { leads } = request.body as { leads: z.infer<typeof testRoutingSchema>[] };
    const teamId = (request as any).teamId;

    try {
      // Get routing rules
      let rules = await getRoutingRules(app, teamId);

      // Initialize default rules if none exist
      if (rules.length === 0) {
        rules = await initializeDefaultRoutingRules(app, teamId);
      }

      // Process all leads
      const results = [];
      for (const leadData of leads) {
        const routing = await routeLead(app, leadData as Lead, rules, teamId);
        results.push({ lead: leadData, routing });
      }

      return reply.send({ results });

    } catch (error) {
      app.log.error('Batch routing test failed:', error as any);
      return reply.code(500).send({ error: 'Failed to test batch routing' });
    }
  });

  /**
   * GET /sla/settings - Get SLA thresholds
   */
  app.get('/sla/settings', {
    schema: {
      response: {
        200: z.object({
          thresholds: z.object({
            priority1: z.number(),
            priority2: z.number(),
            priority3: z.number(),
            priority4: z.number(),
            escalation: z.object({
              enabled: z.boolean(),
              levels: z.array(z.object({
                minutes: z.number(),
                action: z.string()
              }))
            }),
            business_hours: z.object({
              enabled: z.boolean(),
              timezone: z.string(),
              schedule: z.record(z.any())
            })
          })
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = (request as any).teamId;

    try {
      const slaSettings = await app.prisma.sLASetting.findFirst({
        where: { teamId }
      });

      if (!slaSettings) {
        // Return default settings if none exist
        return reply.send({
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
        });
      }

      return reply.send({
        thresholds: slaSettings.thresholds as any
      });

    } catch (error) {
      app.log.error('Failed to get SLA settings:', error as any);
      return reply.code(500).send({ error: 'Failed to get SLA settings' });
    }
  });

  /**
   * PUT /sla/settings - Save SLA thresholds
   */
  app.put('/sla/settings', {
    schema: {
      body: z.object({
        thresholds: z.object({
          priority1: z.number().min(1),
          priority2: z.number().min(1),
          priority3: z.number().min(1),
          priority4: z.number().min(1),
          escalation: z.object({
            enabled: z.boolean(),
            levels: z.array(z.object({
              minutes: z.number().min(1),
              action: z.string()
            }))
          }),
          business_hours: z.object({
            enabled: z.boolean(),
            timezone: z.string(),
            schedule: z.record(z.any())
          })
        })
      }),
      response: {
        200: z.object({
          message: z.string(),
          thresholds: z.any()
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { thresholds } = request.body as { thresholds: any };
    const teamId = (request as any).teamId;

    try {
      // Find existing SLA settings for team
      let slaSettings = await app.prisma.sLASetting.findFirst({
        where: { teamId }
      });

      if (slaSettings) {
        // Update existing settings
        slaSettings = await app.prisma.sLASetting.update({
          where: { id: slaSettings.id },
          data: { thresholds }
        });
      } else {
        // Create new settings
        slaSettings = await app.prisma.sLASetting.create({
          data: { teamId, thresholds }
        });
      }

      return reply.send({
        message: 'SLA settings saved successfully',
        thresholds: slaSettings.thresholds
      });

    } catch (error) {
      app.log.error('Failed to save SLA settings:', error as any);
      return reply.code(500).send({ error: 'Failed to save SLA settings' });
    }
  });

  /**
   * POST /sla/test - Compute target times for sample lead
   */
  app.post('/sla/test', {
    schema: {
      body: z.object({
        lead: z.object({
          email: z.string().email().optional(),
          name: z.string().optional(),
          company: z.string().optional(),
          score: z.number().min(0).max(100).default(50),
          scoreBand: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
          fields: z.record(z.any()).default({})
        }),
        priority: z.number().int().min(1).max(4).default(3)
      }),
      response: {
        200: z.object({
          priority: z.number(),
          slaMinutes: z.number(),
          targetAt: z.string(),
          dueTime: z.string(),
          businessHoursAdjusted: z.boolean(),
          escalationSchedule: z.array(z.object({
            minutes: z.number(),
            action: z.string(),
            scheduledAt: z.string()
          }))
        })
      }
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { lead, priority } = request.body as { lead: any; priority: number };
    const teamId = (request as any).teamId;

    try {
      // Get SLA settings
      const slaSettings = await app.prisma.sLASetting.findFirst({
        where: { teamId }
      });

      const thresholds = slaSettings?.thresholds as any || {
        priority1: 5,
        priority2: 15,
        priority3: 30,
        priority4: 60,
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
      };

      // Get SLA minutes based on priority
      const slaMinutes = thresholds[`priority${priority}`] || 30;
      
      // Calculate target time
      const now = new Date();
      const targetAt = new Date(now.getTime() + (slaMinutes * 60 * 1000));
      
      // For business hours adjustment, we'll keep it simple for now
      const businessHoursAdjusted = false;
      
      // Calculate escalation schedule
      const escalationSchedule = thresholds.escalation?.enabled ? 
        thresholds.escalation.levels.map((level: any) => ({
          minutes: level.minutes,
          action: level.action,
          scheduledAt: new Date(now.getTime() + (level.minutes * 60 * 1000)).toISOString()
        })) : [];

      return reply.send({
        priority,
        slaMinutes,
        targetAt: targetAt.toISOString(),
        dueTime: targetAt.toLocaleString(),
        businessHoursAdjusted,
        escalationSchedule
      });

    } catch (error) {
      app.log.error('Failed to test SLA:', error as any);
      return reply.code(500).send({ error: 'Failed to test SLA' });
    }
  });
}
