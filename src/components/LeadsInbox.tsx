import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Eye
} from "lucide-react";
import { leadsApi, leadsHelpers, type Lead, type LeadFilters } from "@/lib/leadsApi";

interface LeadsInboxProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const LeadsInbox: React.FC<LeadsInboxProps> = ({ 
  autoRefresh = true, 
  refreshInterval = 15000 
}) => {
  const navigate = useNavigate();
  
  // State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [hasOverdueSLAs, setHasOverdueSLAs] = useState(false);

  // Filters
  const [filters, setFilters] = useState<LeadFilters>({
    page: 1,
    limit: 20
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Load leads data
  const loadLeads = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const response = await leadsApi.getLeads(filters);
      setLeads(response.leads);
      setPagination(response.pagination);
      
      // Check for overdue SLAs
      const hasOverdue = response.leads.some(lead => leadsHelpers.hasOverdueSLA(lead));
      setHasOverdueSLAs(hasOverdue);
      
    } catch (error: any) {
      console.error('Failed to load leads:', error);
      toast.error('Failed to load leads', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Auto-refresh effect
  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadLeads(false); // Silent refresh
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadLeads]);

  // Handle filter changes
  const updateFilters = (newFilters: Partial<LeadFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filtering
    }));
  };

  const handleSearch = () => {
    updateFilters({ search: searchTerm || undefined });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle pagination
  const goToPage = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // Handle row click
  const handleRowClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  // Get SLA countdown component
  const SLACountdown: React.FC<{ lead: Lead }> = ({ lead }) => {
    if (!lead.slaCountdown) {
      return <span className="text-muted-foreground text-sm">No SLA</span>;
    }

    const { slaCountdown, slaStatus } = lead;
    const colorClass = leadsHelpers.getSLAStatusColor(slaStatus);
    
    return (
      <div className="flex items-center space-x-1">
        {slaStatus === 'overdue' && <AlertCircle className="w-4 h-4 text-red-500" />}
        {slaStatus === 'due_soon' && <Clock className="w-4 h-4 text-orange-500" />}
        <Badge className={colorClass} variant="outline">
          {leadsHelpers.formatSLACountdown(slaCountdown)}
        </Badge>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with refresh indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-2xl font-semibold tracking-tight">Leads Inbox</h2>
          {hasOverdueSLAs && (
            <div className="flex items-center space-x-1 text-red-600">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Overdue SLAs</span>
            </div>
          )}
        </div>
        <Button 
          onClick={() => loadLeads()} 
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch} size="sm">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Status Filter */}
            <Select value={filters.status || 'all'} onValueChange={(value) => 
              updateFilters({ status: value === 'all' ? undefined : value as any })
            }>
              <SelectTrigger>
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

            {/* Score Band Filter */}
            <Select value={filters.scoreBand || 'all'} onValueChange={(value) => 
              updateFilters({ scoreBand: value === 'all' ? undefined : value as any })
            }>
              <SelectTrigger>
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* SLA Filter */}
            <Select value={filters.sla || 'all'} onValueChange={(value) => 
              updateFilters({ sla: value === 'all' ? undefined : value as any })
            }>
              <SelectTrigger>
                <SelectValue placeholder="SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SLA</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="due_soon">Due Soon</SelectItem>
              </SelectContent>
            </Select>

            {/* Source Filter */}
            <Input
              placeholder="Source..."
              value={filters.source || ''}
              onChange={(e) => updateFilters({ source: e.target.value || undefined })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Loading leads...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No leads found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow 
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleRowClick(lead.id)}
                    >
                      {/* SLA Indicator */}
                      <TableCell className="w-8 p-2">
                        {leadsHelpers.hasOverdueSLA(lead) && (
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                        )}
                        {leadsHelpers.isDueSoon(lead) && (
                          <div className="w-2 h-2 bg-orange-500 rounded-full" />
                        )}
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div>
                            <div className="font-medium">
                              {leadsHelpers.getDisplayName(lead)}
                            </div>
                            {lead.email && lead.name && (
                              <div className="text-sm text-muted-foreground">
                                {lead.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Company */}
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {lead.company && <Building className="w-4 h-4 text-muted-foreground" />}
                          <span>{lead.company || '-'}</span>
                        </div>
                      </TableCell>

                      {/* Source */}
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span>{leadsHelpers.getSourceIcon(lead.source)}</span>
                          <span className="capitalize">{lead.source.replace('_', ' ')}</span>
                        </div>
                      </TableCell>

                      {/* Score */}
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{lead.score}</span>
                          <Badge className={leadsHelpers.getScoreBandColor(lead.scoreBand)} variant="outline">
                            {lead.scoreBand}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Owner */}
                      <TableCell>
                        {lead.ownerName ? (
                          <div className="flex items-center space-x-1">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{lead.ownerName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge className={leadsHelpers.getStatusColor(lead.status)} variant="outline">
                          {lead.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>

                      {/* SLA */}
                      <TableCell>
                        <SLACountdown lead={lead} />
                      </TableCell>

                      {/* Created */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {leadsHelpers.formatRelativeTime(lead.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} leads
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
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
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsInbox;
