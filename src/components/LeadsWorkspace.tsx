import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { getSourceConfig } from "@/lib/sourceMapping";
import { 
  RefreshCw, 
  Search, 
  Filter,
  Clock,
  AlertCircle,
  User,
  Building,
  Mail,
  Eye,
  Flame,
  Users,
  UserCheck,
  CheckCircle,
  TrendingUp,
  Settings,
  ChevronDown,
  MessageSquare,
  Calendar,
  Pause,
  Play,
  X,
  UserPlus,
  MoreHorizontal,
  Bookmark,
  BookmarkCheck,
  AlertTriangle,
  Info,
  ArrowUpDown,
  ChevronRight,
  Avatar,
  Bot,
  UserX
} from "lucide-react";

// Types for the team workspace
interface SDR {
  id: string;
  name: string;
  email: string;
  status: 'available' | 'busy' | 'ooo';
  avatar?: string;
  openLeads?: number;
  maxOpenLeads?: number;
  presenceStatus?: 'available' | 'in_meeting' | 'ooo';
}

interface AuditEvent {
  id: string;
  leadId: string;
  event: string;
  reason: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

interface Lead {
  id: string;
  name?: string;
  email: string;
  company?: string;
  source: string;
  campaign?: string;
  score: number;
  scoreBand: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
  assigned_to?: string; // New field for assigned SDR ID
  assignedToName?: string; // SDR name
  assignment_type?: 'auto' | 'manual';
  assignment_ruleLabel?: string; // e.g., 'Round Robin', 'Capacity', 'Territory'
  assignedAt?: string;
  auditReason?: string; // Top audit reason for tooltip
  slaMinutesRemaining?: number;
  slaStatus?: 'overdue' | 'due_soon' | 'on_track';
  isHot: boolean;
  createdAt: string;
  intentTags?: string[];
  isViewing?: string;
  nextStep?: string;
  // Legacy fields for backward compatibility
  ownerId?: string;
  ownerName?: string;
  assignmentType?: 'auto' | 'manual';
}

interface SavedView {
  id: string;
  name: string;
  filters: LeadFilters;
  isDefault?: boolean;
}

interface LeadFilters {
  status?: string;
  scoreMin?: number;
  scoreMax?: number;
  sla?: string;
  source?: string;
  owner?: string;
  assignmentType?: 'auto' | 'manual' | 'all';
  routingRule?: 'round_robin' | 'capacity' | 'territory' | 'all';
  created?: string;
  search?: string;
  sortBy?: 'created' | 'score' | 'owner' | 'sla';
  groupByOwner?: boolean;
}

interface WorkspaceProps {
  currentUser?: {
    id: string;
    name: string;
    role: 'sdr' | 'manager';
  };
}

// Mock data generators
const generateMockSDRs = (): SDR[] => [
  { id: 'ava', name: 'Ava Chen', email: 'ava@company.com', status: 'available', openLeads: 8, maxOpenLeads: 15, presenceStatus: 'available' },
  { id: 'ben', name: 'Ben Rodriguez', email: 'ben@company.com', status: 'available', openLeads: 12, maxOpenLeads: 20, presenceStatus: 'available' },
  { id: 'cruz', name: 'Cruz Williams', email: 'cruz@company.com', status: 'busy', openLeads: 18, maxOpenLeads: 20, presenceStatus: 'in_meeting' },
  { id: 'dana', name: 'Dana Thompson', email: 'dana@company.com', status: 'available', openLeads: 5, maxOpenLeads: 12, presenceStatus: 'available' },
  { id: 'eli', name: 'Eli Johnson', email: 'eli@company.com', status: 'ooo', openLeads: 0, maxOpenLeads: 15, presenceStatus: 'ooo' },
  { id: 'freya', name: 'Freya Martinez', email: 'freya@company.com', status: 'available', openLeads: 10, maxOpenLeads: 18, presenceStatus: 'available' },
];

const generateMockLeads = (sdrs: SDR[]): Lead[] => {
  const sources = ['Form', 'Email', 'DM', 'Event', 'Demo', 'YouTube'];
  const companies = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Future Systems', 'DataFlow', 'CloudTech', 'SmartOps'];
  const intentTags = ['pricing', 'demo_request', 'booked_meeting', 'competitor_comparison', 'feature_inquiry'];
  
  const leads: Lead[] = [];
  
  for (let i = 1; i <= 25; i++) {
    const score = Math.floor(Math.random() * 80) + 20; // 20-100
    const scoreBand = score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW';
    const source = sources[Math.floor(Math.random() * sources.length)];
    const company = companies[Math.floor(Math.random() * companies.length)];
    const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
    const isRecent = new Date(createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Hot lead logic - score >=80 OR source=Demo/YouTube
    const hasHighScore = score >= 80;
    const isHotSource = source === 'Demo' || source === 'YouTube';
    const isRecentFormOrDemo = isRecent && (source === 'Form' || source === 'Demo');
    const hasHotIntent = Math.random() < 0.3 && ['pricing', 'booked_meeting'].includes(intentTags[Math.floor(Math.random() * intentTags.length)]);
    const isHot = hasHighScore || isHotSource || isRecentFormOrDemo || hasHotIntent;
    
    // Assign some leads to SDRs
    const isAssigned = Math.random() < 0.6;
    const assignedSDR = isAssigned ? sdrs[Math.floor(Math.random() * sdrs.length)] : null;
    
    // Determine assignment type - 40% auto-assigned, 60% manual
    const assignment_type = assignedSDR ? (Math.random() < 0.4 ? 'auto' : 'manual') : undefined;
    const assignedAt = assignedSDR ? new Date(new Date(createdAt).getTime() + Math.random() * 2 * 60 * 60 * 1000).toISOString() : undefined;
    
    // Generate routing rule labels for auto-assigned leads
    const routingRules = ['Round Robin', 'Capacity Based', 'Territory'];
    const assignment_ruleLabel = assignment_type === 'auto' ? routingRules[Math.floor(Math.random() * routingRules.length)] : undefined;
    
    // Generate audit reasons
    const auditReasons = [
      'Assigned by Round Robin rule',
      'Assigned based on capacity availability',
      'Territory match: West Coast',
      'Manual assignment by manager',
      'Skill match: Enterprise deals',
      'Previous relationship with company'
    ];
    const auditReason = assignedSDR ? auditReasons[Math.floor(Math.random() * auditReasons.length)] : undefined;
    
    // SLA logic - hot leads get 10m, others get 2h
    const slaMinutes = isHot ? 10 : 120;
    const minutesSinceCreated = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60);
    const slaMinutesRemaining = Math.max(0, slaMinutes - minutesSinceCreated);
    const slaStatus = slaMinutesRemaining <= 0 ? 'overdue' : slaMinutesRemaining <= 5 ? 'due_soon' : 'on_track';
    
    const status = assignedSDR ? (Math.random() < 0.3 ? 'IN_PROGRESS' : 'ASSIGNED') : 'NEW';
    
    leads.push({
      id: `lead-${i}`,
      name: `Lead ${i}`,
      email: `lead${i}@example.com`,
      company,
      source,
      campaign: `Campaign ${Math.floor(Math.random() * 5) + 1}`,
      score,
      scoreBand,
      status,
      assigned_to: assignedSDR?.id,
      assignedToName: assignedSDR?.name,
      assignment_type,
      assignment_ruleLabel,
      assignedAt,
      auditReason,
      slaMinutesRemaining: Math.floor(slaMinutesRemaining),
      slaStatus,
      isHot,
      createdAt,
      intentTags: Math.random() < 0.4 ? [intentTags[Math.floor(Math.random() * intentTags.length)]] : undefined,
      nextStep: assignedSDR && Math.random() < 0.7 ? ['Email follow-up', 'Schedule demo', 'Send pricing', 'Connect on LinkedIn'][Math.floor(Math.random() * 4)] : undefined,
      // Legacy fields for backward compatibility
      ownerId: assignedSDR?.id,
      ownerName: assignedSDR?.name,
      assignmentType: assignment_type,
    });
  }
  
  // Sort hot leads to top
  return leads.sort((a, b) => {
    if (a.isHot && !b.isHot) return -1;
    if (!a.isHot && b.isHot) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

const LeadsWorkspace: React.FC<WorkspaceProps> = ({ 
  currentUser = { id: 'ava', name: 'Ava Chen', role: 'sdr' }
}) => {
  const navigate = useNavigate();
  
  // Data - Load from API in production
  const [sdrs, setSdrs] = useState<SDR[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('team-inbox');
  const [isOOO, setIsOOO] = useState(false);
  const [conversationDrawerLead, setConversationDrawerLead] = useState<Lead | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [drawerActiveTab, setDrawerActiveTab] = useState<string>('conversation');
  
  // Filters and search
  const [filters, setFilters] = useState<LeadFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  // Load saved views from localStorage
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    const stored = localStorage.getItem('leads-saved-views');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse saved views from localStorage');
      }
    }
    // Default views
    return [
      { id: 'unassigned', name: 'Unassigned', filters: { owner: 'unassigned' }, isDefault: true },
      { id: 'overdue', name: 'Overdue SLAs', filters: { sla: 'overdue' } },
      { id: 'high-score', name: 'High Score (≥80)', filters: { scoreMin: 80 } },
      { id: 'hot-24h', name: 'Hot Last 24h', filters: {} }, // Special filter for hot leads
    ];
  });
  const [selectedView, setSelectedView] = useState<string>('');
  
  // Load real data on component mount
  useEffect(() => {
    loadLeadsData();
  }, []);

  const loadLeadsData = async () => {
    try {
      // In production, load from API
      const response = await fetch('/api/leads', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllLeads(data.leads || []);
      }
      
      // Load SDR data
      const sdrResponse = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        }
      });
      
