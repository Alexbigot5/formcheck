import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  Users,
  Clock,
  Target,
  Download,
  RefreshCw,
  Calendar,
  Award,
  Activity,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { 
  analyticsApi, 
  csvExport, 
  chartHelpers,
  type AnalyticsOverview 
} from "@/lib/analyticsApi";

const AnalyticsPage = () => {
  const [data, setData] = useState<AnalyticsOverview['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [timezone, setTimezone] = useState('UTC');

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod, timezone]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const result = await analyticsApi.getOverview(Number(selectedPeriod), timezone);
      setData(result.data);
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-10">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span>Loading analytics...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Prepare chart data
  const leadsBySourceChart = chartHelpers.prepareBarChartData(
    data.sourceBreakdown.map(item => ({
      label: item.source,
      value: item.count
    }))
  );

  const leadsByDayChart = chartHelpers.prepareLineChartData(
    data.leadsPerDay.map(item => ({
      label: new Date(item.date).toLocaleDateString(),
      value: item.count
    })),
    'New Leads'
  );

  const scoreDistributionChart = chartHelpers.preparePieChartData(
    data.scoreDistribution.map(item => ({
      label: item.band,
      value: item.count
    }))
  );

  const responseTimeChart = chartHelpers.prepareBarChartData(
    data.responseTimeDistribution.map(item => ({
      label: item.bucket,
      value: item.count
    }))
  );

  // Meeting conversion data is now included in the summary
  const hasMeetingConversions = data.summary.meetingConversions > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive insights into your lead performance and team metrics
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Period selector */}
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>

            {/* Timezone selector */}
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">EST</SelectItem>
                <SelectItem value="America/Los_Angeles">PST</SelectItem>
                <SelectItem value="Europe/London">GMT</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh button */}
            <Button onClick={loadAnalytics} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {/* Export all data */}
            <Button 
              onClick={() => csvExport.exportCompleteOverview(data)}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Summary Cards */}
          <div className={`grid gap-4 ${hasMeetingConversions ? 'md:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{chartHelpers.formatNumber(data.summary.totalLeads)}</div>
                <p className="text-xs text-muted-foreground">
                  {chartHelpers.formatNumber(data.summary.newLeads)} new in period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.averageScore.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  Lead quality score
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">SLA Hit Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: chartHelpers.getSLAStatusColor(data.slaMetrics.hitRate) }}>
                  {chartHelpers.formatPercentage(data.slaMetrics.hitRate)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.slaMetrics.satisfiedCount} of {data.slaMetrics.totalSlaClocks} met
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{chartHelpers.formatPercentage(data.summary.conversionRate)}</div>
                {hasMeetingConversions && (
                  <p className="text-xs text-muted-foreground">
                    {data.summary.meetingConversions} meetings ({chartHelpers.formatPercentage(data.summary.meetingConversionRate)})
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Meeting Conversions Card (if applicable) */}
            {hasMeetingConversions && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {chartHelpers.formatNumber(data.summary.meetingConversions)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {chartHelpers.formatPercentage(data.summary.meetingConversionRate)} conversion rate
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Leads by Source */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Leads by Source</CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => csvExport.exportLeadsBySource(data.sourceBreakdown)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.sourceBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="source" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        chartHelpers.formatNumber(value),
                        'Count'
                      ]}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Leads by Day */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Leads Over Time</CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => csvExport.exportLeadsByDay(data.leadsPerDay)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.leadsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: any) => [chartHelpers.formatNumber(value), 'New Leads']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Score Distribution */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Score Distribution</CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => csvExport.exportScoreDistribution(data.scoreDistribution)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.scoreDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ band, percentage }) => `${band} (${percentage.toFixed(1)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {data.scoreDistribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={chartHelpers.getScoreBandColor(entry.band)} 
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [chartHelpers.formatNumber(value), 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Response Time Distribution */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>First Response Time</CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => csvExport.exportResponseTimeDistribution(data.responseTimeDistribution)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.responseTimeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="bucket" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [chartHelpers.formatNumber(value), 'Count']}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* SLA Metrics Detail */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>SLA Performance</CardTitle>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => csvExport.exportSLAMetrics(data.slaMetrics)}
              >
                <Download className="w-4 h-4 mr-1" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {data.slaMetrics.satisfiedCount}
                    </div>
                    <div className="text-sm text-muted-foreground">SLAs Met</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {data.slaMetrics.totalSlaClocks - data.slaMetrics.satisfiedCount}
                    </div>
                    <div className="text-sm text-muted-foreground">SLAs Missed</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {chartHelpers.formatDuration(data.slaMetrics.averageResponseTime)}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Response</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <Activity className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {data.slaMetrics.escalatedCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Escalated</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Sources Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Top Performing Sources</CardTitle>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => csvExport.exportTopSources(data.topSources)}
              >
                <Download className="w-4 h-4 mr-1" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topSources.map((source, index) => (
                  <div key={source.source} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{index + 1}</Badge>
                      <div>
                        <div className="font-medium">{source.source}</div>
                        <div className="text-sm text-muted-foreground">
                          {chartHelpers.formatNumber(source.count)} leads
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{source.averageScore.toFixed(1)}</div>
                        <div className="text-muted-foreground">Avg Score</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{chartHelpers.formatPercentage(source.conversionRate)}</div>
                        <div className="text-muted-foreground">Conversion</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Owner Performance */}
          {data.ownerPerformance.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Team Performance</CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => csvExport.exportOwnerPerformance(data.ownerPerformance)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.ownerPerformance.map((owner) => (
                    <div key={owner.ownerId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{owner.ownerName}</div>
                        <div className="text-sm text-muted-foreground">{owner.ownerEmail}</div>
                      </div>
                      <div className="flex items-center space-x-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{owner.assignedLeads}</div>
                          <div className="text-muted-foreground">Leads</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">
                            {chartHelpers.formatDuration(owner.averageResponseTime)}
                          </div>
                          <div className="text-muted-foreground">Avg Response</div>
                        </div>
                        <div className="text-center">
                          <div 
                            className="font-medium"
                            style={{ color: chartHelpers.getSLAStatusColor(owner.slaHitRate) }}
                          >
                            {chartHelpers.formatPercentage(owner.slaHitRate)}
                          </div>
                          <div className="text-muted-foreground">SLA Hit Rate</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsPage;
