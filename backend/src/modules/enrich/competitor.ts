import { FastifyInstance } from 'fastify';

export interface CompetitorAnalysis {
  isCompetitor: boolean;
  competitorName?: string;
  competitorType?: 'direct' | 'indirect' | 'partner' | 'vendor';
  confidence: number;
  matchedOn: string[]; // What triggered the match (domain, company name, etc.)
  riskLevel: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface CompetitorConfig {
  competitors: CompetitorEntry[];
  partnerCompanies: string[];
  vendorCompanies: string[];
  autoDetectKeywords: string[];
  enabled: boolean;
}

export interface CompetitorEntry {
  name: string;
  domains: string[];
  keywords: string[];
  type: 'direct' | 'indirect' | 'partner' | 'vendor';
  riskLevel: 'low' | 'medium' | 'high';
  notes?: string;
}

/**
 * Analyze if lead is from a competitor company
 */
export async function analyzeCompetitor(
  app: FastifyInstance,
  email?: string,
  domain?: string,
  companyName?: string,
  teamId?: string
): Promise<CompetitorAnalysis> {
  const analysis: CompetitorAnalysis = {
    isCompetitor: false,
    confidence: 0,
    matchedOn: [],
    riskLevel: 'low'
  };

  if (!teamId) {
    return analysis;
  }

  try {
    // Get team's competitor configuration
    const competitorConfig = await getCompetitorConfig(app, teamId);
    
    if (!competitorConfig.enabled) {
      return analysis;
    }

    app.log.debug('Analyzing competitor status', {
      email,
      domain,
      companyName,
      teamId,
      competitorCount: competitorConfig.competitors.length
    });

    // Check against configured competitors
    for (const competitor of competitorConfig.competitors) {
      const match = checkCompetitorMatch(
        competitor,
        email,
        domain,
        companyName
      );

      if (match.isMatch) {
        analysis.isCompetitor = true;
        analysis.competitorName = competitor.name;
        analysis.competitorType = competitor.type;
        analysis.confidence = Math.max(analysis.confidence, match.confidence);
        analysis.matchedOn.push(...match.matchedOn);
        analysis.riskLevel = competitor.riskLevel;
        analysis.notes = competitor.notes;

        app.log.info('Competitor detected', {
          competitorName: competitor.name,
          matchedOn: match.matchedOn,
          confidence: match.confidence,
          type: competitor.type
        });

        // Return on first match (highest priority competitors should be first)
        break;
      }
    }

    // Auto-detection using keywords (if no direct match found)
    if (!analysis.isCompetitor && competitorConfig.autoDetectKeywords.length > 0) {
      const autoDetected = autoDetectCompetitor(
        competitorConfig.autoDetectKeywords,
        email,
        domain,
        companyName
      );

      if (autoDetected.isMatch) {
        analysis.isCompetitor = true;
        analysis.competitorName = 'Auto-detected Competitor';
        analysis.competitorType = 'indirect';
        analysis.confidence = autoDetected.confidence;
        analysis.matchedOn = autoDetected.matchedOn;
        analysis.riskLevel = 'medium';
        analysis.notes = 'Detected via keyword matching';
      }
    }

    return analysis;

  } catch (error) {
    app.log.error('Competitor analysis failed:', error);
    return analysis;
  }
}

/**
 * Check if lead matches a specific competitor entry
 */
function checkCompetitorMatch(
  competitor: CompetitorEntry,
  email?: string,
  domain?: string,
  companyName?: string
): { isMatch: boolean; confidence: number; matchedOn: string[] } {
  const matchedOn: string[] = [];
  let confidence = 0;

  // Domain matching (highest confidence)
  if (domain && competitor.domains.length > 0) {
    for (const competitorDomain of competitor.domains) {
      if (domain.toLowerCase() === competitorDomain.toLowerCase()) {
        matchedOn.push(`domain: ${domain}`);
        confidence = Math.max(confidence, 0.95);
      } else if (domain.toLowerCase().includes(competitorDomain.toLowerCase()) ||
                 competitorDomain.toLowerCase().includes(domain.toLowerCase())) {
        matchedOn.push(`domain similarity: ${domain} ~ ${competitorDomain}`);
        confidence = Math.max(confidence, 0.8);
      }
    }
  }

  // Company name matching
  if (companyName && competitor.keywords.length > 0) {
    const companyLower = companyName.toLowerCase();
    
    for (const keyword of competitor.keywords) {
      const keywordLower = keyword.toLowerCase();
      
      if (companyLower.includes(keywordLower) || keywordLower.includes(companyLower)) {
        matchedOn.push(`company keyword: ${keyword}`);
        confidence = Math.max(confidence, 0.7);
      }
    }
  }

  // Exact company name match
  if (companyName && companyName.toLowerCase() === competitor.name.toLowerCase()) {
    matchedOn.push(`exact company name: ${companyName}`);
    confidence = Math.max(confidence, 0.9);
  }

  // Email pattern matching
  if (email && competitor.keywords.length > 0) {
    const emailLower = email.toLowerCase();
    
    for (const keyword of competitor.keywords) {
      if (emailLower.includes(keyword.toLowerCase())) {
        matchedOn.push(`email keyword: ${keyword}`);
        confidence = Math.max(confidence, 0.6);
      }
    }
  }

  return {
    isMatch: confidence > 0.5, // Threshold for competitor match
    confidence,
    matchedOn
  };
}

/**
 * Auto-detect competitors using keyword patterns
 */
function autoDetectCompetitor(
  keywords: string[],
  email?: string,
  domain?: string,
  companyName?: string
): { isMatch: boolean; confidence: number; matchedOn: string[] } {
  const matchedOn: string[] = [];
  let confidence = 0;

  const searchText = [email, domain, companyName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    
    if (searchText.includes(keywordLower)) {
      matchedOn.push(`auto-detect keyword: ${keyword}`);
      confidence = Math.max(confidence, 0.6);
    }
  }

  return {
    isMatch: confidence > 0.5,
    confidence,
    matchedOn
  };
}

/**
 * Get competitor configuration for team
 */
export async function getCompetitorConfig(
  app: FastifyInstance,
  teamId: string
): Promise<CompetitorConfig> {
  try {
    const team = await app.prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true }
    });

    const settings = team?.settings as any;
    const competitorSettings = settings?.enrichment?.competitors;

    if (competitorSettings) {
      return competitorSettings;
    }

    // Return default configuration
    return getDefaultCompetitorConfig();

  } catch (error) {
    app.log.error('Failed to get competitor config:', error);
    return getDefaultCompetitorConfig();
  }
}

