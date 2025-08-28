import { FastifyInstance } from 'fastify';

export interface Lead {
  id?: string;
  email?: string;
  name?: string;
  company?: string;
  domain?: string;
  source: string;
  score: number;
  scoreBand: 'LOW' | 'MEDIUM' | 'HIGH';
  fields: Record<string, any>;
  utm: Record<string, any>;
  ownerId?: string;
}

export interface RoutingRule {
  id: string;
  teamId: string;
  name: string;
  definition: {
    if: Array<{
      field: string;
      op: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 
          'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in' | 
          'exists' | 'not_exists';
      value: any;
    }>;
    then: {
      assign?: string;        // Pool name or specific owner ID
      priority?: number;      // Assignment priority
      alert?: 'SLACK' | 'EMAIL' | 'WEBHOOK';
      webhook?: string;       // Webhook URL for notifications
      sla?: number;          // SLA in minutes
    };
  };
  enabled: boolean;
  order: number;
}

export interface OwnerPool {
  name: string;
  owners: Array<{
    ownerId: string;
    capacity: number;
    currentLoad: number;
    isActive: boolean;
  }>;
  strategy: 'round_robin' | 'least_loaded' | 'weighted';
  lastAssignedIndex: number;
}

export interface RoutingResult {
  ownerId: string | null;
  pool: string | null;
  reason: string;
  trace: RoutingTrace[];
  alerts: Array<{
    type: 'SLACK' | 'EMAIL' | 'WEBHOOK';
    target?: string;
    message: string;
  }>;
  sla?: number;
  priority?: number;
}

export interface RoutingTrace {
  step: string;
  rule?: string;
  condition?: string;
  result: boolean | string;
  reason: string;
}

/**
 * Route a lead to an owner based on routing rules
 */
export async function routeLead(
  app: FastifyInstance,
  lead: Lead,
  rules: RoutingRule[]
): Promise<RoutingResult> {
  const trace: RoutingTrace[] = [];
  const alerts: RoutingResult['alerts'] = [];
  let assignedOwnerId: string | null = null;
  let assignedPool: string | null = null;
  let sla: number | undefined;
  let priority: number | undefined;

  trace.push({
    step: 'start',
    result: 'initialized',
    reason: `Starting routing for lead with score ${lead.score} (${lead.scoreBand})`
  });

  // Sort rules by order
  const sortedRules = rules
    .filter(rule => rule.enabled)
    .sort((a, b) => a.order - b.order);

  // Evaluate each rule until we find a match
  for (const rule of sortedRules) {
    const ruleResult = await evaluateRoutingRule(app, lead, rule, trace);
    
    if (ruleResult.matched) {
      const assignment = rule.definition.then;
      
      // Handle assignment
      if (assignment.assign) {
        const assignmentResult = await handleAssignment(
          app, 
          assignment.assign, 
          lead, 
          trace
        );
        
        assignedOwnerId = assignmentResult.ownerId;
        assignedPool = assignmentResult.pool;
      }

      // Handle alerts
      if (assignment.alert) {
        alerts.push({
          type: assignment.alert,
          target: assignment.webhook,
          message: `Lead ${lead.name || lead.email} routed to ${assignedPool || assignedOwnerId} via rule "${rule.name}"`
        });
      }

      // Set SLA and priority
      if (assignment.sla) sla = assignment.sla;
      if (assignment.priority) priority = assignment.priority;

      trace.push({
        step: 'assignment',
        rule: rule.id,
        result: assignedOwnerId || assignedPool || 'no_assignment',
        reason: `Rule "${rule.name}" matched and assigned to ${assignedOwnerId || assignedPool}`
      });

      break; // Stop at first matching rule
    }
  }

  // If no rules matched, try default assignment
  if (!assignedOwnerId && !assignedPool) {
    const defaultResult = await handleDefaultAssignment(app, lead, trace);
    assignedOwnerId = defaultResult.ownerId;
    assignedPool = defaultResult.pool;
  }

  const reason = assignedOwnerId 
    ? `Assigned to owner ${assignedOwnerId}${assignedPool ? ` from pool ${assignedPool}` : ''}`
    : assignedPool
    ? `Assigned to pool ${assignedPool}`
    : 'No assignment made - no matching rules or available owners';

  trace.push({
    step: 'final',
    result: assignedOwnerId || assignedPool || 'unassigned',
    reason
  });

  return {
    ownerId: assignedOwnerId,
    pool: assignedPool,
    reason,
    trace,
    alerts,
    sla,
    priority
  };
}

/**
 * Evaluate a single routing rule against a lead
 */
