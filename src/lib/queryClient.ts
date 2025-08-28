import { QueryClient, DefaultOptions } from '@tanstack/react-query';

// Default query options
const queryConfig: DefaultOptions = {
  queries: {
    retry: 1, // Retry failed requests once
    staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh for this duration
    gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchOnMount: true, // Refetch when component mounts
  },
  mutations: {
    retry: 1, // Retry failed mutations once
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection for mutations
  },
};

// Create and configure the QueryClient
export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});

// Query key factory for consistent key generation
export const queryKeys = {
  // Auth
  auth: ['auth'] as const,
  user: () => [...queryKeys.auth, 'user'] as const,
  
  // Leads
  leads: ['leads'] as const,
  lead: (id: string) => [...queryKeys.leads, id] as const,
  leadsList: (filters?: Record<string, any>) => [...queryKeys.leads, 'list', filters] as const,
  
  // Forms
  forms: ['forms'] as const,
  form: (id: string) => [...queryKeys.forms, id] as const,
  formsList: () => [...queryKeys.forms, 'list'] as const,
  
  // Scoring
  scoring: ['scoring'] as const,
  scoringConfig: () => [...queryKeys.scoring, 'config'] as const,
  scoringRules: () => [...queryKeys.scoring, 'rules'] as const,
  
  // Routing
  routing: ['routing'] as const,
  routingRules: () => [...queryKeys.routing, 'rules'] as const,
  
  // Integrations
  integrations: ['integrations'] as const,
  integration: (id: string) => [...queryKeys.integrations, id] as const,
  integrationsList: () => [...queryKeys.integrations, 'list'] as const,
  integrationHealth: (id: string) => [...queryKeys.integrations, id, 'health'] as const,
  
  // Analytics
  analytics: ['analytics'] as const,
  timeline: (leadId?: string) => [...queryKeys.analytics, 'timeline', leadId] as const,
  
  // Settings
  settings: ['settings'] as const,
  slaSettings: () => [...queryKeys.settings, 'sla'] as const,
  apiKeys: () => [...queryKeys.settings, 'api-keys'] as const,
  
  // Email Templates
  emailTemplates: ['email-templates'] as const,
  emailTemplate: (id: string) => [...queryKeys.emailTemplates, id] as const,
  emailTemplatesList: () => [...queryKeys.emailTemplates, 'list'] as const,
} as const;

// Helper function to invalidate related queries
export const invalidateQueries = {
  leads: () => queryClient.invalidateQueries({ queryKey: queryKeys.leads }),
  forms: () => queryClient.invalidateQueries({ queryKey: queryKeys.forms }),
  scoring: () => queryClient.invalidateQueries({ queryKey: queryKeys.scoring }),
  routing: () => queryClient.invalidateQueries({ queryKey: queryKeys.routing }),
  integrations: () => queryClient.invalidateQueries({ queryKey: queryKeys.integrations }),
  analytics: () => queryClient.invalidateQueries({ queryKey: queryKeys.analytics }),
  settings: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  emailTemplates: () => queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates }),
  all: () => queryClient.invalidateQueries(),
};

export default queryClient;
