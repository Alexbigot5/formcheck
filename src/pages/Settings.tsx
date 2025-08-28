import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/AuthProvider";
import { useGet, usePost, useDelete } from "@/lib/useApi";
import { queryKeys } from "@/lib/queryClient";
import { ApiKey } from "@/lib/types";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Trash2, Plus, Eye, EyeOff } from "lucide-react";

const segments = ["high", "medium", "low"] as const;
type Segment = typeof segments[number];

const providers = ["hubspot", "salesforce"] as const;
type Provider = typeof providers[number];

interface Weights { urgency: number; engagement: number; jobRole: number }
interface Thresholds { high: number; medium: number; low: number }

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [active, setActive] = useState("api-keys");
  
  // API Keys state
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{key: string, name: string} | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  // Email templates summary
  const [templatesPresent, setTemplatesPresent] = useState<Record<Segment, boolean>>({ high: false, medium: false, low: false });

  // Lead scoring quick edit
  const [weights, setWeights] = useState<Weights>({ urgency: 30, engagement: 40, jobRole: 30 });
  const [thresholds, setThresholds] = useState<Thresholds>({ high: 75, medium: 45, low: 0 });
  const totalWeight = useMemo(() => weights.urgency + weights.engagement + weights.jobRole, [weights]);
  const [rawLeadScoring, setRawLeadScoring] = useState<any | null>(null);

  // CRM quick settings
  const [provider, setProvider] = useState<Provider | null>(null);
  const [connected, setConnected] = useState(false);

  // API Keys queries
  const { data: apiKeysData, isLoading: loadingKeys, refetch: refetchKeys } = useGet<{keys: ApiKey[]}>(
    queryKeys.apiKeys(),
    '/api/keys',
    { enabled: isAuthenticated }
  );

  const createKeyMutation = usePost<{id: string, name: string, key: string, ipAllowlist?: string[], createdAt: string}>('/api/keys', {
    onSuccess: (data) => {
      setNewlyCreatedKey({ key: data.key, name: data.name });
      setShowKeyDialog(true);
      setShowNewKeyDialog(false);
      setNewKeyName("");
      refetchKeys();
      toast.success("API key created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create API key", { description: error.message });
    }
  });

  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  
  const deleteKeyMutation = useDelete<void>(keyToDelete ? `/api/keys/${keyToDelete}` : '', {
    onSuccess: () => {
      refetchKeys();
      setKeyToDelete(null);
      toast.success("API key deleted");
    },
    onError: (error) => {
      setKeyToDelete(null);
      toast.error("Failed to delete API key", { description: error.message });
    }
  });

  useEffect(() => {
    // Redirect if not authenticated
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    // SEO
    document.title = "Settings | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Configure API keys, email templates, lead scoring, and CRM integration settings.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/settings`);
  }, [navigate, isAuthenticated]);

  // API Key handlers
  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }
    createKeyMutation.mutate({ name: newKeyName.trim() });
  };

  const handleDeleteKey = (keyId: string) => {
    setKeyToDelete(keyId);
    deleteKeyMutation.mutate();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
  };

  const saveLeadScoring = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return navigate("/login");

      const merged = {
        ...(rawLeadScoring || {}),
        weights,
        thresholds,
      };

      const { error } = await supabase
        .from("profiles")
        .update({ lead_scoring: merged })
        .eq("id", user.id);
      if (error) throw error;
      setRawLeadScoring(merged);
      toast.success("Lead scoring saved");
    } catch (e: any) {
      toast.error("Couldn't save lead scoring", { description: e.message });
    }
  };

  const saveProvider = async () => {
    if (!provider) return toast.error("Select a CRM provider");
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return navigate("/login");

    const { error } = await supabase
      .from("crm_settings")
      .upsert({ user_id: user.id, provider, connected }, { onConflict: "user_id,provider" });
    if (error) return toast.error("Couldn't save provider", { description: error.message });

    await supabase.from("profiles").update({ crm_provider: provider, crm_connected: connected }).eq("id", user.id);
    toast.success("CRM provider saved");
  };

  return (
    <Layout>
      <div>
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-1">Configure email templates, lead scoring, and CRM integrations.</p>
          </header>

          <Tabs value={active} onValueChange={setActive}>
            <TabsList>
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="email">Email Templates</TabsTrigger>
              <TabsTrigger value="lead">Lead Scoring</TabsTrigger>
              <TabsTrigger value="crm">CRM</TabsTrigger>
            </TabsList>

            <TabsContent value="api-keys" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage API keys for programmatic access to your SmartForms AI account.
                    </p>
                  </div>
                  <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
                    <DialogTrigger asChild>
                      <Button variant="hero">
                        <Plus className="w-4 h-4 mr-2" />
                        Create API Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New API Key</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="key-name">Key Name</Label>
                          <Input
                            id="key-name"
                            placeholder="e.g., Production Integration"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowNewKeyDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCreateKey}
                            disabled={createKeyMutation.isPending}
                          >
                            {createKeyMutation.isPending ? "Creating..." : "Create Key"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {loadingKeys ? (
                    <div className="text-center py-4">Loading API keys...</div>
                  ) : (
                    <div className="space-y-3">
                      {apiKeysData?.keys?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No API keys found.</p>
                          <p className="text-sm">Create your first API key to get started.</p>
                        </div>
                      ) : (
                        apiKeysData?.keys?.map((apiKey) => (
                          <div key={apiKey.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium">{apiKey.name}</div>
                              <div className="text-sm text-muted-foreground">
                                sk_live_••••••••{apiKey.id.slice(-4)} • Created {new Date(apiKey.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the API key "{apiKey.name}"? 
                                      This action cannot be undone and will immediately revoke access.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteKey(apiKey.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* New Key Created Dialog */}
              <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>API Key Created Successfully</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Your new API key:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-background border rounded text-sm font-mono">
                          {newlyCreatedKey?.key}
                        </code>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard(newlyCreatedKey?.key || '')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>⚠️ <strong>Important:</strong> This is the only time you'll see the full API key.</p>
                      <p>• Copy it now and store it securely</p>
                      <p>• You can only see the last 4 characters later</p>
                      <p>• If lost, you'll need to create a new one</p>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => setShowKeyDialog(false)}>
                        I've Saved It Safely
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="email" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Templates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Manage follow-up templates for each lead segment.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {segments.map((seg) => (
                      <div key={seg} className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground uppercase">{seg}</div>
                        <div className="text-sm font-medium">{templatesPresent[seg] ? "Customized" : "Using default"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="hero" onClick={() => navigate("/email-templates")}>Open editor</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lead" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Scoring</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Urgency weight</Label>
                        <Input type="number" className="w-24" value={weights.urgency} onChange={(e) => setWeights((w) => ({ ...w, urgency: Number(e.target.value) }))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Engagement weight</Label>
                        <Input type="number" className="w-24" value={weights.engagement} onChange={(e) => setWeights((w) => ({ ...w, engagement: Number(e.target.value) }))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Job role weight</Label>
                        <Input type="number" className="w-24" value={weights.jobRole} onChange={(e) => setWeights((w) => ({ ...w, jobRole: Number(e.target.value) }))} />
                      </div>
                      <div className="text-sm text-muted-foreground">Total weight: {totalWeight}</div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>High threshold (≥)</Label>
                        <Input type="number" className="w-24" value={thresholds.high} onChange={(e) => setThresholds((t) => ({ ...t, high: Number(e.target.value) }))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Medium threshold (≥)</Label>
                        <Input type="number" className="w-24" value={thresholds.medium} onChange={(e) => setThresholds((t) => ({ ...t, medium: Number(e.target.value) }))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Low threshold (&lt; Medium)</Label>
                        <Input type="number" className="w-24" value={thresholds.low} onChange={(e) => setThresholds((t) => ({ ...t, low: Number(e.target.value) }))} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={() => navigate("/lead-scoring")}>Open advanced</Button>
                    <Button variant="hero" onClick={saveLeadScoring}>Save</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="crm" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>CRM Integration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Choose your provider and manage connection.</p>
                  <RadioGroup value={provider ?? undefined} onValueChange={(v) => setProvider(v as Provider)} className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-lg border p-3">
                      <RadioGroupItem value="hubspot" id="hubspot" />
                      <span>HubSpot</span>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border p-3">
                      <RadioGroupItem value="salesforce" id="salesforce" />
                      <span>Salesforce</span>
                    </label>
                  </RadioGroup>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={saveProvider}>Save selection</Button>
                    <Button
                      variant="hero"
                      onClick={() => toast.info("OAuth setup required", { description: "Add your CRM OAuth credentials to enable connection." })}
                      disabled={!provider}
                    >
                      Connect via OAuth
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => { setConnected(true); toast("Marked as connected (demo)"); saveProvider(); }}
                      disabled={!provider}
                    >
                      Mark as connected
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => navigate("/integrations/crm")}>Open full setup</Button>
                  </div>
                </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
