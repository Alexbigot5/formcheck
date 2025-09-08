import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { leadsApi } from "@/lib/leadsApi";
import { 
  Inbox,
  Search,
  Filter,
  Clock,
  User,
  Star,
  Mail,
  MessageSquare,
  Globe,
  Linkedin,
  Instagram,
  Database,
  Calendar,
  Phone,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  Target,
  Activity,
  FileText,
  Send,
  Eye,
  MoreHorizontal,
  Plus
} from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  source: 'website_form' | 'shared_inbox' | 'instagram_dm' | 'linkedin_csv' | 'webhook' | 'manual';
  score: number;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed_won' | 'closed_lost';
  owner?: string;
  created_at: string;
  last_activity: string;
  sla_status: 'on_time' | 'due_soon' | 'overdue';
  sla_due: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
}

interface TimelineEvent {
  id: string;
  type: 'form_submission' | 'email_sent' | 'email_received' | 'dm_received' | 'crm_sync' | 'follow_up' | 'note' | 'call' | 'meeting';
  title: string;
  description: string;
  timestamp: string;
  source: string;
  data?: any;
  user?: string;
}

interface LeadFilters {
  search: string;
  source: string;
  sla_status: string;
  owner: string;
  score_band: string;
  status: string;
  priority: string;
}

