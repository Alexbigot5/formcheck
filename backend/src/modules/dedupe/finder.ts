import { FastifyInstance } from 'fastify';
import { buildKeys, calculateNameSimilarity, type Lead, type DedupeKeys } from './keys';

export interface DedupePolicy {
  // Matching strategies
  emailExact: boolean;           // Exact email match
  domainFuzzy: boolean;          // Same domain + similar name
  nameFuzzy: boolean;            // Fuzzy name matching
  
  // Thresholds
  nameSimilarityThreshold: number;  // 0.0 - 1.0, minimum similarity for name match
  domainNameThreshold: number;      // 0.0 - 1.0, minimum similarity for domain+name match
  
  // Time windows
  timeWindowHours?: number;      // Only check leads within this time window
  
  // Priority rules
  prioritizeRecent: boolean;     // Prefer more recent leads as primary
  prioritizeHighScore: boolean;  // Prefer higher scored leads as primary
}

export const DEFAULT_DEDUPE_POLICY: DedupePolicy = {
  emailExact: true,
  domainFuzzy: true,
  nameFuzzy: true,
  nameSimilarityThreshold: 0.8,
  domainNameThreshold: 0.7,
  timeWindowHours: 24 * 7, // 7 days
  prioritizeRecent: false,
  prioritizeHighScore: true
};

export interface DuplicateMatch {
  leadId: string;
  matchType: 'email_exact' | 'domain_fuzzy' | 'name_fuzzy';
  confidence: number; // 0.0 - 1.0
  matchedKeys: string[];
}

/**
 * Find potential duplicate leads based on deduplication policy
 */
export async function findDuplicate(
  app: FastifyInstance,
  lead: Lead,
  teamId: string,
  policy: DedupePolicy = DEFAULT_DEDUPE_POLICY
): Promise<string | null> {
  const keys = buildKeys(lead);
  const matches: DuplicateMatch[] = [];

  // Build time window filter
  const timeFilter = policy.timeWindowHours
    ? {
        createdAt: {
          gte: new Date(Date.now() - policy.timeWindowHours * 60 * 60 * 1000)
        }
      }
    : {};

  try {
    // 1. Exact email match (highest priority)
    if (policy.emailExact && keys.emailHash) {
      const emailMatches = await findByEmailHash(app, keys.emailHash, teamId, timeFilter);
      matches.push(...emailMatches.map(match => ({
        leadId: match.leadId,
        matchType: 'email_exact' as const,
        confidence: 1.0,
        matchedKeys: ['email']
      })));
    }

    // 2. Domain + fuzzy name match
    if (policy.domainFuzzy && keys.domain && keys.nameKey) {
      const domainMatches = await findByDomainAndName(
        app, 
        keys.domain, 
        keys.nameKey, 
        teamId, 
        timeFilter,
        policy.domainNameThreshold
      );
      matches.push(...domainMatches);
    }

    // 3. Fuzzy name match (lowest priority)
    if (policy.nameFuzzy && keys.nameKey) {
      const nameMatches = await findByFuzzyName(
        app,
        keys.nameKey,
        teamId,
        timeFilter,
        policy.nameSimilarityThreshold
      );
      matches.push(...nameMatches);
    }

    // Select best match based on confidence and policy
    if (matches.length === 0) {
      return null;
    }

    const bestMatch = selectBestMatch(matches, policy);
    return bestMatch?.leadId || null;

  } catch (error) {
    app.log.error('Duplicate finding failed:', error);
    throw new Error('Duplicate detection failed');
  }
}

/**
 * Find leads by exact email hash match
 */
async function findByEmailHash(
  app: FastifyInstance,
  emailHash: string,
  teamId: string,
  timeFilter: any
): Promise<Array<{ leadId: string }>> {
  const dedupeKeys = await app.prisma.leadDedupeKey.findMany({
    where: {
      emailHash,
      lead: {
        teamId,
        ...timeFilter
      }
    },
    select: {
      leadId: true
    }
  });

  return dedupeKeys;
}

