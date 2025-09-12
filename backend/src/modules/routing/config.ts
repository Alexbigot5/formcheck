import { FastifyInstance } from 'fastify';
import { RoutingRule } from './engine';

/**
 * Get routing rules for a team
 */
export async function getRoutingRules(
  app: FastifyInstance,
  teamId: string
): Promise<RoutingRule[]> {
  try {
    const rules = await app.prisma.routingRule.findMany({
      where: { teamId },
      orderBy: { order: 'asc' }
    });

    return rules.map(rule => ({
      id: rule.id,
      teamId: rule.teamId,
      name: extractRuleName(rule.definition),
      definition: rule.definition as RoutingRule['definition'],
      enabled: rule.enabled,
      order: rule.order
    }));
  } catch (error) {
    app.log.error('Failed to get routing rules:', error as any);
    return [];
  }
}

/**
 * Create or update routing rule
 */
export async function upsertRoutingRule(
  app: FastifyInstance,
  teamId: string,
  rule: Omit<RoutingRule, 'id' | 'teamId'>
): Promise<RoutingRule> {
  try {
    const newRule = await app.prisma.routingRule.create({
      data: {
        teamId,
        definition: rule.definition,
        enabled: rule.enabled,
        order: rule.order
      }
    });

    return {
      id: newRule.id,
      teamId: newRule.teamId,
      name: rule.name,
      definition: newRule.definition as RoutingRule['definition'],
      enabled: newRule.enabled,
      order: newRule.order
    };
  } catch (error) {
    app.log.error('Failed to upsert routing rule:', error as any);
    throw new Error('Failed to save routing rule');
  }
}

/**
 * Update routing rule
 */
export async function updateRoutingRule(
  app: FastifyInstance,
  ruleId: string,
  teamId: string,
  updates: Partial<Omit<RoutingRule, 'id' | 'teamId'>>
): Promise<RoutingRule> {
  try {
    const updatedRule = await app.prisma.routingRule.update({
      where: { id: ruleId, teamId },
      data: {
        definition: updates.definition,
        enabled: updates.enabled,
        order: updates.order
      }
    });

    return {
      id: updatedRule.id,
      teamId: updatedRule.teamId,
      name: updates.name || extractRuleName(updatedRule.definition),
      definition: updatedRule.definition as RoutingRule['definition'],
      enabled: updatedRule.enabled,
      order: updatedRule.order
    };
  } catch (error) {
    app.log.error('Failed to update routing rule:', error as any);
    throw new Error('Failed to update routing rule');
  }
}

/**
 * Delete routing rule
 */
export async function deleteRoutingRule(
  app: FastifyInstance,
  ruleId: string,
  teamId: string
): Promise<void> {
  try {
    await app.prisma.routingRule.delete({
      where: { id: ruleId, teamId }
    });
  } catch (error) {
    app.log.error('Failed to delete routing rule:', error as any);
    throw new Error('Failed to delete routing rule');
  }
}

/**
 * Reorder routing rules
 */
export async function reorderRoutingRules(
  app: FastifyInstance,
  teamId: string,
  ruleIds: string[]
): Promise<void> {
  try {
    // Update order for each rule
    for (let i = 0; i < ruleIds.length; i++) {
      await app.prisma.routingRule.update({
        where: { id: ruleIds[i], teamId },
        data: { order: i + 1 }
      });
    }
  } catch (error) {
    app.log.error('Failed to reorder routing rules:', error as any);
    throw new Error('Failed to reorder routing rules');
  }
}

/**
 * Initialize default routing rules for a team
 */
