// Re-export all routing functionality
export { routeLead } from './engine';
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
} from './config';
export { registerRoutingRoutes } from './routes';

// Re-export types
export type { 
  Lead,
  RoutingRule, 
  OwnerPool,
  RoutingResult, 
  RoutingTrace 
} from './engine';