const UnifiedLeadInbox: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadFilters>({
    search: '',
    source: 'all',
    sla_status: 'all',
    owner: 'all',
    score_band: 'all',
    status: 'all',
    priority: 'all'
  });

  useEffect(() => {
    // SEO
    document.title = "Lead Inbox | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Unified lead inbox with timeline view of all lead activities and communications.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/leads`);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) navigate("/login");
    });

    loadLeads();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadLeads = async () => {
    try {
      // Load real leads from API
      const response = await leadsApi.getLeads({ limit: 100 });
      
      // Convert API leads to component format
      const convertedLeads: Lead[] = response.leads.map(apiLead => ({
        id: apiLead.id,
        name: apiLead.name || '',
        email: apiLead.email || '',
        company: apiLead.company || '',
        phone: apiLead.phone || '',
        source: apiLead.source,
        score: apiLead.score,
        status: apiLead.status.toLowerCase() as Lead['status'],
        owner: apiLead.ownerName || apiLead.owner?.user.email || '',
        created_at: apiLead.createdAt,
        last_activity: apiLead.updatedAt,
        sla_status: apiLead.slaStatus || 'on_time',
        sla_due: apiLead.slaCountdown?.targetAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        tags: [], // API doesn't have tags field yet
        priority: apiLead.scoreBand === 'HIGH' ? 'high' : apiLead.scoreBand === 'MEDIUM' ? 'medium' : 'low'
      }));

      setLeads(convertedLeads);
    } catch (error) {
      console.error("Error loading leads:", error);
      toast.error("Failed to load leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = (leadId: string) => {
    // Mock timeline data
    const mockTimeline: TimelineEvent[] = [
      {
        id: "event-1",
        type: "form_submission",
        title: "Form Submitted",
        description: "Contact form submitted from pricing page",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        source: "Website Form",
        data: { form_name: "Contact Form", page: "/pricing" }
      },
      {
        id: "event-2",
        type: "crm_sync",
        title: "Synced to CRM",
        description: "Lead automatically synced to HubSpot",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
        source: "HubSpot Integration"
      },
      {
        id: "event-3",
        type: "email_sent",
        title: "Welcome Email Sent",
        description: "Automated welcome email delivered",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
        source: "Email Automation",
        user: "System"
      },
      {
        id: "event-4",
        type: "follow_up",
        title: "Follow-up Scheduled",
        description: "Follow-up call scheduled for tomorrow 2PM",
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        source: "Manual",
        user: "john@company.com"
      },
      {
        id: "event-5",
        type: "note",
        title: "Note Added",
        description: "Interested in Enterprise plan, budget confirmed at $50k/year",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        source: "Manual",
        user: "john@company.com"
      }
    ];

    setTimeline(mockTimeline);
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'website_form': return <Globe className="h-4 w-4" />;
      case 'shared_inbox': return <Mail className="h-4 w-4" />;
      case 'instagram_dm': return <Instagram className="h-4 w-4" />;
      case 'linkedin_csv': return <Linkedin className="h-4 w-4" />;
      case 'webhook': return <Database className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'website_form': return 'Website Form';
      case 'shared_inbox': return 'Email Inbox';
      case 'instagram_dm': return 'Instagram DM';
      case 'linkedin_csv': return 'LinkedIn Import';
      case 'webhook': return 'Webhook';
      default: return 'Manual';
    }
  };

  const getSLAStatusIcon = (status: string) => {
    switch (status) {
      case 'on_time': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'due_soon': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'outline';
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'form_submission': return <FileText className="h-4 w-4" />;
      case 'email_sent': return <Send className="h-4 w-4" />;
      case 'email_received': return <Mail className="h-4 w-4" />;
      case 'dm_received': return <MessageSquare className="h-4 w-4" />;
      case 'crm_sync': return <Database className="h-4 w-4" />;
      case 'follow_up': return <Calendar className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'meeting': return <Users className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                         lead.email.toLowerCase().includes(filters.search.toLowerCase()) ||
                         (lead.company && lead.company.toLowerCase().includes(filters.search.toLowerCase()));
    
    const matchesSource = filters.source === 'all' || lead.source === filters.source;
    const matchesSLA = filters.sla_status === 'all' || lead.sla_status === filters.sla_status;
    const matchesOwner = filters.owner === 'all' || lead.owner === filters.owner;
    const matchesStatus = filters.status === 'all' || lead.status === filters.status;
    const matchesPriority = filters.priority === 'all' || lead.priority === filters.priority;
    
    const matchesScoreBand = filters.score_band === 'all' || 
      (filters.score_band === 'high' && lead.score >= 80) ||
      (filters.score_band === 'medium' && lead.score >= 60 && lead.score < 80) ||
      (filters.score_band === 'low' && lead.score < 60);

    return matchesSearch && matchesSource && matchesSLA && matchesOwner && matchesScoreBand && matchesStatus && matchesPriority;
  });

  const uniqueOwners = [...new Set(leads.map(lead => lead.owner).filter(Boolean))];

  if (selectedLead) {
    return (
      <Layout>
        <div>
            <div className="mb-6 flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedLead(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Inbox
              </Button>
            </div>

            {/* Lead Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">{selectedLead.name}</h1>
                  <p className="text-muted-foreground mt-1">{selectedLead.email}</p>
                  {selectedLead.company && (
                    <p className="text-sm text-muted-foreground">{selectedLead.company}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getScoreBadgeColor(selectedLead.score)}>
                    Score: {selectedLead.score}
                  </Badge>
                  <Badge variant={getPriorityBadgeColor(selectedLead.priority)}>
                    {selectedLead.priority} priority
                  </Badge>
                  {getSLAStatusIcon(selectedLead.sla_status)}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Source</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    {getSourceIcon(selectedLead.source)}
                    <span className="text-sm">{getSourceLabel(selectedLead.source)}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline">{selectedLead.status}</Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Owner</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm">{selectedLead.owner || 'Unassigned'}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">SLA Due</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    {getSLAStatusIcon(selectedLead.sla_status)}
                    <span className="text-sm">
                      {new Date(selectedLead.sla_due).toLocaleString()}
                    </span>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Activity Timeline
                  </CardTitle>
                  <Button size="sm" variant="outline">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Note
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <div className="text-center py-8">
                    <Button 
                      variant="outline" 
                      onClick={() => loadTimeline(selectedLead.id)}
                    >
                      Load Timeline
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timeline.map((event, index) => (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            {getTimelineIcon(event.type)}
                          </div>
                          {index < timeline.length - 1 && (
                            <div className="mt-2 h-8 w-px bg-border" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium">{event.title}</h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{event.source}</span>
                              <span>•</span>
                              <span>{new Date(event.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                          {event.user && (
                            <p className="text-xs text-muted-foreground mt-1">by {event.user}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
          <header className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
                  <Inbox className="h-8 w-8" />
                  Lead Inbox
                </h1>
                <p className="text-muted-foreground mt-1">
                  Unified view of all leads from every source
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{filteredLeads.length} leads</Badge>
              </div>
            </div>
          </header>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <div>
                  <Label className="text-xs">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Name, email, company..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))}
                      className="pl-8 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Source</Label>
                  <select
                    value={filters.source}
                    onChange={(e) => setFilters(prev => ({...prev, source: e.target.value}))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Sources</option>
                    <option value="website_form">Website Form</option>
                    <option value="shared_inbox">Email Inbox</option>
                    <option value="instagram_dm">Instagram DM</option>
                    <option value="linkedin_csv">LinkedIn Import</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">SLA Status</Label>
                  <select
                    value={filters.sla_status}
                    onChange={(e) => setFilters(prev => ({...prev, sla_status: e.target.value}))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All SLA</option>
                    <option value="on_time">On Time</option>
                    <option value="due_soon">Due Soon</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Owner</Label>
                  <select
                    value={filters.owner}
                    onChange={(e) => setFilters(prev => ({...prev, owner: e.target.value}))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Owners</option>
                    {uniqueOwners.map(owner => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                    <option value="">Unassigned</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Score Band</Label>
                  <select
                    value={filters.score_band}
                    onChange={(e) => setFilters(prev => ({...prev, score_band: e.target.value}))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Scores</option>
                    <option value="high">High (80+)</option>
                    <option value="medium">Medium (60-79)</option>
                    <option value="low">Low (0-59)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Status</Label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({...prev, status: e.target.value}))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="proposal">Proposal</option>
                    <option value="closed_won">Closed Won</option>
                    <option value="closed_lost">Closed Lost</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Priority</Label>
                  <select
                    value={filters.priority}
                    onChange={(e) => setFilters(prev => ({...prev, priority: e.target.value}))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Priority</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leads List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading leads...</div>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No leads found</h3>
              <p className="text-muted-foreground">
                {leads.length === 0 
                  ? "No leads have been captured yet"
                  : "Try adjusting your filters to see more leads"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLeads.map((lead) => (
                <Card 
                  key={lead.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedLead(lead);
                    loadTimeline(lead.id);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            {getSourceIcon(lead.source)}
                            <span className="font-medium">{lead.name}</span>
                          </div>
                          <Badge variant={getScoreBadgeColor(lead.score)}>
                            {lead.score}
                          </Badge>
                          <Badge variant={getPriorityBadgeColor(lead.priority)}>
                            {lead.priority}
                          </Badge>
                          {getSLAStatusIcon(lead.sla_status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{lead.email}</span>
                          {lead.company && <span>• {lead.company}</span>}
                          <span>• {getSourceLabel(lead.source)}</span>
                          <span>• {lead.owner || 'Unassigned'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{lead.status}</Badge>
                        <div className="text-xs text-muted-foreground text-right">
                          <div>Created {new Date(lead.created_at).toLocaleDateString()}</div>
                          <div>Last activity {new Date(lead.last_activity).toLocaleDateString()}</div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </div>
    </Layout>
  );
};

export default UnifiedLeadInbox;
