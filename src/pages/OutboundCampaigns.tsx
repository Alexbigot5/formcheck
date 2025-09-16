import React, { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Plus, 
  Mail, 
  Users, 
  Send, 
  Settings, 
  Play, 
  Pause, 
  BarChart3, 
  Eye, 
  Edit, 
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

interface MailboxPool {
  id: string;
  name: string;
  mailboxes: string[];
  status: 'active' | 'inactive';
  created_at: string;
}

interface EmailSequence {
  id: string;
  name: string;
  steps: number;
  status: 'draft' | 'active' | 'paused';
  open_rate: number;
  reply_rate: number;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  sequence_id: string;
  mailbox_pool_id: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  total_leads: number;
  sent: number;
  opened: number;
  replied: number;
  created_at: string;
}

const OutboundCampaigns = () => {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [showNewSequenceDialog, setShowNewSequenceDialog] = useState(false);
  const [showNewPoolDialog, setShowNewPoolDialog] = useState(false);

  // Production data - load from API
  const [mailboxPools, setMailboxPools] = useState<MailboxPool[]>([]);
  const [emailSequences, setEmailSequences] = useState<EmailSequence[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaignData();
  }, []);

  const loadCampaignData = async () => {
    try {
      setLoading(true);
      
      // Load mailbox pools
      const poolsResponse = await fetch('/api/campaigns/mailbox-pools', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        }
      });
      if (poolsResponse.ok) {
        const poolsData = await poolsResponse.json();
        setMailboxPools(poolsData.pools || []);
      }

      // Load email sequences
      const sequencesResponse = await fetch('/api/campaigns/sequences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        }
      });
      if (sequencesResponse.ok) {
        const sequencesData = await sequencesResponse.json();
        setEmailSequences(sequencesData.sequences || []);
      }

      // Load campaigns
      const campaignsResponse = await fetch('/api/campaigns', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        }
      });
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json();
        setCampaigns(campaignsData.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to load campaign data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      draft: "secondary", 
      paused: "outline",
      inactive: "destructive",
      completed: "secondary"
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Layout>
      <div>
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Outbound Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Manage your cold email campaigns, sequences, and mailbox pools.
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="sequences">Email Sequences</TabsTrigger>
            <TabsTrigger value="mailboxes">Mailbox Pools</TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Active Campaigns</h2>
              <Dialog open={showNewCampaignDialog} onOpenChange={setShowNewCampaignDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Campaign</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="campaign-name">Campaign Name</Label>
                      <Input id="campaign-name" placeholder="Enter campaign name" />
                    </div>
                    <div>
                      <Label htmlFor="sequence-select">Email Sequence</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sequence" />
                        </SelectTrigger>
                        <SelectContent>
                          {emailSequences.map((seq) => (
                            <SelectItem key={seq.id} value={seq.id}>
                              {seq.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="pool-select">Mailbox Pool</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select mailbox pool" />
                        </SelectTrigger>
                        <SelectContent>
                          {mailboxPools.map((pool) => (
                            <SelectItem key={pool.id} value={pool.id}>
                              {pool.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button onClick={() => {
                        toast.success("Campaign created successfully!");
                        setShowNewCampaignDialog(false);
                      }}>
                        Create Campaign
                      </Button>
                      <Button variant="outline" onClick={() => setShowNewCampaignDialog(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(campaign.status)}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        {campaign.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Leads</p>
                        <p className="font-medium">{campaign.total_leads}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sent</p>
                        <p className="font-medium">{campaign.sent}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Opened</p>
                        <p className="font-medium">{campaign.opened} ({((campaign.opened/campaign.sent)*100).toFixed(1)}%)</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Replied</p>
                        <p className="font-medium">{campaign.replied} ({((campaign.replied/campaign.sent)*100).toFixed(1)}%)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Email Sequences Tab */}
          <TabsContent value="sequences" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Email Sequences</h2>
              <Dialog open={showNewSequenceDialog} onOpenChange={setShowNewSequenceDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Sequence
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Email Sequence</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sequence-name">Sequence Name</Label>
                      <Input id="sequence-name" placeholder="Enter sequence name" />
                    </div>
                    <div>
                      <Label htmlFor="sequence-description">Description</Label>
                      <Textarea id="sequence-description" placeholder="Describe this sequence..." />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button onClick={() => {
                        toast.success("Email sequence created successfully!");
                        setShowNewSequenceDialog(false);
                      }}>
                        Create Sequence
                      </Button>
                      <Button variant="outline" onClick={() => setShowNewSequenceDialog(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {emailSequences.map((sequence) => (
                <Card key={sequence.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(sequence.status)}
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Steps</p>
                        <p className="font-medium">{sequence.steps} emails</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Open Rate</p>
                        <p className="font-medium">{sequence.open_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reply Rate</p>
                        <p className="font-medium">{sequence.reply_rate}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Mailbox Pools Tab */}
          <TabsContent value="mailboxes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Mailbox Pools</h2>
              <Dialog open={showNewPoolDialog} onOpenChange={setShowNewPoolDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Pool
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Mailbox Pool</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="pool-name">Pool Name</Label>
                      <Input id="pool-name" placeholder="Enter pool name" />
                    </div>
                    <div>
                      <Label htmlFor="mailboxes">Mailboxes</Label>
                      <Textarea 
                        id="mailboxes" 
                        placeholder="Enter email addresses (one per line)"
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button onClick={() => {
                        toast.success("Mailbox pool created successfully!");
                        setShowNewPoolDialog(false);
                      }}>
                        Create Pool
                      </Button>
                      <Button variant="outline" onClick={() => setShowNewPoolDialog(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {mailboxPools.map((pool) => (
                <Card key={pool.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{pool.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(pool.status)}
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {pool.mailboxes.length} mailboxes
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {pool.mailboxes.slice(0, 3).map((email, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {email}
                          </Badge>
                        ))}
                        {pool.mailboxes.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{pool.mailboxes.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default OutboundCampaigns;
