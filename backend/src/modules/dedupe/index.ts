// Temporary stub for dedupe module to fix Railway deployment
// This bypasses the import issues by providing simple implementations

export interface DedupeResult {
  action: 'created' | 'merged' | 'skipped';
  leadId: string;
  duplicateId?: string;
  keys: any;
}

export interface DedupeOptions {
  skipMerge?: boolean;
}

// Simple placeholder function that just creates leads without deduplication
export async function deduplicateLead(
  app: any,
  lead: any,
  teamId: string,
  options: DedupeOptions = {}
): Promise<DedupeResult> {
  try {
    // For now, just create new leads without deduplication
    const newLead = await app.prisma.lead.create({
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

    return {
      action: 'created',
      leadId: newLead.id,
      keys: {}
    };
  } catch (error) {
    console.error('Failed to create lead:', error);
    throw error;
  }
}

// Export stub functions to maintain compatibility
export const buildKeys = () => ({});
export const validateKeys = () => true;
export const findDuplicate = () => null;
export const analyzeDuplicates = () => [];
export const mergeLeads = () => ({});
export const selectPrimaryLead = () => ({});
export const previewMerge = () => ({});
export const DEFAULT_DEDUPE_POLICY = {};
export const DEFAULT_MERGE_STRATEGY = {};
