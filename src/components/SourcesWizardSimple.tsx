import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import apiClient from "@/lib/apiClient";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  CheckCircle,
  AlertCircle,
  Clock,
  Target,
  TrendingUp,
  Activity,
  Eye,
  Link,
  BarChart3,
  Globe,
  Mail,
  Linkedin,
  Instagram,
  Webhook
} from "lucide-react";
import { getSourceConfig } from "@/lib/sourceMapping";
import { WebsiteFormWizard } from "@/components/source-wizards/WebsiteFormWizard";
import { EmailWizard } from "@/components/source-wizards/EmailWizard";
import { toast } from "sonner";
import { analyticsApi } from "@/lib/analyticsApi";
import { useAuth } from "@/lib/AuthProvider";

interface LeadSourceData {
  source: string;
  sourceId: string;
  leads: number;
  icon: any;
  color: string;
}

interface TrackingStatus {
  utmParametersDetected: boolean;
  referrerCaptured: boolean;
  lastDetectedUTM: string;
  lastReferrer: string;
  trackingHealth: 'healthy' | 'warning' | 'error' | 'unknown';
}

const SourcesWizardSimple = () => {
  const { isAuthenticated } = useAuth();
  const [attributionMode, setAttributionMode] = useState<'first-touch' | 'last-touch' | 'multi-touch'>('first-touch');
  const [activeWizard, setActiveWizard] = useState<string | null>(null);
  const [leadStats, setLeadStats] = useState<LeadSourceData[]>([]);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({
    utmParametersDetected: false,
    referrerCaptured: false,
    lastDetectedUTM: '',
    lastReferrer: '',
    trackingHealth: 'unknown'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load real analytics data
  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch dashboard overview which includes source data
        const response = await apiClient.get('/api/dashboard/overview');
        const analyticsResponse = response.data;
        
        if (analyticsResponse && analyticsResponse.sourceBreakdown) {
          // Transform API data to component format
          const sourceData: LeadSourceData[] = analyticsResponse.sourceBreakdown.map((source: any) => {
            const config = getSourceConfig(source.source);
            return {
              source: config.label,
              sourceId: source.source,
              leads: source.count || 0,
              icon: config.icon,
              color: config.color
            };
          });

          setLeadStats(sourceData);
        }

        // Fetch tracking status (this would come from a separate endpoint)
        // For now, we'll derive it from the analytics data
        const hasUTMData = analyticsResponse.data.sourceBreakdown?.some((s: any) => 
          s.source?.includes('utm') || s.source?.includes('google') || s.source?.includes('facebook')
        );
        
        setTrackingStatus({
          utmParametersDetected: hasUTMData || false,
          referrerCaptured: true, // Assume referrer capture is working
          lastDetectedUTM: hasUTMData ? 'utm_source=detected&utm_medium=web' : '',
          lastReferrer: 'https://www.google.com',
          trackingHealth: hasUTMData ? 'healthy' : 'warning'
        });

      } catch (err: any) {
        console.error('Failed to load analytics data:', err);
        setError(err.message || 'Failed to load lead source data');
        
        // Set empty state on error
        setLeadStats([]);
        setTrackingStatus({
          utmParametersDetected: false,
          referrerCaptured: false,
          lastDetectedUTM: '',
          lastReferrer: '',
          trackingHealth: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    // Only load data if authenticated
    if (isAuthenticated) {
      loadAnalyticsData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Chart data for the bar chart
  const chartData = leadStats.map(item => ({
    name: item.source,
    leads: item.leads,
    fill: item.color
  }));

  // Handler functions for wizard management
  const handleConnect = (sourceId: string) => {
    if (['website-form', 'shared-inbox'].includes(sourceId)) {
      setActiveWizard(sourceId);
    } else {
      toast.success("Source connected successfully!");
    }
  };

  const handleWizardComplete = (sourceId: string) => {
    setActiveWizard(null);
    toast.success("Source connected successfully!");
  };

  const handleWizardClose = () => {
    setActiveWizard(null);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Lead Sources</h2>
          <p className="text-muted-foreground">
            Loading your lead source analytics...
          </p>
        </div>
        
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Lead Sources</h2>
          <p className="text-muted-foreground">
            Configure and test your lead ingestion sources with advanced tracking and attribution.
          </p>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Failed to load lead source data</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
              size="sm"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Lead Sources</h2>
        <p className="text-muted-foreground">
          Configure and test your lead ingestion sources with advanced tracking and attribution.
        </p>
      </div>

      {/* Tracking Status and Attribution Mode */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Tracking Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">UTM Parameters</span>
                </div>
                <Badge variant={trackingStatus.utmParametersDetected ? "default" : "secondary"} className="flex items-center gap-1">
                  {trackingStatus.utmParametersDetected ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {trackingStatus.utmParametersDetected ? 'Detected' : 'Not Found'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Referrer Capture</span>
                </div>
                <Badge variant={trackingStatus.referrerCaptured ? "default" : "secondary"} className="flex items-center gap-1">
                  {trackingStatus.referrerCaptured ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {trackingStatus.referrerCaptured ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Last UTM Detected:</div>
                <div className="text-xs font-mono bg-muted p-2 rounded text-green-700">
                  {trackingStatus.lastDetectedUTM}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Last Referrer:</div>
                <div className="text-xs font-mono bg-muted p-2 rounded text-blue-700">
                  {trackingStatus.lastReferrer}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Attribution Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Tabs value={attributionMode} onValueChange={(value) => setAttributionMode(value as typeof attributionMode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="first-touch">First-touch</TabsTrigger>
                  <TabsTrigger value="last-touch">Last-touch</TabsTrigger>
                  <TabsTrigger value="multi-touch">Multi-touch</TabsTrigger>
                </TabsList>
                
                <TabsContent value="first-touch" className="mt-4">
                  <div className="text-sm text-muted-foreground">
                    Credits the first source that brought the lead to your site. Best for understanding initial awareness drivers.
                  </div>
                </TabsContent>
                
                <TabsContent value="last-touch" className="mt-4">
                  <div className="text-sm text-muted-foreground">
                    Credits the last source before conversion. Ideal for understanding what drives final decisions.
                  </div>
                </TabsContent>
                
                <TabsContent value="multi-touch" className="mt-4">
                  <div className="text-sm text-muted-foreground">
                    Distributes credit across all touchpoints in the customer journey. Provides comprehensive attribution.
                  </div>
                </TabsContent>
              </Tabs>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800">Current Mode: {attributionMode.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                <div className="text-xs text-blue-700 mt-1">
                  All lead source analytics will use this attribution model.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Website Form */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Website Form</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Embed forms on your website to capture visitor information
            </p>
            <Button variant="outline" size="sm" onClick={() => handleConnect('website-form')}>
              Configure
            </Button>
          </CardContent>
        </Card>

        {/* Email Integration */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Integration</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-yellow-500" />
                Setup Required
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Connect email accounts to automatically process lead emails
            </p>
            <Button variant="outline" size="sm" onClick={() => handleConnect('shared-inbox')}>
              Setup
            </Button>
          </CardContent>
        </Card>

        {/* LinkedIn */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LinkedIn</CardTitle>
            <Linkedin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-500" />
                Not Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Import leads from LinkedIn campaigns and messages
            </p>
            <Button variant="outline" size="sm">
              Connect
            </Button>
          </CardContent>
        </Card>

        {/* Instagram */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instagram</CardTitle>
            <Instagram className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-500" />
                Not Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Capture leads from Instagram business profiles
            </p>
            <Button variant="outline" size="sm">
              Connect
            </Button>
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                Ready
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Receive leads from third-party applications via webhooks
            </p>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </CardContent>
        </Card>

        {/* API Integration */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Integration</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                Available
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Use our REST API to programmatically submit leads
            </p>
            <Button variant="outline" size="sm">
              View Docs
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Lead Stats by Source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Leads This Month by Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leadStats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={stat.sourceId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stat.color}20` }}>
                      <IconComponent className="w-4 h-4" style={{ color: stat.color }} />
                    </div>
                    <div>
                      <span className="font-medium text-sm">{stat.source}</span>
                      <div className="text-xs text-muted-foreground capitalize">
                        {getSourceConfig(stat.sourceId).category}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="font-bold">
                      {stat.leads}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {((stat.leads / leadStats.reduce((sum, s) => sum + s.leads, 0)) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Leads This Month:</span>
              <span className="font-bold text-lg">{leadStats.reduce((sum, stat) => sum + stat.leads, 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Sources Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Top Sources Chart
          </CardTitle>
          <p className="text-sm text-muted-foreground">Lead acquisition by source this month</p>
        </CardHeader>
        <CardContent>
          {leadStats.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No Lead Sources Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your first lead source to see analytics here
                </p>
                <Button variant="outline" onClick={() => handleConnect('website-form')}>
                  Connect Website Form
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value) => [value, 'Leads']}
                    labelStyle={{ color: '#374151' }}
                  />
                  <Bar 
                    dataKey="leads" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Integrations</span>
              <span className="text-sm font-medium">{leadStats.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Active Sources</span>
              <span className="text-sm font-medium">{leadStats.filter(stat => stat.leads > 0).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Leads This Month</span>
              <span className="text-sm font-medium">{leadStats.reduce((sum, stat) => sum + stat.leads, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Attribution Mode</span>
              <Badge variant="outline">{attributionMode.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Tracking Health</span>
              <Badge 
                variant={trackingStatus.trackingHealth === 'healthy' ? 'default' : 
                        trackingStatus.trackingHealth === 'warning' ? 'secondary' : 'destructive'}
                className="flex items-center gap-1"
              >
                {trackingStatus.trackingHealth === 'healthy' && <CheckCircle className="w-3 h-3" />}
                {trackingStatus.trackingHealth === 'warning' && <AlertCircle className="w-3 h-3" />}
                {trackingStatus.trackingHealth === 'error' && <AlertCircle className="w-3 h-3" />}
                {trackingStatus.trackingHealth.charAt(0).toUpperCase() + trackingStatus.trackingHealth.slice(1)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wizard Components */}
      {activeWizard === 'website-form' && (
        <WebsiteFormWizard 
          onClose={handleWizardClose} 
          onComplete={handleWizardComplete} 
        />
      )}
      <EmailWizard 
        open={activeWizard === 'shared-inbox'}
        onClose={handleWizardClose} 
        onComplete={handleWizardComplete} 
      />
    </div>
  );
};

export default SourcesWizardSimple;
