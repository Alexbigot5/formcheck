import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FunnelChart, Funnel, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";
import { TrendingUp, Download, Calendar, Target, Users, Award } from "lucide-react";
import { Contact, Deal } from "@/pages/CrmHub";

interface ReportingTabProps {
  contacts: Contact[];
  deals: Deal[];
}

const ReportingTab: React.FC<ReportingTabProps> = ({ contacts, deals }) => {
  // Generate funnel data
  const funnelData = [
    { name: 'New', value: deals.filter(d => d.stage === 'New').length, fill: '#8884d8' },
    { name: 'Contacted', value: deals.filter(d => d.stage === 'Contacted').length, fill: '#82ca9d' },
    { name: 'Qualified', value: deals.filter(d => d.stage === 'Qualified').length, fill: '#ffc658' },
    { name: 'Meeting', value: deals.filter(d => d.stage === 'Meeting').length, fill: '#ff7c7c' },
    { name: 'Proposal', value: deals.filter(d => d.stage === 'Proposal').length, fill: '#8dd1e1' },
    { name: 'Won', value: deals.filter(d => d.stage === 'Won').length, fill: '#82ca9d' }
  ].filter(item => item.value > 0);

  // Generate leads by channel data (mock data based on contacts)
  const leadsByChannelData = [
    { channel: 'Newsletter', leads: 45, color: '#8884d8' },
    { channel: 'YouTube', leads: 32, color: '#82ca9d' },
    { channel: 'LinkedIn', leads: 28, color: '#ffc658' },
    { channel: 'Ads', leads: 18, color: '#ff7c7c' }
  ];

  // Generate rep performance data
  const repPerformanceData = [
    { 
      name: 'Sarah Chen', 
      dealsWon: deals.filter(d => d.owner === 'Sarah Chen' && d.stage === 'Won').length,
      totalDeals: deals.filter(d => d.owner === 'Sarah Chen').length,
      avgResponseTime: 12,
      revenue: deals.filter(d => d.owner === 'Sarah Chen' && d.stage === 'Won').reduce((sum, d) => sum + d.value, 0)
    },
    { 
      name: 'Mike Johnson', 
      dealsWon: deals.filter(d => d.owner === 'Mike Johnson' && d.stage === 'Won').length,
      totalDeals: deals.filter(d => d.owner === 'Mike Johnson').length,
      avgResponseTime: 18,
      revenue: deals.filter(d => d.owner === 'Mike Johnson' && d.stage === 'Won').reduce((sum, d) => sum + d.value, 0)
    },
    { 
      name: 'Emma Davis', 
      dealsWon: deals.filter(d => d.owner === 'Emma Davis' && d.stage === 'Won').length,
      totalDeals: deals.filter(d => d.owner === 'Emma Davis').length,
      avgResponseTime: 8,
      revenue: deals.filter(d => d.owner === 'Emma Davis' && d.stage === 'Won').reduce((sum, d) => sum + d.value, 0)
    },
    { 
      name: 'Alex Rodriguez', 
      dealsWon: deals.filter(d => d.owner === 'Alex Rodriguez' && d.stage === 'Won').length,
      totalDeals: deals.filter(d => d.owner === 'Alex Rodriguez').length,
      avgResponseTime: 22,
      revenue: deals.filter(d => d.owner === 'Alex Rodriguez' && d.stage === 'Won').reduce((sum, d) => sum + d.value, 0)
    }
  ];

  // Generate forecast data
  const forecastData = [
    { 
      stage: 'Qualified', 
      pipelineValue: deals.filter(d => d.stage === 'Qualified').reduce((sum, d) => sum + d.value, 0),
      probability: 25,
      weightedValue: deals.filter(d => d.stage === 'Qualified').reduce((sum, d) => sum + (d.value * 0.25), 0)
    },
    { 
      stage: 'Meeting', 
      pipelineValue: deals.filter(d => d.stage === 'Meeting').reduce((sum, d) => sum + d.value, 0),
      probability: 50,
      weightedValue: deals.filter(d => d.stage === 'Meeting').reduce((sum, d) => sum + (d.value * 0.50), 0)
    },
    { 
      stage: 'Proposal', 
      pipelineValue: deals.filter(d => d.stage === 'Proposal').reduce((sum, d) => sum + d.value, 0),
      probability: 75,
      weightedValue: deals.filter(d => d.stage === 'Proposal').reduce((sum, d) => sum + (d.value * 0.75), 0)
    },
    { 
      stage: 'Negotiation', 
      pipelineValue: deals.filter(d => d.stage === 'Negotiation').reduce((sum, d) => sum + d.value, 0),
      probability: 90,
      weightedValue: deals.filter(d => d.stage === 'Negotiation').reduce((sum, d) => sum + (d.value * 0.90), 0)
    }
  ].filter(item => item.pipelineValue > 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTotalPipelineValue = () => {
    return deals.reduce((sum, deal) => sum + deal.value, 0);
  };

  const getWeightedForecast = () => {
    return deals.reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0);
  };

  const getWinRate = () => {
    const wonDeals = deals.filter(d => d.stage === 'Won').length;
    return deals.length > 0 ? ((wonDeals / deals.length) * 100) : 0;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Reporting & Analytics</h2>
          <p className="text-muted-foreground">Comprehensive sales performance insights</p>
        </div>
        <div className="flex items-center gap-4">
          <Select defaultValue="30d">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pipeline</p>
                <p className="text-xl font-bold">{formatCurrency(getTotalPipelineValue())}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Weighted Forecast</p>
                <p className="text-xl font-bold">{formatCurrency(getWeightedForecast())}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-xl font-bold">{getWinRate().toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Deals</p>
                <p className="text-xl font-bold">{deals.filter(d => !['Won', 'Lost'].includes(d.stage)).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Funnel */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Sales Funnel</CardTitle>
            <p className="text-sm text-muted-foreground">Deal progression through pipeline stages</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip formatter={(value) => [value, 'Deals']} />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Leads by Channel */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Leads by Channel</CardTitle>
            <p className="text-sm text-muted-foreground">Lead acquisition sources</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsByChannelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip formatter={(value) => [value, 'Leads']} />
                  <Bar dataKey="leads" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rep Performance Leaderboard */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Sales Rep Performance</CardTitle>
            <p className="text-sm text-muted-foreground">Individual performance metrics</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {repPerformanceData
                .sort((a, b) => b.dealsWon - a.dealsWon)
                .map((rep, index) => (
                <div key={rep.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                      <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium">{rep.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {rep.dealsWon}/{rep.totalDeals} deals won
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(rep.revenue)}</p>
                    <p className="text-sm text-muted-foreground">
                      {rep.avgResponseTime}m avg response
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Forecast Table */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Revenue Forecast</CardTitle>
            <p className="text-sm text-muted-foreground">Probability-weighted pipeline</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                <div>Stage</div>
                <div>Pipeline Value</div>
                <div>Probability</div>
                <div>Weighted Value</div>
              </div>
              {forecastData.map((item) => (
                <div key={item.stage} className="grid grid-cols-4 gap-4 text-sm">
                  <div className="font-medium">{item.stage}</div>
                  <div>{formatCurrency(item.pipelineValue)}</div>
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {item.probability}%
                    </Badge>
                  </div>
                  <div className="font-medium text-green-600">
                    {formatCurrency(item.weightedValue)}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-4 text-sm font-bold border-t pt-2">
                <div>Total</div>
                <div>{formatCurrency(forecastData.reduce((sum, item) => sum + item.pipelineValue, 0))}</div>
                <div>-</div>
                <div className="text-green-600">
                  {formatCurrency(forecastData.reduce((sum, item) => sum + item.weightedValue, 0))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportingTab;
