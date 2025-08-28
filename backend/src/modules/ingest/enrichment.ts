import { FastifyInstance } from 'fastify';
import { NormalizedLead } from './normalizer.js';
import { enrichLead as enrichLeadData } from '../enrich/index.js';

export interface EnrichedLead extends NormalizedLead {
  enrichment?: {
    companyData?: {
      industry?: string;
      size?: string;
      revenue?: string;
      founded?: number;
      employees?: number;
      technologies?: string[];
    };
    contactData?: {
      jobLevel?: string;
      department?: string;
      role?: string;
      seniority?: string;
    };
    geolocation?: {
      country?: string;
      region?: string;
      city?: string;
      timezone?: string;
    };
    socialProfiles?: {
      linkedin?: string;
      twitter?: string;
      github?: string;
    };
    enrichmentSource?: string;
    enrichedAt?: string;
    confidence?: number;
  };
}

/**
 * Enrich lead data with additional information
 * This is a wrapper that maintains backward compatibility while using the new enrichment module
 */
export async function enrichLead(
  app: FastifyInstance,
  lead: NormalizedLead,
  teamId: string
): Promise<EnrichedLead> {
  try {
    app.log.debug('Starting lead enrichment (compatibility wrapper)', { 
      email: lead.email, 
      company: lead.company 
    });

    // Use the new comprehensive enrichment module
    const enrichedLead = await enrichLeadData(app, lead, teamId);
    
    // Convert to the expected format for backward compatibility
    const enrichmentData = enrichedLead.fields?.enrichment;
    
    if (enrichmentData) {
      const compatibleEnrichment = {
        companyData: {
          industry: enrichmentData.industry,
          size: enrichmentData.companySize,
          revenue: enrichmentData.revenue,
          location: enrichmentData.location
        },
        contactData: {
          emailQuality: enrichmentData.emailQuality,
          isFreeMailbox: enrichmentData.isFreeMailbox
        },
        geolocation: {
          location: enrichmentData.location
        },
        socialProfiles: {
          relationship: enrichmentData.relationship,
          isCompetitor: enrichmentData.isCompetitor
        },
        enrichmentSource: 'smartforms_ai_v2',
        enrichedAt: enrichmentData.enrichedAt || new Date().toISOString(),
        confidence: 85 // High confidence for new enrichment system
      };

      const result: EnrichedLead = {
        ...enrichedLead,
        enrichment: compatibleEnrichment
      };

      // Update lead fields with enriched data
      updateLeadFieldsWithEnrichment(result);

      app.log.debug('Lead enrichment completed', { 
        email: lead.email,
        enrichmentSources: enrichmentData.enrichmentSources,
        companySize: enrichmentData.companySize,
        isFreeMailbox: enrichmentData.isFreeMailbox,
        isCompetitor: enrichmentData.isCompetitor
      });

      return result;
    }

    return lead;

  } catch (error) {
    app.log.error('Lead enrichment failed:', error);
    
    // Return original lead on enrichment failure
    return {
      ...lead,
      enrichment: {
        enrichmentSource: 'error',
        enrichedAt: new Date().toISOString(),
        confidence: 0
      }
    };
  }
}

/**
 * Get enrichment configuration for team
 */
async function getEnrichmentConfig(
  app: FastifyInstance,
  teamId: string
): Promise<{
  enabled: boolean;
  providers: string[];
  companyEnrichment: boolean;
  contactEnrichment: boolean;
  geolocationEnrichment: boolean;
  socialEnrichment: boolean;
}> {
  try {
    // In a real implementation, this would come from database
    // For now, return default configuration
    return {
      enabled: true,
      providers: ['clearbit', 'hunter', 'fullcontact'],
      companyEnrichment: true,
      contactEnrichment: true,
      geolocationEnrichment: true,
      socialEnrichment: false // Disabled by default for privacy
    };
  } catch (error) {
    app.log.error('Failed to get enrichment config:', error);
    return {
      enabled: false,
      providers: [],
      companyEnrichment: false,
      contactEnrichment: false,
      geolocationEnrichment: false,
      socialEnrichment: false
    };
  }
}