export async function initializeDefaultRoutingRules(
  app: FastifyInstance,
  teamId: string
): Promise<RoutingRule[]> {
  try {
    // Check if rules already exist
    const existingRules = await getRoutingRules(app, teamId);
    if (existingRules.length > 0) {
      return existingRules;
    }

    // Create default rules
    const defaultRules: Omit<RoutingRule, 'id' | 'teamId'>[] = [
      {
        name: 'High Score to AE Pool A',
        definition: {
          if: [
            { field: 'scoreBand', op: 'equals', value: 'HIGH' }
          ],
          then: {
            assign: 'AE_POOL_A',
            alert: 'SLACK',
            sla: 15,
            priority: 1
          }
        },
        enabled: true,
        order: 1
      },
      {
        name: 'Enterprise Leads to Senior AEs',
        definition: {
          if: [
            { field: 'fields.employees', op: 'greater_equal', value: 1000 },
            { field: 'fields.budget', op: 'greater_equal', value: 100000 }
          ],
          then: {
            assign: 'SENIOR_AE_POOL',
            alert: 'SLACK',
            sla: 10,
            priority: 1
          }
        },
        enabled: true,
        order: 2
      },
      {
        name: 'Decision Makers to AE Pool A',
        definition: {
          if: [
            { field: 'fields.title', op: 'contains', value: 'ceo' }
          ],
          then: {
            assign: 'AE_POOL_A',
            alert: 'EMAIL',
            sla: 20,
            priority: 2
          }
        },
        enabled: true,
        order: 3
      },
      {
        name: 'Medium Score to AE Pool B',
        definition: {
          if: [
            { field: 'scoreBand', op: 'equals', value: 'MEDIUM' }
          ],
          then: {
            assign: 'AE_POOL_B',
            sla: 30
          }
        },
        enabled: true,
        order: 4
      },
      {
        name: 'Low Score to SDR Pool',
        definition: {
          if: [
            { field: 'scoreBand', op: 'equals', value: 'LOW' }
          ],
          then: {
            assign: 'SDR_POOL',
            sla: 60
          }
        },
        enabled: true,
        order: 5
      },
      {
        name: 'Paid Search to Fast Track',
        definition: {
          if: [
            { field: 'utm.medium', op: 'equals', value: 'cpc' },
            { field: 'utm.source', op: 'equals', value: 'google' }
          ],
          then: {
            assign: 'FAST_TRACK_POOL',
            alert: 'SLACK',
            sla: 5,
            priority: 1
          }
        },
        enabled: true,
        order: 6
      }
    ];

    const rules: RoutingRule[] = [];
    for (const ruleData of defaultRules) {
      const rule = await upsertRoutingRule(app, teamId, ruleData);
      rules.push(rule);
    }

    return rules;
  } catch (error) {
    app.log.error('Failed to initialize default routing rules:', error as any);
    throw new Error('Failed to initialize routing rules');
  }
}

/**
 * Validate routing rule
 */
