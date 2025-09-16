import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";
import { getSourceConfig } from "@/lib/sourceMapping";
import { analyticsApi, type AnalyticsOverview } from "@/lib/analyticsApi";
import { 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  Target, 
  Activity, 
  Bell,
  Globe,
  Mail,
  Instagram,
  Linkedin,
  Webhook,
  DollarSign,
  Calendar,
  Phone
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [dateRange, setDateRange] = useState("30d");
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load analytics data
  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const data = await analyticsApi.getOverview(days);
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('Failed to load analytics data:', err);
      setError(err.message || 'Failed to load analytics data');
      
      // Fallback to mock data structure for compatibility
      setAnalyticsData(createMockAnalyticsData());
    } finally {
      setLoading(false);
    }
  };

  // Mock data fallback function
  const createMockAnalyticsData = (): AnalyticsOverview => ({
    success: true,
    data: {
      summary: {
        totalLeads: 1218,
        newLeads: 234,
        averageScore: 72.5,
        conversionRate: 28.6,
        meetingConversions: 89,
        meetingConversionRate: 38.0
      },
      sourceBreakdown: [
        { source: 'Newsletter', count: 245, percentage: 20.1 },
        { source: 'YouTube', count: 189, percentage: 15.5 },
        { source: 'LinkedIn', count: 156, percentage: 12.8 },
        { source: 'Direct', count: 98, percentage: 8.0 },
        { source: 'Social Media', count: 67, percentage: 5.5 }
      ],
      leadsPerDay: [],
      slaMetrics: {
        hitRate: 85.2,
        averageResponseTime: 24.5,
        totalSlaClocks: 1218,
        satisfiedCount: 1038,
        escalatedCount: 180
      },
      responseTimeDistribution: [],
      scoreDistribution: [
        { band: 'HIGH', count: 365, percentage: 30.0 },
        { band: 'MEDIUM', count: 609, percentage: 50.0 },
        { band: 'LOW', count: 244, percentage: 20.0 }
      ],
      topSources: [
        { source: 'Newsletter', count: 245, averageScore: 78.5, conversionRate: 35.1 },
        { source: 'YouTube', count: 189, averageScore: 65.2, conversionRate: 28.0 },
        { source: 'LinkedIn', count: 156, averageScore: 82.1, conversionRate: 19.9 }
      ],
      ownerPerformance: []
    }
  });

  // Mock data for charts (keeping for compatibility)
  const leadsByChannelData = [
    { name: 'Newsletter', value: 35, color: '#8884d8' },
    { name: 'YouTube', value: 28, color: '#82ca9d' },
    { name: 'LinkedIn', value: 20, color: '#ffc658' },
    { name: 'Direct', value: 12, color: '#ff7c7c' },
    { name: 'Other', value: 5, color: '#8dd1e1' }
  ];

  const funnelData = [
    { name: 'New', value: 1000, fill: '#8884d8' },
    { name: 'Contacted', value: 750, fill: '#82ca9d' },
    { name: 'Qualified', value: 450, fill: '#ffc658' },
    { name: 'Meeting', value: 280, fill: '#ff7c7c' },
    { name: 'Won', value: 120, fill: '#8dd1e1' },
    { name: 'Lost', value: 160, fill: '#ffb347' }
  ];

  const channelPerformanceData = [
    { channel: 'Newsletter', leads: 245, conversions: 86, rate: 35.1 },
    { channel: 'YouTube', leads: 189, conversions: 53, rate: 28.0 },
    { channel: 'LinkedIn', leads: 156, conversions: 31, rate: 19.9 },
    { channel: 'Direct', leads: 98, conversions: 12, rate: 12.2 },
    { channel: 'Social Media', leads: 67, conversions: 8, rate: 11.9 }
  ];

  // New data for enhanced features
  const pipelineStagesData = [
    { stage: 'Qualified', value: 285000, count: 45, avgDealSize: 6333 },
    { stage: 'Proposal', value: 180000, count: 18, avgDealSize: 10000 },
    { stage: 'Negotiation', value: 95000, count: 8, avgDealSize: 11875 },
    { stage: 'Closed Won', value: 75000, count: 12, avgDealSize: 6250 }
  ];

  const teamPerformanceData = [
    { name: 'Sarah Chen', responseTime: 12, conversionRate: 28.5, assignedLeads: 45, slaCompliance: 96 },
    { name: 'Mike Johnson', responseTime: 18, conversionRate: 24.2, assignedLeads: 52, slaCompliance: 89 },
    { name: 'Emma Davis', responseTime: 8, conversionRate: 31.8, assignedLeads: 38, slaCompliance: 98 },
    { name: 'Alex Rodriguez', responseTime: 22, conversionRate: 22.1, assignedLeads: 41, slaCompliance: 85 }
  ];

  const leadSourcesData = [
    { sourceId: 'website-form', count: 156, status: 'healthy', conversionRate: 24.3 },
    { sourceId: 'shared-inbox', count: 89, status: 'healthy', conversionRate: 18.7 },
    { sourceId: 'linkedin-csv', count: 67, status: 'warning', conversionRate: 31.2 },
    { sourceId: 'instagram-dms', count: 34, status: 'healthy', conversionRate: 15.8 },
    { sourceId: 'mailchimp', count: 45, status: 'healthy', conversionRate: 32.1 },
    { sourceId: 'calendly', count: 38, status: 'healthy', conversionRate: 41.2 },
    { sourceId: 'webhook', count: 23, status: 'error', conversionRate: 28.9 }
  ].map(item => {
    const config = getSourceConfig(item.sourceId);
    return {
      ...item,
      source: config.label,
      icon: config.icon,
      color: config.color
    };
  });

  const recentActivity = [
    { type: 'lead', message: 'New high-value lead from LinkedIn', time: '2 min ago', priority: 'high' },
    { type: 'campaign', message: 'Q1 Enterprise campaign achieved 25% open rate', time: '5 min ago', priority: 'medium' },
    { type: 'sla', message: 'SLA breach: Lead #1247 requires immediate attention', time: '8 min ago', priority: 'high' },
    { type: 'integration', message: 'HubSpot sync completed successfully', time: '12 min ago', priority: 'low' },
    { type: 'form', message: 'Contact Form v2 conversion rate improved by 15%', time: '18 min ago', priority: 'medium' }
  ];

  const smartAlerts = [
    { type: 'urgent', message: '3 high-value leads need immediate follow-up', action: 'View Leads', count: 3 },
    { type: 'warning', message: 'LinkedIn integration showing connection issues', action: 'Check Integration', count: 1 },
    { type: 'opportunity', message: 'Newsletter campaign performing 40% above average', action: 'View Campaign', count: 1 }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getMetricsByDateRange = (range: string) => {
    const baseMetrics = {
      totalLeads: 1247,
      conversionRate: 24.3,
      activeForms: 12,
      pipelineValue: 485000,
      slaCompliance: 92.5,
      avgResponseTime: 14.2,
      teamUtilization: 87.3
    };

    switch (range) {
      case "7d":
        return {
          ...baseMetrics,
          totalLeads: 89,
          conversionRate: 26.1,
          pipelineValue: 125000
        };
      case "90d":
        return {
          ...baseMetrics,
          totalLeads: 3421,
          conversionRate: 22.8,
          pipelineValue: 1250000
        };
      default:
        return baseMetrics;
    }
  };

  const metrics = getMetricsByDateRange(dateRange);

  useEffect(() => {
    // SEO
    document.title = "Reporting Hub | SmartForms AI";

    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Comprehensive reporting hub for SmartForms AI: lead analytics, pipeline insights, and performance metrics.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/dashboard`);

    // Auth guard - only redirect if not in mock auth mode
    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    if (!USE_MOCK_AUTH && !isAuthenticated) {
      navigate("/login");
    }
  }, [navigate, isAuthenticated]);

  // Load analytics data when component mounts or date range changes
  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange]);

  return (
    <Layout>
      <div>
        <header className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Reporting Hub</h1>
            <p className="text-muted-foreground mt-1">Comprehensive analytics and performance insights.</p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7d</SelectItem>
              <SelectItem value="30d">Last 30d</SelectItem>
              <SelectItem value="90d">Last 90d</SelectItem>
            </SelectContent>
          </Select>
        </header>

        {/* Smart Alerts - High Priority */}
        {smartAlerts.length > 0 && (
          <div className="mb-6">
            <div className="grid gap-3">
              {smartAlerts.map((alert, index) => (
                <Card key={index} className={`border-l-4 ${
                  alert.type === 'urgent' ? 'border-l-red-500 bg-red-50/50' :
                  alert.type === 'warning' ? 'border-l-yellow-500 bg-yellow-50/50' :
                  'border-l-green-500 bg-green-50/50'
                }`}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {alert.type === 'urgent' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                      {alert.type === 'warning' && <Clock className="h-5 w-5 text-yellow-600" />}
                      {alert.type === 'opportunity' && <TrendingUp className="h-5 w-5 text-green-600" />}
                      <div>
                        <p className="font-medium text-sm">{alert.message}</p>
                        {alert.count > 1 && (
                          <Badge variant="secondary" className="mt-1">
                            {alert.count} items
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      {alert.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Metrics Row */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : analyticsData ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.data.summary.totalLeads.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">All captured leads</p>
              </CardContent>
            </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalLeads.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">All captured leads</p>
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Lead to customer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Forms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeForms}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently published</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(metrics.pipelineValue / 1000).toFixed(0)}k</div>
              <p className="text-xs text-muted-foreground mt-1">Total opportunity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">SLA Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.slaCompliance}%</div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgResponseTime}m</div>
              <p className="text-xs text-muted-foreground mt-1">Team average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Team Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.teamUtilization}%</div>
              <p className="text-xs text-muted-foreground mt-1">Capacity used</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* Funnel Overview */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Funnel Overview</CardTitle>
              <p className="text-sm text-muted-foreground">Lead progression through pipeline stages</p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip formatter={(value) => [value.toLocaleString(), 'Leads']} />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Performing Channels */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Top Performing Channels</CardTitle>
              <p className="text-sm text-muted-foreground">Conversion rates by acquisition channel</p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channel" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => {
                      if (name === 'rate') return [`${value}%`, 'Conversion Rate'];
                      return [value, name === 'leads' ? 'Total Leads' : 'Conversions'];
                    }} />
                    <Bar dataKey="rate" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Analytics - Collapsible */}
        <div className="mt-8">
          <Collapsible open={showAdvancedMetrics} onOpenChange={setShowAdvancedMetrics}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  <span className="font-semibold">Advanced Analytics</span>
                  <Badge variant="secondary">{showAdvancedMetrics ? 'Hide' : 'Show'} Details</Badge>
                </div>
                {showAdvancedMetrics ? <ChevronUp /> : <ChevronDown />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 mt-4">
              
              {/* Revenue Pipeline Forecasting */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Revenue Pipeline
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Pipeline value by stage</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pipelineStagesData.map((stage, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{stage.stage}</p>
                            <p className="text-sm text-muted-foreground">{stage.count} deals</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${(stage.value / 1000).toFixed(0)}k</p>
                            <p className="text-sm text-muted-foreground">
                              Avg: ${(stage.avgDealSize / 1000).toFixed(1)}k
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Multi-Channel Lead Intake Monitor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Lead Sources Health
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Multi-channel intake monitoring</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {leadSourcesData.map((source, index) => {
                        const IconComponent = source.icon;
                        return (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center" 
                                style={{ backgroundColor: `${source.color}20` }}
                              >
                                <IconComponent className="w-4 h-4" style={{ color: source.color }} />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{source.source}</p>
                                <p className="text-xs text-muted-foreground">
                                  {source.count} leads • {source.conversionRate}% conv.
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant={source.status === 'healthy' ? 'default' : source.status === 'warning' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {source.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Team Performance & SLA Dashboard */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Performance
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Individual performance metrics</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {teamPerformanceData.map((member, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">{member.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {member.assignedLeads} leads
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-muted-foreground">Response</p>
                              <p className="font-medium">{member.responseTime}m</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Conversion</p>
                              <p className="font-medium">{member.conversionRate}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">SLA</p>
                              <p className="font-medium">{member.slaCompliance}%</p>
                            </div>
                          </div>
                          <Progress value={member.slaCompliance} className="h-1" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Real-Time Activity Feed */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Live platform updates</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentActivity.slice(0, 5).map((activity, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            activity.priority === 'high' ? 'bg-red-500' :
                            activity.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight">{activity.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Additional Insights */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Channel Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leadsByChannelData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Best Channel</span>
                  <span className="text-sm font-bold">Newsletter (35.1%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Avg. Deal Size</span>
                  <span className="text-sm font-bold">$4,042</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <span className="text-sm font-bold">42.9%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Avg. Sales Cycle</span>
                  <span className="text-sm font-bold">18 days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  Export Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Schedule Email
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  View Detailed Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
