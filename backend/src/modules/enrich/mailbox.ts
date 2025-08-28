import { FastifyInstance } from 'fastify';

export interface MailboxAnalysis {
  isFreeMailbox: boolean;
  provider?: string;
  businessDomain?: boolean;
  disposableEmail?: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}

/**
 * Comprehensive list of free email providers
 */
const FREE_EMAIL_DOMAINS = new Set([
  // Major providers
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'live.com', 'msn.com',
  
  // International providers
  'yandex.com', 'yandex.ru', 'mail.ru', 'rambler.ru', 'ya.ru',
  'qq.com', '163.com', '126.com', 'sina.com', 'sohu.com',
  'naver.com', 'daum.net', 'hanmail.net', 'nate.com',
  'web.de', 'gmx.de', 'gmx.com', 't-online.de', 'freenet.de',
  'orange.fr', 'laposte.net', 'free.fr', 'sfr.fr', 'wanadoo.fr',
  'libero.it', 'virgilio.it', 'alice.it', 'tin.it',
  'terra.com.br', 'bol.com.br', 'ig.com.br', 'r7.com',
  'yahoo.co.uk', 'btinternet.com', 'sky.com', 'virgin.net',
  'bigpond.com', 'optusnet.com.au', 'telstra.com',
  
  // Privacy-focused providers
  'protonmail.com', 'proton.me', 'tutanota.com', 'tutamail.com',
  'mailfence.com', 'hushmail.com', 'countermail.com',
  'startmail.com', 'runbox.com', 'posteo.de', 'mailbox.org',
  
  // Temporary/disposable providers
  '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
  'tempmail.org', 'throwaway.email', 'getnada.com',
  'maildrop.cc', 'temp-mail.org', 'fakemailgenerator.com',
  '33mail.com', 'spamgourmet.com', 'sneakemail.com',
  
  // Regional providers
  'rediffmail.com', 'sify.com', 'indiatimes.com', // India
  'seznam.cz', 'centrum.cz', 'email.cz', // Czech Republic
  'onet.pl', 'wp.pl', 'interia.pl', 'o2.pl', // Poland
  'freemail.hu', 'citromail.hu', 'indamail.hu', // Hungary
  'abv.bg', 'mail.bg', 'dir.bg', // Bulgaria
  'inbox.lv', 'apollo.lv', 'one.lv', // Latvia
  'delfi.ee', 'hot.ee', 'mail.ee', // Estonia
  'mail.lt', 'takas.lt', 'zebra.lt', // Lithuania
  
  // Other common providers
  'zoho.com', 'zohomail.com', 'mail.com', 'email.com',
  'fastmail.com', 'fastmail.fm', 'hey.com', 'superhuman.com',
  'cock.li', 'aaathats3as.com', 'horsefucker.org'
]);

/**
 * Domains that are known to be disposable/temporary
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
  'tempmail.org', 'throwaway.email', 'getnada.com',
  'maildrop.cc', 'temp-mail.org', 'fakemailgenerator.com',
  '33mail.com', 'spamgourmet.com', 'sneakemail.com',
  'yopmail.com', 'sharklasers.com', 'grr.la',
  'dispostable.com', 'tempail.com', 'minuteinbox.com',
  'emailondeck.com', 'mohmal.com', 'mytrashmail.com'
]);

/**
 * Business email indicators (domains that suggest business use)
 */
const BUSINESS_INDICATORS = [
  // Generic business terms
  'corp', 'inc', 'llc', 'ltd', 'company', 'group', 'enterprise',
  'solutions', 'systems', 'technologies', 'tech', 'software',
  'consulting', 'services', 'partners', 'global', 'international',
  
  // Industry-specific terms
  'bank', 'finance', 'capital', 'invest', 'fund', 'insurance',
  'health', 'medical', 'pharma', 'bio', 'care', 'hospital',
  'law', 'legal', 'attorney', 'firm', 'associates',
  'real', 'estate', 'property', 'development', 'construction',
  'manufacturing', 'industrial', 'factory', 'production',
  'retail', 'store', 'shop', 'market', 'trade',
  'media', 'news', 'publishing', 'broadcast', 'digital',
  'education', 'school', 'university', 'college', 'academy'
];

/**
 * Analyze email domain to determine mailbox type and risk
 */
