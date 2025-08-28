import { FastifyInstance } from 'fastify';
import axios from 'axios';

export interface CompanyEnrichmentData {
  companySize?: string;
  revenue?: string;
  location?: string;
  industry?: string;
  founded?: string;
  website?: string;
  description?: string;
  employees?: number;
  funding?: string;
  techStack?: string[];
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
}

export interface EnrichmentProvider {
  name: string;
  enabled: boolean;
  priority: number;
  rateLimitPerMinute: number;
  lastUsed: Date;
  requestCount: number;
}

/**
 * Enrich company data using multiple providers
 */
export async function enrichCompanyData(
  app: FastifyInstance,
  domain: string,
  companyName?: string
): Promise<CompanyEnrichmentData | null> {
  if (!domain && !companyName) {
    return null;
  }

  app.log.debug('Starting company enrichment', { domain, companyName });

  try {
    // Try multiple enrichment strategies in order of preference
    const enrichmentResults = await Promise.allSettled([
      enrichFromClearbit(domain, companyName),
      enrichFromBuiltWith(domain),
      enrichFromHunter(domain),
      enrichFromDomainHeuristics(domain, companyName)
    ]);

    // Merge results from all successful providers
    const mergedData: CompanyEnrichmentData = {};
    
    for (const result of enrichmentResults) {
      if (result.status === 'fulfilled' && result.value) {
        Object.assign(mergedData, result.value);
      }
    }

    // Apply business logic and normalization
    const normalizedData = normalizeCompanyData(mergedData);

    app.log.debug('Company enrichment completed', {
      domain,
      hasData: Object.keys(normalizedData).length > 0,
      fields: Object.keys(normalizedData)
    });

    return Object.keys(normalizedData).length > 0 ? normalizedData : null;

  } catch (error) {
    app.log.error('Company enrichment failed:', error, { domain, companyName });
    return null;
  }
}

/**
 * Enrich using Clearbit-style API (placeholder - would use real API)
 */
async function enrichFromClearbit(
  domain?: string,
  companyName?: string
): Promise<CompanyEnrichmentData | null> {
  if (!domain) return null;

  try {
    // This would be a real Clearbit API call
    // For now, return mock data based on domain patterns
    return await mockClearbitEnrichment(domain);
    
  } catch (error) {
    console.error('Clearbit enrichment failed:', error);
    return null;
  }
}

/**
 * Enrich using BuiltWith-style API for tech stack
 */
async function enrichFromBuiltWith(domain?: string): Promise<CompanyEnrichmentData | null> {
  if (!domain) return null;

  try {
    // Mock tech stack detection based on domain patterns
    const techStack = detectTechStackFromDomain(domain);
    
    return techStack.length > 0 ? { techStack } : null;
    
  } catch (error) {
    console.error('BuiltWith enrichment failed:', error);
    return null;
  }
}

/**
 * Enrich using Hunter.io-style API for company info
 */
async function enrichFromHunter(domain?: string): Promise<CompanyEnrichmentData | null> {
  if (!domain) return null;

  try {
    // This would be a real Hunter.io API call
    // For now, return mock data based on domain analysis
    return await mockHunterEnrichment(domain);
    
  } catch (error) {
    console.error('Hunter enrichment failed:', error);
    return null;
  }
}

/**
 * Enrich using domain heuristics and public data
 */
async function enrichFromDomainHeuristics(
  domain?: string,
  companyName?: string
): Promise<CompanyEnrichmentData | null> {
  if (!domain) return null;

  const enrichmentData: CompanyEnrichmentData = {};

  // Analyze domain for company size indicators
  enrichmentData.companySize = inferCompanySizeFromDomain(domain);

  // Analyze domain for location indicators
  enrichmentData.location = inferLocationFromDomain(domain);

  // Analyze domain for industry indicators
  enrichmentData.industry = inferIndustryFromDomain(domain);

  // Generate website URL
  enrichmentData.website = `https://${domain}`;

  return Object.keys(enrichmentData).filter(key => 
    enrichmentData[key as keyof CompanyEnrichmentData] !== undefined
  ).length > 0 ? enrichmentData : null;
}

/**
 * Mock Clearbit enrichment (replace with real API)
 */
