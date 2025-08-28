import { FastifyInstance } from 'fastify';

export interface ScoringConfig {
  id: string;
  teamId: string;
  weights: Record<string, number>;
  bands: {
    low: { min: number; max: number };
    medium: { min: number; max: number };
    high: { min: number; max: number };
  };
  negative: Array<{
    field: string;
    op: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
    value: any;
    penalty: number;
    reason: string;
  }>;
  enrichment: Record<string, any>;
  version: number;
}

export interface ScoringRule {
  id: string;
  teamId: string;
  type: 'IF_THEN' | 'WEIGHT';
  definition: {
    if?: Array<{
      field: string;
      op: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in' | 'exists' | 'not_exists';
      value: any;
    }>;
    then?: {
      add?: number;
      multiply?: number;
      tag?: string;
      route?: string;
      sla?: number;
    };
    weight?: number;
    field?: string;
  };
  enabled: boolean;
  order: number;
}

export interface Lead {
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  domain?: string;
  source: string;
  fields: Record<string, any>;
  utm: Record<string, any>;
  score?: number;
}

export interface ScoringResult {
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  trace: ScoringTrace[];
  tags: string[];
  routing?: string;
  sla?: number;
}

export interface ScoringTrace {
  step: string;
  rule?: string;
  field?: string;
  value?: any;
  operation: string;
  points: number;
  total: number;
  reason: string;
}

/**
 * Apply scoring rules to a lead
 */
export async function applyScoring(
  app: FastifyInstance,
  lead: Lead,
  config: ScoringConfig,
  rules: ScoringRule[]
): Promise<ScoringResult> {
  const trace: ScoringTrace[] = [];
  let score = 0;
  const tags: string[] = [];
  let routing: string | undefined;
  let sla: number | undefined;

  // Step 1: Apply base weights from config
  score += applyWeights(lead, config.weights, trace);

  // Step 2: Apply negative rules (penalties)
  score = applyNegativeRules(lead, config.negative, score, trace);

  // Step 3: Apply IF_THEN rules in order
  const ruleResults = applyIfThenRules(lead, rules, score, trace);
  score = ruleResults.score;
  tags.push(...ruleResults.tags);
  if (ruleResults.routing) routing = ruleResults.routing;
  if (ruleResults.sla) sla = ruleResults.sla;

  // Step 4: Apply weight-based rules
  score += applyWeightRules(lead, rules, trace);

  // Step 5: Ensure score is within bounds
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Step 6: Calculate score band
  const band = calculateScoreBand(score, config.bands);

  trace.push({
    step: 'final',
    operation: 'band_calculation',
    points: 0,
    total: score,
    reason: `Final score ${score} maps to ${band} band`
  });

  return {
    score,
    band,
    trace,
    tags,
    routing,
    sla
  };
}

/**
 * Apply base weights from configuration
 */
function applyWeights(lead: Lead, weights: Record<string, number>, trace: ScoringTrace[]): number {
  let totalPoints = 0;

  for (const [field, weight] of Object.entries(weights)) {
    const value = getFieldValue(lead, field);
    let points = 0;

    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'boolean') {
        points = value ? weight : 0;
      } else if (typeof value === 'number') {
        points = value * weight;
      } else if (typeof value === 'string') {
        // String length-based scoring
        points = Math.min(value.length / 10, 1) * weight;
      } else {
        // Has value
        points = weight;
      }
    }

    if (points !== 0) {
      totalPoints += points;
      trace.push({
        step: 'weights',
        field,
        value,
        operation: 'weight_application',
        points,
        total: totalPoints,
        reason: `Field '${field}' with value '${value}' applied weight ${weight} for ${points} points`
      });
    }
  }

  return totalPoints;
}

/**
 * Apply negative rules (penalties)
 */
function applyNegativeRules(
  lead: Lead,
  negativeRules: ScoringConfig['negative'],
  currentScore: number,
  trace: ScoringTrace[]
): number {
  let score = currentScore;

  for (const rule of negativeRules) {
    const value = getFieldValue(lead, rule.field);
    const matches = evaluateCondition(value, rule.op, rule.value);

    if (matches) {
      score -= rule.penalty;
      trace.push({
        step: 'negative',
        field: rule.field,
        value,
        operation: 'penalty',
        points: -rule.penalty,
        total: score,
        reason: rule.reason
      });
    }
  }

  return score;
}

