import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Target, Award, Building, User, Calendar } from "lucide-react";
import { Deal } from "@/pages/CrmHub";

interface PipelineTabProps {
  deals: Deal[];
}

const PipelineTab: React.FC<PipelineTabProps> = ({ deals }) => {
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  const stages = [
    { id: "New", name: "New", color: "bg-gray-100" },
    { id: "Contacted", name: "Contacted", color: "bg-blue-100" },
    { id: "Qualified", name: "Qualified", color: "bg-yellow-100" },
    { id: "Meeting", name: "Meeting", color: "bg-orange-100" },
    { id: "Proposal", name: "Proposal", color: "bg-purple-100" },
    { id: "Negotiation", name: "Negotiation", color: "bg-green-100" },
    { id: "Won", name: "Won", color: "bg-green-200" },
    { id: "Lost", name: "Lost", color: "bg-red-100" }
  ];

  const getDealsByStage = (stage: string) => {
    return deals.filter(deal => deal.stage === stage);
  };

  const getTotalPipelineValue = () => {
    return deals.reduce((total, deal) => total + deal.value, 0);
  };

  const getWeightedForecast = () => {
    return deals.reduce((total, deal) => total + (deal.value * deal.probability / 100), 0);
  };

  const getWinRate = () => {
    const wonDeals = deals.filter(deal => deal.stage === "Won").length;
    const totalDeals = deals.length;
    return totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
  };

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    if (draggedDeal) {
      // In a real app, this would update the deal stage
      console.log(`Moving deal ${draggedDeal.id} to stage ${stage}`);
      setDraggedDeal(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Sales Pipeline</h2>
          <p className="text-muted-foreground">Track deals through your sales process</p>
        </div>
        <Button>Add Deal</Button>
      </div>

      {/* Pipeline Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
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
                <Target className="h-5 w-5 text-purple-600" />
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
                <Award className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Deals</p>
                <p className="text-xl font-bold">{deals.filter(d => !['Won', 'Lost'].includes(d.stage)).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {stages.map((stage) => {
            const stageDeals = getDealsByStage(stage.id);
            const stageValue = stageDeals.reduce((total, deal) => total + deal.value, 0);
            
            return (
              <div
                key={stage.id}
                className="w-80 bg-gray-50 rounded-xl p-4"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">{stage.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(stageValue)}
                  </p>
                </div>

                {/* Deal Cards */}
                <div className="space-y-3">
                  {stageDeals.map((deal) => (
                    <Card
                      key={deal.id}
                      className="rounded-lg cursor-move hover:shadow-md transition-shadow"
                      draggable
                      onDragStart={() => handleDragStart(deal)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium text-sm leading-tight">{deal.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Building className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">{deal.company}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(deal.value)}
                            </div>
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                            >
                              {deal.probability}%
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {deal.owner}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(deal.closeDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Add Deal Button */}
                {stageDeals.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No deals in this stage</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PipelineTab;
