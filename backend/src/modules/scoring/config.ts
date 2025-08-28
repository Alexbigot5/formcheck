import { FastifyInstance } from 'fastify';
import { ScoringConfig, ScoringRule, getDefaultScoringConfig } from './engine.js';

/**
 * Get active scoring configuration for a team
 */
export async function getScoringConfig(
  app: FastifyInstance,
  teamId: string
): Promise<ScoringConfig | null> {
  try {
    const config = await app.prisma.scoringConfig.findFirst({
      where: { teamId },
      orderBy: { version: 'desc' }
    });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      teamId: config.teamId,
      weights: config.weights as Record<string, number>,
      bands: config.bands as ScoringConfig['bands'],
      negative: config.negative as ScoringConfig['negative'],
      enrichment: config.enrichment as Record<string, any>,
      version: config.version
    };
  } catch (error) {
    app.log.error('Failed to get scoring config:', error);
    return null;
  }
}

/**
 * Get scoring rules for a team
 */
export async function getScoringRules(
  app: FastifyInstance,
  teamId: string
): Promise<ScoringRule[]> {
  try {
    const rules = await app.prisma.scoringRule.findMany({
      where: { teamId },
      orderBy: { order: 'asc' }
    });

    return rules.map(rule => ({
      id: rule.id,
      teamId: rule.teamId,
      type: rule.type as 'IF_THEN' | 'WEIGHT',
      definition: rule.definition as ScoringRule['definition'],
      enabled: rule.enabled,
      order: rule.order
    }));
  } catch (error) {
    app.log.error('Failed to get scoring rules:', error);
    return [];
  }
}

/**
 * Create or update scoring configuration
 */
export async function upsertScoringConfig(
  app: FastifyInstance,
  teamId: string,
  config: Omit<ScoringConfig, 'id' | 'teamId'>,
  createdBy: string
): Promise<ScoringConfig> {
  try {
    // Get current version for audit trail
    const currentConfig = await app.prisma.scoringConfig.findFirst({
      where: { teamId },
      orderBy: { version: 'desc' }
    });

    const nextVersion = currentConfig ? currentConfig.version + 1 : 1;

    const newConfig = await app.prisma.scoringConfig.create({
      data: {
        teamId,
        weights: config.weights,
        bands: config.bands,
        negative: config.negative,
        enrichment: config.enrichment,
        version: nextVersion,
        createdBy
      }
    });

    const configResult = {
      id: newConfig.id,
      teamId: newConfig.teamId,
      weights: newConfig.weights as Record<string, number>,
      bands: newConfig.bands as ScoringConfig['bands'],
      negative: newConfig.negative as ScoringConfig['negative'],
      enrichment: newConfig.enrichment as Record<string, any>,
      version: newConfig.version
    };

    // Log the configuration change to audit table
    try {
      await app.prisma.audit.create({
        data: {
          teamId,
          userId: createdBy,
          entityType: 'SCORING_CONFIG',
          entityId: newConfig.id,
          action: currentConfig ? 'update' : 'create',
          before: currentConfig ? {
            weights: currentConfig.weights,
            bands: currentConfig.bands,
            negative: currentConfig.negative,
            enrichment: currentConfig.enrichment,
            version: currentConfig.version
          } : null,
          after: {
            weights: newConfig.weights,
            bands: newConfig.bands,
            negative: newConfig.negative,
            enrichment: newConfig.enrichment,
            version: newConfig.version
          }
        }
      });
    } catch (auditError) {
      // Don't fail the main operation if audit logging fails
      app.log.warn('Failed to log scoring config audit:', auditError);
    }

    return configResult;
  } catch (error) {
    app.log.error('Failed to upsert scoring config:', error);
    throw new Error('Failed to save scoring configuration');
  }
}

/**
 * Create or update scoring rule
 */
export async function upsertScoringRule(
  app: FastifyInstance,
  teamId: string,
  rule: Omit<ScoringRule, 'id' | 'teamId'>
): Promise<ScoringRule> {
  try {
    const newRule = await app.prisma.scoringRule.create({
      data: {
        teamId,
        type: rule.type,
        definition: rule.definition,
        enabled: rule.enabled,
        order: rule.order
      }
    });

    return {
      id: newRule.id,
      teamId: newRule.teamId,
      type: newRule.type as 'IF_THEN' | 'WEIGHT',
      definition: newRule.definition as ScoringRule['definition'],
      enabled: newRule.enabled,
      order: newRule.order
    };
  } catch (error) {
    app.log.error('Failed to upsert scoring rule:', error);
    throw new Error('Failed to save scoring rule');
  }
}

/**
 * Initialize default scoring configuration for a team
 */
