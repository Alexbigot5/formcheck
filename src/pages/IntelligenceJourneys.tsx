import React, { useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";
import { ArrowLeft, Route, Filter, Download } from "lucide-react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";

const IntelligenceJourneys = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    document.title = "Journey Mapping | SmartForms AI";
    
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [navigate, isAuthenticated]);

  // Mock Sankey data
  const journeyData = [
    { from: "LinkedIn", to: "Webinar", value: 180 },
    { from: "LinkedIn", to: "Email", value: 120 },
    { from: "LinkedIn", to: "Demo", value: 150 },
    { from: "Webinar", to: "Demo", value: 200 },
    { from: "Webinar", to: "Proposal", value: 120 },
    { from: "Email", to: "Demo", value: 80 },
    { from: "Demo", to: "Proposal", value: 280 },
    { from: "Proposal", to: "Closed", value: 120 }
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
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Route className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Cross-Channel Journey Mapping</h1>
              <p className="text-muted-foreground">Detailed analysis of lead paths across touchpoints</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Date Range
              </Button>
              <Button variant="outline" size="sm">Channel</Button>
              <Button variant="outline" size="sm">Campaign</Button>
              <Button variant="outline" size="sm">Persona</Button>
              <Button variant="outline" size="sm" className="ml-auto">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Journey Visualization */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Journey Flow</CardTitle>
            <p className="text-sm text-muted-foreground">
              Hover over connections to see conversion rates, volume, and median time
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-96 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Interactive Sankey Diagram</p>
                <p className="text-sm text-gray-500">Journey visualization would render here</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Journey Insights */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Converting Paths</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium">LinkedIn → Webinar → Demo → Closed</span>
                  <Badge className="bg-green-100 text-green-800">65% conversion</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium">Referral → Demo → Closed</span>
                  <Badge className="bg-blue-100 text-blue-800">58% conversion</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <span className="text-sm font-medium">Content → Email → Demo → Closed</span>
                  <Badge className="bg-orange-100 text-orange-800">42% conversion</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Journey Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Average Touchpoints</span>
                    <span className="font-medium">4.2</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Median Journey Time</span>
                    <span className="font-medium">18 days</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Most Common Entry Point</span>
                    <span className="font-medium">LinkedIn (45%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Highest Converting Channel</span>
                    <span className="font-medium">Webinars (65%)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default IntelligenceJourneys;
