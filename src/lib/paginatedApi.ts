import { useQuery, useInfiniteQuery, QueryClient, UseQueryOptions, UseInfiniteQueryOptions } from '@tanstack/react-query';
import apiClient from './apiClient';

// Enhanced pagination types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'updatedAt' | 'score' | 'name' | 'company';
  order?: 'asc' | 'desc';
  filter?: string; // JSON string for complex filters
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface InfinitePageParam {
  pageParam?: number;
}

// Enhanced leads API with React Query integration
export interface LeadFilters extends PaginationParams {
  status?: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  source?: string;
  scoreBand?: 'LOW' | 'MEDIUM' | 'HIGH';
  ownerId?: string;
  search?: string;
  sla?: 'overdue' | 'due_soon' | 'all';
}

export interface Lead {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  domain?: string;
  source: string;
  score: number;
  scoreBand: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  ownerId?: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
  slaStatus?: 'overdue' | 'due_soon' | 'on_track' | null;
  slaCountdown?: {
    targetAt: string;
    minutesRemaining: number;
    isOverdue: boolean;
    status: string;
  } | null;
}

export interface TimelineItem {
  id: string;
  type: 'message' | 'event';
  timestamp: string;
  data: any;
}

export interface TimelineResponse {
  timeline: TimelineItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// API functions
export const paginatedApi = {
  // Get paginated leads
  async getLeads(filters: LeadFilters): Promise<PaginatedResponse<Lead>> {
    const response = await apiClient.get('/api/leads', { params: filters });
    return {
      data: response.data.leads,
      pagination: response.data.pagination
    };
  },

  // Get timeline with pagination
  async getTimeline(leadId: string, limit: number = 50, offset: number = 0): Promise<TimelineResponse> {
    const response = await apiClient.get(`/leads/${leadId}/timeline`, {
      params: { limit, offset }
    });
    return response.data;
  }
};

// React Query hooks for leads
export const useLeads = (
  filters: LeadFilters,
  options?: Omit<UseQueryOptions<PaginatedResponse<Lead>>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: () => paginatedApi.getLeads(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    ...options
  });
};

// Infinite scroll hook for leads
export const useInfiniteLeads = (
  filters: Omit<LeadFilters, 'page'>,
  options?: Omit<UseInfiniteQueryOptions<PaginatedResponse<Lead>, Error, PaginatedResponse<Lead>, PaginatedResponse<Lead>, string[], number>, 'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'>
) => {
  return useInfiniteQuery({
    queryKey: ['leads-infinite', filters],
    queryFn: ({ pageParam = 1 }) => 
      paginatedApi.getLeads({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30000,
    gcTime: 300000,
    ...options
  });
};

// Timeline hooks
export const useTimeline = (
  leadId: string,
  limit: number = 50,
  offset: number = 0,
  options?: Omit<UseQueryOptions<TimelineResponse>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['timeline', leadId, limit, offset],
    queryFn: () => paginatedApi.getTimeline(leadId, limit, offset),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    enabled: !!leadId,
    ...options
  });
};

// Infinite scroll hook for timeline
export const useInfiniteTimeline = (
  leadId: string,
  limit: number = 50,
  options?: Omit<UseInfiniteQueryOptions<TimelineResponse, Error, TimelineResponse, TimelineResponse, string[], number>, 'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'>
) => {
  return useInfiniteQuery({
    queryKey: ['timeline-infinite', leadId, limit],
    queryFn: ({ pageParam = 0 }) => 
      paginatedApi.getTimeline(leadId, limit, pageParam),
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasMore ? lastPage.pagination.offset + lastPage.pagination.limit : undefined,
    initialPageParam: 0,
    enabled: !!leadId,
    staleTime: 60000,
    gcTime: 300000,
    ...options
  });
};

// Query key factories for cache invalidation
export const queryKeys = {
  leads: {
    all: () => ['leads'] as const,
    lists: () => ['leads', 'list'] as const,
    list: (filters: LeadFilters) => ['leads', 'list', filters] as const,
    infinite: (filters: Omit<LeadFilters, 'page'>) => ['leads-infinite', filters] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
  },
  timeline: {
    all: () => ['timeline'] as const,
    byLead: (leadId: string) => ['timeline', leadId] as const,
    infinite: (leadId: string, limit: number) => ['timeline-infinite', leadId, limit] as const,
  }
};