      if (sdrResponse.ok) {
        const sdrData = await sdrResponse.json();
        setSdrs(sdrData.users || []);
      }
    } catch (error) {
      console.error('Failed to load leads data:', error);
      // Fallback to empty arrays for now
      setAllLeads([]);
      setSdrs([]);
    }
  };

  // Persist saved views to localStorage
  useEffect(() => {
    localStorage.setItem('leads-saved-views', JSON.stringify(savedViews));
  }, [savedViews]);
  
  // Live SLA countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      // Update SLA countdowns for all leads
      allLeads.forEach(lead => {
        if (lead.slaMinutesRemaining !== undefined && lead.slaMinutesRemaining > 0) {
          lead.slaMinutesRemaining = Math.max(0, lead.slaMinutesRemaining - 1);
          
          // Update SLA status based on remaining time
          if (lead.slaMinutesRemaining <= 0) {
            lead.slaStatus = 'overdue';
          } else if (lead.slaMinutesRemaining <= 5) {
            lead.slaStatus = 'due_soon';
          } else {
            lead.slaStatus = 'on_track';
          }
        }
      });
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [allLeads]);
  
  // Soft lock management - simulate viewing state
  const [viewingStates, setViewingStates] = useState<Record<string, { user: string; timestamp: number }>>({});
  
  useEffect(() => {
    // Clean up old viewing states (older than 90 seconds)
    const cleanup = setInterval(() => {
      const now = Date.now();
      setViewingStates(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(leadId => {
          if (now - updated[leadId].timestamp > 90000) { // 90 seconds
            delete updated[leadId];
          }
        });
        return updated;
      });
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(cleanup);
  }, []);
  
  // Computed data based on filters and tab
  const filteredLeads = useMemo(() => {
    let leads = [...allLeads];
    
    // Tab filtering
    switch (activeTab) {
      case 'team-inbox':
        leads = leads.filter(lead => !lead.ownerId);
        break;
      case 'my-queue':
        leads = leads.filter(lead => lead.ownerId === currentUser.id);
        break;
      case 'shared':
        leads = leads.filter(lead => lead.ownerId && lead.ownerId !== currentUser.id);
        break;
      case 'manager-view':
        // Manager view shows all leads with priority on overdue SLAs and hot leads
        leads = leads.sort((a, b) => {
          // Overdue SLAs first
          if (a.slaStatus === 'overdue' && b.slaStatus !== 'overdue') return -1;
          if (a.slaStatus !== 'overdue' && b.slaStatus === 'overdue') return 1;
          // Then hot leads
          if (a.isHot && !b.isHot) return -1;
          if (!a.isHot && b.isHot) return 1;
          return 0;
        });
        break;
      // 'all' shows everything
    }
    
    // Special handling for hot leads view
    if (selectedView === 'hot-24h') {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      leads = leads.filter(lead => 
        lead.isHot && new Date(lead.createdAt) > last24h
      );
    }
    
    // Apply filters
    if (filters.status && filters.status !== 'all') {
      leads = leads.filter(lead => lead.status === filters.status);
    }
    
    if (filters.scoreMin !== undefined) {
      leads = leads.filter(lead => lead.score >= filters.scoreMin!);
    }
    
    if (filters.scoreMax !== undefined) {
      leads = leads.filter(lead => lead.score <= filters.scoreMax!);
    }
    
    if (filters.sla && filters.sla !== 'all') {
      if (filters.sla === 'overdue') {
        leads = leads.filter(lead => lead.slaStatus === 'overdue');
      } else if (filters.sla === 'due_soon') {
        leads = leads.filter(lead => lead.slaStatus === 'due_soon');
      }
    }
    
    if (filters.source && filters.source !== 'all') {
      leads = leads.filter(lead => lead.source === filters.source);
    }
    
    if (filters.owner && filters.owner !== 'all') {
      if (filters.owner === 'unassigned') {
        leads = leads.filter(lead => !lead.ownerId);
      } else {
        leads = leads.filter(lead => lead.ownerId === filters.owner);
      }
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      leads = leads.filter(lead => 
        lead.name?.toLowerCase().includes(term) ||
        lead.email.toLowerCase().includes(term) ||
        lead.company?.toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    leads.sort((a, b) => {
      // Hot leads always at top within their group
      if (a.isHot && !b.isHot) return -1;
      if (!a.isHot && b.isHot) return 1;
      
      // Within hot/non-hot groups, sort by selected criteria
      switch (filters.sortBy) {
        case 'score':
          return b.score - a.score;
        case 'owner':
          if (!a.ownerName && !b.ownerName) return 0;
          if (!a.ownerName) return 1;
          if (!b.ownerName) return -1;
          return a.ownerName.localeCompare(b.ownerName);
        case 'sla':
          if (a.slaStatus === 'overdue' && b.slaStatus !== 'overdue') return -1;
          if (a.slaStatus !== 'overdue' && b.slaStatus === 'overdue') return 1;
          if (a.slaMinutesRemaining !== undefined && b.slaMinutesRemaining !== undefined) {
            return a.slaMinutesRemaining - b.slaMinutesRemaining;
          }
          return 0;
        default: // 'created'
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return leads;
  }, [allLeads, activeTab, filters, searchTerm, currentUser.id, selectedView]);

  // Group leads by owner if groupByOwner is enabled
  const groupedLeads = useMemo(() => {
    if (!filters.groupByOwner) {
      return { ungrouped: filteredLeads };
    }

    const groups: Record<string, Lead[]> = {};
    
    filteredLeads.forEach(lead => {
      const groupKey = lead.ownerName || 'Unassigned';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(lead);
    });

    // Sort group keys
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Unassigned') return -1;
      if (b === 'Unassigned') return 1;
      return a.localeCompare(b);
    });

    const sortedGroups: Record<string, Lead[]> = {};
    sortedGroupKeys.forEach(key => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [filteredLeads, filters.groupByOwner]);
  
  // KPI calculations
  const kpis = useMemo(() => {
    const total = allLeads.length;
    const newLeads = allLeads.filter(l => l.status === 'NEW').length;
    const assigned = allLeads.filter(l => l.status === 'ASSIGNED').length;
    const inProgress = allLeads.filter(l => l.status === 'IN_PROGRESS').length;
    const closed = allLeads.filter(l => l.status === 'CLOSED').length;
    const overdue = allLeads.filter(l => l.slaStatus === 'overdue').length;
    const hotLeads = allLeads.filter(l => l.isHot && new Date(l.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length;
    const unassigned = allLeads.filter(l => !l.assigned_to).length;
    
    // Auto-assigned today calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const autoAssignedToday = allLeads.filter(l => 
      l.assignment_type === 'auto' && 
      l.assignedAt && 
      new Date(l.assignedAt) >= today
    ).length;
    
    return { total, newLeads, assigned, inProgress, closed, overdue, hotLeads, autoAssignedToday, unassigned };
  }, [allLeads]);
  
  // Tab counts
  const tabCounts = useMemo(() => {
    const teamInbox = allLeads.filter(l => !l.ownerId).length;
    const myQueue = allLeads.filter(l => l.ownerId === currentUser.id).length;
    const shared = allLeads.filter(l => l.ownerId && l.ownerId !== currentUser.id).length;
    const overdueCount = allLeads.filter(l => l.slaStatus === 'overdue').length;
    
    return { teamInbox, myQueue, shared, overdue: overdueCount };
  }, [allLeads, currentUser.id]);
  
  // Handlers
  const handleClaimLead = useCallback((leadId: string) => {
    const lead = allLeads.find(l => l.id === leadId);
    if (lead && !lead.assigned_to) {
      // In real app, this would be POST /leads/:id/claim
      lead.assigned_to = currentUser.id;
      lead.assignedToName = currentUser.name;
      lead.assignment_type = 'manual';
      lead.assignedAt = new Date().toISOString();
      lead.auditReason = 'Manual claim by SDR';
      lead.status = 'ASSIGNED';
      
      // Update legacy fields for compatibility
      lead.ownerId = currentUser.id;
      lead.ownerName = currentUser.name;
      lead.assignmentType = 'manual';
      
      toast.success(`Claimed ${lead.name || lead.email}`);
      
      // Remove from selected if it was selected
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
    }
  }, [allLeads, currentUser]);
  
  const handleBulkAssign = useCallback((ownerId: string) => {
    const sdr = sdrs.find(s => s.id === ownerId);
    if (!sdr) return;
    
    selectedLeads.forEach(leadId => {
      const lead = allLeads.find(l => l.id === leadId);
      if (lead) {
        lead.ownerId = ownerId;
        lead.ownerName = sdr.name;
        lead.assignmentType = 'manual';
        lead.assignedAt = new Date().toISOString();
        lead.status = 'ASSIGNED';
      }
    });
    
    toast.success(`Assigned ${selectedLeads.length} leads to ${sdr.name}`);
    setSelectedLeads([]);
  }, [selectedLeads, allLeads, sdrs]);

  const handleReassignLead = useCallback((leadId: string, newOwnerId: string) => {
    const lead = allLeads.find(l => l.id === leadId);
    const sdr = sdrs.find(s => s.id === newOwnerId);
    
    if (lead && sdr) {
      // In real app, this would be POST /leads/:id/reassign
      const oldOwner = lead.assignedToName;
      lead.assigned_to = newOwnerId;
      lead.assignedToName = sdr.name;
      lead.assignment_type = 'manual';
      lead.assignedAt = new Date().toISOString();
      lead.auditReason = 'Manual reassignment by manager';
      
      // Update legacy fields for compatibility
      lead.ownerId = newOwnerId;
      lead.ownerName = sdr.name;
      lead.assignmentType = 'manual';
      
      toast.success(`Reassigned lead from ${oldOwner || 'Unassigned'} to ${sdr.name}`);
    }
  }, [allLeads, sdrs]);
  
  const handleApplySavedView = useCallback((viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    if (view) {
      setFilters(view.filters);
      setSelectedView(viewId);
      
      // Special handling for hot leads view
      if (viewId === 'hot-24h') {
        // Filter will be applied in the computed filteredLeads
      }
    }
  }, [savedViews]);

  const handleKPIClick = useCallback((filterType: string) => {
    switch (filterType) {
      case 'auto-assigned':
        setFilters(prev => ({ ...prev, assignmentType: 'auto' }));
        break;
      case 'unassigned':
        setFilters(prev => ({ ...prev, owner: 'unassigned' }));
        setActiveTab('team-inbox');
        break;
      default:
        break;
    }
  }, []);
  
  const formatSLACountdown = (minutesRemaining?: number, status?: string) => {
    if (minutesRemaining === undefined) return '-';
    
    if (status === 'overdue') {
      const overdue = Math.abs(minutesRemaining);
      return `${overdue}m overdue`;
    }
    
    if (minutesRemaining < 60) {
      return `${minutesRemaining}m`;
    }
    
    const hours = Math.floor(minutesRemaining / 60);
    const mins = minutesRemaining % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };
  
  const getSLAChipColor = (status?: string) => {
    switch (status) {
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'due_soon': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <h1 className="text-2xl font-semibold">Leads Workspace</h1>
          
          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className={`grid w-fit ${currentUser.role === 'manager' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="team-inbox" className="relative">
                Team Inbox
                {tabCounts.teamInbox > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    {tabCounts.teamInbox}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="my-queue" className="relative">
                My Queue
                {tabCounts.myQueue > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    {tabCounts.myQueue}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="shared" className="relative">
                Shared
                {tabCounts.shared > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                    {tabCounts.shared}
                  </Badge>
                )}
              </TabsTrigger>
              {currentUser.role === 'manager' && (
                <TabsTrigger value="manager-view" className="relative">
                  Manager View
                  {tabCounts.overdue > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-5 text-xs">
                      {tabCounts.overdue}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          
          {/* Unibox Button */}
          <Button 
            variant="outline" 
            onClick={() => navigate('/unibox?tab=unassigned')}
            className="flex items-center space-x-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Unibox</span>
          </Button>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Saved Views */}
          <Select value={selectedView} onValueChange={handleApplySavedView}>
            <SelectTrigger className="w-48">
              <Bookmark className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Saved Views" />
            </SelectTrigger>
            <SelectContent>
              {savedViews.map(view => (
                <SelectItem key={view.id} value={view.id}>
                  <div className="flex items-center">
                    {view.isDefault && <BookmarkCheck className="w-3 h-3 mr-2" />}
                    {view.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          {/* OOO Toggle */}
          <Button
            variant={isOOO ? "destructive" : "outline"}
            size="sm"
            onClick={() => setIsOOO(!isOOO)}
          >
            {isOOO ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isOOO ? 'OOO' : 'Available'}
          </Button>
          
          {/* Refresh */}
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{kpis.total}</p>
              </div>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-2xl font-bold">{kpis.newLeads}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Assigned</p>
                <p className="text-2xl font-bold">{kpis.assigned}</p>
              </div>
              <UserCheck className="w-5 h-5 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{kpis.inProgress}</p>
              </div>
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-purple-50"
          onClick={() => handleKPIClick('auto-assigned')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Auto-Assigned</p>
                <p className="text-2xl font-bold">{kpis.autoAssignedToday}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-gray-50"
          onClick={() => handleKPIClick('unassigned')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unassigned</p>
                <p className="text-2xl font-bold">{kpis.unassigned}</p>
              </div>
              <UserX className="w-5 h-5 text-gray-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold">{kpis.closed}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={kpis.overdue > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue SLAs</p>
                <p className="text-2xl font-bold text-red-600">{kpis.overdue}</p>
              </div>
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={kpis.hotLeads > 0 ? 'border-orange-200 bg-orange-50 cursor-pointer hover:bg-orange-100' : 'cursor-pointer'}
          onClick={() => handleApplySavedView('hot-24h')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hot Leads</p>
                <p className="text-2xl font-bold text-orange-600">{kpis.hotLeads}</p>
                <p className="text-xs text-muted-foreground">Last 24h</p>
              </div>
              <Flame className="w-5 h-5 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filters.status || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? undefined : value }))}>
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

        <Select value={filters.sla || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, sla: value === 'all' ? undefined : value }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="SLA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All SLA</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="due_soon">Due Soon</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.source || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, source: value === 'all' ? undefined : value }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="Form">Form</SelectItem>
            <SelectItem value="Email">Email</SelectItem>
            <SelectItem value="DM">DM</SelectItem>
            <SelectItem value="Event">Event</SelectItem>
            <SelectItem value="Demo">Demo</SelectItem>
            <SelectItem value="YouTube">YouTube</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.owner || 'all'} onValueChange={(value) => {
          if (value === 'me') {
            // Switch to My Queue tab and filter by current user
            setActiveTab('my-queue');
            setFilters(prev => ({ ...prev, owner: currentUser.id }));
          } else {
            setFilters(prev => ({ ...prev, owner: value === 'all' ? undefined : value }));
          }
        }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            <SelectItem value="me">Me</SelectItem>
            {sdrs.map(sdr => (
              <SelectItem key={sdr.id} value={sdr.id}>{sdr.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort By */}
        <Select value={filters.sortBy || 'created'} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value as LeadFilters['sortBy'] }))}>
          <SelectTrigger className="w-40">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Created Date</SelectItem>
            <SelectItem value="score">Score</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="sla">SLA Time</SelectItem>
          </SelectContent>
        </Select>

        {/* Assignment Type Filter */}
        <Select value={filters.assignmentType || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, assignmentType: value === 'all' ? undefined : value as 'auto' | 'manual' }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Assignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignments</SelectItem>
            <SelectItem value="auto">Auto-Assigned</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        {/* Routing Rule Filter */}
        <Select value={filters.routingRule || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, routingRule: value === 'all' ? undefined : value as any }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Routing Rule" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rules</SelectItem>
            <SelectItem value="round_robin">Round Robin</SelectItem>
            <SelectItem value="capacity">Capacity Based</SelectItem>
            <SelectItem value="territory">Territory</SelectItem>
          </SelectContent>
        </Select>

        {/* Group by Owner Toggle */}
        <Button
          variant={filters.groupByOwner ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters(prev => ({ ...prev, groupByOwner: !prev.groupByOwner }))}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Group by Owner
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedLeads.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium">
                  {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
                </span>
                <Button size="sm" variant="outline" onClick={() => setSelectedLeads([])}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Select onValueChange={handleBulkAssign}>
                  <SelectTrigger className="w-48">
                    <UserPlus className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Assign to Rep" />
                  </SelectTrigger>
                  <SelectContent>
                    {sdrs.filter(sdr => sdr.status === 'available').map(sdr => (
                      <SelectItem key={sdr.id} value={sdr.id}>
                        {sdr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select onValueChange={(status) => {
                  selectedLeads.forEach(leadId => {
                    const lead = allLeads.find(l => l.id === leadId);
                    if (lead) {
                      lead.status = status as Lead['status'];
                    }
                  });
                  toast.success(`Updated status for ${selectedLeads.length} leads`);
                  setSelectedLeads([]);
                }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Change Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select onValueChange={(tag) => {
                  selectedLeads.forEach(leadId => {
                    const lead = allLeads.find(l => l.id === leadId);
                    if (lead) {
                      if (!lead.intentTags) lead.intentTags = [];
                      if (!lead.intentTags.includes(tag)) {
                        lead.intentTags.push(tag);
                      }
                    }
                  });
                  toast.success(`Tagged ${selectedLeads.length} leads with "${tag}"`);
                  setSelectedLeads([]);
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="demo-ready">Demo Ready</SelectItem>
                    <SelectItem value="nurture">Nurture</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

              {/* Duplicate Detection Banner */}
        {filteredLeads.some(lead => lead.email === 'lead5@example.com' || lead.email === 'lead12@example.com') && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <h3 className="font-medium text-yellow-800">Potential Duplicates Detected</h3>
                    <p className="text-sm text-yellow-700">
                      2 leads may be duplicates based on email addresses. Review for deduplication.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" className="bg-white">
                    Review Duplicates
                  </Button>
                  <Button size="sm" variant="ghost">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* SDR Availability Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Availability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {sdrs.map((sdr) => {
              const capacityPercentage = ((sdr.openLeads || 0) / (sdr.maxOpenLeads || 1)) * 100;
              const getPresenceDotColor = (status?: string) => {
                switch (status) {
                  case 'available': return 'bg-green-500';
                  case 'in_meeting': return 'bg-yellow-500';
                  case 'ooo': return 'bg-red-500';
                  default: return 'bg-gray-400';
                }
              };
              
              return (
                <div key={sdr.id} className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {sdr.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getPresenceDotColor(sdr.presenceStatus)}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{sdr.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {sdr.openLeads}/{sdr.maxOpenLeads} leads
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div 
                        className={`h-1.5 rounded-full transition-all ${
                          capacityPercentage >= 90 ? 'bg-red-500' :
                          capacityPercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

        {/* Main Content */}
      <div className="flex gap-6">
        {/* Table */}
        <div className={`${conversationDrawerLead ? 'w-2/3' : 'w-full'} transition-all duration-300`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {activeTab === 'team-inbox' ? 'Team Inbox' :
                   activeTab === 'my-queue' ? 'My Queue' :
                   activeTab === 'shared' ? 'Shared Leads' :
                   activeTab === 'manager-view' ? 'Manager View' : 'All Leads'}
                  <span className="text-muted-foreground ml-2">({filteredLeads.length})</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedLeads(filteredLeads.map(l => l.id));
                            } else {
                              setSelectedLeads([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Name • Company</TableHead>
                      <TableHead>Hot</TableHead>
                      <TableHead>Source/Campaign</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Owner/Claim</TableHead>
                      <TableHead className="w-16">Why</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow 
                        key={lead.id}
                        className={`cursor-pointer hover:bg-muted/50 ${lead.isHot ? 'bg-red-50 border-l-4 border-l-red-500' : ''}`}
                        onClick={() => {
                          setConversationDrawerLead(lead);
                          // Set viewing state
                          setViewingStates(prev => ({
                            ...prev,
                            [lead.id]: { user: currentUser.name, timestamp: Date.now() }
                          }));
                        }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedLeads(prev => [...prev, lead.id]);
                              } else {
                                setSelectedLeads(prev => prev.filter(id => id !== lead.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3">
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
                              {lead.company && (
                                <div className="text-sm text-muted-foreground flex items-center">
                                  <Building className="w-3 h-3 mr-1" />
                                  {lead.company}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.isHot && (
                            <div className="flex items-center">
                              <span className="text-lg mr-1">🔥</span>
                              <span className="text-xs font-medium text-red-600">HOT</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const config = getSourceConfig(lead.source);
                              const IconComponent = config.icon;
                              return (
                                <>
                                  <div 
                                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" 
                                    style={{ backgroundColor: `${config.color}20` }}
                                  >
                                    <IconComponent className="w-3 h-3" style={{ color: config.color }} />
                                  </div>
                                  <div className="min-w-0">
                                    <Badge 
                                      variant="outline" 
                                      className="mb-1 text-xs" 
                                      style={{ borderColor: `${config.color}40`, color: config.color }}
                                    >
                                      {config.label}
                                    </Badge>
                                    {lead.campaign && (
                                      <div className="text-xs text-muted-foreground truncate">{lead.campaign}</div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {activeTab === 'team-inbox' && !lead.assigned_to ? (
                            <div className="space-y-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleClaimLead(lead.id)}
                                disabled={viewingStates[lead.id] && viewingStates[lead.id].user !== currentUser.name}
                              >
                                Claim
                              </Button>
                              {viewingStates[lead.id] && viewingStates[lead.id].user !== currentUser.name && (
                                <div className="text-xs text-muted-foreground">
                                  {viewingStates[lead.id].user} is viewing...
                                </div>
                              )}
                            </div>
                          ) : lead.assignedToName ? (
                            <div className="flex items-center space-x-2">
                              {/* Avatar */}
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium text-primary">
                                  {lead.assignedToName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              
                              {/* Name and Badge */}
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">{lead.assignedToName}</span>
                                <div className="flex items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      {lead.assignment_type === 'auto' ? (
                                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-neutral-50 text-neutral-700 border-neutral-200 cursor-help">
                                          Auto • {lead.assignment_ruleLabel}
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                          Manual
                                        </Badge>
                                      )}
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{lead.auditReason}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        {/* Why Column - Hover-only chip */}
                        <TableCell>
                          {lead.assigned_to && lead.auditReason && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-help transition-colors">
                                  <Info className="w-3 h-3 text-gray-500" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{lead.auditReason}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.slaMinutesRemaining !== undefined ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className={getSLAChipColor(lead.slaStatus)}
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatSLACountdown(lead.slaMinutesRemaining, lead.slaStatus)}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {lead.slaStatus === 'overdue' 
                                    ? `Overdue by ${Math.abs(lead.slaMinutesRemaining)} minutes`
                                    : lead.slaStatus === 'due_soon'
                                    ? `Due in ${lead.slaMinutesRemaining} minutes (${lead.isHot ? '10m' : '2h'} SLA)`
                                    : `${lead.slaMinutesRemaining} minutes remaining (${lead.isHot ? '10m' : '2h'} SLA)`
                                  }
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
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
                          <span className="text-sm text-muted-foreground">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center space-x-1">
                            {activeTab === 'my-queue' && lead.ownerId === currentUser.id && (
                              <>
                                <Button variant="ghost" size="sm">
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Calendar className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {/* Reassign option for managers or if lead is assigned */}
                                {(currentUser.role === 'manager' || lead.ownerId) && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <UserX className="w-4 h-4 mr-2" />
                                      Reassign to
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {sdrs.filter(sdr => sdr.status === 'available' && sdr.id !== lead.ownerId).map(sdr => (
                                        <DropdownMenuItem 
                                          key={sdr.id}
                                          onClick={() => handleReassignLead(lead.id, sdr.id)}
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                                              <span className="text-xs font-medium text-primary">
                                                {sdr.name.charAt(0).toUpperCase()}
                                              </span>
                                            </div>
                                            {sdr.name}
                                          </div>
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                )}
                                
                                <DropdownMenuItem>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                
                                <DropdownMenuItem>
                                  <MessageSquare className="w-4 h-4 mr-2" />
                                  Add Note
                                </DropdownMenuItem>
                                
                                {lead.ownerId === currentUser.id && (
                                  <DropdownMenuItem>
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Schedule Follow-up
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {filteredLeads.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No leads found</h3>
                      <p>Try adjusting your filters or search terms</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversation Drawer */}
        {conversationDrawerLead && (
          <div className="w-1/3">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg">
                  {conversationDrawerLead.name || conversationDrawerLead.email}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setConversationDrawerLead(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <Tabs value={drawerActiveTab} onValueChange={setDrawerActiveTab} className="h-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="conversation">Conversation</TabsTrigger>
                    <TabsTrigger value="routing">Routing</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="conversation" className="mt-4">
                    <ScrollArea className="h-80">
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          Conversation thread and internal notes with @mentions would appear here...
                        </div>
                        
                        {/* Mock conversation */}
                        <div className="space-y-3">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="text-sm font-medium">Form Submission</div>
                            <div className="text-xs text-muted-foreground">2 hours ago</div>
                            <div className="text-sm mt-1">Interested in pricing for enterprise plan</div>
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm font-medium">Internal Note</div>
                            <div className="text-xs text-muted-foreground">1 hour ago • @{currentUser.name}</div>
                            <div className="text-sm mt-1">High-value prospect, prioritize for demo</div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                    
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex space-x-2">
                        <Input placeholder="Add internal note or @mention..." className="flex-1" />
                        <Button size="sm">Send</Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="routing" className="mt-4">
                    <ScrollArea className="h-80">
                      <div className="space-y-4">
                        {/* Assignment Info */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Assignment Details</h4>
                            {conversationDrawerLead?.assignedAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(conversationDrawerLead.assignedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Assigned to:</span>
                              <div className="flex items-center gap-2">
                                {conversationDrawerLead?.assignedToName ? (
                                  <>
                                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                      <span className="text-xs font-medium text-primary">
                                        {conversationDrawerLead.assignedToName.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium">{conversationDrawerLead.assignedToName}</span>
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Unassigned</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Assignment type:</span>
                              <div className="flex items-center gap-2">
                                {conversationDrawerLead?.assignment_type === 'auto' ? (
                                  <Badge variant="outline" className="text-xs px-2 py-1 bg-neutral-50 text-neutral-700 border-neutral-200">
                                    Auto • {conversationDrawerLead.assignment_ruleLabel}
                                  </Badge>
                                ) : conversationDrawerLead?.assignment_type === 'manual' ? (
                                  <Badge variant="secondary" className="text-xs px-2 py-1">
                                    Manual
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Not assigned</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Audit Events */}
                        <div className="space-y-3">
                          <h4 className="font-medium">Assignment History</h4>
                          <div className="space-y-2">
                            {conversationDrawerLead?.auditReason && (
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <div className="text-sm font-medium">Assignment Event</div>
                                <div className="text-xs text-muted-foreground">
                                  {conversationDrawerLead.assignedAt ? new Date(conversationDrawerLead.assignedAt).toLocaleString() : 'Recently'}
                                </div>
                                <div className="text-sm mt-1">{conversationDrawerLead.auditReason}</div>
                              </div>
                            )}
                            
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm font-medium">Lead Created</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(conversationDrawerLead?.createdAt || '').toLocaleString()}
                              </div>
                              <div className="text-sm mt-1">Lead entered system from {conversationDrawerLead?.source}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsWorkspace;