export function validateRoutingRule(rule: Partial<RoutingRule>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate name
  if (!rule.name || rule.name.trim().length === 0) {
    errors.push('Rule name is required');
  }

  // Validate definition
  if (!rule.definition) {
    errors.push('Rule definition is required');
  } else {
    // Validate if conditions
    if (!rule.definition.if || !Array.isArray(rule.definition.if) || rule.definition.if.length === 0) {
      errors.push('Rule must have at least one condition in "if" array');
    } else {
      for (const condition of rule.definition.if) {
        if (!condition.field || !condition.op || condition.value === undefined) {
          errors.push('Each condition must have field, op, and value');
        }
      }
    }

    // Validate then actions
    if (!rule.definition.then) {
      errors.push('Rule must have "then" actions');
    } else {
      const then = rule.definition.then;
      
      if (!then.assign) {
        errors.push('Rule must specify assignment target in "then.assign"');
      }

      if (then.sla && (then.sla <= 0 || !Number.isInteger(then.sla))) {
        errors.push('SLA must be a positive integer (minutes)');
      }

      if (then.priority && (then.priority <= 0 || !Number.isInteger(then.priority))) {
        errors.push('Priority must be a positive integer');
      }

      if (then.alert && !['SLACK', 'EMAIL', 'WEBHOOK'].includes(then.alert)) {
        errors.push('Alert type must be SLACK, EMAIL, or WEBHOOK');
      }

      if (then.alert === 'WEBHOOK' && !then.webhook) {
        errors.push('Webhook URL is required when alert type is WEBHOOK');
      }
    }
  }

  // Validate order
  if (rule.order !== undefined && (rule.order < 0 || !Number.isInteger(rule.order))) {
    errors.push('Rule order must be a non-negative integer');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get owner pools configuration for a team
 */
export async function getOwnerPools(
  app: FastifyInstance,
  teamId: string
): Promise<Array<{ name: string; owners: number; strategy: string }>> {
  try {
    const owners = await app.prisma.owner.findMany({
      where: { teamId },
      include: {
        user: { select: { email: true } },
        _count: { select: { leads: true } }
      }
    });

    // Group owners into pools (simplified logic)
    const pools = [
      {
        name: 'AE_POOL_A',
        owners: owners.filter(o => o.capacity >= 50).length,
        strategy: 'round_robin'
      },
      {
        name: 'AE_POOL_B', 
        owners: owners.filter(o => o.capacity >= 20 && o.capacity < 50).length,
        strategy: 'round_robin'
      },
      {
        name: 'SDR_POOL',
        owners: owners.filter(o => o.capacity < 20).length,
        strategy: 'round_robin'
      },
      {
        name: 'SENIOR_AE_POOL',
        owners: owners.filter(o => o.capacity >= 100).length,
        strategy: 'least_loaded'
      },
      {
        name: 'FAST_TRACK_POOL',
        owners: owners.filter(o => o.capacity >= 30).length,
        strategy: 'round_robin'
      }
    ].filter(pool => pool.owners > 0);

    return pools;
  } catch (error) {
    app.log.error('Failed to get owner pools:', error as any);
    return [];
  }
}

/**
 * Get routing statistics for a team
 */
export async function getRoutingStats(
  app: FastifyInstance,
  teamId: string,
  days: number = 30
): Promise<{
  totalLeads: number;
  routedLeads: number;
  unroutedLeads: number;
  poolDistribution: Record<string, number>;
  avgRoutingTime: number;
}> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const leads = await app.prisma.lead.findMany({
      where: {
        teamId,
        createdAt: { gte: since }
      },
      include: {
        timelineEvents: {
          where: { type: 'SCORE_UPDATED' }, // Using existing enum value
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    const totalLeads = leads.length;
    const routedLeads = leads.filter(lead => lead.ownerId).length;
    const unroutedLeads = totalLeads - routedLeads;

    // Simplified pool distribution (would need proper pool tracking)
    const poolDistribution: Record<string, number> = {};
    
    // Calculate average routing time (simplified)
    const routingTimes = leads
      .filter(lead => lead.timelineEvents.length > 0)
      .map(lead => {
        const firstEvent = lead.timelineEvents[0];
        return firstEvent.createdAt.getTime() - lead.createdAt.getTime();
      });

    const avgRoutingTime = routingTimes.length > 0
      ? routingTimes.reduce((sum, time) => sum + time, 0) / routingTimes.length / 1000 / 60 // Convert to minutes
      : 0;

    return {
      totalLeads,
      routedLeads,
      unroutedLeads,
      poolDistribution,
      avgRoutingTime
    };
  } catch (error) {
    app.log.error('Failed to get routing stats:', error as any);
    return {
      totalLeads: 0,
      routedLeads: 0,
      unroutedLeads: 0,
      poolDistribution: {},
      avgRoutingTime: 0
    };
  }
}

/**
 * Extract rule name from definition for display
 */
function extractRuleName(definition: any): string {
  if (!definition?.if || !Array.isArray(definition.if)) {
    return 'Unnamed Rule';
  }

  const conditions = definition.if.map((cond: any) => 
    `${cond.field} ${cond.op} ${cond.value}`
  ).join(' AND ');

  const action = definition.then?.assign || 'unassigned';
  
  return `If ${conditions} then assign to ${action}`;
}