// Cache management utilities
export const cacheUtils = {
  // Invalidate all leads queries
  invalidateLeads: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.leads.all() });
  },

  // Invalidate specific lead list
  invalidateLeadsList: (queryClient: QueryClient, filters: LeadFilters) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.leads.list(filters) });
  },

  // Invalidate timeline for a specific lead
  invalidateTimeline: (queryClient: QueryClient, leadId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.timeline.byLead(leadId) });
  },

  // Update lead in cache
  updateLeadInCache: (queryClient: QueryClient, leadId: string, updater: (lead: Lead) => Lead) => {
    // Update detail cache
    queryClient.setQueryData(queryKeys.leads.detail(leadId), updater);

    // Update list caches
    queryClient.setQueriesData(
      { queryKey: queryKeys.leads.lists() },
      (data: PaginatedResponse<Lead> | undefined) => {
        if (!data) return data;
        return {
          ...data,
          data: data.data.map(lead => lead.id === leadId ? updater(lead) : lead)
        };
      }
    );

    // Update infinite query caches
    queryClient.setQueriesData(
      { queryKey: ['leads-infinite'] },
      (data: any) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page: PaginatedResponse<Lead>) => ({
            ...page,
            data: page.data.map((lead: Lead) => lead.id === leadId ? updater(lead) : lead)
          }))
        };
      }
    );
  },

  // Prefetch next page
  prefetchNextPage: async (queryClient: QueryClient, filters: LeadFilters) => {
    const nextPageFilters = { ...filters, page: (filters.page || 1) + 1 };
    await queryClient.prefetchQuery({
      queryKey: queryKeys.leads.list(nextPageFilters),
      queryFn: () => paginatedApi.getLeads(nextPageFilters),
      staleTime: 30000
    });
  },

  // Get cached lead count
  getCachedLeadCount: (queryClient: QueryClient, filters: LeadFilters): number | undefined => {
    const data = queryClient.getQueryData<PaginatedResponse<Lead>>(queryKeys.leads.list(filters));
    return data?.pagination.total;
  },

  // Check if more data available
  hasMorePages: (queryClient: QueryClient, filters: LeadFilters): boolean => {
    const data = queryClient.getQueryData<PaginatedResponse<Lead>>(queryKeys.leads.list(filters));
    return data?.pagination.hasNextPage ?? false;
  }
};

// Sorting and filtering utilities
export const filterUtils = {
  // Create filter key for caching
  createFilterKey: (filters: LeadFilters): string => {
    const { page, pageSize, ...filterParams } = filters;
    return JSON.stringify(filterParams);
  },

  // Merge filters with defaults
  mergeFilters: (filters: Partial<LeadFilters>): LeadFilters => {
    return {
      page: 1,
      pageSize: 20,
      sort: 'createdAt',
      order: 'desc',
      ...filters
    };
  },

  // Convert complex filter object to JSON string
  encodeComplexFilter: (filter: Record<string, any>): string => {
    return JSON.stringify(filter);
  },

  // Parse JSON filter string
  decodeComplexFilter: (filter: string): Record<string, any> | null => {
    try {
      return JSON.parse(filter);
    } catch {
      return null;
    }
  },

  // Build search filter
  buildSearchFilter: (searchTerm: string): Record<string, any> => {
    if (!searchTerm.trim()) return {};
    
    return {
      OR: [
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { company: { contains: searchTerm, mode: 'insensitive' } },
        { domain: { contains: searchTerm, mode: 'insensitive' } }
      ]
    };
  },

  // Build date range filter
  buildDateRangeFilter: (field: string, start: Date, end: Date): Record<string, any> => {
    return {
      [field]: {
        gte: start.toISOString(),
        lte: end.toISOString()
      }
    };
  }
};

// Performance monitoring
export const perfUtils = {
  // Track query performance
  trackQueryPerformance: (queryKey: string[], startTime: number) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (duration > 1000) {
      console.warn(`Slow query detected: ${queryKey.join('.')} took ${duration}ms`);
    }
  },

  // Get optimal page size based on viewport
  getOptimalPageSize: (): number => {
    const height = window.innerHeight;
    const rowHeight = 60; // Approximate row height
    const headerHeight = 200; // Header and filters height
    const footerHeight = 100; // Pagination height
    
    const availableHeight = height - headerHeight - footerHeight;
    const maxRows = Math.floor(availableHeight / rowHeight);
    
    // Ensure reasonable bounds
    return Math.max(10, Math.min(50, maxRows));
  },

  // Detect if infinite scroll should be used
  shouldUseInfiniteScroll: (totalItems: number): boolean => {
    return totalItems > 100 || window.innerWidth < 768; // Use infinite scroll for large datasets or mobile
  }
};
