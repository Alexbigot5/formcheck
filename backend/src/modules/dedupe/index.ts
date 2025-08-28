import { FastifyInstance } from 'fastify';
import { buildKeys, validateKeys, type Lead, type DedupeKeys } from './keys.js';
import { findDuplicate, analyzeDuplicates, type DedupePolicy, DEFAULT_DEDUPE_POLICY } from './finder.js';
import { mergeLeads, selectPrimaryLead, previewMerge, type MergeStrategy, DEFAULT_MERGE_STRATEGY, type MergeResult } from './merger.js';

export interface DedupeResult {
  action: 'created' | 'merged' | 'skipped';
  leadId: string;
  duplicateId?: string;
  mergeResult?: MergeResult;
  keys: DedupeKeys;
}

export interface DedupeOptions {
  policy?: DedupePolicy;
  mergeStrategy?: MergeStrategy;
  skipMerge?: boolean; // If true, only detect but don't merge
}

/**
 * Main deduplication function - run before inserting new leads
 */
export async function deduplicateLead(
  app: FastifyInstance,
  lead: Lead,
  teamId: string,
  options: DedupeOptions = {}
): Promise<DedupeResult> {
  const {
    policy = DEFAULT_DEDUPE_POLICY,
    mergeStrategy = DEFAULT_MERGE_STRATEGY,
    skipMerge = false
  } = options;

  try {
    // Build deduplication keys
    const keys = buildKeys(lead);
    
    if (!validateKeys(keys)) {
      app.log.warn('Lead has insufficient data for deduplication', { lead });
    }

    // Find potential duplicate
    const duplicateId = await findDuplicate(app, lead, teamId, policy);
    
    if (!duplicateId) {
      // No duplicate found - create new lead
      const newLead = await createLeadWithKeys(app, lead, teamId, keys);
      
      await logDedupeDecision(app, {
        action: 'created',
        leadId: newLead.id,
        teamId,
        keys,
        decision: 'no_duplicate_found'
      });

      return {
        action: 'created',
        leadId: newLead.id,
        keys
      };
    }

    if (skipMerge) {
      // Duplicate found but merge skipped
      await logDedupeDecision(app, {
        action: 'skipped',
        leadId: duplicateId,
        teamId,
        keys,
        decision: 'duplicate_found_merge_skipped'
      });

      return {
        action: 'skipped',
        leadId: duplicateId,
        duplicateId,
        keys
      };
    }

    // Create temporary lead to determine merge order
    const tempLead = await createLeadWithKeys(app, lead, teamId, keys);
    
    // Get both leads for comparison
    const [existingLead, newLead] = await Promise.all([
      app.prisma.lead.findUnique({ where: { id: duplicateId } }),
      app.prisma.lead.findUnique({ where: { id: tempLead.id } })
    ]);

    if (!existingLead || !newLead) {
      throw new Error('Failed to retrieve leads for merge comparison');
    }

    // Determine which should be primary
    const { primary, duplicate } = selectPrimaryLead(existingLead, newLead);
    
    // Merge the leads
    const mergeResult = await mergeLeads(
      app,
      primary.id,
      duplicate.id,
      mergeStrategy
    );

    await logDedupeDecision(app, {
      action: 'merged',
      leadId: mergeResult.primaryLeadId,
      teamId,
      keys,
      decision: 'duplicate_found_and_merged',
      mergedLeadId: mergeResult.duplicateLeadId,
      consolidatedMessages: mergeResult.consolidatedMessages,
      consolidatedEvents: mergeResult.consolidatedEvents
    });

    return {
      action: 'merged',
      leadId: mergeResult.primaryLeadId,
      duplicateId: mergeResult.duplicateLeadId,
      mergeResult,
      keys
    };

  } catch (error) {
    app.log.error('Deduplication failed:', error);
    
    // Fallback: create new lead without deduplication
    const newLead = await createLeadWithKeys(app, lead, teamId, keys);
    
    await logDedupeDecision(app, {
      action: 'created',
      leadId: newLead.id,
      teamId,
      keys,
      decision: 'deduplication_failed_fallback',
      error: error.message
    });

    return {
      action: 'created',
      leadId: newLead.id,
      keys
    };
  }
}

/**
 * Create a new lead with deduplication keys
 */
async function createLeadWithKeys(
  app: FastifyInstance,
  lead: Lead,
  teamId: string,
  keys: DedupeKeys
): Promise<any> {
  return await app.prisma.$transaction(async (prisma) => {
    // Create the lead
    const newLead = await prisma.lead.create({
      data: {
        teamId,
        email: lead.email,
        name: lead.name,
        phone: lead.phone,
        company: lead.company,
        domain: lead.domain,
        source: lead.source || 'UNKNOWN',
        fields: lead.fields || {},
        utm: lead.utm || {},
        score: lead.score || 0,
        scoreBand: lead.scoreBand || 'LOW',
        status: lead.status || 'NEW'
      }
    });

    // Create deduplication keys
    if (validateKeys(keys)) {
      await prisma.leadDedupeKey.create({
        data: {
          leadId: newLead.id,
          emailHash: keys.emailHash,
          domain: keys.domain,
          nameKey: keys.nameKey
        }
      });
    }

    return newLead;
  });
}

/**
 * Log deduplication decision for audit trail
 */
async function logDedupeDecision(
  app: FastifyInstance,
  data: {
    action: string;
    leadId: string;
    teamId: string;
    keys: DedupeKeys;
    decision: string;
    mergedLeadId?: string;
    consolidatedMessages?: number;
    consolidatedEvents?: number;
    error?: string;
  }
): Promise<void> {
  try {
    // Log to audit table
    await app.prisma.audit.create({
      data: {
        teamId: data.teamId,
        entityType: 'Lead',
        entityId: data.leadId,
        action: `dedupe_${data.action}`,
        after: {
          decision: data.decision,
          keys: data.keys,
          mergedLeadId: data.mergedLeadId,
          consolidatedMessages: data.consolidatedMessages,
          consolidatedEvents: data.consolidatedEvents,
          error: data.error
        }
      }
    });

    // Log to timeline
    await app.prisma.timelineEvent.create({
      data: {
        leadId: data.leadId,
        type: 'SCORE_UPDATED', // Using existing enum
        payload: {
          action: 'deduplication',
          decision: data.decision,
          keys: data.keys,
          mergedLeadId: data.mergedLeadId,
          consolidatedMessages: data.consolidatedMessages,
          consolidatedEvents: data.consolidatedEvents
        }
      }
    });

    app.log.info('Deduplication decision logged', {
      action: data.action,
      leadId: data.leadId,
      decision: data.decision
    });

  } catch (error) {
    app.log.error('Failed to log deduplication decision:', error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}

// Re-export all the main functions and types
export {
  buildKeys,
  validateKeys,
  findDuplicate,
  analyzeDuplicates,
  mergeLeads,
  selectPrimaryLead,
  previewMerge,
  DEFAULT_DEDUPE_POLICY,
  DEFAULT_MERGE_STRATEGY
};

export type {
  Lead,
  DedupeKeys,
  DedupePolicy,
  MergeStrategy,
  MergeResult
};
