/**
 * Webhook payload normalizer
 * Converts various webhook formats to standardized lead fields
 */

export interface NormalizedLead {
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  domain?: string;
  source: string;
  sourceRef?: string;
  fields: Record<string, any>;
  utm: Record<string, any>;
}

/**
 * Normalize webhook payload to standard lead format
 */
export async function normalizeWebhookPayload(payload: any): Promise<NormalizedLead> {
  const normalized: NormalizedLead = {
    source: payload.source || 'webhook',
    fields: {},
    utm: {}
  };

  // Normalize basic contact fields
  normalized.email = extractEmail(payload);
  normalized.name = extractName(payload);
  normalized.phone = extractPhone(payload);
  normalized.company = extractCompany(payload);
  normalized.domain = extractDomain(payload);

  // Extract source reference
  normalized.sourceRef = payload.submissionId || payload.formId || payload.event;

  // Normalize custom fields
  normalized.fields = extractCustomFields(payload);

  // Normalize UTM parameters
  normalized.utm = extractUtmParameters(payload);

  return normalized;
}

/**
 * Extract email from various payload formats
 */
function extractEmail(payload: any): string | undefined {
  // Direct email field
  if (payload.email) return payload.email;
  
  // Common form field names
  const emailFields = [
    'email_address',
    'emailAddress', 
    'user_email',
    'contact_email',
    'work_email',
    'business_email'
  ];

  for (const field of emailFields) {
    if (payload[field]) return payload[field];
  }

  // Check in nested fields
  if (payload.fields) {
    for (const field of emailFields) {
      if (payload.fields[field]) return payload.fields[field];
    }
    if (payload.fields.email) return payload.fields.email;
  }

  if (payload.customFields) {
    for (const field of emailFields) {
      if (payload.customFields[field]) return payload.customFields[field];
    }
    if (payload.customFields.email) return payload.customFields.email;
  }

  return undefined;
}

/**
 * Extract name from various payload formats
 */
function extractName(payload: any): string | undefined {
  // Direct name field
  if (payload.name) return payload.name;
  
  // Combine first and last name
  if (payload.firstName || payload.lastName) {
    const parts = [];
    if (payload.firstName) parts.push(payload.firstName);
    if (payload.lastName) parts.push(payload.lastName);
    return parts.join(' ');
  }

  // Common name field variations
  const nameFields = [
    'full_name',
    'fullName',
    'contact_name',
    'user_name',
    'customer_name',
    'lead_name'
  ];

  for (const field of nameFields) {
    if (payload[field]) return payload[field];
  }

  // Check in nested fields
  if (payload.fields) {
    // Try combining first/last from fields
    if (payload.fields.firstName || payload.fields.lastName) {
      const parts = [];
      if (payload.fields.firstName) parts.push(payload.fields.firstName);
      if (payload.fields.lastName) parts.push(payload.fields.lastName);
      return parts.join(' ');
    }

    // Try other name variations
    for (const field of nameFields) {
      if (payload.fields[field]) return payload.fields[field];
    }
    if (payload.fields.name) return payload.fields.name;
  }

  if (payload.customFields) {
    for (const field of nameFields) {
      if (payload.customFields[field]) return payload.customFields[field];
    }
    if (payload.customFields.name) return payload.customFields.name;
  }

  return undefined;
}

/**
 * Extract phone from various payload formats
 */
function extractPhone(payload: any): string | undefined {
  // Direct phone field
  if (payload.phone) return payload.phone;
  
  const phoneFields = [
    'phone_number',
    'phoneNumber',
    'mobile',
    'mobile_phone',
    'work_phone',
    'business_phone',
    'contact_phone',
    'telephone'
  ];

  for (const field of phoneFields) {
    if (payload[field]) return payload[field];
  }

  // Check in nested fields
  if (payload.fields) {
    for (const field of phoneFields) {
      if (payload.fields[field]) return payload.fields[field];
    }
    if (payload.fields.phone) return payload.fields.phone;
  }

  if (payload.customFields) {
    for (const field of phoneFields) {
      if (payload.customFields[field]) return payload.customFields[field];
    }
    if (payload.customFields.phone) return payload.customFields.phone;
  }

  return undefined;
}

/**
 * Extract company from various payload formats
 */
function extractCompany(payload: any): string | undefined {
  // Direct company field
  if (payload.company) return payload.company;
  
  const companyFields = [
    'company_name',
    'companyName',
    'organization',
    'business_name',
    'employer',
    'workplace',
    'account_name'
  ];

  for (const field of companyFields) {
    if (payload[field]) return payload[field];
  }

  // Check in nested fields
  if (payload.fields) {
    for (const field of companyFields) {
      if (payload.fields[field]) return payload.fields[field];
    }
    if (payload.fields.company) return payload.fields.company;
  }

  if (payload.customFields) {
    for (const field of companyFields) {
      if (payload.customFields[field]) return payload.customFields[field];
    }
    if (payload.customFields.company) return payload.customFields.company;
  }

  return undefined;
}