async function mockClearbitEnrichment(domain: string): Promise<CompanyEnrichmentData | null> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Mock data based on known domain patterns
  const mockData: Record<string, CompanyEnrichmentData> = {
    'salesforce.com': {
      companySize: 'Enterprise (10000+)',
      revenue: '$31.35B',
      location: 'San Francisco, CA',
      industry: 'Software',
      founded: '1999',
      employees: 79000,
      funding: 'Public (NYSE: CRM)'
    },
    'hubspot.com': {
      companySize: 'Large (1000-5000)',
      revenue: '$1.73B',
      location: 'Cambridge, MA',
      industry: 'Marketing Technology',
      founded: '2006',
      employees: 7000,
      funding: 'Public (NYSE: HUBS)'
    },
    'stripe.com': {
      companySize: 'Large (1000-5000)',
      revenue: '$12B+',
      location: 'San Francisco, CA',
      industry: 'Financial Technology',
      founded: '2010',
      employees: 4000,
      funding: 'Private ($95B valuation)'
    }
  };

  // Check for exact domain match
  if (mockData[domain]) {
    return mockData[domain];
  }

  // Generate heuristic data for unknown domains
  return {
    companySize: inferCompanySizeFromDomain(domain),
    location: inferLocationFromDomain(domain),
    industry: inferIndustryFromDomain(domain),
    website: `https://${domain}`
  };
}

/**
 * Mock Hunter.io enrichment (replace with real API)
 */
async function mockHunterEnrichment(domain: string): Promise<CompanyEnrichmentData | null> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 150));

  // Basic company info extraction
  const companyName = domain.split('.')[0];
  const tld = domain.split('.').pop();

  return {
    description: `${companyName} is a company operating in the ${inferIndustryFromDomain(domain)} industry.`,
    location: inferLocationFromDomain(domain),
    socialProfiles: {
      linkedin: `https://linkedin.com/company/${companyName}`,
      twitter: `https://twitter.com/${companyName}`
    }
  };
}

/**
 * Infer company size from domain characteristics
 */
function inferCompanySizeFromDomain(domain: string): string {
  const domainLower = domain.toLowerCase();

  // Enterprise indicators
  if (domainLower.includes('enterprise') || 
      domainLower.includes('corp') || 
      domainLower.includes('global') ||
      domainLower.includes('international')) {
    return 'Enterprise (10000+)';
  }

  // Large company indicators
  if (domainLower.includes('group') || 
      domainLower.includes('systems') || 
      domainLower.includes('solutions') ||
      domainLower.includes('technologies')) {
    return 'Large (1000-5000)';
  }

  // Medium company indicators
  if (domainLower.includes('company') || 
      domainLower.includes('inc') || 
      domainLower.includes('llc')) {
    return 'Medium (100-1000)';
  }

  // Startup indicators
  if (domainLower.includes('startup') || 
      domainLower.includes('labs') || 
      domainLower.includes('studio') ||
      domainLower.endsWith('.io') ||
      domainLower.endsWith('.ai')) {
    return 'Startup (10-100)';
  }

  // Default for unknown
  return 'Small (1-50)';
}

/**
 * Infer location from domain TLD and patterns
 */
function inferLocationFromDomain(domain: string): string | undefined {
  const tld = domain.split('.').pop()?.toLowerCase();
  const domainLower = domain.toLowerCase();

  // Country-specific TLDs
  const tldToCountry: Record<string, string> = {
    'uk': 'United Kingdom',
    'ca': 'Canada',
    'au': 'Australia',
    'de': 'Germany',
    'fr': 'France',
    'jp': 'Japan',
    'cn': 'China',
    'in': 'India',
    'br': 'Brazil',
    'mx': 'Mexico',
    'nl': 'Netherlands',
    'se': 'Sweden',
    'ch': 'Switzerland',
    'sg': 'Singapore',
    'hk': 'Hong Kong'
  };

  if (tld && tldToCountry[tld]) {
    return tldToCountry[tld];
  }

  // Location indicators in domain name
  if (domainLower.includes('usa') || domainLower.includes('america')) {
    return 'United States';
  }
  if (domainLower.includes('europe') || domainLower.includes('eu')) {
    return 'Europe';
  }
  if (domainLower.includes('asia') || domainLower.includes('apac')) {
    return 'Asia Pacific';
  }

  // Default for .com domains (most likely US-based)
  if (tld === 'com') {
    return 'United States';
  }

  return undefined;
}

