// Re-export all scoring functionality
export { applyScoring, getDefaultScoringConfig } from './engine';
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
} from './config';
export { registerScoringRoutes } from './routes';

// Re-export types
export type { 
  ScoringConfig, 
  ScoringRule, 
  Lead, 
  ScoringResult, 
  ScoringTrace 
} from './engine';