/**
 * Extract domain from various sources
 */
function extractDomain(payload: any): string | undefined {
  // Direct domain field
  if (payload.domain) return payload.domain;
  if (payload.website) return cleanDomain(payload.website);
  
  // Extract from email
  const email = extractEmail(payload);
  if (email) {
    const emailDomain = email.split('@')[1];
    if (emailDomain && !isPersonalEmailDomain(emailDomain)) {
      return emailDomain;
    }
  }

  // Check website fields
  const websiteFields = [
    'website',
    'company_website',
    'business_website',
    'url',
    'homepage'
  ];

  for (const field of websiteFields) {
    if (payload[field]) return cleanDomain(payload[field]);
  }

  // Check in nested fields
  if (payload.fields) {
    for (const field of websiteFields) {
      if (payload.fields[field]) return cleanDomain(payload.fields[field]);
    }
  }

  if (payload.customFields) {
    for (const field of websiteFields) {
      if (payload.customFields[field]) return cleanDomain(payload.customFields[field]);
    }
  }

  return undefined;
}

/**
 * Extract custom fields from payload
 */
function extractCustomFields(payload: any): Record<string, any> {
  const fields: Record<string, any> = {};

  // Include direct custom fields
  if (payload.fields) {
    Object.assign(fields, payload.fields);
  }
  
  if (payload.customFields) {
    Object.assign(fields, payload.customFields);
  }

  // Include specific business fields
  const businessFields = [
    'title', 'job_title', 'position', 'role',
    'budget', 'annual_revenue', 'company_size', 'employees',
    'industry', 'department', 'use_case', 'requirements',
    'timeline', 'decision_maker', 'authority',
    'pain_points', 'current_solution', 'goals'
  ];

  for (const field of businessFields) {
    if (payload[field] !== undefined) {
      fields[field] = payload[field];
    }
  }

  // Include form metadata
  if (payload.formId) fields.formId = payload.formId;
  if (payload.formName) fields.formName = payload.formName;
  if (payload.submissionId) fields.submissionId = payload.submissionId;

  // Include technical metadata
  if (payload.ip) fields.ip = payload.ip;
  if (payload.userAgent) fields.userAgent = payload.userAgent;
  if (payload.referrer) fields.referrer = payload.referrer;

  return fields;
}

/**
 * Extract UTM parameters from payload
 */
function extractUtmParameters(payload: any): Record<string, any> {
  const utm: Record<string, any> = {};

  // Direct UTM object
  if (payload.utm && typeof payload.utm === 'object') {
    Object.assign(utm, payload.utm);
  }

  // Individual UTM fields
  const utmFields = [
    'utm_source',
    'utm_medium', 
    'utm_campaign',
    'utm_term',
    'utm_content'
  ];

  for (const field of utmFields) {
    if (payload[field]) {
      const utmKey = field.replace('utm_', '');
      utm[utmKey] = payload[field];
    }
  }

  // Additional tracking parameters
  if (payload.gclid) utm.gclid = payload.gclid;
  if (payload.fbclid) utm.fbclid = payload.fbclid;
  if (payload.referrer) utm.referrer = payload.referrer;

  // Check in nested fields
  if (payload.fields) {
    for (const field of utmFields) {
      if (payload.fields[field]) {
        const utmKey = field.replace('utm_', '');
        utm[utmKey] = payload.fields[field];
      }
    }
  }

  return utm;
}

/**
 * Clean and normalize domain from URL
 */
function cleanDomain(url: string): string {
  if (!url) return '';
  
  // Remove protocol
  let domain = url.replace(/^https?:\/\//, '');
  
  // Remove www
  domain = domain.replace(/^www\./, '');
  
  // Remove path
  domain = domain.split('/')[0];
  
  // Remove port
  domain = domain.split(':')[0];
  
  return domain.toLowerCase();
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
    'zoho.com'
  ];

  return personalDomains.includes(domain.toLowerCase());
}

/**
 * Validate normalized lead data
 */
export function validateNormalizedLead(lead: NormalizedLead): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Must have at least email or name
  if (!lead.email && !lead.name) {
    errors.push('Lead must have either email or name');
  }

  // Validate email format if present
  if (lead.email && !isValidEmail(lead.email)) {
    errors.push('Invalid email format');
  }

  // Validate source
  if (!lead.source || lead.source.trim().length === 0) {
    errors.push('Source is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if email is valid format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
