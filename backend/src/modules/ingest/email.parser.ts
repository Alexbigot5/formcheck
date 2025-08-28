import { ParsedMail } from 'mailparser';
import { NormalizedLead } from './normalizer.js';

/**
 * Parse email to extract lead data
 */
export async function parseEmailToLead(
  parsed: ParsedMail,
  teamId: string
): Promise<NormalizedLead | null> {
  try {
    // Extract sender information
    const from = parsed.from?.value?.[0];
    if (!from?.address) {
      return null; // No sender email, can't create lead
    }

    const lead: NormalizedLead = {
      email: from.address,
      name: from.name || extractNameFromEmail(from.address),
      source: 'email_inbox',
      sourceRef: parsed.messageId || undefined,
      fields: {},
      utm: {}
    };

    // Extract company information
    lead.company = extractCompanyFromEmail(from.address, parsed);
    lead.domain = extractDomainFromEmail(from.address);

    // Extract phone number from email content
    lead.phone = extractPhoneFromContent(parsed.text || parsed.html || '');

    // Extract additional information from email content
    const extractedFields = extractFieldsFromContent(
      parsed.subject || '',
      parsed.text || parsed.html || ''
    );
    
    Object.assign(lead.fields, extractedFields);

    // Add email metadata
    lead.fields.emailSubject = parsed.subject;
    lead.fields.emailDate = parsed.date?.toISOString();
    lead.fields.emailMessageId = parsed.messageId;
    lead.fields.hasAttachments = (parsed.attachments?.length || 0) > 0;
    lead.fields.attachmentCount = parsed.attachments?.length || 0;

    // Extract signature information
    const signatureInfo = extractSignatureInfo(parsed.text || parsed.html || '');
    if (signatureInfo) {
      Object.assign(lead.fields, signatureInfo);
    }

    return lead;

  } catch (error) {
    console.error('Failed to parse email to lead:', error);
    return null;
  }
}

/**
 * Extract name from email address if no display name
 */
function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  
  // Handle common patterns like first.last, first_last, firstlast
  let name = localPart
    .replace(/[._-]/g, ' ')
    .replace(/\d+/g, '') // Remove numbers
    .trim();

  // Capitalize words
  name = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return name || localPart;
}

/**
 * Extract company from email address and content
 */
function extractCompanyFromEmail(email: string, parsed: ParsedMail): string | undefined {
  const domain = email.split('@')[1];
  
  // Skip personal email domains
  if (isPersonalEmailDomain(domain)) {
    // Try to extract from signature or content
    return extractCompanyFromContent(parsed.text || parsed.html || '');
  }

  // Convert domain to potential company name
  const companyName = domain
    .split('.')[0] // Remove TLD
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return companyName;
}

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email: string): string {
  return email.split('@')[1];
}

/**
 * Extract company from email content/signature
 */
