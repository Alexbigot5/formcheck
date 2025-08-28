import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  User, 
  Building, 
  Mail, 
  Phone, 
  Globe,
  Calendar,
  Clock,
  AlertCircle,
  RefreshCw,
  Edit,
  MoreHorizontal
} from "lucide-react";
import { leadsApi, leadsHelpers, type LeadDetails } from "@/lib/leadsApi";
import LeadActions from "@/components/LeadActions";
import EnhancedTimeline from "@/components/EnhancedTimeline";

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [lead, setLead] = useState<LeadDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Load lead data
  useEffect(() => {
    if (!id) return;
    
    loadLead();
  }, [id]);

  const loadLead = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const leadData = await leadsApi.getLead(id);
      setLead(leadData);
    } catch (error: any) {
      console.error('Failed to load lead:', error);
      toast.error('Failed to load lead details', { description: error.message });
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };



  if (loading || !lead) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-10">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span>Loading lead details...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">
                {leadsHelpers.getDisplayName(lead)}
              </h1>
              <p className="text-muted-foreground">
                Lead #{lead.id.slice(-8)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={loadLead}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Lead Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Lead Actions</h2>
          <LeadActions 
            lead={lead} 
            onLeadUpdate={(updatedLead) => {
              setLead({ ...lead, ...updatedLead });
            }}
            onRefresh={() => {
              loadLead();
            }}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lead Information */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lead Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status and Score */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={leadsHelpers.getStatusColor(lead.status)} variant="outline">
                      {lead.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-sm text-muted-foreground">Score</p>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">{lead.score}</span>
                      <Badge className={leadsHelpers.getScoreBandColor(lead.scoreBand)} variant="outline">
                        {lead.scoreBand}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact Details */}
                <div className="space-y-3">
                  {lead.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{lead.email}</span>
                    </div>
                  )}
                  
                  {lead.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{lead.phone}</span>
                    </div>
                  )}
                  
                  {lead.company && (
                    <div className="flex items-center space-x-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{lead.company}</span>
                    </div>
                  )}
                  
                  {lead.domain && (
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{lead.domain}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Source and Owner */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Source</span>
                    <div className="flex items-center space-x-1">
                      <span>{leadsHelpers.getSourceIcon(lead.source)}</span>
                      <span className="text-sm capitalize">{lead.source.replace('_', ' ')}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Owner</span>
                    <div className="flex items-center space-x-1">
                      {lead.ownerName ? (
                        <>
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{lead.ownerName}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SLA Information */}
            {lead.slaClocks && lead.slaClocks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    SLA Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lead.slaClocks.map((sla, index) => {
                    const now = new Date();
                    const target = new Date(sla.targetAt);
                    const isOverdue = now > target && !sla.satisfiedAt;
                    const timeRemaining = target.getTime() - now.getTime();
                    
                    return (
                      <div key={sla.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            SLA #{index + 1}
                          </span>
                          <Badge 
                            className={isOverdue ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} 
                            variant="outline"
                          >
                            {sla.satisfiedAt ? 'Satisfied' : isOverdue ? 'Overdue' : 'Active'}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Target: {target.toLocaleString()}</div>
                          {sla.satisfiedAt && (
                            <div>Satisfied: {new Date(sla.satisfiedAt).toLocaleString()}</div>
                          )}
                          {!sla.satisfiedAt && (
                            <div className={isOverdue ? 'text-red-600' : 'text-green-600'}>
                              {isOverdue ? 
                                `${Math.ceil(Math.abs(timeRemaining) / (60 * 1000))}m overdue` :
                                `${Math.ceil(timeRemaining / (60 * 1000))}m remaining`
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Custom Fields */}
            {lead.fields && Object.keys(lead.fields).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Custom Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(lead.fields).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground capitalize">
                          {key.replace('_', ' ')}
                        </span>
                        <span className="text-sm">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Enhanced Timeline */}
          <div className="lg:col-span-2">
            <EnhancedTimeline 
              leadId={lead.id}
              autoRefresh={true}
              refreshInterval={30000}
              maxHeight="600px"
              showHeader={true}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default LeadDetail;
