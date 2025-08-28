import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  User, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  Loader2,
  Clock,
  ArrowRight,
  Eye,
  Settings
} from "lucide-react";
import { 
  useTimeline, 
  useInfiniteTimeline,
  type TimelineItem 
} from "@/lib/paginatedApi";
import { format } from "date-fns";

interface EnhancedTimelineProps {
  leadId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxHeight?: string;
  showHeader?: boolean;
}

const EnhancedTimeline: React.FC<EnhancedTimelineProps> = ({
  leadId,
  autoRefresh = true,
  refreshInterval = 30000,
  maxHeight = "600px",
  showHeader = true
}) => {
  const [viewMode, setViewMode] = useState<'standard' | 'infinite'>('standard');
  const [pageSize, setPageSize] = useState(50);

  // Determine if we should use infinite scroll based on total items
  const standardQuery = useTimeline(leadId, pageSize, 0, {
    enabled: viewMode === 'standard',
    refetchInterval: autoRefresh ? refreshInterval : false
  });

  const infiniteQuery = useInfiniteTimeline(leadId, pageSize, {
    enabled: viewMode === 'infinite',
    refetchInterval: autoRefresh ? refreshInterval : false
  });

  // Auto-switch to infinite scroll for large timelines
  useEffect(() => {
    if (standardQuery.data && standardQuery.data.pagination.total > 200) {
      setViewMode('infinite');
    }
  }, [standardQuery.data?.pagination.total]);

  // Use appropriate query
  const query = viewMode === 'infinite' ? infiniteQuery : standardQuery;
  const isLoading = query.isLoading;
  const isError = query.isError;
  const error = query.error;

  // Extract timeline data
  const { timelineItems, totalItems, hasMore } = useMemo(() => {
    if (viewMode === 'infinite' && 'pages' in query && query.data) {
      const allItems = query.data.pages.flatMap(page => page.timeline);
      const lastPage = query.data.pages[query.data.pages.length - 1];
      
      return {
        timelineItems: allItems,
        totalItems: lastPage.pagination.total,
        hasMore: lastPage.pagination.hasMore
      };
    } else if (viewMode === 'standard' && 'data' in query && query.data) {
      return {
        timelineItems: query.data.timeline,
        totalItems: query.data.pagination.total,
        hasMore: query.data.pagination.hasMore
      };
    }
    
    return {
      timelineItems: [],
      totalItems: 0,
      hasMore: false
    };
  }, [viewMode, query.data]);

  // Load more for infinite scroll
  const loadMore = useCallback(() => {
    if (viewMode === 'infinite' && 'fetchNextPage' in query && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [viewMode, query]);

  // Get icon for timeline item
  const getTimelineIcon = (item: TimelineItem) => {
    if (item.type === 'message') {
      const channel = item.data.channel;
      switch (channel) {
        case 'EMAIL': return <Mail className="w-4 h-4" />;
        case 'DM': return <MessageSquare className="w-4 h-4" />;
        case 'FORM': return <User className="w-4 h-4" />;
        default: return <Mail className="w-4 h-4" />;
      }
    } else {
      const eventType = item.data.type;
      switch (eventType) {
        case 'CALL_LOGGED': return <Phone className="w-4 h-4" />;
        case 'STATUS_CHANGED': return <Settings className="w-4 h-4" />;
        case 'SCORE_UPDATED': return <ArrowRight className="w-4 h-4" />;
        case 'CRM_SYNC': return <RefreshCw className="w-4 h-4" />;
        case 'SLA_ESCALATED': return <AlertTriangle className="w-4 h-4" />;
        default: return <CheckCircle className="w-4 h-4" />;
      }
    }
  };

  // Get color for timeline item
  const getTimelineColor = (item: TimelineItem) => {
    if (item.type === 'message') {
      return item.data.direction === 'IN' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600';
    } else {
      const eventType = item.data.type;
      switch (eventType) {
        case 'SLA_ESCALATED': return 'bg-red-100 text-red-600';
        case 'SCORE_UPDATED': return 'bg-purple-100 text-purple-600';
        case 'CRM_SYNC': return 'bg-orange-100 text-orange-600';
        default: return 'bg-gray-100 text-gray-600';
      }
    }
  };

  // Format timeline item content
  const formatTimelineContent = (item: TimelineItem) => {
    if (item.type === 'message') {
      return {
        title: item.data.subject || `${item.data.direction === 'IN' ? 'Received' : 'Sent'} ${item.data.channel.toLowerCase()}`,
        content: item.data.body?.substring(0, 200) + (item.data.body?.length > 200 ? '...' : ''),
        metadata: `${item.data.direction} • ${item.data.channel}`
      };
    } else {
      const payload = item.data.payload;
      let title = item.data.type.replace(/_/g, ' ').toLowerCase();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      
      let content = '';
      let metadata = 'System Event';

      switch (item.data.type) {
        case 'SCORE_UPDATED':
          content = `Score changed to ${payload.score} (${payload.band})`;
          if (payload.reason) content += ` - ${payload.reason}`;
          break;
        case 'STATUS_CHANGED':
          content = `Status changed to ${payload.newStatus}`;
          if (payload.previousStatus) content = `Status changed from ${payload.previousStatus} to ${payload.newStatus}`;
          break;
        case 'CRM_SYNC':
          content = `Synced to ${payload.provider || 'CRM'}`;
          if (payload.recordId) content += ` (ID: ${payload.recordId})`;
          break;
        case 'SLA_ESCALATED':
          content = `SLA escalated - ${payload.reason || 'Response time exceeded'}`;
          break;
        default:
          content = JSON.stringify(payload).substring(0, 100);
      }

      return { title, content, metadata };
    }
  };

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ))}
    </div>
  );

  if (isError) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load timeline: {error?.message || 'An unexpected error occurred'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Timeline</span>
              {totalItems > 0 && (
                <Badge variant="outline">
                  {totalItems} {totalItems === 1 ? 'event' : 'events'}
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              {totalItems > 200 && (
                <Badge variant="secondary" className="text-xs">
                  Large Timeline - Using Pagination
                </Badge>
              )}
              
              <Button 
                onClick={() => query.refetch()} 
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      
      <CardContent>
        <ScrollArea style={{ height: maxHeight }}>
          {isLoading && !timelineItems.length ? (
            renderSkeleton()
          ) : timelineItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No timeline events yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {timelineItems.map((item, index) => {
                const { title, content, metadata } = formatTimelineContent(item);
                const isLast = index === timelineItems.length - 1;
                
                return (
                  <div key={item.id} className="relative">
                    {/* Timeline line */}
                    {!isLast && (
                      <div className="absolute left-5 top-10 w-px h-full bg-border" />
                    )}
                    
                    <div className="flex space-x-4">
                      {/* Timeline icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTimelineColor(item)}`}>
                        {getTimelineIcon(item)}
                      </div>
                      
                      {/* Timeline content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-sm">{title}</h4>
                          <time className="text-xs text-muted-foreground">
                            {format(new Date(item.timestamp), 'MMM dd, HH:mm')}
                          </time>
                        </div>
                        
                        <div className="text-xs text-muted-foreground mb-2">
                          {metadata}
                        </div>
                        
                        {content && (
                          <div className="text-sm text-foreground bg-muted/30 rounded-md p-3">
                            {content.length > 150 ? (
                              <details className="group">
                                <summary className="cursor-pointer">
                                  {content.substring(0, 150)}...
                                  <span className="text-primary ml-2 group-open:hidden">Show more</span>
                                  <span className="text-primary ml-2 hidden group-open:inline">Show less</span>
                                </summary>
                                <div className="mt-2">
                                  {content}
                                </div>
                              </details>
                            ) : (
                              content
                            )}
                          </div>
                        )}
                        
                        {/* Additional metadata for messages */}
                        {item.type === 'message' && item.data.meta && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {Object.entries(item.data.meta).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Load more button for infinite scroll */}
              {viewMode === 'infinite' && hasMore && (
                <div className="text-center py-4">
                  <Button 
                    onClick={loadMore} 
                    disabled={'isFetchingNextPage' in query && query.isFetchingNextPage}
                    variant="outline"
                    size="sm"
                  >
                    {'isFetchingNextPage' in query && query.isFetchingNextPage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Load more events
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* Standard pagination info */}
              {viewMode === 'standard' && hasMore && (
                <div className="text-center py-4">
                  <Alert>
                    <Eye className="h-4 w-4" />
                    <AlertDescription>
                      Showing first {timelineItems.length} of {totalItems} events.
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="ml-2 p-0 h-auto"
                        onClick={() => setViewMode('infinite')}
                      >
                        Load all events
                      </Button>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default EnhancedTimeline;