/**
 * Enrich company data using various providers
 */
async function enrichCompanyData(
  app: FastifyInstance,
  companyName?: string,
  domain?: string,
  config?: any
): Promise<any> {
  if (!config.companyEnrichment) return null;

  try {
    // Mock enrichment - in production, integrate with real providers
    const mockData = generateMockCompanyData(companyName, domain);
    
    app.log.debug('Company enrichment completed', { 
      company: companyName,
      domain,
      enrichedFields: Object.keys(mockData)
    });

    return mockData;
  } catch (error) {
    app.log.error('Company enrichment failed:', error);
    return null;
  }
}

/**
 * Enrich contact data
 */
async function enrichContactData(
  app: FastifyInstance,
  email?: string,
  name?: string,
  companyData?: any,
  config?: any
): Promise<any> {
  if (!config.contactEnrichment) return null;

  try {
    // Mock enrichment - in production, integrate with real providers
    const mockData = generateMockContactData(email, name, companyData);
    
    app.log.debug('Contact enrichment completed', { 
      email,
      name,
      enrichedFields: Object.keys(mockData)
    });

    return mockData;
  } catch (error) {
    app.log.error('Contact enrichment failed:', error);
    return null;
  }
}

/**
 * Enrich geolocation data from IP
 */
async function enrichGeolocationData(
  app: FastifyInstance,
  ip: string,
  config?: any
): Promise<any> {
  if (!config.geolocationEnrichment) return null;

  try {
    // Mock enrichment - in production, use IP geolocation service
    const mockData = generateMockGeolocationData(ip);
    
    app.log.debug('Geolocation enrichment completed', { 
      ip,
      location: `${mockData.city}, ${mockData.country}`
    });

    return mockData;
  } catch (error) {
    app.log.error('Geolocation enrichment failed:', error);
    return null;
  }
}

/**
 * Enrich social profiles
 */
async function enrichSocialProfiles(
  app: FastifyInstance,
  email?: string,
  name?: string,
  company?: string,
  config?: any
): Promise<any> {
  if (!config.socialEnrichment) return null;

  try {
    // Mock enrichment - in production, integrate with social APIs
    const mockData = generateMockSocialProfiles(email, name, company);
    
    app.log.debug('Social enrichment completed', { 
      email,
      profiles: Object.keys(mockData)
    });

    return mockData;
  } catch (error) {
    app.log.error('Social enrichment failed:', error);
    return null;
  }
}

/**
 * Update lead fields with enriched data
 */
function updateLeadFieldsWithEnrichment(lead: EnrichedLead): void {
  if (!lead.enrichment) return;

  // Update company info
  if (lead.enrichment.companyData) {
    const company = lead.enrichment.companyData;
    if (company.industry && !lead.fields.industry) {
      lead.fields.industry = company.industry;
    }
    if (company.employees && !lead.fields.employees) {
      lead.fields.employees = company.employees;
    }
    if (company.revenue && !lead.fields.revenue) {
      lead.fields.revenue = company.revenue;
    }
  }

  // Update contact info
  if (lead.enrichment.contactData) {
    const contact = lead.enrichment.contactData;
    if (contact.jobLevel && !lead.fields.jobLevel) {
      lead.fields.jobLevel = contact.jobLevel;
    }
    if (contact.department && !lead.fields.department) {
      lead.fields.department = contact.department;
    }
    if (contact.seniority && !lead.fields.seniority) {
      lead.fields.seniority = contact.seniority;
    }
  }

  // Update location info
  if (lead.enrichment.geolocation) {
    const geo = lead.enrichment.geolocation;
    if (geo.country && !lead.fields.country) {
      lead.fields.country = geo.country;
    }
    if (geo.timezone && !lead.fields.timezone) {
      lead.fields.timezone = geo.timezone;
    }
  }
}

