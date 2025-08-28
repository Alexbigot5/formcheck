import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Search, 
  Filter,
  Clock,
  AlertCircle,
  User,
  Building,
  Mail,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2
} from "lucide-react";
import { 
  useLeads, 
  useInfiniteLeads, 
  type LeadFilters, 
  type Lead,
  cacheUtils,
  perfUtils,
  filterUtils
} from "@/lib/paginatedApi";

interface EnhancedLeadsInboxProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  useInfiniteScroll?: boolean;
}

const EnhancedLeadsInbox: React.FC<EnhancedLeadsInboxProps> = ({ 
  autoRefresh = true, 
  refreshInterval = 15000,
  useInfiniteScroll
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [filters, setFilters] = useState<LeadFilters>(() => 
    filterUtils.mergeFilters({
      pageSize: perfUtils.getOptimalPageSize()
    })
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'infinite'>('table');

  // Determine if we should use infinite scroll
  const shouldUseInfinite = useMemo(() => {
    if (useInfiniteScroll !== undefined) return useInfiniteScroll;
    return viewMode === 'infinite';
  }, [useInfiniteScroll, viewMode]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Update filters when search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      updateFilters({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch]);

  // Memoized filter key for cache optimization
  const filterKey = useMemo(() => 
    filterUtils.createFilterKey(filters), 
    [filters]
  );

  // Query hooks
  const standardQuery = useLeads(filters, {
    enabled: !shouldUseInfinite,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: false
  });

  const infiniteQuery = useInfiniteLeads(
    { ...filters, page: undefined }, // Remove page from infinite query
    {
      enabled: shouldUseInfinite,
      refetchInterval: autoRefresh ? refreshInterval : false,
      refetchIntervalInBackground: false
    }
  );

  // Use appropriate query based on mode
  const query = shouldUseInfinite ? infiniteQuery : standardQuery;
  const isLoading = query.isLoading;
  const isError = query.isError;
  const error = query.error;

  // Extract data based on query type
  const { leads, pagination, hasOverdueSLAs } = useMemo(() => {
    if (shouldUseInfinite && 'pages' in query && query.data) {
      const allLeads = query.data.pages.flatMap(page => page.data);
      const lastPage = query.data.pages[query.data.pages.length - 1];
      
      return {
        leads: allLeads,
        pagination: lastPage?.pagination || null,
        hasOverdueSLAs: allLeads.some(lead => lead.slaStatus === 'overdue')
      };
    } else if (!shouldUseInfinite && 'data' in query && query.data) {
      return {
        leads: query.data.data,
        pagination: query.data.pagination,
        hasOverdueSLAs: query.data.data.some(lead => lead.slaStatus === 'overdue')
      };
    }
    
    return {
      leads: [],
      pagination: null,
      hasOverdueSLAs: false
    };
  }, [shouldUseInfinite, query.data]);

  // Handle filter changes
  const updateFilters = useCallback((newFilters: Partial<LeadFilters>) => {
    setFilters(prev => filterUtils.mergeFilters({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1 // Reset to first page when filtering
    }));
  }, []);

  // Handle search
  const handleSearch = useCallback(() => {
    updateFilters({ search: searchTerm || undefined });
  }, [searchTerm, updateFilters]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // Handle sorting
  const handleSort = useCallback((field: LeadFilters['sort']) => {
    const newOrder = filters.sort === field && filters.order === 'desc' ? 'asc' : 'desc';
    updateFilters({ sort: field, order: newOrder });
  }, [filters.sort, filters.order, updateFilters]);

  // Navigation
  const goToPage = useCallback((page: number) => {
    updateFilters({ page });
    // Prefetch next page for better UX
    if (pagination?.hasNextPage) {
      cacheUtils.prefetchNextPage(queryClient, { ...filters, page: page + 1 });
    }
  }, [filters, pagination, queryClient, updateFilters]);

  const handleRowClick = useCallback((leadId: string) => {
    navigate(`/leads/${leadId}`);
  }, [navigate]);

  // Infinite scroll handler
  const loadMore = useCallback(() => {
    if (shouldUseInfinite && 'fetchNextPage' in query && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [shouldUseInfinite, query]);

  // Auto-detect optimal view mode based on data
  useEffect(() => {
    if (pagination && perfUtils.shouldUseInfiniteScroll(pagination.total)) {
      setViewMode('infinite');
    }
  }, [pagination?.total]);

  // Error handling
  if (isError) {
    toast.error('Failed to load leads', { 
      description: error?.message || 'An unexpected error occurred' 
    });
  }

  // Render sort icon
  const renderSortIcon = (field: LeadFilters['sort']) => {
    if (filters.sort !== field) {
      return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    }
    return filters.order === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: filters.pageSize || 20 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative flex-1 lg:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
          
          <Button onClick={handleSearch} variant="outline" size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {/* View mode toggle */}
          <Select value={viewMode} onValueChange={(value: 'table' | 'infinite') => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">Table</SelectItem>
              <SelectItem value="infinite">Infinite</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh button */}
          <Button 
            onClick={() => query.refetch()} 
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* SLA alert */}
          {hasOverdueSLAs && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertCircle className="w-3 h-3 mr-1" />
              SLA Overdue
            </Badge>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        {/* Status filter */}
        <Select 
          value={filters.status || 'all'} 
          onValueChange={(value) => updateFilters({ status: value === 'all' ? undefined : value as any })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        {/* Score band filter */}
        <Select 
          value={filters.scoreBand || 'all'} 
          onValueChange={(value) => updateFilters({ scoreBand: value === 'all' ? undefined : value as any })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Score Band" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* SLA filter */}
        <Select 
          value={filters.sla || 'all'} 
          onValueChange={(value) => updateFilters({ sla: value === 'all' ? undefined : value as any })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="SLA Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All SLA</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="due_soon">Due Soon</SelectItem>
          </SelectContent>
        </Select>

        {/* Page size selector */}
        <Select 
          value={String(filters.pageSize || 20)} 
          onValueChange={(value) => updateFilters({ pageSize: Number(value) })}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Leads {pagination && `(${pagination.total})`}
            </span>
            <div className="text-sm text-muted-foreground">
              Cache key: {filterKey.slice(0, 20)}...
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !leads.length ? (
            renderSkeleton()
          ) : (
            <>
              {/* Table view */}
              {viewMode === 'table' && (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('name')}
                            className="h-auto p-0 font-semibold"
                          >
                            Name {renderSortIcon('name')}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('company')}
                            className="h-auto p-0 font-semibold"
                          >
                            Company {renderSortIcon('company')}
                          </Button>
                        </TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('score')}
                            className="h-auto p-0 font-semibold"
                          >
                            Score {renderSortIcon('score')}
                          </Button>
                        </TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>SLA</TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSort('createdAt')}
                            className="h-auto p-0 font-semibold"
                          >
                            Created {renderSortIcon('createdAt')}
                          </Button>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow 
                          key={lead.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(lead.id)}
                        >
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                {lead.name ? (
                                  <span className="text-xs font-medium">
                                    {lead.name.charAt(0).toUpperCase()}
                                  </span>
                                ) : (
                                  <Mail className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{lead.name || 'Unknown'}</div>
                                <div className="text-sm text-muted-foreground">{lead.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {lead.company && <Building className="w-4 h-4 text-muted-foreground" />}
                              <span>{lead.company || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.source}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{lead.score}</span>
                              <Badge 
                                variant={
                                  lead.scoreBand === 'HIGH' ? 'default' :
                                  lead.scoreBand === 'MEDIUM' ? 'secondary' : 'outline'
                                }
                                className="text-xs"
                              >
                                {lead.scoreBand}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {lead.ownerName && <User className="w-4 h-4 text-muted-foreground" />}
                              <span className="text-sm">{lead.ownerName || 'Unassigned'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                lead.status === 'CLOSED' ? 'default' :
                                lead.status === 'IN_PROGRESS' ? 'secondary' :
                                lead.status === 'ASSIGNED' ? 'outline' : 'outline'
                              }
                            >
                              {lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {lead.slaCountdown ? (
                              <div className="flex items-center space-x-2">
                                <Clock className={`w-4 h-4 ${
                                  lead.slaStatus === 'overdue' ? 'text-red-500' :
                                  lead.slaStatus === 'due_soon' ? 'text-yellow-500' : 'text-green-500'
                                }`} />
                                <span className={`text-sm ${
                                  lead.slaStatus === 'overdue' ? 'text-red-600 font-medium' :
                                  lead.slaStatus === 'due_soon' ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                  {lead.slaCountdown.isOverdue ? 
                                    `${Math.abs(lead.slaCountdown.minutesRemaining)}m overdue` :
                                    `${lead.slaCountdown.minutesRemaining}m left`
                                  }
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(lead.id);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Standard pagination */}
                  {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                        {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                        {pagination.total} leads
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToPage(pagination.page - 1)}
                          disabled={!pagination.hasPrevPage}
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const page = i + 1;
                            return (
                              <Button
                                key={page}
                                variant={page === pagination.page ? "default" : "outline"}
                                size="sm"
                                onClick={() => goToPage(page)}
                                className="w-8 h-8 p-0"
                              >
                                {page}
                              </Button>
                            );
                          })}
                          {pagination.totalPages > 5 && (
                            <>
                              <span className="text-muted-foreground">...</span>
                              <Button
                                variant={pagination.page === pagination.totalPages ? "default" : "outline"}
                                size="sm"
                                onClick={() => goToPage(pagination.totalPages)}
                                className="w-8 h-8 p-0"
                              >
                                {pagination.totalPages}
                              </Button>
                            </>
                          )}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToPage(pagination.page + 1)}
                          disabled={!pagination.hasNextPage}
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Infinite scroll view */}
              {viewMode === 'infinite' && (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {leads.map((lead, index) => (
                      <Card 
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleRowClick(lead.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                {lead.name ? (
                                  <span className="text-sm font-medium">
                                    {lead.name.charAt(0).toUpperCase()}
                                  </span>
                                ) : (
                                  <Mail className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{lead.name || 'Unknown'}</div>
                                <div className="text-sm text-muted-foreground">{lead.email}</div>
                                {lead.company && (
                                  <div className="text-sm text-muted-foreground flex items-center">
                                    <Building className="w-3 h-3 mr-1" />
                                    {lead.company}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">{lead.source}</Badge>
                              <Badge 
                                variant={
                                  lead.scoreBand === 'HIGH' ? 'default' :
                                  lead.scoreBand === 'MEDIUM' ? 'secondary' : 'outline'
                                }
                              >
                                {lead.score}
                              </Badge>
                              {lead.slaCountdown && (
                                <Badge 
                                  variant={lead.slaStatus === 'overdue' ? 'destructive' : 'outline'}
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  {lead.slaCountdown.isOverdue ? 
                                    `${Math.abs(lead.slaCountdown.minutesRemaining)}m overdue` :
                                    `${lead.slaCountdown.minutesRemaining}m`
                                  }
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {/* Load more button for infinite scroll */}
                    {shouldUseInfinite && 'hasNextPage' in query && query.hasNextPage && (
                      <div className="text-center py-4">
                        <Button 
                          onClick={loadMore} 
                          disabled={query.isFetchingNextPage}
                          variant="outline"
                        >
                          {query.isFetchingNextPage ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            'Load More'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedLeadsInbox;
