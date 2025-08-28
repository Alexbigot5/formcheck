import { createHash } from 'crypto';

export interface Lead {
  id?: string;
  email?: string;
  name?: string;
  company?: string;
  domain?: string;
  phone?: string;
}

export interface DedupeKeys {
  emailHash?: string;
  domain?: string;
  nameKey?: string;
}

/**
 * Build deduplication keys from lead data
 * These keys are used to identify potential duplicates
 */
export function buildKeys(lead: Lead): DedupeKeys {
  const keys: DedupeKeys = {};

  // Email hash - primary deduplication key
  if (lead.email && isValidEmail(lead.email)) {
    keys.emailHash = hashEmail(lead.email);
  }

  // Domain - for company-level deduplication
  if (lead.domain) {
    keys.domain = normalizeDomain(lead.domain);
  } else if (lead.email && isValidEmail(lead.email)) {
    // Extract domain from email if not provided
    const emailDomain = extractDomainFromEmail(lead.email);
    if (emailDomain && !isPersonalEmailDomain(emailDomain)) {
      keys.domain = emailDomain;
    }
  } else if (lead.company) {
    // Try to derive domain from company name
    const derivedDomain = deriveCompanyDomain(lead.company);
    if (derivedDomain) {
      keys.domain = derivedDomain;
    }
  }

  // Name key - for name-based deduplication
  if (lead.name) {
    keys.nameKey = buildNameKey(lead.name);
  }

  return keys;
}

/**
 * Hash email for secure storage and comparison
 * Uses SHA-256 with salt for privacy
 */
function hashEmail(email: string): string {
  const normalizedEmail = normalizeEmail(email);
  const salt = 'smartforms_email_salt'; // In production, use env variable
  return createHash('sha256')
    .update(salt + normalizedEmail)
    .digest('hex');
}

/**
 * Normalize email for consistent comparison
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Normalize domain for consistent comparison
 */
function normalizeDomain(domain: string): string {
  return domain.toLowerCase()
    .replace(/^www\./, '') // Remove www prefix
    .replace(/\/$/, '') // Remove trailing slash
    .trim();
}

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email: string): string | null {
  const match = email.match(/@([^@]+)$/);
  return match ? normalizeDomain(match[1]) : null;
}

/**
 * Build a normalized name key for fuzzy matching
 * Handles common variations and typos
 */
function buildNameKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common prefixes and suffixes
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, '')
    // Remove punctuation and extra spaces
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    // Sort name parts for consistent ordering
    .split(' ')
    .filter(part => part.length > 1) // Remove single letters
    .sort()
    .join(' ');
}

/**
 * Derive a potential company domain from company name
 */
function deriveCompanyDomain(company: string): string | null {
  // Simple heuristic - convert company name to potential domain
  const normalized = company
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '')
    .replace(/(inc|corp|llc|ltd|company|co)$/, '');

  // Only return if it looks like a reasonable domain
  if (normalized.length >= 3 && normalized.length <= 30) {
    return `${normalized}.com`;
  }

  return null;
}

/**
 * Check if email is valid format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
 * Calculate similarity score between two name keys
 * Returns a value between 0 and 1 (1 = identical)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const key1 = buildNameKey(name1);
  const key2 = buildNameKey(name2);

  if (key1 === key2) return 1;

  // Calculate Jaccard similarity of word sets
  const words1 = new Set(key1.split(' '));
  const words2 = new Set(key2.split(' '));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Validate deduplication keys
 */
export function validateKeys(keys: DedupeKeys): boolean {
  // At least one key must be present
  return !!(keys.emailHash || keys.domain || keys.nameKey);
}
