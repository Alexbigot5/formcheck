// Re-export all routing functionality
export { routeLead } from './engine.js';
export { 
  getRoutingRules, 
  upsertRoutingRule, 
  updateRoutingRule,
  deleteRoutingRule,
  reorderRoutingRules,
  validateRoutingRule,
  initializeDefaultRoutingRules,
  getOwnerPools,
  getRoutingStats
} from './config.js';
export { registerRoutingRoutes } from './routes.js';

// Re-export types
export type { 
  Lead,
  RoutingRule, 
  OwnerPool,
  RoutingResult, 
  RoutingTrace 
} from './engine.js';