async function evaluateRoutingRule(
  app: FastifyInstance,
  lead: Lead,
  rule: RoutingRule,
  trace: RoutingTrace[]
): Promise<{ matched: boolean }> {
  trace.push({
    step: 'rule_evaluation',
    rule: rule.id,
    result: false,
    reason: `Evaluating rule "${rule.name}"`
  });

  // Evaluate all conditions (AND logic)
  for (const condition of rule.definition.if) {
    const value = getFieldValue(lead, condition.field);
    const matches = evaluateCondition(value, condition.op, condition.value);

    trace.push({
      step: 'condition',
      rule: rule.id,
      condition: `${condition.field} ${condition.op} ${condition.value}`,
      result: matches,
      reason: `Field '${condition.field}' with value '${value}' ${matches ? 'matches' : 'does not match'} condition`
    });

    if (!matches) {
      return { matched: false };
    }
  }

  trace.push({
    step: 'rule_match',
    rule: rule.id,
    result: true,
    reason: `Rule "${rule.name}" matched - all conditions satisfied`
  });

  return { matched: true };
}

/**
 * Handle assignment to pool or specific owner
 */
async function handleAssignment(
  app: FastifyInstance,
  assignment: string,
  lead: Lead,
  trace: RoutingTrace[]
): Promise<{ ownerId: string | null; pool: string | null }> {
  
  // Check if assignment is a specific owner ID (starts with owner_)
  if (assignment.startsWith('owner_') || assignment.length > 20) {
    trace.push({
      step: 'direct_assignment',
      result: assignment,
      reason: `Direct assignment to owner ${assignment}`
    });
    
    return { ownerId: assignment, pool: null };
  }

  // Otherwise, treat as pool assignment
  const pool = await getOwnerPool(app, assignment, lead.teamId);
  if (!pool) {
    trace.push({
      step: 'pool_not_found',
      result: false,
      reason: `Pool "${assignment}" not found`
    });
    
    return { ownerId: null, pool: assignment };
  }

  // Get next owner from pool using round-robin
  const selectedOwner = await getNextOwnerFromPool(app, pool, lead.teamId, trace);
  
  return { 
    ownerId: selectedOwner?.ownerId || null, 
    pool: assignment 
  };
}

/**
 * Handle default assignment when no rules match
 */
async function handleDefaultAssignment(
  app: FastifyInstance,
  lead: Lead,
  trace: RoutingTrace[]
): Promise<{ ownerId: string | null; pool: string | null }> {
  
  trace.push({
    step: 'default_assignment',
    result: 'attempting',
    reason: 'No routing rules matched, attempting default assignment'
  });

  // Try to find a default pool
  const defaultPool = await getDefaultOwnerPool(app, lead.teamId);
  if (defaultPool) {
    const selectedOwner = await getNextOwnerFromPool(app, defaultPool, lead.teamId, trace);
    return { 
      ownerId: selectedOwner?.ownerId || null, 
      pool: defaultPool.name 
    };
  }

  // Fallback: assign to any available owner
  const availableOwner = await getAnyAvailableOwner(app, lead.teamId);
  if (availableOwner) {
    trace.push({
      step: 'fallback_assignment',
      result: availableOwner.id,
      reason: `Fallback assignment to available owner ${availableOwner.id}`
    });
    
    return { ownerId: availableOwner.id, pool: null };
  }

  trace.push({
    step: 'no_assignment',
    result: false,
    reason: 'No available owners found for assignment'
  });

  return { ownerId: null, pool: null };
}

/**
 * Get owner pool configuration
 */
async function getOwnerPool(
  app: FastifyInstance,
  poolName: string,
  teamId: string
): Promise<OwnerPool | null> {
  try {
    // For now, we'll create a simple pool from owners
    // In a real implementation, you might have a separate pools table
    const owners = await app.prisma.owner.findMany({
      where: { teamId },
      include: {
        user: { select: { email: true } },
        _count: { select: { leads: true } }
      }
    });

    if (owners.length === 0) {
      return null;
    }

    // Filter owners by pool (could be based on tags, roles, etc.)
    const poolOwners = owners.filter(owner => {
      // Simple pool matching - in practice, you'd have proper pool configuration
      if (poolName === 'AE_POOL_A') {
        return owner.capacity >= 50; // High capacity owners
      } else if (poolName === 'AE_POOL_B') {
        return owner.capacity < 50 && owner.capacity >= 20; // Medium capacity
      } else if (poolName === 'SDR_POOL') {
        return owner.capacity < 20; // Lower capacity for SDRs
      }
      return true; // Default pool includes all
    });

    if (poolOwners.length === 0) {
      return null;
    }

    return {
      name: poolName,
      owners: poolOwners.map(owner => ({
        ownerId: owner.id,
        capacity: owner.capacity,
        currentLoad: owner._count.leads,
        isActive: true // Could be based on working hours, availability, etc.
      })),
      strategy: 'round_robin',
      lastAssignedIndex: 0
    };
  } catch (error) {
    app.log.error('Failed to get owner pool:', error);
    return null;
  }
}