/**
 * Find leads by domain and fuzzy name match
 */
async function findByDomainAndName(
  app: FastifyInstance,
  domain: string,
  nameKey: string,
  teamId: string,
  timeFilter: any,
  threshold: number
): Promise<DuplicateMatch[]> {
  const dedupeKeys = await app.prisma.leadDedupeKey.findMany({
    where: {
      domain,
      lead: {
        teamId,
        ...timeFilter
      }
    },
    select: {
      leadId: true,
      nameKey: true
    }
  });

  const matches: DuplicateMatch[] = [];

  for (const key of dedupeKeys) {
    if (key.nameKey) {
      const similarity = calculateNameSimilarity(nameKey, key.nameKey);
      if (similarity >= threshold) {
        matches.push({
          leadId: key.leadId,
          matchType: 'domain_fuzzy',
          confidence: similarity,
          matchedKeys: ['domain', 'name']
        });
      }
    }
  }

  return matches;
}

/**
 * Find leads by fuzzy name match
 */
async function findByFuzzyName(
  app: FastifyInstance,
  nameKey: string,
  teamId: string,
  timeFilter: any,
  threshold: number
): Promise<DuplicateMatch[]> {
  const dedupeKeys = await app.prisma.leadDedupeKey.findMany({
    where: {
      nameKey: {
        not: null
      },
      lead: {
        teamId,
        ...timeFilter
      }
    },
    select: {
      leadId: true,
      nameKey: true
    },
    take: 100 // Limit for performance
  });

  const matches: DuplicateMatch[] = [];

  for (const key of dedupeKeys) {
    if (key.nameKey) {
      const similarity = calculateNameSimilarity(nameKey, key.nameKey);
      if (similarity >= threshold) {
        matches.push({
          leadId: key.leadId,
          matchType: 'name_fuzzy',
          confidence: similarity,
          matchedKeys: ['name']
        });
      }
    }
  }

  return matches;
}

/**
 * Select the best match from multiple candidates
 */
function selectBestMatch(matches: DuplicateMatch[], policy: DedupePolicy): DuplicateMatch | null {
  if (matches.length === 0) return null;

  // Sort by match type priority, then confidence
  const priorityOrder = {
    'email_exact': 3,
    'domain_fuzzy': 2,
    'name_fuzzy': 1
  };

  return matches.sort((a, b) => {
    // First, sort by match type priority
    const priorityDiff = priorityOrder[b.matchType] - priorityOrder[a.matchType];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by confidence
    return b.confidence - a.confidence;
  })[0];
}

/**
 * Get detailed duplicate analysis for debugging
 */
export async function analyzeDuplicates(
  app: FastifyInstance,
  lead: Lead,
  teamId: string,
  policy: DedupePolicy = DEFAULT_DEDUPE_POLICY
): Promise<{
  keys: DedupeKeys;
  matches: DuplicateMatch[];
  recommendation: string | null;
}> {
  const keys = buildKeys(lead);
  const matches: DuplicateMatch[] = [];

  // Run all matching strategies
  if (keys.emailHash) {
    const emailMatches = await findByEmailHash(app, keys.emailHash, teamId, {});
    matches.push(...emailMatches.map(match => ({
      leadId: match.leadId,
      matchType: 'email_exact' as const,
      confidence: 1.0,
      matchedKeys: ['email']
    })));
  }

  if (keys.domain && keys.nameKey) {
    const domainMatches = await findByDomainAndName(
      app, 
      keys.domain, 
      keys.nameKey, 
      teamId, 
      {},
      policy.domainNameThreshold
    );
    matches.push(...domainMatches);
  }

  if (keys.nameKey) {
    const nameMatches = await findByFuzzyName(
      app,
      keys.nameKey,
      teamId,
      {},
      policy.nameSimilarityThreshold
    );
    matches.push(...nameMatches);
  }

  const bestMatch = selectBestMatch(matches, policy);

  return {
    keys,
    matches,
    recommendation: bestMatch?.leadId || null
  };
}
