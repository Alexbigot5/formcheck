import { FastifyInstance } from 'fastify';
import { enrichCompanyData, getCompanyEnrichment, CompanyEnrichmentData } from './company';
import { analyzeMailboxWithTeamSettings, isFreeMailbox, MailboxAnalysis, calculateEmailQualityScore } from './mailbox';
import { analyzeCompanyRelationship, CompetitorAnalysis } from './competitor';

export interface EnrichedLeadData {
  companySize?: string;
  revenue?: string;
  location?: string;
  industry?: string;
  isFreeMailbox?: boolean;
  isCompetitor?: boolean;
  emailQuality?: number;
  relationship?: 'competitor' | 'partner' | 'vendor' | 'prospect' | 'unknown';
  riskLevel?: 'low' | 'medium' | 'high';
  enrichmentSources?: string[];
  enrichedAt?: string;
}

export interface LeadToEnrich {
  email?: string;
  domain?: string;
  company?: string;
  name?: string;
  fields?: Record<string, any>;
}

/**
 * Main enrichment function that combines all enrichment modules
 */
export async function enrichLead(
  app: FastifyInstance,
  lead: LeadToEnrich,
  teamId: string
): Promise<LeadToEnrich & { fields: { enrichment: EnrichedLeadData } }> {
  app.log.debug('Starting lead enrichment', {
    email: lead.email,
    domain: lead.domain,
    company: lead.company,
    teamId
  });

  const enrichmentData: EnrichedLeadData = {
    enrichmentSources: [],
    enrichedAt: new Date().toISOString()
  };

  try {
    // Parallel enrichment operations for better performance
    const [
      companyData,
      mailboxAnalysis,
      relationshipAnalysis
    ] = await Promise.allSettled([
      // Company enrichment
      lead.domain ? getCompanyEnrichment(app, lead.domain, lead.company) : null,
      
      // Mailbox analysis
      lead.email ? analyzeMailboxWithTeamSettings(app, lead.email, teamId) : null,
      
      // Competitor/relationship analysis
      analyzeCompanyRelationship(app, lead.email, lead.domain, lead.company, teamId)
    ]);

    // Process company enrichment results
    if (companyData.status === 'fulfilled' && companyData.value) {
      const company = companyData.value;
      enrichmentData.companySize = company.companySize;
      enrichmentData.revenue = company.revenue;
      enrichmentData.location = company.location;
      enrichmentData.industry = company.industry;
      enrichmentData.enrichmentSources?.push('company_api');

      app.log.debug('Company enrichment completed', {
        domain: lead.domain,
        companySize: company.companySize,
        revenue: company.revenue,
        location: company.location
      });
    }

    // Process mailbox analysis results
    if (mailboxAnalysis.status === 'fulfilled' && mailboxAnalysis.value) {
      const mailbox = mailboxAnalysis.value;
      enrichmentData.isFreeMailbox = mailbox.isFreeMailbox;
      enrichmentData.emailQuality = lead.email ? calculateEmailQualityScore(lead.email) : undefined;
      enrichmentData.enrichmentSources?.push('mailbox_analysis');

      app.log.debug('Mailbox analysis completed', {
        email: lead.email,
        isFreeMailbox: mailbox.isFreeMailbox,
        provider: mailbox.provider,
        riskLevel: mailbox.riskLevel
      });
    }

    // Process relationship analysis results
    if (relationshipAnalysis.status === 'fulfilled' && relationshipAnalysis.value) {
      const relationship = relationshipAnalysis.value;
      enrichmentData.isCompetitor = relationship.competitor.isCompetitor;
      enrichmentData.relationship = relationship.relationship;
      enrichmentData.riskLevel = relationship.riskLevel;
      enrichmentData.enrichmentSources?.push('relationship_analysis');

      app.log.debug('Relationship analysis completed', {
        email: lead.email,
        domain: lead.domain,
        isCompetitor: relationship.competitor.isCompetitor,
        relationship: relationship.relationship,
        riskLevel: relationship.riskLevel
      });

      // Log competitor detection
      if (relationship.competitor.isCompetitor) {
        app.log.warn('Competitor lead detected', {
          competitorName: relationship.competitor.competitorName,
          type: relationship.competitor.competitorType,
          confidence: relationship.competitor.confidence,
          matchedOn: relationship.competitor.matchedOn
        });
      }
    }

    // Merge enrichment data into lead fields
    const enrichedLead = {
      ...lead,
      fields: {
        ...lead.fields,
        enrichment: enrichmentData
      }
    };

    app.log.info('Lead enrichment completed', {
      email: lead.email,
      enrichmentSources: enrichmentData.enrichmentSources,
      companySize: enrichmentData.companySize,
      isFreeMailbox: enrichmentData.isFreeMailbox,
      isCompetitor: enrichmentData.isCompetitor,
      relationship: enrichmentData.relationship
    });

    return enrichedLead;

  } catch (error) {
    app.log.error('Lead enrichment failed:', error, {
      email: lead.email,
      domain: lead.domain
    });

    // Return lead with minimal enrichment data on error
    return {
      ...lead,
      fields: {
        ...lead.fields,
        enrichment: {
          enrichmentSources: ['error'],
          enrichedAt: new Date().toISOString(),
          riskLevel: 'medium'
        }
      }
    };
  }
}