/**
 * Get next owner from pool using round-robin strategy
 */
async function getNextOwnerFromPool(
  app: FastifyInstance,
  pool: OwnerPool,
  teamId: string,
  trace: RoutingTrace[]
): Promise<{ ownerId: string } | null> {
  
  const activeOwners = pool.owners.filter(owner => 
    owner.isActive && owner.currentLoad < owner.capacity
  );

  if (activeOwners.length === 0) {
    trace.push({
      step: 'no_available_owners',
      result: false,
      reason: `No available owners in pool "${pool.name}" - all at capacity`
    });
    return null;
  }

  let selectedOwner;

  switch (pool.strategy) {
    case 'round_robin':
      // Simple round-robin: next owner in line
      const nextIndex = (pool.lastAssignedIndex + 1) % activeOwners.length;
      selectedOwner = activeOwners[nextIndex];
      pool.lastAssignedIndex = nextIndex;
      break;

    case 'least_loaded':
      // Assign to owner with least current load
      selectedOwner = activeOwners.reduce((least, current) => 
        current.currentLoad < least.currentLoad ? current : least
      );
      break;

    case 'weighted':
      // Weighted assignment based on capacity
      const totalCapacity = activeOwners.reduce((sum, owner) => sum + owner.capacity, 0);
      const random = Math.random() * totalCapacity;
      let runningSum = 0;
      
      for (const owner of activeOwners) {
        runningSum += owner.capacity;
        if (random <= runningSum) {
          selectedOwner = owner;
          break;
        }
      }
      selectedOwner = selectedOwner || activeOwners[0];
      break;

    default:
      selectedOwner = activeOwners[0];
  }

  trace.push({
    step: 'pool_assignment',
    result: selectedOwner.ownerId,
    reason: `Selected owner ${selectedOwner.ownerId} from pool "${pool.name}" using ${pool.strategy} strategy`
  });

  return { ownerId: selectedOwner.ownerId };
}

/**
 * Get default owner pool for a team
 */
async function getDefaultOwnerPool(
  app: FastifyInstance,
  teamId: string
): Promise<OwnerPool | null> {
  return await getOwnerPool(app, 'DEFAULT', teamId);
}

/**
 * Get any available owner as fallback
 */
async function getAnyAvailableOwner(
  app: FastifyInstance,
  teamId: string
): Promise<{ id: string } | null> {
  try {
    const owner = await app.prisma.owner.findFirst({
      where: { 
        teamId,
        leads: {
          _count: {
            lt: app.prisma.owner.fields.capacity
          }
        }
      }
    });

    return owner ? { id: owner.id } : null;
  } catch (error) {
    app.log.error('Failed to get available owner:', error);
    return null;
  }
}

/**
 * Get field value from lead object (supports nested paths)
 */
function getFieldValue(lead: Lead, fieldPath: string): any {
  const paths = fieldPath.split('.');
  let value: any = lead;

  for (const path of paths) {
    if (value === null || value === undefined) {
      return null;
    }
    value = value[path];
  }

  return value;
}

/**
 * Evaluate a condition against a value
 */
function evaluateCondition(value: any, op: string, targetValue: any): boolean {
  switch (op) {
    case 'equals':
      return value === targetValue;
    
    case 'not_equals':
      return value !== targetValue;
    
    case 'greater_than':
      return typeof value === 'number' && value > targetValue;
    
    case 'less_than':
      return typeof value === 'number' && value < targetValue;
    
    case 'greater_equal':
      return typeof value === 'number' && value >= targetValue;
    
    case 'less_equal':
      return typeof value === 'number' && value <= targetValue;
    
    case 'contains':
      return typeof value === 'string' && value.toLowerCase().includes(String(targetValue).toLowerCase());
    
    case 'not_contains':
      return typeof value === 'string' && !value.toLowerCase().includes(String(targetValue).toLowerCase());
    
    case 'starts_with':
      return typeof value === 'string' && value.toLowerCase().startsWith(String(targetValue).toLowerCase());
    
    case 'ends_with':
      return typeof value === 'string' && value.toLowerCase().endsWith(String(targetValue).toLowerCase());
    
    case 'regex':
      try {
        const regex = new RegExp(targetValue, 'i');
        return typeof value === 'string' && regex.test(value);
      } catch {
        return false;
      }
    
    case 'in':
      return Array.isArray(targetValue) && targetValue.includes(value);
    
    case 'not_in':
      return Array.isArray(targetValue) && !targetValue.includes(value);
    
    case 'exists':
      return value !== null && value !== undefined && value !== '';
    
    case 'not_exists':
      return value === null || value === undefined || value === '';
    
    default:
      return false;
  }
}