export function analyzeMailbox(email: string): MailboxAnalysis {
  if (!email || !email.includes('@')) {
    return {
      isFreeMailbox: true,
      riskLevel: 'high',
      confidence: 1.0,
      disposableEmail: false
    };
  }

  const domain = email.split('@')[1].toLowerCase();
  const analysis: MailboxAnalysis = {
    isFreeMailbox: false,
    businessDomain: false,
    disposableEmail: false,
    riskLevel: 'low',
    confidence: 0.8
  };

  // Check if it's a free email provider
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    analysis.isFreeMailbox = true;
    analysis.provider = getProviderName(domain);
    analysis.riskLevel = 'medium';
    analysis.confidence = 0.95;
  }

  // Check if it's a disposable email
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    analysis.disposableEmail = true;
    analysis.isFreeMailbox = true;
    analysis.riskLevel = 'high';
    analysis.confidence = 0.99;
  }

  // Check if it looks like a business domain
  if (!analysis.isFreeMailbox) {
    analysis.businessDomain = isBusinessDomain(domain);
    analysis.riskLevel = analysis.businessDomain ? 'low' : 'medium';
    analysis.confidence = analysis.businessDomain ? 0.9 : 0.7;
  }

  // Additional risk factors
  if (hasSuspiciousPatterns(email)) {
    analysis.riskLevel = 'high';
    analysis.confidence = Math.max(0.8, analysis.confidence);
  }

  return analysis;
}

/**
 * Get provider name for known free email domains
 */
function getProviderName(domain: string): string {
  const providerMap: Record<string, string> = {
    'gmail.com': 'Gmail',
    'yahoo.com': 'Yahoo',
    'hotmail.com': 'Hotmail',
    'outlook.com': 'Outlook',
    'aol.com': 'AOL',
    'icloud.com': 'iCloud',
    'me.com': 'iCloud',
    'mac.com': 'iCloud',
    'live.com': 'Microsoft Live',
    'msn.com': 'MSN',
    'yandex.com': 'Yandex',
    'mail.ru': 'Mail.ru',
    'qq.com': 'QQ Mail',
    'protonmail.com': 'ProtonMail',
    'proton.me': 'Proton',
    'tutanota.com': 'Tutanota',
    'zoho.com': 'Zoho',
    'fastmail.com': 'FastMail',
    'hey.com': 'Hey'
  };

  return providerMap[domain] || 'Unknown Provider';
}

/**
 * Check if domain appears to be a business domain
 */
function isBusinessDomain(domain: string): boolean {
  const domainLower = domain.toLowerCase();

  // Check for business indicators in domain name
  for (const indicator of BUSINESS_INDICATORS) {
    if (domainLower.includes(indicator)) {
      return true;
    }
  }

  // Check TLD patterns (business TLDs are more likely to be business)
  const tld = domain.split('.').pop();
  const businessTlds = ['com', 'org', 'net', 'biz', 'info', 'co'];
  
  if (!businessTlds.includes(tld || '')) {
    // Country-specific TLDs might indicate business
    const countryTlds = ['uk', 'ca', 'au', 'de', 'fr', 'jp', 'sg'];
    if (countryTlds.includes(tld || '')) {
      return true;
    }
  }

  // Check domain structure (subdomains might indicate business)
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Subdomains like mail.company.com, email.company.com
    const subdomain = parts[0];
    if (['mail', 'email', 'smtp', 'mx'].includes(subdomain)) {
      return true;
    }
  }

  // Domain length heuristic (very short domains are often businesses)
  const domainName = domain.split('.')[0];
  if (domainName.length <= 6 && !FREE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  return false;
}

/**
 * Check for suspicious email patterns
 */
function hasSuspiciousPatterns(email: string): boolean {
  const emailLower = email.toLowerCase();
  const localPart = emailLower.split('@')[0];

  // Suspicious patterns in local part
  const suspiciousPatterns = [
    /^test/,           // test emails
    /^temp/,           // temporary emails
    /^fake/,           // fake emails
    /^spam/,           // spam emails
    /^no-?reply/,      // no-reply emails
    /^admin/,          // generic admin emails
    /^info/,           // generic info emails
    /\d{8,}/,          // long number sequences
    /^[a-z]{1,2}$/,    // very short local parts
    /^.{30,}/          // very long local parts
  ];

  return suspiciousPatterns.some(pattern => pattern.test(localPart));
}

/**
 * Analyze email deliverability and reputation
 */
