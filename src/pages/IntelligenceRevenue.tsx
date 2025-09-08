import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";
import { ArrowLeft, DollarSign, TrendingUp, BarChart } from "lucide-react";
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";

const IntelligenceRevenue = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [viewMode, setViewMode] = useState<"value" | "count">("value");

  useEffect(() => {
    document.title = "Revenue Impact | SmartForms AI";
    
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [navigate, isAuthenticated]);

  const revenueData = [
    { source: "Webinars", leads: 320, pipeline: 640000, closed: 416000, roi: 3.2, cac: 125 },
    { source: "LinkedIn", leads: 450, pipeline: 450000, closed: 256000, roi: 2.1, cac: 89 },
    { source: "Email", leads: 280, pipeline: 280000, closed: 136000, roi: 1.8, cac: 45 },
    { source: "Referrals", leads: 180, pipeline: 360000, closed: 194000, roi: 4.1, cac: 25 },
    { source: "Content", leads: 220, pipeline: 220000, closed: 98000, roi: 1.5, cac: 67 }
  ];

  const roiData = [
    { source: "Referrals", roi: 4.1, fill: "#22c55e" },
    { source: "Webinars", roi: 3.2, fill: "#3b82f6" },
    { source: "LinkedIn", roi: 2.1, fill: "#f59e0b" },
    { source: "Email", roi: 1.8, fill: "#ef4444" },
    { source: "Content", roi: 1.5, fill: "#8b5cf6" }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/recommendations")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Hub
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Revenue Impact Modeling</h1>
              <p className="text-muted-foreground">Lead sources mapped to pipeline value and closed revenue</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Highest ROI Source</span>
              </div>
              <div className="text-2xl font-bold">Referrals</div>
              <div className="text-sm text-green-600">4.1x return</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Lowest CAC Source</span>
              </div>
              <div className="text-2xl font-bold">Referrals</div>
              <div className="text-sm text-blue-600">$25 per lead</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <BarChart className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Payback Period</span>
              </div>
              <div className="text-2xl font-bold">3.2 months</div>
              <div className="text-sm text-orange-600">Average</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Total Pipeline</span>
              </div>
              <div className="text-2xl font-bold">$1.95M</div>
              <div className="text-sm text-purple-600">Active</div>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">View by:</span>
              <Button 
                variant={viewMode === "value" ? "default" : "outline"} 
                size="sm"
                onClick={() => setViewMode("value")}
              >
                $ Value
              </Button>
              <Button 
                variant={viewMode === "count" ? "default" : "outline"} 
                size="sm"
                onClick={() => setViewMode("count")}
              >
                Lead Count
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline vs Closed Revenue</CardTitle>
              <p className="text-sm text-muted-foreground">Lead source performance comparison</p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${(Number(value) / 1000).toFixed(0)}k`, '']} />
                    <Bar dataKey="pipeline" fill="#ffc658" name="Pipeline Value" />
                    <Bar dataKey="closed" fill="#82ca9d" name="Closed Revenue" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ROI by Source</CardTitle>
              <p className="text-sm text-muted-foreground">Return on investment analysis</p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roiData}
                      dataKey="roi"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ source, roi }) => `${source}: ${roi}x`}
                    >
                      {roiData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Source Performance Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Source</th>
                    <th className="text-right p-2">Leads</th>
                    <th className="text-right p-2">Pipeline</th>
                    <th className="text-right p-2">Closed</th>
                    <th className="text-right p-2">ROI</th>
                    <th className="text-right p-2">CAC</th>
                    <th className="text-center p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.map((item) => (
                    <tr key={item.source} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{item.source}</td>
                      <td className="text-right p-2">{item.leads}</td>
                      <td className="text-right p-2">${(item.pipeline / 1000).toFixed(0)}k</td>
                      <td className="text-right p-2">${(item.closed / 1000).toFixed(0)}k</td>
                      <td className="text-right p-2">
                        <Badge variant={item.roi > 3 ? "default" : item.roi > 2 ? "secondary" : "outline"}>
                          {item.roi}x
                        </Badge>
                      </td>
                      <td className="text-right p-2">${item.cac}</td>
                      <td className="text-center p-2">
                        <Button size="sm" variant="outline">Drill Into Source</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default IntelligenceRevenue;
