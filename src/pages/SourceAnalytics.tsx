import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Clock, 
  Target,
  Filter,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { getSourceConfig, SOURCE_CATEGORIES, SOURCE_CONFIG } from '@/lib/sourceMapping';

const SourceAnalytics = () => {
  const [dateRange, setDateRange] = useState('30d');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Mock data for source performance
  const sourcePerformanceData = [
    { sourceId: 'calendly', leads: 145, conversions: 89, revenue: 125000, avgDealSize: 1404, conversionRate: 61.4, cost: 2400, roi: 5108 },
    { sourceId: 'website-form', leads: 234, conversions: 67, revenue: 98000, avgDealSize: 1462, conversionRate: 28.6, cost: 1200, roi: 8067 },
    { sourceId: 'mailchimp', leads: 189, conversions: 45, revenue: 78000, avgDealSize: 1733, conversionRate: 23.8, cost: 890, roi: 8663 },
    { sourceId: 'linkedin-leads', leads: 156, conversions: 52, revenue: 95000, avgDealSize: 1827, conversionRate: 33.3, cost: 3200, roi: 2869 },
    { sourceId: 'typeform', leads: 123, conversions: 31, revenue: 52000, avgDealSize: 1677, conversionRate: 25.2, cost: 450, roi: 11456 },
    { sourceId: 'intercom', leads: 98, conversions: 28, revenue: 48000, avgDealSize: 1714, conversionRate: 28.6, cost: 1800, roi: 2567 },
    { sourceId: 'instagram-dms', leads: 87, conversions: 12, revenue: 18000, avgDealSize: 1500, conversionRate: 13.8, cost: 0, roi: Infinity },
    { sourceId: 'shared-inbox', leads: 76, conversions: 19, revenue: 34000, avgDealSize: 1789, conversionRate: 25.0, cost: 0, roi: Infinity },
    { sourceId: 'shopify', leads: 65, conversions: 22, revenue: 41000, avgDealSize: 1864, conversionRate: 33.8, cost: 1100, roi: 3627 },
    { sourceId: 'webhook', leads: 45, conversions: 8, revenue: 15000, avgDealSize: 1875, conversionRate: 17.8, cost: 200, roi: 7400 }
  ].map(item => {
    const config = getSourceConfig(item.sourceId);
    return {
      ...item,
      source: config.label,
      category: config.category,
      color: config.color,
      icon: config.icon,
      webhookSupported: config.webhookSupported,
      costPerLead: item.cost / item.leads,
      costPerConversion: item.cost / item.conversions
    };
  });

  // Time series data for trends
  const trendData = [
    { date: '2024-01-01', 'website-form': 45, 'mailchimp': 32, 'calendly': 28, 'linkedin-leads': 23 },
    { date: '2024-01-08', 'website-form': 52, 'mailchimp': 38, 'calendly': 35, 'linkedin-leads': 29 },
    { date: '2024-01-15', 'website-form': 48, 'mailchimp': 41, 'calendly': 42, 'linkedin-leads': 31 },
    { date: '2024-01-22', 'website-form': 58, 'mailchimp': 45, 'calendly': 38, 'linkedin-leads': 35 },
    { date: '2024-01-29', 'website-form': 61, 'mailchimp': 48, 'calendly': 45, 'linkedin-leads': 38 }
  ];

  // Category breakdown
  const categoryData = SOURCE_CATEGORIES.map(category => {
    const categoryLeads = sourcePerformanceData
      .filter(source => source.category === category.id)
      .reduce((sum, source) => sum + source.leads, 0);
    
    const categoryConversions = sourcePerformanceData
      .filter(source => source.category === category.id)
      .reduce((sum, source) => sum + source.conversions, 0);
    
    return {
      category: category.label,
      categoryId: category.id,
      leads: categoryLeads,
      conversions: categoryConversions,
      conversionRate: categoryLeads > 0 ? (categoryConversions / categoryLeads * 100) : 0,
      sources: sourcePerformanceData.filter(source => source.category === category.id).length
    };
  }).filter(item => item.leads > 0);

  // Filter data based on selected category
  const filteredSources = selectedCategory === 'all' 
    ? sourcePerformanceData 
    : sourcePerformanceData.filter(source => source.category === selectedCategory);

  // Calculate totals
  const totals = filteredSources.reduce((acc, source) => ({
    leads: acc.leads + source.leads,
    conversions: acc.conversions + source.conversions,
    revenue: acc.revenue + source.revenue,
    cost: acc.cost + source.cost
  }), { leads: 0, conversions: 0, revenue: 0, cost: 0 });

  const avgConversionRate = totals.leads > 0 ? (totals.conversions / totals.leads * 100) : 0;
  const totalROI = totals.cost > 0 ? ((totals.revenue - totals.cost) / totals.cost * 100) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Source Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Performance insights across all lead sources
            </p>
          </div>
          <div className="flex gap-2">
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
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.leads.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">↗ 12.5%</span> from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgConversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">↗ 3.2%</span> from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(totals.revenue / 1000).toFixed(0)}k</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">↗ 18.7%</span> from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalROI.toFixed(0)}%</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">↗ 5.8%</span> from last period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            All Sources ({sourcePerformanceData.length})
          </Button>
          {SOURCE_CATEGORIES.map(category => {
            const count = sourcePerformanceData.filter(s => s.category === category.id).length;
            if (count === 0) return null;
            const CategoryIcon = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="gap-1"
              >
                <CategoryIcon className="h-3 w-3" />
                {category.label} ({count})
              </Button>
            );
          })}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Source Performance Table */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Source Performance Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredSources.slice(0, 10).map((source, index) => {
                      const IconComponent = source.icon;
                      return (
                        <div key={source.sourceId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: `${source.color}20` }}
                            >
                              <IconComponent className="w-4 h-4" style={{ color: source.color }} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{source.source}</span>
                                {source.webhookSupported && (
                                  <Badge variant="secondary" className="text-xs">Webhook</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground capitalize">
                                {source.category}
                              </div>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center gap-4 text-sm">
                              <span>{source.leads} leads</span>
                              <span className="font-medium">{source.conversionRate.toFixed(1)}%</span>
                              <span className="text-green-600 font-medium">
                                ${(source.revenue / 1000).toFixed(0)}k
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {source.cost > 0 ? `$${source.costPerLead.toFixed(0)}/lead` : 'Free'}
                              {source.roi !== Infinity && (
                                <span className="ml-2">{source.roi.toFixed(0)}% ROI</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Rate by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredSources.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="source" 
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Conversion Rate']}
                        />
                        <Bar dataKey="conversionRate" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lead Volume by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category, leads }) => `${category}: ${leads}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="leads"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lead Trends Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="website-form" stroke="#3B82F6" name="Website Form" />
                      <Line type="monotone" dataKey="mailchimp" stroke="#FFE01B" name="Mailchimp" />
                      <Line type="monotone" dataKey="calendly" stroke="#006BFF" name="Calendly" />
                      <Line type="monotone" dataKey="linkedin-leads" stroke="#0077B5" name="LinkedIn" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roi" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>ROI by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredSources
                      .filter(source => source.cost > 0)
                      .sort((a, b) => b.roi - a.roi)
                      .slice(0, 8)
                      .map((source) => {
                        const IconComponent = source.icon;
                        return (
                          <div key={source.sourceId} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${source.color}20` }}
                              >
                                <IconComponent className="w-3 h-3" style={{ color: source.color }} />
                              </div>
                              <span className="text-sm font-medium">{source.source}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">{source.roi.toFixed(0)}%</div>
                              <div className="text-xs text-muted-foreground">
                                ${source.costPerLead.toFixed(0)}/lead
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cost Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredSources.filter(s => s.cost > 0).slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="source" 
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value) => [`$${Number(value).toFixed(0)}`, 'Cost per Lead']}
                        />
                        <Bar dataKey="costPerLead" fill="#ff7c7c" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SourceAnalytics;