export function analyzeEmailDeliverability(email: string): {
  deliverable: boolean;
  riskScore: number;
  issues: string[];
} {
  const issues: string[] = [];
  let riskScore = 0;
  const mailboxAnalysis = analyzeMailbox(email);

  // Risk factors
  if (mailboxAnalysis.disposableEmail) {
    issues.push('Disposable email address');
    riskScore += 50;
  }

  if (mailboxAnalysis.isFreeMailbox) {
    issues.push('Free email provider');
    riskScore += 20;
  }

  if (hasSuspiciousPatterns(email)) {
    issues.push('Suspicious email pattern');
    riskScore += 30;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    issues.push('Invalid email format');
    riskScore += 40;
  }

  // Check for common typos in domains
  const domain = email.split('@')[1];
  const commonTypos = checkForDomainTypos(domain);
  if (commonTypos.length > 0) {
    issues.push(`Possible domain typo: ${commonTypos.join(', ')}`);
    riskScore += 25;
  }

  return {
    deliverable: riskScore < 70,
    riskScore: Math.min(100, riskScore),
    issues
  };
}

/**
 * Check for common domain typos
 */
function checkForDomainTypos(domain: string): string[] {
  const commonDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'company.com', 'business.com', 'enterprise.com'
  ];

  const suggestions: string[] = [];
  
  for (const commonDomain of commonDomains) {
    if (calculateLevenshteinDistance(domain, commonDomain) <= 2 && domain !== commonDomain) {
      suggestions.push(commonDomain);
    }
  }

  return suggestions;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Get custom free domains from team settings
 */
export async function getCustomFreeDomains(
  app: FastifyInstance,
  teamId: string
): Promise<Set<string>> {
  try {
    // Get team-specific free domain overrides
    const team = await app.prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true }
    });

    const settings = team?.settings as any;
    const customFreeDomains = settings?.enrichment?.customFreeDomains || [];

    return new Set(customFreeDomains.map((domain: string) => domain.toLowerCase()));

  } catch (error) {
    app.log.error('Failed to get custom free domains:', error);
    return new Set();
  }
}

/**
 * Check if email is from a free mailbox provider
 */
export async function isFreeMailbox(
  app: FastifyInstance,
  email: string,
  teamId: string
): Promise<boolean> {
  if (!email || !email.includes('@')) {
    return true; // Invalid emails are considered "free" (risky)
  }

  const domain = email.split('@')[1].toLowerCase();

  // Check standard free domains
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  // Check team-specific custom free domains
  const customFreeDomains = await getCustomFreeDomains(app, teamId);
  if (customFreeDomains.has(domain)) {
    return true;
  }

  return false;
}

/**
 * Enhanced mailbox analysis with team settings
 */
export async function analyzeMailboxWithTeamSettings(
  app: FastifyInstance,
  email: string,
  teamId: string
): Promise<MailboxAnalysis> {
  const baseAnalysis = analyzeMailbox(email);
  
  // Check team-specific settings
  const customFreeDomains = await getCustomFreeDomains(app, teamId);
  const domain = email.split('@')[1]?.toLowerCase();

  if (domain && customFreeDomains.has(domain)) {
    baseAnalysis.isFreeMailbox = true;
    baseAnalysis.provider = 'Custom Free Domain';
    baseAnalysis.riskLevel = 'medium';
    baseAnalysis.confidence = 0.9;
  }

  return baseAnalysis;
}

/**
 * Get mailbox provider category
 */
export function getMailboxCategory(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) return 'invalid';
  
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return 'disposable';
  }
  
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return 'free';
  }
  
  if (isBusinessDomain(domain)) {
    return 'business';
  }
  
  return 'unknown';
}

/**
 * Calculate email quality score (0-100)
 */
export function calculateEmailQualityScore(email: string): number {
  let score = 100;
  const analysis = analyzeMailbox(email);

  // Deduct points for risk factors
  if (analysis.disposableEmail) {
    score -= 60; // Major penalty for disposable emails
  } else if (analysis.isFreeMailbox) {
    score -= 30; // Moderate penalty for free emails
  }

  if (hasSuspiciousPatterns(email)) {
    score -= 25; // Penalty for suspicious patterns
  }

  // Bonus points for business domains
  if (analysis.businessDomain) {
    score += 10;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    score -= 40; // Major penalty for invalid format
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Batch analyze multiple emails
 */
export async function batchAnalyzeMailboxes(
  app: FastifyInstance,
  emails: string[],
  teamId: string
): Promise<Map<string, MailboxAnalysis>> {
  const results = new Map<string, MailboxAnalysis>();
  
  // Get team settings once for all emails
  const customFreeDomains = await getCustomFreeDomains(app, teamId);
  
  for (const email of emails) {
    const analysis = analyzeMailbox(email);
    
    // Apply team-specific overrides
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && customFreeDomains.has(domain)) {
      analysis.isFreeMailbox = true;
      analysis.provider = 'Custom Free Domain';
      analysis.riskLevel = 'medium';
    }
    
    results.set(email, analysis);
  }
  
  return results;
}