/**
 * Get default competitor configuration
 */
function getDefaultCompetitorConfig(): CompetitorConfig {
  return {
    competitors: [
      {
        name: 'Typeform',
        domains: ['typeform.com', 'typeform.io'],
        keywords: ['typeform', 'type form'],
        type: 'direct',
        riskLevel: 'high',
        notes: 'Direct form builder competitor'
      },
      {
        name: 'Jotform',
        domains: ['jotform.com', 'jotform.io'],
        keywords: ['jotform', 'jot form'],
        type: 'direct',
        riskLevel: 'high',
        notes: 'Direct form builder competitor'
      },
      {
        name: 'Google Forms',
        domains: ['google.com', 'forms.google.com'],
        keywords: ['google forms', 'google form'],
        type: 'direct',
        riskLevel: 'medium',
        notes: 'Free form builder competitor'
      },
      {
        name: 'Microsoft Forms',
        domains: ['microsoft.com', 'forms.office.com'],
        keywords: ['microsoft forms', 'office forms'],
        type: 'direct',
        riskLevel: 'medium',
        notes: 'Enterprise form builder competitor'
      },
      {
        name: 'Formstack',
        domains: ['formstack.com'],
        keywords: ['formstack', 'form stack'],
        type: 'direct',
        riskLevel: 'high',
        notes: 'Enterprise form builder competitor'
      },
      {
        name: 'Wufoo',
        domains: ['wufoo.com'],
        keywords: ['wufoo'],
        type: 'direct',
        riskLevel: 'medium',
        notes: 'Form builder competitor'
      },
      {
        name: 'Zapier',
        domains: ['zapier.com'],
        keywords: ['zapier'],
        type: 'indirect',
        riskLevel: 'medium',
        notes: 'Workflow automation competitor'
      },
      {
        name: 'HubSpot',
        domains: ['hubspot.com'],
        keywords: ['hubspot', 'hub spot'],
        type: 'indirect',
        riskLevel: 'high',
        notes: 'CRM and marketing automation competitor'
      }
    ],
    partnerCompanies: [
      'salesforce.com',
      'pipedrive.com',
      'zoho.com',
      'freshworks.com'
    ],
    vendorCompanies: [
      'aws.amazon.com',
      'stripe.com',
      'twilio.com',
      'sendgrid.com'
    ],
    autoDetectKeywords: [
      'form builder', 'form creator', 'survey tool',
      'lead capture', 'landing page', 'conversion',
      'automation', 'workflow', 'integration'
    ],
    enabled: true
  };
}