/**
 * Batch enrich multiple leads
 */
export async function batchEnrichLeads(
  app: FastifyInstance,
  leads: LeadToEnrich[],
  teamId: string
): Promise<Array<LeadToEnrich & { fields: { enrichment: EnrichedLeadData } }>> {
  app.log.info(`Starting batch enrichment for ${leads.length} leads`, { teamId });

  const enrichedLeads: Array<LeadToEnrich & { fields: { enrichment: EnrichedLeadData } }> = [];

  // Process leads in batches to avoid overwhelming external APIs
  const batchSize = 10;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    
    const batchPromises = batch.map(lead => 
      enrichLead(app, lead, teamId).catch(error => {
        app.log.error('Failed to enrich lead in batch:', error, { lead });
        return {
          ...lead,
          fields: {
            ...lead.fields,
            enrichment: {
              enrichmentSources: ['batch_error'],
              enrichedAt: new Date().toISOString(),
              riskLevel: 'medium' as const
            }
          }
        };
      })
    );

    const batchResults = await Promise.all(batchPromises);
    enrichedLeads.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + batchSize < leads.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  app.log.info(`Batch enrichment completed: ${enrichedLeads.length} leads processed`, { teamId });

  return enrichedLeads;
}

/**
 * Get enrichment statistics for team
 */
export async function getEnrichmentStats(
  app: FastifyInstance,
  teamId: string,
  days: number = 30
): Promise<{
  totalEnriched: number;
  enrichmentRate: number;
  sourceBreakdown: Record<string, number>;
  qualityMetrics: {
    averageEmailQuality: number;
    freeMailboxRate: number;
    competitorRate: number;
    businessDomainRate: number;
  };
}> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalLeads, enrichedLeads] = await Promise.all([
      app.prisma.lead.count({
        where: { teamId, createdAt: { gte: startDate } }
      }),
      app.prisma.lead.findMany({
        where: {
          teamId,
          createdAt: { gte: startDate },
          fields: {
            path: ['enrichment'],
            not: null
          }
        },
        select: { fields: true }
      })
    ]);

    const sourceBreakdown: Record<string, number> = {};
    let totalEmailQuality = 0;
    let freeMailboxCount = 0;
    let competitorCount = 0;
    let businessDomainCount = 0;
    let emailQualityCount = 0;

    for (const lead of enrichedLeads) {
      const enrichment = (lead.fields as any)?.enrichment;
      
      if (enrichment?.enrichmentSources) {
        for (const source of enrichment.enrichmentSources) {
          sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
        }
      }

      if (enrichment?.emailQuality !== undefined) {
        totalEmailQuality += enrichment.emailQuality;
        emailQualityCount++;
      }

      if (enrichment?.isFreeMailbox) {
        freeMailboxCount++;
      }

      if (enrichment?.isCompetitor) {
        competitorCount++;
      }

      if (enrichment?.relationship === 'prospect' && !enrichment?.isFreeMailbox) {
        businessDomainCount++;
      }
    }

    return {
      totalEnriched: enrichedLeads.length,
      enrichmentRate: totalLeads > 0 ? enrichedLeads.length / totalLeads : 0,
      sourceBreakdown,
      qualityMetrics: {
        averageEmailQuality: emailQualityCount > 0 ? totalEmailQuality / emailQualityCount : 0,
        freeMailboxRate: enrichedLeads.length > 0 ? freeMailboxCount / enrichedLeads.length : 0,
        competitorRate: enrichedLeads.length > 0 ? competitorCount / enrichedLeads.length : 0,
        businessDomainRate: enrichedLeads.length > 0 ? businessDomainCount / enrichedLeads.length : 0
      }
    };

  } catch (error) {
    app.log.error('Failed to get enrichment stats:', error);
    return {
      totalEnriched: 0,
      enrichmentRate: 0,
      sourceBreakdown: {},
      qualityMetrics: {
        averageEmailQuality: 0,
        freeMailboxRate: 0,
        competitorRate: 0,
        businessDomainRate: 0
      }
    };
  }
}

// Re-export all enrichment functionality
export { enrichCompanyData, getCompanyEnrichment } from './company';
export { analyzeMailbox, isFreeMailbox, getMailboxCategory } from './mailbox';
export { 
  analyzeCompetitor, 
  getCompetitorConfig, 
  updateCompetitorConfig,
  addCompetitor,
  removeCompetitor,
  isPartnerCompany,
  isVendorCompany,
  analyzeCompanyRelationship,
  getCompetitorStats
} from './competitor';
export { registerEnrichmentRoutes } from './routes';

// Re-export types
export type { CompanyEnrichmentData } from './company';
export type { MailboxAnalysis } from './mailbox';
export type { CompetitorAnalysis, CompetitorConfig, CompetitorEntry } from './competitor';
export type { EnrichedLeadData, LeadToEnrich };
