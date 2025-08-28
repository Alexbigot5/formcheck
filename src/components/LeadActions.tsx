import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Calculator,
  Users,
  MessageSquare,
  Trash2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Eye,
  Zap,
  Database,
  Clock
} from "lucide-react";
import { 
  leadActionsApi, 
  leadsHelpers, 
  type Lead, 
  type LeadDetails 
} from "@/lib/leadsApi";
import { 
  routingApi, 
  ownersApi, 
  type RoutingResult, 
  type Owner 
} from "@/lib/routingApi";
import { 
  scoringApi, 
  type ScoringResult 
} from "@/lib/scoringApi";

interface LeadActionsProps {
  lead: LeadDetails;
  onLeadUpdate: (updatedLead: Lead) => void;
  onRefresh: () => void;
}

const LeadActions: React.FC<LeadActionsProps> = ({ lead, onLeadUpdate, onRefresh }) => {
  // State for various actions
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [owners, setOwners] = useState<Owner[]>([]);
  const [crmProviders, setCrmProviders] = useState<Array<{ id: string; name: string; configured: boolean }>>([]);

  // Re-scoring state
  const [scoringPreview, setScoringPreview] = useState<ScoringResult | null>(null);
  const [newScore, setNewScore] = useState(lead.score);
  const [newScoreBand, setNewScoreBand] = useState<'LOW' | 'MEDIUM' | 'HIGH'>(lead.scoreBand);
  const [scoreReason, setScoreReason] = useState('');

  // Re-routing state
  const [routingPreview, setRoutingPreview] = useState<RoutingResult | null>(null);
  const [selectedOwner, setSelectedOwner] = useState(lead.ownerId || '');
  const [routingReason, setRoutingReason] = useState('');
  const [routingSla, setRoutingSla] = useState<number>(30);

  // First touch state
  const [messageBody, setMessageBody] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageChannel, setMessageChannel] = useState<'EMAIL' | 'DM' | 'API'>('EMAIL');

  // CRM sync state
  const [crmPreview, setCrmPreview] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState('');

  // Load data on mount
  useEffect(() => {
    loadOwners();
    loadCrmProviders();
  }, []);

  const loadOwners = async () => {
    try {
      const { owners } = await ownersApi.getOwners();
      setOwners(owners);
    } catch (error) {
      console.error('Failed to load owners:', error);
    }
  };

  const loadCrmProviders = async () => {
    try {
      const { providers } = await leadActionsApi.getCrmProviders();
      setCrmProviders(providers);
      if (providers.length > 0 && !selectedProvider) {
        setSelectedProvider(providers.find(p => p.configured)?.id || providers[0].id);
      }
    } catch (error) {
      console.error('Failed to load CRM providers:', error);
    }
  };

  const setActionLoading = (action: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [action]: isLoading }));
  };

  // Re-scoring actions
  const previewScoring = async () => {
    try {
      setActionLoading('scoring-preview', true);
      const result = await scoringApi.testScoring({
        email: lead.email,
        name: lead.name,
        company: lead.company,
        fields: lead.fields
      });
      setScoringPreview(result);
      setNewScore(result.score);
      setNewScoreBand(result.band as 'LOW' | 'MEDIUM' | 'HIGH');
    } catch (error: any) {
      toast.error('Failed to preview scoring', { description: error.message });
    } finally {
      setActionLoading('scoring-preview', false);
    }
  };

  const applyScoring = async () => {
    try {
      setActionLoading('scoring-apply', true);
      const result = await leadActionsApi.updateScore(
        lead.id, 
        newScore, 
        newScoreBand, 
        scoreReason || 'Manual score update'
      );
      onLeadUpdate(result.lead);
      toast.success(result.message);
      setScoringPreview(null);
      setScoreReason('');
    } catch (error: any) {
      toast.error('Failed to update score', { description: error.message });
    } finally {
      setActionLoading('scoring-apply', false);
    }
  };

  // Re-routing actions
  const previewRouting = async () => {
    try {
      setActionLoading('routing-preview', true);
      const result = await routingApi.testRouting({
        email: lead.email,
        name: lead.name,
        company: lead.company,
        score: lead.score,
        scoreBand: lead.scoreBand,
        fields: lead.fields
      });
      setRoutingPreview(result);
    } catch (error: any) {
      toast.error('Failed to preview routing', { description: error.message });
    } finally {
      setActionLoading('routing-preview', false);
    }
  };

  const applyRouting = async () => {
    if (!selectedOwner) {
      toast.error('Please select an owner');
      return;
    }

    try {
      setActionLoading('routing-apply', true);
      const result = await leadActionsApi.assignOwner(
        lead.id,
        selectedOwner,
        routingReason || 'Manual assignment',
        routingSla
      );
      onLeadUpdate(result.lead);
      toast.success(result.message);
      setRoutingPreview(null);
      setRoutingReason('');
    } catch (error: any) {
      toast.error('Failed to assign owner', { description: error.message });
    } finally {
      setActionLoading('routing-apply', false);
    }
  };

  // First touch action
  const sendFirstTouch = async () => {
    if (!messageBody.trim()) {
      toast.error('Message body is required');
      return;
    }

    try {
      setActionLoading('first-touch', true);
      const result = await leadActionsApi.createMessage(
        lead.id,
        messageBody,
        messageSubject || undefined,
        messageChannel
      );
      
      toast.success('Message sent successfully!');
      if (result.slaUpdate?.satisfied) {
        toast.success('SLA satisfied with first touch response');
      }
      
      setMessageBody('');
      setMessageSubject('');
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to send message', { description: error.message });
    } finally {
      setActionLoading('first-touch', false);
    }
  };

  // CRM sync actions
  const previewCrmSync = async () => {
    if (!selectedProvider) {
      toast.error('Please select a CRM provider');
      return;
    }

    try {
      setActionLoading('crm-preview', true);
      const result = await leadActionsApi.syncToCrm(lead.id, true, selectedProvider);
      setCrmPreview(result);
    } catch (error: any) {
      toast.error('Failed to preview CRM sync', { description: error.message });
    } finally {
      setActionLoading('crm-preview', false);
    }
  };

  const applyCrmSync = async () => {
    if (!selectedProvider) {
      toast.error('Please select a CRM provider');
      return;
    }

    try {
      setActionLoading('crm-apply', true);
      const result = await leadActionsApi.syncToCrm(lead.id, false, selectedProvider);
      toast.success(result.message);
      setCrmPreview(null);
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to sync to CRM', { description: error.message });
    } finally {
      setActionLoading('crm-apply', false);
    }
  };

  // GDPR delete action
  const deleteLead = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this lead and all associated data? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setActionLoading('delete', true);
      const result = await leadActionsApi.deleteLead(lead.id);
      toast.success(result.message);
      // Navigate back or handle deletion
      window.history.back();
    } catch (error: any) {
      toast.error('Failed to delete lead', { description: error.message });
    } finally {
      setActionLoading('delete', false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Re-score Action */}
      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <Calculator className="w-4 h-4 mr-2" />
                Re-score Lead
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Test new scoring rules and update lead score
              </p>
              <div className="mt-2">
                <Badge className={leadsHelpers.getScoreBandColor(lead.scoreBand)}>
                  Current: {lead.score} ({lead.scoreBand})
                </Badge>
              </div>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Re-score Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                onClick={previewScoring}
                disabled={loading['scoring-preview']}
                variant="outline"
                className="flex-1 mr-2"
              >
                <Eye className="w-4 h-4 mr-2" />
                {loading['scoring-preview'] ? 'Testing...' : 'Preview Score'}
              </Button>
              <div className="text-sm text-muted-foreground">
                Current: {lead.score}
              </div>
            </div>

            {scoringPreview && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>New Score:</span>
                      <Badge className={leadsHelpers.getScoreBandColor(scoringPreview.band as any)}>
                        {scoringPreview.score} ({scoringPreview.band})
                      </Badge>
                    </div>
                    {scoringPreview.trace.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer">View Trace</summary>
                        <div className="mt-2 space-y-1">
                          {scoringPreview.trace.map((trace: any, index: number) => (
                            <div key={index} className="border-l-2 pl-2">
                              <div>{trace.step}: +{trace.points}</div>
                              <div className="text-muted-foreground">{trace.reason}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-2">
              <Label>Manual Score (0-100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newScore}
                onChange={(e) => setNewScore(Number(e.target.value))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Score Band</Label>
              <Select value={newScoreBand} onValueChange={(value: any) => setNewScoreBand(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Reason (optional)</Label>
              <Input
                value={scoreReason}
                onChange={(e) => setScoreReason(e.target.value)}
                placeholder="Manual adjustment based on..."
              />
            </div>

            <Button
              onClick={applyScoring}
              disabled={loading['scoring-apply']}
              className="w-full"
            >
              <Zap className="w-4 h-4 mr-2" />
              {loading['scoring-apply'] ? 'Updating...' : 'Update Score'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Re-route Action */}
      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <Users className="w-4 h-4 mr-2" />
                Re-route Lead
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Test routing rules and assign to owner
              </p>
              <div className="mt-2">
                <Badge variant="outline">
                  Current: {lead.ownerName || 'Unassigned'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Re-route Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={previewRouting}
              disabled={loading['routing-preview']}
              variant="outline"
              className="w-full"
            >
              <Eye className="w-4 h-4 mr-2" />
              {loading['routing-preview'] ? 'Testing...' : 'Preview Routing'}
            </Button>

            {routingPreview && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div>
                      <strong>Suggested Assignment:</strong>
                      <div className="text-sm mt-1">
                        Pool: {routingPreview.pool || 'None'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {routingPreview.reason}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-2">
              <Label>Assign to Owner</Label>
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner..." />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name || owner.email} ({owner.pool})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>SLA (minutes)</Label>
              <Input
                type="number"
                min="1"
                value={routingSla}
                onChange={(e) => setRoutingSla(Number(e.target.value))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Reason (optional)</Label>
              <Input
                value={routingReason}
                onChange={(e) => setRoutingReason(e.target.value)}
                placeholder="Manual assignment because..."
              />
            </div>

            <Button
              onClick={applyRouting}
              disabled={loading['routing-apply'] || !selectedOwner}
              className="w-full"
            >
              <Users className="w-4 h-4 mr-2" />
              {loading['routing-apply'] ? 'Assigning...' : 'Assign Owner'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* First Touch Action */}
      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <MessageSquare className="w-4 h-4 mr-2" />
                Mark First Touch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Send outbound message and satisfy SLA
              </p>
              {lead.slaClocks && lead.slaClocks.some(sla => !sla.satisfiedAt) && (
                <div className="mt-2">
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                    <Clock className="w-3 h-3 mr-1" />
                    Active SLA
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark First Touch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Channel</Label>
              <Select value={messageChannel} onValueChange={(value: any) => setMessageChannel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="DM">Direct Message</SelectItem>
                  <SelectItem value="API">API/Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Subject (optional)</Label>
              <Input
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Re: Your inquiry..."
              />
            </div>

            <div className="grid gap-2">
              <Label>Message Body</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Thank you for your interest..."
                rows={4}
              />
            </div>

            <Button
              onClick={sendFirstTouch}
              disabled={loading['first-touch'] || !messageBody.trim()}
              className="w-full"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {loading['first-touch'] ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CRM Sync Action */}
      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync to CRM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Preview and sync lead data to CRM
              </p>
              <div className="mt-2">
                <Badge variant="outline">
                  {crmProviders.filter(p => p.configured).length} configured
                </Badge>
              </div>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sync to CRM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>CRM Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  {crmProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} {provider.configured ? '✓' : '(Not configured)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={previewCrmSync}
                disabled={loading['crm-preview'] || !selectedProvider}
                variant="outline"
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-2" />
                {loading['crm-preview'] ? 'Loading...' : 'Preview'}
              </Button>
              <Button
                onClick={applyCrmSync}
                disabled={loading['crm-apply'] || !selectedProvider}
                className="flex-1"
              >
                <Database className="w-4 h-4 mr-2" />
                {loading['crm-apply'] ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>

            {crmPreview && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Sync Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-4">
                      {/* Payload */}
                      <div>
                        <h4 className="font-medium text-sm mb-2">Outbound Payload:</h4>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(crmPreview.payload, null, 2)}
                        </pre>
                      </div>

                      {/* Diff */}
                      {crmPreview.diff && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Changes:</h4>
                          <div className="space-y-2 text-xs">
                            {Object.keys(crmPreview.diff.added).length > 0 && (
                              <div>
                                <div className="font-medium text-green-600">Added:</div>
                                {Object.entries(crmPreview.diff.added).map(([key, value]) => (
                                  <div key={key} className="ml-2">
                                    + {key}: {JSON.stringify(value)}
                                  </div>
                                ))}
                              </div>
                            )}
                            {Object.keys(crmPreview.diff.changed).length > 0 && (
                              <div>
                                <div className="font-medium text-blue-600">Changed:</div>
                                {Object.entries(crmPreview.diff.changed).map(([key, change]: [string, any]) => (
                                  <div key={key} className="ml-2">
                                    ~ {key}: {JSON.stringify(change.from)} → {JSON.stringify(change.to)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* GDPR Delete Action */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base text-red-600">
            <Trash2 className="w-4 h-4 mr-2" />
            GDPR Delete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Permanently delete lead and all data
          </p>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This action cannot be undone
            </AlertDescription>
          </Alert>
          <Button
            onClick={deleteLead}
            disabled={loading['delete']}
            variant="destructive"
            size="sm"
            className="w-full mt-3"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {loading['delete'] ? 'Deleting...' : 'Delete Lead'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadActions;