/**
 * Update competitor configuration for team
 */
export async function updateCompetitorConfig(
  app: FastifyInstance,
  teamId: string,
  config: Partial<CompetitorConfig>
): Promise<CompetitorConfig> {
  try {
    const currentTeam = await app.prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true }
    });

    const currentSettings = (currentTeam?.settings as any) || {};
    const currentEnrichment = currentSettings.enrichment || {};
    
    const updatedConfig = {
      ...getDefaultCompetitorConfig(),
      ...currentEnrichment.competitors,
      ...config
    };

    await app.prisma.team.update({
      where: { id: teamId },
      data: {
        settings: {
          ...currentSettings,
          enrichment: {
            ...currentEnrichment,
            competitors: updatedConfig
          }
        }
      }
    });

    app.log.info('Competitor configuration updated', { teamId });
    
    return updatedConfig;

  } catch (error) {
    app.log.error('Failed to update competitor config:', error);
    throw error;
  }
}

/**
 * Add competitor to team configuration
 */
export async function addCompetitor(
  app: FastifyInstance,
  teamId: string,
  competitor: CompetitorEntry
): Promise<void> {
  const currentConfig = await getCompetitorConfig(app, teamId);
  
  // Check if competitor already exists
  const existingIndex = currentConfig.competitors.findIndex(
    c => c.name.toLowerCase() === competitor.name.toLowerCase()
  );

  if (existingIndex >= 0) {
    // Update existing competitor
    currentConfig.competitors[existingIndex] = competitor;
  } else {
    // Add new competitor
    currentConfig.competitors.push(competitor);
  }

  await updateCompetitorConfig(app, teamId, currentConfig);
}

/**
 * Remove competitor from team configuration
 */
export async function removeCompetitor(
  app: FastifyInstance,
  teamId: string,
  competitorName: string
): Promise<void> {
  const currentConfig = await getCompetitorConfig(app, teamId);
  
  currentConfig.competitors = currentConfig.competitors.filter(
    c => c.name.toLowerCase() !== competitorName.toLowerCase()
  );

  await updateCompetitorConfig(app, teamId, currentConfig);
}

/**
 * Check if company/domain is a known partner
 */
export async function isPartnerCompany(
  app: FastifyInstance,
  domain: string,
  teamId: string
): Promise<boolean> {
  try {
    const config = await getCompetitorConfig(app, teamId);
    
    return config.partnerCompanies.some(partner => 
      domain.toLowerCase().includes(partner.toLowerCase()) ||
      partner.toLowerCase().includes(domain.toLowerCase())
    );

  } catch (error) {
    app.log.error('Failed to check partner status:', error);
    return false;
  }
}

/**
 * Check if company/domain is a known vendor
 */
export async function isVendorCompany(
  app: FastifyInstance,
  domain: string,
  teamId: string
): Promise<boolean> {
  try {
    const config = await getCompetitorConfig(app, teamId);
    
    return config.vendorCompanies.some(vendor => 
      domain.toLowerCase().includes(vendor.toLowerCase()) ||
      vendor.toLowerCase().includes(domain.toLowerCase())
    );

  } catch (error) {
    app.log.error('Failed to check vendor status:', error);
    return false;
  }
}

/**
 * Get comprehensive relationship analysis
 */
