// Re-export all scoring functionality
export { applyScoring, getDefaultScoringConfig } from './engine.js';
export { 
  getScoringConfig, 
  getScoringRules, 
  upsertScoringConfig, 
  upsertScoringRule,
  updateScoringRule,
  deleteScoringRule,
  reorderScoringRules,
  getScoringConfigHistory,
  validateScoringConfig,
  validateScoringRule,
  initializeDefaultScoringConfig
} from './config.js';
export { registerScoringRoutes } from './routes.js';

// Re-export types
export type { 
  ScoringConfig, 
  ScoringRule, 
  Lead, 
  ScoringResult, 
  ScoringTrace 
} from './engine.js';
