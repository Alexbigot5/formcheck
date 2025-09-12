import { FastifyInstance } from 'fastify';
import { Lead } from './keys';

export interface MergeResult {
  primaryLeadId: string;
  duplicateLeadId: string;
  mergedData: any;
  consolidatedMessages: number;
  consolidatedEvents: number;
  finalScore: number;
}

export interface MergeStrategy {
  scoreStrategy: 'highest' | 'latest' | 'sum' | 'average';
  dataStrategy: 'primary' | 'latest' | 'merge_non_null';
  messageStrategy: 'consolidate' | 'keep_primary';
  eventStrategy: 'consolidate' | 'keep_primary';
}

export const DEFAULT_MERGE_STRATEGY: MergeStrategy = {
  scoreStrategy: 'highest',
  dataStrategy: 'merge_non_null',
  messageStrategy: 'consolidate',
  eventStrategy: 'consolidate'
};

/**
 * Merge duplicate leads, consolidating all related data
 */
export async function mergeLeads(
  app: FastifyInstance,
  primaryLeadId: string,
  duplicateLeadId: string,
  strategy: MergeStrategy = DEFAULT_MERGE_STRATEGY
): Promise<MergeResult> {
  
  // Use transaction to ensure data consistency
  return await app.prisma.$transaction(async (prisma) => {
    // Get both leads with all related data
    const [primaryLead, duplicateLead] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: primaryLeadId },
        include: {
          messages: true,
          timelineEvents: true,
          dedupeKeys: true,
          slaClocks: true
        }
      }),
      prisma.lead.findUnique({
        where: { id: duplicateLeadId },
        include: {
          messages: true,
          timelineEvents: true,
          dedupeKeys: true,
          slaClocks: true
        }
      })
    ]);

    if (!primaryLead || !duplicateLead) {
      throw new Error('One or both leads not found');
    }

    // Ensure leads belong to the same team
    if (primaryLead.teamId !== duplicateLead.teamId) {
      throw new Error('Cannot merge leads from different teams');
    }

    // Merge lead data
    const mergedData = mergeLeadData(primaryLead, duplicateLead, strategy);
    const finalScore = calculateFinalScore(primaryLead, duplicateLead, strategy);

    // Update primary lead with merged data
    await prisma.lead.update({
      where: { id: primaryLeadId },
      data: {
        ...mergedData,
        score: finalScore,
        updatedAt: new Date()
      }
    });

    // Consolidate messages
    let consolidatedMessages = 0;
    if (strategy.messageStrategy === 'consolidate' && duplicateLead.messages.length > 0) {
      await prisma.message.updateMany({
        where: { leadId: duplicateLeadId },
        data: { leadId: primaryLeadId }
      });
      consolidatedMessages = duplicateLead.messages.length;
    }

    // Consolidate timeline events
    let consolidatedEvents = 0;
    if (strategy.eventStrategy === 'consolidate' && duplicateLead.timelineEvents.length > 0) {
      await prisma.timelineEvent.updateMany({
        where: { leadId: duplicateLeadId },
        data: { leadId: primaryLeadId }
      });
      consolidatedEvents = duplicateLead.timelineEvents.length;
    }

    // Consolidate SLA clocks
    if (duplicateLead.slaClocks.length > 0) {
      await prisma.sLAClock.updateMany({
        where: { leadId: duplicateLeadId },
        data: { leadId: primaryLeadId }
      });
    }

    // Merge dedupe keys (keep unique ones)
    const existingKeys = primaryLead.dedupeKeys;
    const duplicateKeys = duplicateLead.dedupeKeys;
    
    for (const key of duplicateKeys) {
      const exists = existingKeys.some(existing => 
        existing.emailHash === key.emailHash &&
        existing.domain === key.domain &&
        existing.nameKey === key.nameKey
      );
      
      if (!exists) {
        await prisma.leadDedupeKey.update({
          where: { id: key.id },
          data: { leadId: primaryLeadId }
        });
      }
    }

    // Add merge timeline event to primary lead
    await prisma.timelineEvent.create({
      data: {
        leadId: primaryLeadId,
        type: 'SCORE_UPDATED', // Using existing enum value
        payload: {
          action: 'lead_merged',
          mergedLeadId: duplicateLeadId,
          previousScore: primaryLead.score,
          newScore: finalScore,
          consolidatedMessages,
          consolidatedEvents,
          mergeStrategy: JSON.parse(JSON.stringify(strategy))
        }
      }
    });

    // Delete the duplicate lead (cascade will handle related data)
    await prisma.lead.delete({
      where: { id: duplicateLeadId }
    });

    return {
      primaryLeadId,
      duplicateLeadId,
      mergedData,
      consolidatedMessages,
      consolidatedEvents,
      finalScore
    };
  });
}

/**
 * Merge lead data fields based on strategy
 */