export async function analyzeCompanyRelationship(
  app: FastifyInstance,
  email?: string,
  domain?: string,
  companyName?: string,
  teamId?: string
): Promise<{
  competitor: CompetitorAnalysis;
  isPartner: boolean;
  isVendor: boolean;
  relationship: 'competitor' | 'partner' | 'vendor' | 'prospect' | 'unknown';
  riskLevel: 'low' | 'medium' | 'high';
}> {
  if (!teamId) {
    return {
      competitor: { isCompetitor: false, confidence: 0, matchedOn: [], riskLevel: 'low' },
      isPartner: false,
      isVendor: false,
      relationship: 'unknown',
      riskLevel: 'low'
    };
  }

  const [competitorAnalysis, isPartner, isVendor] = await Promise.all([
    analyzeCompetitor(app, email, domain, companyName, teamId),
    domain ? isPartnerCompany(app, domain, teamId) : false,
    domain ? isVendorCompany(app, domain, teamId) : false
  ]);

  // Determine primary relationship
  let relationship: 'competitor' | 'partner' | 'vendor' | 'prospect' | 'unknown' = 'prospect';
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  if (competitorAnalysis.isCompetitor) {
    relationship = 'competitor';
    riskLevel = competitorAnalysis.riskLevel;
  } else if (isPartner) {
    relationship = 'partner';
    riskLevel = 'low';
  } else if (isVendor) {
    relationship = 'vendor';
    riskLevel = 'low';
  } else if (!domain || !companyName) {
    relationship = 'unknown';
    riskLevel = 'medium';
  }

  return {
    competitor: competitorAnalysis,
    isPartner,
    isVendor,
    relationship,
    riskLevel
  };
}

/**
 * Bulk analyze multiple leads for competitor status
 */
export async function batchAnalyzeCompetitors(
  app: FastifyInstance,
  leads: Array<{ email?: string; domain?: string; companyName?: string }>,
  teamId: string
): Promise<Map<string, CompetitorAnalysis>> {
  const results = new Map<string, CompetitorAnalysis>();
  
  // Get competitor config once for all leads
  const competitorConfig = await getCompetitorConfig(app, teamId);
  
  if (!competitorConfig.enabled) {
    // Return empty results if competitor detection is disabled
    for (const lead of leads) {
      const key = lead.email || lead.domain || lead.companyName || 'unknown';
      results.set(key, {
        isCompetitor: false,
        confidence: 0,
        matchedOn: [],
        riskLevel: 'low'
      });
    }
    return results;
  }

  // Analyze each lead
  for (const lead of leads) {
    const key = lead.email || lead.domain || lead.companyName || 'unknown';
    
    try {
      const analysis = await analyzeCompetitor(
        app,
        lead.email,
        lead.domain,
        lead.companyName,
        teamId
      );
      
      results.set(key, analysis);
      
    } catch (error) {
      app.log.error('Failed to analyze competitor for lead:', error, { lead });
      results.set(key, {
        isCompetitor: false,
        confidence: 0,
        matchedOn: [],
        riskLevel: 'low'
      });
    }
  }
  
  return results;
}

/**
 * Get competitor statistics for team
 */
export async function getCompetitorStats(
  app: FastifyInstance,
  teamId: string,
  days: number = 30
): Promise<{
  totalCompetitorLeads: number;
  competitorBreakdown: Array<{
    name: string;
    count: number;
    type: string;
    riskLevel: string;
  }>;
  recentTrends: Array<{
    date: string;
    count: number;
  }>;
}> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get leads with competitor analysis
    const leads = await app.prisma.lead.findMany({
      where: {
        teamId,
        createdAt: { gte: startDate },
        fields: {
          path: ['enrichment', 'competitor', 'isCompetitor'],
          equals: true
        }
      },
      select: {
        fields: true,
        createdAt: true
      }
    });

    const competitorBreakdown = new Map<string, any>();
    const dailyCounts = new Map<string, number>();

    for (const lead of leads) {
      const enrichment = (lead.fields as any)?.enrichment;
      const competitor = enrichment?.competitor;

      if (competitor?.isCompetitor) {
        const name = competitor.competitorName || 'Unknown';
        const existing = competitorBreakdown.get(name) || {
          name,
          count: 0,
          type: competitor.competitorType || 'unknown',
          riskLevel: competitor.riskLevel || 'medium'
        };
        
        existing.count++;
        competitorBreakdown.set(name, existing);

        // Track daily counts
        const date = lead.createdAt.toISOString().split('T')[0];
        dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
      }
    }

    return {
      totalCompetitorLeads: leads.length,
      competitorBreakdown: Array.from(competitorBreakdown.values()),
      recentTrends: Array.from(dailyCounts.entries()).map(([date, count]) => ({
        date,
        count
      })).sort((a, b) => a.date.localeCompare(b.date))
    };

  } catch (error) {
    app.log.error('Failed to get competitor stats:', error);
    return {
      totalCompetitorLeads: 0,
      competitorBreakdown: [],
      recentTrends: []
    };
  }
}