/**
 * Apply IF_THEN rules
 */
function applyIfThenRules(
  lead: Lead,
  rules: ScoringRule[],
  currentScore: number,
  trace: ScoringTrace[]
): { score: number; tags: string[]; routing?: string; sla?: number } {
  let score = currentScore;
  const tags: string[] = [];
  let routing: string | undefined;
  let sla: number | undefined;

  const ifThenRules = rules
    .filter(rule => rule.type === 'IF_THEN' && rule.enabled)
    .sort((a, b) => a.order - b.order);

  for (const rule of ifThenRules) {
    if (!rule.definition.if || !rule.definition.then) continue;

    // Evaluate all conditions (AND logic)
    const allConditionsMet = rule.definition.if.every(condition => {
      const value = getFieldValue(lead, condition.field);
      return evaluateCondition(value, condition.op, condition.value);
    });

    if (allConditionsMet) {
      const then = rule.definition.then;
      let points = 0;

      // Apply score changes
      if (then.add) {
        points += then.add;
        score += then.add;
      }
      if (then.multiply) {
        const multipliedPoints = score * (then.multiply - 1);
        points += multipliedPoints;
        score *= then.multiply;
      }

      // Apply tags
      if (then.tag) {
        tags.push(then.tag);
      }

      // Apply routing
      if (then.route) {
        routing = then.route;
      }

      // Apply SLA
      if (then.sla) {
        sla = then.sla;
      }

      trace.push({
        step: 'if_then',
        rule: rule.id,
        operation: 'rule_application',
        points,
        total: score,
        reason: `IF_THEN rule triggered: ${JSON.stringify(rule.definition.if)} → ${JSON.stringify(then)}`
      });
    }
  }

  return { score, tags, routing, sla };
}

/**
 * Apply weight-based rules
 */
function applyWeightRules(lead: Lead, rules: ScoringRule[], trace: ScoringTrace[]): number {
  let totalPoints = 0;

  const weightRules = rules
    .filter(rule => rule.type === 'WEIGHT' && rule.enabled)
    .sort((a, b) => a.order - b.order);

  for (const rule of weightRules) {
    if (!rule.definition.field || !rule.definition.weight) continue;

    const value = getFieldValue(lead, rule.definition.field);
    let points = 0;

    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'number') {
        points = value * rule.definition.weight;
      } else {
        points = rule.definition.weight;
      }

      totalPoints += points;
      trace.push({
        step: 'weight_rules',
        rule: rule.id,
        field: rule.definition.field,
        value,
        operation: 'weight_rule',
        points,
        total: totalPoints,
        reason: `Weight rule applied to field '${rule.definition.field}'`
      });
    }
  }

  return totalPoints;
}

/**
 * Calculate score band based on configuration
 */
function calculateScoreBand(score: number, bands: ScoringConfig['bands']): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= bands.high.min && score <= bands.high.max) {
    return 'HIGH';
  } else if (score >= bands.medium.min && score <= bands.medium.max) {
    return 'MEDIUM';
  } else {
    return 'LOW';
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

/**
 * Get default scoring configuration
 */
export function getDefaultScoringConfig(): Omit<ScoringConfig, 'id' | 'teamId'> {
  return {
    weights: {
      'email': 5,
      'name': 3,
      'company': 8,
      'phone': 4,
      'fields.budget': 0.001, // $1 = 0.001 points
      'fields.employees': 0.1,
      'fields.title': 5,
      'utm.source': 2,
      'utm.medium': 2
    },
    bands: {
      low: { min: 0, max: 30 },
      medium: { min: 31, max: 70 },
      high: { min: 71, max: 100 }
    },
    negative: [
      {
        field: 'email',
        op: 'contains',
        value: 'test',
        penalty: 20,
        reason: 'Test email detected'
      },
      {
        field: 'name',
        op: 'contains',
        value: 'test',
        penalty: 15,
        reason: 'Test name detected'
      },
      {
        field: 'company',
        op: 'equals',
        value: '',
        penalty: 10,
        reason: 'Missing company information'
      }
    ],
    enrichment: {},
    version: 1
  };
}
