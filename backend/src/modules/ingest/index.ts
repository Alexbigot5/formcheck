// Re-export all ingestion functionality
export { registerWebhookIngestionRoutes } from './webhook.routes';
export { registerInboxRoutes } from './inbox.routes';
export { registerLinkedInRoutes, registerLinkedInAnalysisRoute } from './linkedin.routes';
export { registerInstagramRoutes } from './instagram.routes';
export { normalizeWebhookPayload, validateNormalizedLead } from './normalizer';
export { enrichLead } from './enrichment';
export { parseEmailToLead } from './email.parser';
export { EmailListener, EmailListenerManager } from './email.listener';

// Re-export types
export type { NormalizedLead } from './normalizer';
export type { EnrichedLead } from './enrichment';
export type { WebhookIngestionResult } from './webhook.routes';