function mergeLeadData(primary: any, duplicate: any, strategy: MergeStrategy): any {
  const merged = { ...primary };

  switch (strategy.dataStrategy) {
    case 'primary':
      // Keep primary lead data as-is
      break;

    case 'latest':
      // Use data from the most recently updated lead
      if (duplicate.updatedAt > primary.updatedAt) {
        Object.assign(merged, {
          email: duplicate.email || primary.email,
          name: duplicate.name || primary.name,
          phone: duplicate.phone || primary.phone,
          company: duplicate.company || primary.company,
          domain: duplicate.domain || primary.domain,
          fields: duplicate.fields,
          utm: duplicate.utm
        });
      }
      break;

    case 'merge_non_null':
      // Merge non-null values, preferring duplicate over primary
      merged.email = duplicate.email || primary.email;
      merged.name = duplicate.name || primary.name;
      merged.phone = duplicate.phone || primary.phone;
      merged.company = duplicate.company || primary.company;
      merged.domain = duplicate.domain || primary.domain;
      merged.externalId = duplicate.externalId || primary.externalId;
      merged.sourceRef = duplicate.sourceRef || primary.sourceRef;
      
      // Merge JSON fields
      merged.fields = mergeJsonFields(primary.fields, duplicate.fields);
      merged.utm = mergeJsonFields(primary.utm, duplicate.utm);
      break;
  }

  return merged;
}

/**
 * Calculate final score based on strategy
 */
function calculateFinalScore(primary: any, duplicate: any, strategy: MergeStrategy): number {
  switch (strategy.scoreStrategy) {
    case 'highest':
      return Math.max(primary.score, duplicate.score);
    
    case 'latest':
      return duplicate.updatedAt > primary.updatedAt ? duplicate.score : primary.score;
    
    case 'sum':
      return primary.score + duplicate.score;
    
    case 'average':
      return Math.round((primary.score + duplicate.score) / 2);
    
    default:
      return Math.max(primary.score, duplicate.score);
  }
}

/**
 * Merge JSON fields, combining non-conflicting data
 */
function mergeJsonFields(primary: any, duplicate: any): any {
  if (!primary && !duplicate) return {};
  if (!primary) return duplicate;
  if (!duplicate) return primary;

  // Deep merge objects
  const merged = { ...primary };
  
  for (const [key, value] of Object.entries(duplicate)) {
    if (value !== null && value !== undefined) {
      if (typeof value === 'object' && !Array.isArray(value) && merged[key]) {
        merged[key] = mergeJsonFields(merged[key], value);
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
}

/**
 * Determine which lead should be primary based on criteria
 */
export function selectPrimaryLead(lead1: any, lead2: any): { primary: any; duplicate: any } {
  // Prefer lead with higher score
  if (lead1.score !== lead2.score) {
    return lead1.score > lead2.score 
      ? { primary: lead1, duplicate: lead2 }
      : { primary: lead2, duplicate: lead1 };
  }

  // Prefer lead with more complete data
  const lead1Completeness = calculateDataCompleteness(lead1);
  const lead2Completeness = calculateDataCompleteness(lead2);
  
  if (lead1Completeness !== lead2Completeness) {
    return lead1Completeness > lead2Completeness
      ? { primary: lead1, duplicate: lead2 }
      : { primary: lead2, duplicate: lead1 };
  }

  // Prefer older lead (first contact)
  return lead1.createdAt < lead2.createdAt
    ? { primary: lead1, duplicate: lead2 }
    : { primary: lead2, duplicate: lead1 };
}

/**
 * Calculate data completeness score for a lead
 */
function calculateDataCompleteness(lead: any): number {
  let score = 0;
  const fields = ['email', 'name', 'phone', 'company', 'domain'];
  
  for (const field of fields) {
    if (lead[field]) score += 1;
  }
  
  // Bonus for rich field data
  if (lead.fields && Object.keys(lead.fields).length > 0) {
    score += Object.keys(lead.fields).length * 0.1;
  }
  
  return score;
}

/**
 * Preview merge operation without executing it
 */
export async function previewMerge(
  app: FastifyInstance,
  primaryLeadId: string,
  duplicateLeadId: string,
  strategy: MergeStrategy = DEFAULT_MERGE_STRATEGY
): Promise<{
  mergedData: any;
  finalScore: number;
  messagesToConsolidate: number;
  eventsToConsolidate: number;
  dataChanges: string[];
}> {
  const [primaryLead, duplicateLead] = await Promise.all([
    app.prisma.lead.findUnique({
      where: { id: primaryLeadId },
      include: {
        messages: { select: { id: true } },
        timelineEvents: { select: { id: true } }
      }
    }),
    app.prisma.lead.findUnique({
      where: { id: duplicateLeadId },
      include: {
        messages: { select: { id: true } },
        timelineEvents: { select: { id: true } }
      }
    })
  ]);

  if (!primaryLead || !duplicateLead) {
    throw new Error('One or both leads not found');
  }

  const mergedData = mergeLeadData(primaryLead, duplicateLead, strategy);
  const finalScore = calculateFinalScore(primaryLead, duplicateLead, strategy);
  
  // Calculate what would change
  const dataChanges: string[] = [];
  const fields = ['email', 'name', 'phone', 'company', 'domain'];
  
  for (const field of fields) {
    if (primaryLead[field] !== mergedData[field]) {
      dataChanges.push(`${field}: "${primaryLead[field]}" → "${mergedData[field]}"`);
    }
  }
  
  if (primaryLead.score !== finalScore) {
    dataChanges.push(`score: ${primaryLead.score} → ${finalScore}`);
  }

  return {
    mergedData,
    finalScore,
    messagesToConsolidate: duplicateLead.messages.length,
    eventsToConsolidate: duplicateLead.timelineEvents.length,
    dataChanges
  };
}