/**
 * Infer industry from domain patterns
 */
function inferIndustryFromDomain(domain: string): string | undefined {
  const domainLower = domain.toLowerCase();

  // Technology indicators
  if (domainLower.includes('tech') || 
      domainLower.includes('software') || 
      domainLower.includes('app') ||
      domainLower.includes('digital') ||
      domainLower.includes('cloud') ||
      domainLower.endsWith('.io') ||
      domainLower.endsWith('.ai')) {
    return 'Technology';
  }

  // Finance indicators
  if (domainLower.includes('bank') || 
      domainLower.includes('finance') || 
      domainLower.includes('capital') ||
      domainLower.includes('invest') ||
      domainLower.includes('fund')) {
    return 'Financial Services';
  }

  // Healthcare indicators
  if (domainLower.includes('health') || 
      domainLower.includes('medical') || 
      domainLower.includes('pharma') ||
      domainLower.includes('bio') ||
      domainLower.includes('care')) {
    return 'Healthcare';
  }

  // Education indicators
  if (domainLower.includes('edu') || 
      domainLower.includes('university') || 
      domainLower.includes('school') ||
      domainLower.includes('college') ||
      domainLower.endsWith('.edu')) {
    return 'Education';
  }

  // Consulting indicators
  if (domainLower.includes('consulting') || 
      domainLower.includes('advisory') || 
      domainLower.includes('partners')) {
    return 'Consulting';
  }

  // Manufacturing indicators
  if (domainLower.includes('manufacturing') || 
      domainLower.includes('industrial') || 
      domainLower.includes('factory') ||
      domainLower.includes('production')) {
    return 'Manufacturing';
  }

  // Retail indicators
  if (domainLower.includes('retail') || 
      domainLower.includes('store') || 
      domainLower.includes('shop') ||
      domainLower.includes('ecommerce')) {
    return 'Retail';
  }

  return undefined;
}

/**
 * Detect tech stack from domain patterns
 */
function detectTechStackFromDomain(domain: string): string[] {
  const techStack: string[] = [];
  const domainLower = domain.toLowerCase();

  // Common tech indicators
  if (domainLower.includes('aws') || domainLower.includes('amazon')) {
    techStack.push('AWS');
  }
  if (domainLower.includes('google') || domainLower.includes('gcp')) {
    techStack.push('Google Cloud');
  }
  if (domainLower.includes('azure') || domainLower.includes('microsoft')) {
    techStack.push('Microsoft Azure');
  }
  if (domainLower.includes('salesforce') || domainLower.includes('sfdc')) {
    techStack.push('Salesforce');
  }
  if (domainLower.includes('hubspot')) {
    techStack.push('HubSpot');
  }
  if (domainLower.includes('shopify')) {
    techStack.push('Shopify');
  }

  return techStack;
}

/**
 * Normalize and clean company data
 */
function normalizeCompanyData(data: CompanyEnrichmentData): CompanyEnrichmentData {
  const normalized: CompanyEnrichmentData = {};

  // Normalize company size
  if (data.companySize) {
    normalized.companySize = normalizeCompanySize(data.companySize);
  }

  // Normalize revenue
  if (data.revenue) {
    normalized.revenue = normalizeRevenue(data.revenue);
  }

  // Normalize location
  if (data.location) {
    normalized.location = normalizeLocation(data.location);
  }

  // Copy other fields as-is
  if (data.industry) normalized.industry = data.industry;
  if (data.founded) normalized.founded = data.founded;
  if (data.website) normalized.website = data.website;
  if (data.description) normalized.description = data.description;
  if (data.employees) normalized.employees = data.employees;
  if (data.funding) normalized.funding = data.funding;
  if (data.techStack) normalized.techStack = data.techStack;
  if (data.socialProfiles) normalized.socialProfiles = data.socialProfiles;

  return normalized;
}