/**
 * Calculate enrichment confidence score
 */
function calculateEnrichmentConfidence(enrichment: any): number {
  let score = 0;
  let maxScore = 0;

  // Company data confidence
  if (enrichment.companyData) {
    maxScore += 40;
    const company = enrichment.companyData;
    if (company.industry) score += 10;
    if (company.employees) score += 10;
    if (company.revenue) score += 10;
    if (company.technologies) score += 10;
  }

  // Contact data confidence
  if (enrichment.contactData) {
    maxScore += 30;
    const contact = enrichment.contactData;
    if (contact.jobLevel) score += 10;
    if (contact.department) score += 10;
    if (contact.seniority) score += 10;
  }

  // Geolocation confidence
  if (enrichment.geolocation) {
    maxScore += 20;
    const geo = enrichment.geolocation;
    if (geo.country) score += 10;
    if (geo.city) score += 10;
  }

  // Social profiles confidence
  if (enrichment.socialProfiles) {
    maxScore += 10;
    const social = enrichment.socialProfiles;
    if (social.linkedin) score += 5;
    if (social.twitter) score += 3;
    if (social.github) score += 2;
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// Mock data generators for demonstration
function generateMockCompanyData(companyName?: string, domain?: string): any {
  const industries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'];
  const sizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
  
  return {
    name: companyName,
    domain: domain,
    industry: industries[Math.floor(Math.random() * industries.length)],
    size: sizes[Math.floor(Math.random() * sizes.length)],
    employees: Math.floor(Math.random() * 1000) + 10,
    revenue: `$${Math.floor(Math.random() * 100)}M`,
    founded: 2000 + Math.floor(Math.random() * 23),
    technologies: ['React', 'Node.js', 'AWS', 'Salesforce'].slice(0, Math.floor(Math.random() * 3) + 1)
  };
}

function generateMockContactData(email?: string, name?: string, companyData?: any): any {
  const jobLevels = ['Individual Contributor', 'Manager', 'Director', 'VP', 'C-Level'];
  const departments = ['Engineering', 'Sales', 'Marketing', 'Operations', 'Finance'];
  const seniorities = ['Junior', 'Mid-Level', 'Senior', 'Principal', 'Executive'];
  
  return {
    jobLevel: jobLevels[Math.floor(Math.random() * jobLevels.length)],
    department: departments[Math.floor(Math.random() * departments.length)],
    role: name ? `${name.split(' ')[0]}'s Role` : 'Unknown Role',
    seniority: seniorities[Math.floor(Math.random() * seniorities.length)]
  };
}

function generateMockGeolocationData(ip: string): any {
  const locations = [
    { country: 'United States', region: 'California', city: 'San Francisco', timezone: 'America/Los_Angeles' },
    { country: 'United Kingdom', region: 'England', city: 'London', timezone: 'Europe/London' },
    { country: 'Germany', region: 'Berlin', city: 'Berlin', timezone: 'Europe/Berlin' },
    { country: 'Canada', region: 'Ontario', city: 'Toronto', timezone: 'America/Toronto' }
  ];
  
  return locations[Math.floor(Math.random() * locations.length)];
}

function generateMockSocialProfiles(email?: string, name?: string, company?: string): any {
  const profiles: any = {};
  
  if (Math.random() > 0.5) {
    profiles.linkedin = `https://linkedin.com/in/${name?.toLowerCase().replace(' ', '-') || 'unknown'}`;
  }
  
  if (Math.random() > 0.7) {
    profiles.twitter = `https://twitter.com/${name?.toLowerCase().replace(' ', '') || 'unknown'}`;
  }
  
  if (Math.random() > 0.8) {
    profiles.github = `https://github.com/${name?.toLowerCase().replace(' ', '') || 'unknown'}`;
  }
  
  return Object.keys(profiles).length > 0 ? profiles : null;
}
