// Re-export all ingestion functionality
export { registerWebhookIngestionRoutes } from './webhook.routes.js';
export { registerInboxRoutes } from './inbox.routes.js';
export { registerLinkedInRoutes, registerLinkedInAnalysisRoute } from './linkedin.routes.js';
export { registerInstagramRoutes } from './instagram.routes.js';
export { normalizeWebhookPayload, validateNormalizedLead } from './normalizer.js';
export { enrichLead } from './enrichment.js';
export { parseEmailToLead } from './email.parser.js';
export { EmailListener, EmailListenerManager } from './email.listener.js';

// Re-export types
export type { NormalizedLead } from './normalizer.js';
export type { EnrichedLead } from './enrichment.js';
export type { WebhookIngestionResult } from './webhook.routes.js';