function extractCompanyFromContent(content: string): string | undefined {
  if (!content) return undefined;

  // Common patterns in email signatures
  const companyPatterns = [
    /(?:^|\n)([A-Z][A-Za-z\s&.,'-]+(?:Inc|LLC|Corp|Corporation|Company|Ltd|Limited|Group|Solutions|Technologies|Systems)\.?)\s*$/gm,
    /(?:^|\n)([A-Z][A-Za-z\s&.,'-]{2,30})\s*\n.*?(?:www\.|http)/gm,
    /\b([A-Z][A-Za-z\s&.,'-]+)\s+(?:Inc|LLC|Corp|Corporation|Company|Ltd|Limited)\b/gi
  ];

  for (const pattern of companyPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }

  return undefined;
}

/**
 * Extract phone number from email content
 */
function extractPhoneFromContent(content: string): string | undefined {
  if (!content) return undefined;

  // Phone number patterns
  const phonePatterns = [
    /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g, // US format
    /\b\+?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}\b/g, // International
    /\b(?:phone|tel|mobile|cell)[:.\s]*([+0-9\s\-\(\)\.]{10,})\b/gi // Labeled phone
  ];

  for (const pattern of phonePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Return the first valid-looking phone number
      const phone = matches[0].replace(/[^\d+]/g, '');
      if (phone.length >= 10) {
        return matches[0].trim();
      }
    }
  }

  return undefined;
}

/**
 * Extract additional fields from email content
 */
function extractFieldsFromContent(subject: string, content: string): Record<string, any> {
  const fields: Record<string, any> = {};

  // Extract job title from signature
  const title = extractJobTitle(content);
  if (title) fields.title = title;

  // Extract website/URL
  const website = extractWebsite(content);
  if (website) fields.website = website;

  // Detect if it's an inquiry or specific type
  fields.emailType = detectEmailType(subject, content);

  // Extract urgency indicators
  fields.urgency = detectUrgency(subject, content);

  // Extract budget mentions
  const budget = extractBudgetMention(content);
  if (budget) fields.budgetMention = budget;

  // Extract timeline mentions
  const timeline = extractTimelineMention(content);
  if (timeline) fields.timeline = timeline;

  // Extract company size indicators
  const companySize = extractCompanySize(content);
  if (companySize) fields.companySize = companySize;

  return fields;
}

/**
 * Extract job title from email signature
 */
function extractJobTitle(content: string): string | undefined {
  const titlePatterns = [
    /(?:^|\n)([A-Z][A-Za-z\s&,-]+(?:Manager|Director|VP|President|CEO|CTO|CFO|COO|Head|Lead|Specialist|Analyst|Coordinator|Executive|Officer))\s*$/gm,
    /(?:^|\n)([A-Z][A-Za-z\s&,-]+)\s*\n.*?(?:@|www\.)/gm
  ];

  for (const pattern of titlePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const title = matches[0].trim();
      if (title.length > 3 && title.length < 50) {
        return title;
      }
    }
  }

  return undefined;
}

/**
 * Extract website from email content
 */
function extractWebsite(content: string): string | undefined {
  const websitePatterns = [
    /https?:\/\/[^\s<>"]+/gi,
    /www\.[^\s<>"]+/gi,
    /\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co)\b/gi
  ];

  for (const pattern of websitePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }

  return undefined;
}

/**
 * Detect email type based on content
 */
function detectEmailType(subject: string, content: string): string {
  const text = (subject + ' ' + content).toLowerCase();

  if (text.includes('inquiry') || text.includes('interested') || text.includes('quote')) {
    return 'inquiry';
  }
  if (text.includes('demo') || text.includes('demonstration')) {
    return 'demo_request';
  }
  if (text.includes('support') || text.includes('help') || text.includes('issue')) {
    return 'support';
  }
  if (text.includes('partnership') || text.includes('collaborate')) {
    return 'partnership';
  }
  if (text.includes('feedback') || text.includes('suggestion')) {
    return 'feedback';
  }

  return 'general';
}

/**
 * Detect urgency indicators
 */
function detectUrgency(subject: string, content: string): string {
  const text = (subject + ' ' + content).toLowerCase();

  if (text.includes('urgent') || text.includes('asap') || text.includes('immediately')) {
    return 'high';
  }
  if (text.includes('soon') || text.includes('quickly') || text.includes('priority')) {
    return 'medium';
  }

  return 'normal';
}

/**
 * Extract budget mentions
 */
function extractBudgetMention(content: string): string | undefined {
  const budgetPatterns = [
    /\$[\d,]+(?:\.\d{2})?/g,
    /budget.*?\$?[\d,]+/gi,
    /[\d,]+\s*(?:dollars?|USD|EUR|GBP)/gi
  ];

  for (const pattern of budgetPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }

  return undefined;
}

/**
 * Extract timeline mentions
 */
function extractTimelineMention(content: string): string | undefined {
  const timelinePatterns = [
    /(?:by|within|in)\s+(\d+\s+(?:days?|weeks?|months?))/gi,
    /(?:next|this)\s+(week|month|quarter|year)/gi,
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/gi
  ];

  for (const pattern of timelinePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }

  return undefined;
}

/**
 * Extract company size indicators
 */
function extractCompanySize(content: string): string | undefined {
  const sizePatterns = [
    /(\d+)\s+employees?/gi,
    /team\s+of\s+(\d+)/gi,
    /(\d+)\s+(?:person|people)\s+(?:company|team|organization)/gi
  ];

  for (const pattern of sizePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }

  return undefined;
}

/**
 * Extract signature information
 */
function extractSignatureInfo(content: string): Record<string, any> | null {
  const info: Record<string, any> = {};

  // Try to find signature block (usually at the end)
  const lines = content.split('\n');
  const signatureStart = findSignatureStart(lines);
  
  if (signatureStart === -1) return null;

  const signatureLines = lines.slice(signatureStart);
  const signatureText = signatureLines.join('\n');

  // Extract various signature elements
  const title = extractJobTitle(signatureText);
  if (title) info.signatureTitle = title;

  const phone = extractPhoneFromContent(signatureText);
  if (phone) info.signaturePhone = phone;

  const website = extractWebsite(signatureText);
  if (website) info.signatureWebsite = website;

  const company = extractCompanyFromContent(signatureText);
  if (company) info.signatureCompany = company;

  return Object.keys(info).length > 0 ? info : null;
}

/**
 * Find where email signature starts
 */
function findSignatureStart(lines: string[]): number {
  // Look for common signature indicators
  const signatureIndicators = [
    /^--\s*$/,
    /^best\s+regards?/i,
    /^sincerely/i,
    /^thanks?/i,
    /^cheers/i
  ];

  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const line = lines[i].trim();
    
    for (const indicator of signatureIndicators) {
      if (indicator.test(line)) {
        return i;
      }
    }
  }

  // Fallback: assume last 5 lines might be signature
  return Math.max(0, lines.length - 5);
}

/**
 * Check if domain is a personal email provider
 */
function isPersonalEmailDomain(domain: string): boolean {
  const personalDomains = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'protonmail.com',
    'mail.com',
    'yandex.com',
    'zoho.com',
    'live.com',
    'msn.com'
  ];

  return personalDomains.includes(domain.toLowerCase());
}