export async function initializeDefaultScoringConfig(
  app: FastifyInstance,
  teamId: string,
  createdBy: string
): Promise<{ config: ScoringConfig; rules: ScoringRule[] }> {
  try {
    // Check if config already exists
    const existingConfig = await getScoringConfig(app, teamId);
    if (existingConfig) {
      const rules = await getScoringRules(app, teamId);
      return { config: existingConfig, rules };
    }

    // Create default configuration
    const defaultConfig = getDefaultScoringConfig();
    const config = await upsertScoringConfig(app, teamId, defaultConfig, createdBy);

    // Create default rules
    const defaultRules: Omit<ScoringRule, 'id' | 'teamId'>[] = [
      {
        type: 'IF_THEN',
        definition: {
          if: [
            { field: 'fields.budget', op: 'greater_equal', value: 10000 }
          ],
          then: {
            add: 15,
            tag: 'high_budget',
            route: 'ae_pool_a',
            sla: 15
          }
        },
        enabled: true,
        order: 1
      },
      {
        type: 'IF_THEN',
        definition: {
          if: [
            { field: 'fields.title', op: 'contains', value: 'ceo' },
            { field: 'fields.title', op: 'contains', value: 'founder' }
          ],
          then: {
            add: 20,
            tag: 'decision_maker',
            route: 'senior_ae_pool'
          }
        },
        enabled: true,
        order: 2
      },
      {
        type: 'IF_THEN',
        definition: {
          if: [
            { field: 'utm.source', op: 'equals', value: 'google' },
            { field: 'utm.medium', op: 'equals', value: 'cpc' }
          ],
          then: {
            add: 10,
            tag: 'paid_search'
          }
        },
        enabled: true,
        order: 3
      },
      {
        type: 'WEIGHT',
        definition: {
          field: 'fields.company_size',
          weight: 0.1
        },
        enabled: true,
        order: 4
      }
    ];

    const rules: ScoringRule[] = [];
    for (const ruleData of defaultRules) {
      const rule = await upsertScoringRule(app, teamId, ruleData);
      rules.push(rule);
    }

    return { config, rules };
  } catch (error) {
    app.log.error('Failed to initialize default scoring config:', error);
    throw new Error('Failed to initialize scoring configuration');
  }
}

/**
 * Update scoring rule
 */
export async function updateScoringRule(
  app: FastifyInstance,
  ruleId: string,
  teamId: string,
  updates: Partial<Omit<ScoringRule, 'id' | 'teamId'>>
): Promise<ScoringRule> {
  try {
    const updatedRule = await app.prisma.scoringRule.update({
      where: { id: ruleId, teamId },
      data: updates
    });

    return {
      id: updatedRule.id,
      teamId: updatedRule.teamId,
      type: updatedRule.type as 'IF_THEN' | 'WEIGHT',
      definition: updatedRule.definition as ScoringRule['definition'],
      enabled: updatedRule.enabled,
      order: updatedRule.order
    };
  } catch (error) {
    app.log.error('Failed to update scoring rule:', error);
    throw new Error('Failed to update scoring rule');
  }
}

/**
 * Delete scoring rule
 */
export async function deleteScoringRule(
  app: FastifyInstance,
  ruleId: string,
  teamId: string
): Promise<void> {
  try {
    await app.prisma.scoringRule.delete({
      where: { id: ruleId, teamId }
    });
  } catch (error) {
    app.log.error('Failed to delete scoring rule:', error);
    throw new Error('Failed to delete scoring rule');
  }
}

/**
 * Reorder scoring rules
 */
export async function reorderScoringRules(
  app: FastifyInstance,
  teamId: string,
  ruleIds: string[]
): Promise<void> {
  try {
    // Update order for each rule
    for (let i = 0; i < ruleIds.length; i++) {
      await app.prisma.scoringRule.update({
        where: { id: ruleIds[i], teamId },
        data: { order: i + 1 }
      });
    }
  } catch (error) {
    app.log.error('Failed to reorder scoring rules:', error);
    throw new Error('Failed to reorder scoring rules');
  }
}

/**
 * Get scoring configuration history
 */
export async function getScoringConfigHistory(
  app: FastifyInstance,
  teamId: string,
  limit: number = 10
): Promise<ScoringConfig[]> {
  try {
    const configs = await app.prisma.scoringConfig.findMany({
      where: { teamId },
      orderBy: { version: 'desc' },
      take: limit
    });

    return configs.map(config => ({
      id: config.id,
      teamId: config.teamId,
      weights: config.weights as Record<string, number>,
      bands: config.bands as ScoringConfig['bands'],
      negative: config.negative as ScoringConfig['negative'],
      enrichment: config.enrichment as Record<string, any>,
      version: config.version
    }));
  } catch (error) {
    app.log.error('Failed to get scoring config history:', error);
    return [];
  }
}

/**
 * Validate scoring configuration
 */
export function validateScoringConfig(config: Partial<ScoringConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate weights
  if (config.weights) {
    for (const [field, weight] of Object.entries(config.weights)) {
      if (typeof weight !== 'number' || weight < 0) {
        errors.push(`Invalid weight for field '${field}': must be a positive number`);
      }
    }
  }

  // Validate bands
  if (config.bands) {
    const { low, medium, high } = config.bands;
    
    if (!low || !medium || !high) {
      errors.push('All score bands (low, medium, high) must be defined');
    } else {
      if (low.min >= low.max || medium.min >= medium.max || high.min >= high.max) {
        errors.push('Band minimums must be less than maximums');
      }
      
      if (low.max >= medium.min || medium.max >= high.min) {
        errors.push('Score bands must not overlap');
      }
    }
  }

  // Validate negative rules
  if (config.negative) {
    for (const rule of config.negative) {
      if (!rule.field || !rule.op || rule.penalty === undefined) {
        errors.push('Negative rules must have field, op, and penalty defined');
      }
      if (rule.penalty < 0) {
        errors.push('Penalty values must be positive numbers');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate scoring rule
 */
export function validateScoringRule(rule: Partial<ScoringRule>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule.type || !['IF_THEN', 'WEIGHT'].includes(rule.type)) {
    errors.push('Rule type must be either IF_THEN or WEIGHT');
  }

  if (rule.type === 'IF_THEN') {
    if (!rule.definition?.if || !Array.isArray(rule.definition.if)) {
      errors.push('IF_THEN rules must have an "if" condition array');
    }
    if (!rule.definition?.then) {
      errors.push('IF_THEN rules must have a "then" action');
    }
  }

  if (rule.type === 'WEIGHT') {
    if (!rule.definition?.field || !rule.definition?.weight) {
      errors.push('WEIGHT rules must have field and weight defined');
    }
  }

  if (rule.order !== undefined && (rule.order < 0 || !Number.isInteger(rule.order))) {
    errors.push('Rule order must be a non-negative integer');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