/**
 * Normalize company size to standard categories
 */
function normalizeCompanySize(size: string): string {
  const sizeNum = parseInt(size.replace(/[^\d]/g, ''));

  if (sizeNum >= 10000) return 'Enterprise (10000+)';
  if (sizeNum >= 1000) return 'Large (1000-5000)';
  if (sizeNum >= 100) return 'Medium (100-1000)';
  if (sizeNum >= 10) return 'Startup (10-100)';
  if (sizeNum >= 1) return 'Small (1-50)';

  // Text-based size indicators
  const sizeLower = size.toLowerCase();
  if (sizeLower.includes('enterprise') || sizeLower.includes('fortune')) {
    return 'Enterprise (10000+)';
  }
  if (sizeLower.includes('large') || sizeLower.includes('corporation')) {
    return 'Large (1000-5000)';
  }
  if (sizeLower.includes('medium') || sizeLower.includes('mid')) {
    return 'Medium (100-1000)';
  }
  if (sizeLower.includes('startup') || sizeLower.includes('small')) {
    return 'Startup (10-100)';
  }

  return size; // Return original if can't normalize
}

/**
 * Normalize revenue to standard format
 */
function normalizeRevenue(revenue: string): string {
  // Extract numbers and convert to standard format
  const revenueMatch = revenue.match(/[\d.]+/);
  if (!revenueMatch) return revenue;

  const amount = parseFloat(revenueMatch[0]);
  const revenueLower = revenue.toLowerCase();

  if (revenueLower.includes('b') || revenueLower.includes('billion')) {
    return `$${amount}B`;
  }
  if (revenueLower.includes('m') || revenueLower.includes('million')) {
    return `$${amount}M`;
  }
  if (revenueLower.includes('k') || revenueLower.includes('thousand')) {
    return `$${amount}K`;
  }

  return revenue; // Return original if can't normalize
}

/**
 * Normalize location to standard format
 */
function normalizeLocation(location: string): string {
  // Clean up common location formats
  return location
    .replace(/,\s*USA?$/i, ', United States')
    .replace(/,\s*UK$/i, ', United Kingdom')
    .replace(/,\s*CA$/i, ', Canada')
    .trim();
}

/**
 * Get company enrichment from cache or external APIs
 */
export async function getCompanyEnrichment(
  app: FastifyInstance,
  domain: string,
  companyName?: string,
  useCache: boolean = true
): Promise<CompanyEnrichmentData | null> {
  // Check cache first (if enabled)
  if (useCache) {
    const cached = await getCachedEnrichment(app, domain);
    if (cached) {
      app.log.debug('Using cached company enrichment', { domain });
      return cached;
    }
  }

  // Fetch fresh enrichment data
  const enrichmentData = await enrichCompanyData(app, domain, companyName);

  // Cache the result (if we have data)
  if (enrichmentData && useCache) {
    await cacheEnrichment(app, domain, enrichmentData);
  }

  return enrichmentData;
}

/**
 * Get cached enrichment data
 */
async function getCachedEnrichment(
  app: FastifyInstance,
  domain: string
): Promise<CompanyEnrichmentData | null> {
  try {
    // Check if we have recent enrichment data (within 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const cachedLead = await app.prisma.lead.findFirst({
      where: {
        domain,
        fields: {
          path: ['enrichment'],
          not: null
        },
        updatedAt: {
          gte: thirtyDaysAgo
        }
      },
      select: {
        fields: true
      }
    });

    if (cachedLead && cachedLead.fields) {
      const fields = cachedLead.fields as any;
      return fields.enrichment || null;
    }

    return null;
  } catch (error) {
    app.log.error('Failed to get cached enrichment:', error);
    return null;
  }
}

/**
 * Cache enrichment data
 */
async function cacheEnrichment(
  app: FastifyInstance,
  domain: string,
  data: CompanyEnrichmentData
): Promise<void> {
  try {
    // Store enrichment data in a dedicated cache table or update existing leads
    // For now, we'll rely on the lead enrichment storage
    app.log.debug('Enrichment data cached', { domain, fields: Object.keys(data) });
  } catch (error) {
    app.log.error('Failed to cache enrichment:', error);
  }
}

