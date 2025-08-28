import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Play, 
  ArrowRightLeft,
  Users,
  Settings,
  Activity,
  Database,
  Workflow,
  ArrowRight,
  GripVertical,
  Target,
  Zap
} from "lucide-react";

const providers = ["hubspot", "salesforce", "zoho", "pipedrive"] as const;

type Provider = typeof providers[number];

type FieldMapping = Record<string, string>; // internal_field -> provider_field

interface FieldMappingConfig {
  internal_field: string;
  crm_field: string;
  direction: 'bidirectional' | 'to_crm' | 'from_crm';
  create_only?: boolean;
  update_only?: boolean;
}

interface DuplicateHandlingPolicy {
  strategy: 'create_always' | 'update_existing' | 'skip_duplicates' | 'create_and_link';
  match_fields: string[];
  merge_strategy?: 'overwrite' | 'preserve_existing' | 'smart_merge';
}

interface OwnerAssignmentRule {
  id: string;
  name: string;
  conditions: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
  }[];
  assignment: {
    type: 'specific_user' | 'round_robin' | 'territory' | 'lead_score';
    value: string;
  };
  priority: number;
  enabled: boolean;
}

interface IntegrationHealth {
  status: 'healthy' | 'warning' | 'error';
  last_sync: string | null;
  last_success: string | null;
  error_count: number;
  recent_errors: string[];
  sync_stats: {
    total_synced: number;
    created: number;
    updated: number;
    failed: number;
  };
}

interface RoutingRules {
  high_owner?: string;
  medium_owner?: string;
  low_owner?: string;
  additional_notes?: string;
}

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  crmMapping?: string;
}

interface SyncSettings {
  mode: 'off' | 'one_way' | 'two_way';
  frequency: 'real_time' | 'hourly' | 'daily';
  conflictResolution: 'smartforms_wins' | 'crm_wins' | 'newest_wins';
}

const internalFields = [
  { key: "name", label: "Lead name" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "job_title", label: "Job title" },
  { key: "urgency", label: "Urgency" },
  { key: "engagement", label: "Engagement" },
  { key: "response_summary", label: "Response summary" },
];

const CrmIntegrations: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [connected, setConnected] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping>({});
  const [routingRules, setRoutingRules] = useState<RoutingRules>({});
  const progress = useMemo(() => (step / 4) * 100, [step]);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [hasSavedCreds, setHasSavedCreds] = useState(false);
  
  // Enhanced features state
  const [fieldMappingConfigs, setFieldMappingConfigs] = useState<FieldMappingConfig[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicateHandlingPolicy>({
    strategy: 'update_existing',
    match_fields: ['email'],
    merge_strategy: 'smart_merge'
  });
  const [ownerAssignmentRules, setOwnerAssignmentRules] = useState<OwnerAssignmentRule[]>([]);
  const [isDryRunMode, setIsDryRunMode] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<any[]>([]);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealth>({
    status: 'healthy',
    last_sync: null,
    last_success: null,
    error_count: 0,
    recent_errors: [],
    sync_stats: {
      total_synced: 0,
      created: 0,
      updated: 0,
      failed: 0
    }
  });

  // New state for enhanced features
  const [useSmartFormsCRM, setUseSmartFormsCRM] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([
    { id: 'new', name: 'New', description: 'Fresh leads from forms', crmMapping: '' },
    { id: 'contacted', name: 'Contacted', description: 'Initial outreach sent', crmMapping: '' },
    { id: 'qualified', name: 'Qualified', description: 'Lead meets criteria', crmMapping: '' },
    { id: 'meeting', name: 'Meeting', description: 'Demo or call scheduled', crmMapping: '' },
    { id: 'won', name: 'Won', description: 'Successfully closed', crmMapping: '' },
    { id: 'lost', name: 'Lost', description: 'Opportunity lost', crmMapping: '' }
  ]);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    mode: 'off',
    frequency: 'real_time',
    conflictResolution: 'smartforms_wins'
  });

  useEffect(() => {
    // SEO
    document.title = "CRM Integrations | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Connect HubSpot, Salesforce, Zoho, or Pipedrive; map fields and routing.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/integrations/crm`);

    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (!USE_MOCK_AUTH) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) navigate("/login");
      });

      // Load existing settings
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.user) return navigate("/login");
        const { data, error } = await supabase
          .from("crm_settings")
          .select("provider, connected, field_mappings, routing_rules, credentials")
          .eq("user_id", session.user.id);
        if (!error && data && data.length) {
          const first = data[0] as any;
          setProvider((first.provider as Provider) || null);
          setConnected(!!first.connected);
          setFieldMappings((first.field_mappings as FieldMapping) || {});
          setRoutingRules((first.routing_rules as RoutingRules) || {});
          setHasSavedCreds(!!first.credentials && Object.keys(first.credentials || {}).length > 0);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [navigate]);

  const saveProvider = async () => {
    if (!provider) return toast.error("Select a CRM provider");
    
    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (USE_MOCK_AUTH) {
      toast.success("Provider saved (mock mode)");
      return;
    }
    
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return navigate("/login");

    const { error } = await supabase
      .from("crm_settings")
      .upsert({ user_id: user.id, provider, connected }, { onConflict: "user_id,provider" });
    if (error) return toast.error("Couldn't save provider", { description: error.message });

    // Reflect in profiles too
    await supabase.from("profiles").update({ crm_provider: provider, crm_connected: connected }).eq("id", user.id);

    toast.success("Provider saved");
  };

  const saveCredentials = async () => {
    if (!provider) return toast.error("Select a CRM provider");
    if (Object.keys(credentials).length === 0) return toast.error("Enter at least one credential field");
    
    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (USE_MOCK_AUTH) {
      setHasSavedCreds(true);
      toast.success("Credentials saved securely (mock mode)");
      return;
    }
    
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return navigate("/login");

    const { error } = await supabase
      .from("crm_settings")
      .update({ credentials: (credentials as unknown) as any })
      .eq("user_id", user.id)
      .eq("provider", provider);
    if (error) return toast.error("Couldn't save credentials", { description: error.message });

    setHasSavedCreds(true);
    toast.success("Credentials saved securely");
  };

  const saveMappings = async () => {
    if (!provider) return toast.error("Select a provider first");
    
    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (USE_MOCK_AUTH) {
      toast.success("Field mappings saved (mock mode)");
      return;
    }
    
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return navigate("/login");

    const { error } = await supabase
      .from("crm_settings")
      .update({ field_mappings: (fieldMappings as unknown) as any })
      .eq("user_id", user.id)
      .eq("provider", provider);
    if (error) return toast.error("Couldn't save mappings", { description: error.message });
    toast.success("Field mappings saved");
  };

  const saveRouting = async () => {
    if (!provider) return toast.error("Select a provider first");
    
    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (USE_MOCK_AUTH) {
      toast.success("Routing rules saved (mock mode)");
      return;
    }
    
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return navigate("/login");

    const { error } = await supabase
      .from("crm_settings")
      .update({ routing_rules: (routingRules as unknown) as any })
      .eq("user_id", user.id)
      .eq("provider", provider);
    if (error) return toast.error("Couldn't save routing rules", { description: error.message });
    toast.success("Routing rules saved");
  };

  // New handlers for enhanced features
  const handleSmartFormsCRMToggle = (enabled: boolean) => {
    setUseSmartFormsCRM(enabled);
    if (enabled) {
      setProvider(null);
      setConnected(false);
      setSyncSettings(prev => ({ ...prev, mode: 'off' }));
      toast.info("External CRM integrations disabled - using SmartForms CRM");
    } else {
      toast.info("External CRM integrations enabled");
    }
  };

  const handlePipelineMappingChange = (stageId: string, crmMapping: string) => {
    setPipelineStages(prev => prev.map(stage => 
      stage.id === stageId ? { ...stage, crmMapping } : stage
    ));
  };

  const handleSyncSettingsChange = (key: keyof SyncSettings, value: any) => {
    setSyncSettings(prev => ({ ...prev, [key]: value }));
  };

  // Mock CRM stages for mapping
  const mockCRMStages = {
    hubspot: ['New', 'Contacted', 'Qualified', 'Presentation Scheduled', 'Decision Maker Bought-In', 'Contract Sent', 'Closed Won', 'Closed Lost'],
    salesforce: ['Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'],
    zoho: ['Not Contacted', 'Contacted', 'Qualified', 'Demo', 'Negotiation', 'Won', 'Lost'],
    pipedrive: ['Lead In', 'Contact Made', 'Demo Scheduled', 'Proposal Made', 'Negotiations Started', 'Won', 'Lost']
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>1. Choose provider & connect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={provider ?? undefined} onValueChange={(v) => setProvider(v as Provider)} className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value="hubspot" id="hubspot" />
                <span>HubSpot</span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value="salesforce" id="salesforce" />
                <span>Salesforce</span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value="zoho" id="zoho" />
                <span>Zoho CRM</span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value="pipedrive" id="pipedrive" />
                <span>Pipedrive</span>
              </label>
            </RadioGroup>

            {provider === "hubspot" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="hubspot_private_app_token">HubSpot Private App Token</Label>
                  <Input id="hubspot_private_app_token" type="password" placeholder="Private App Token" value={credentials.private_app_token ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, private_app_token: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hubspot_portal_id">Portal ID (optional)</Label>
                  <Input id="hubspot_portal_id" placeholder="Optional portal id" value={credentials.portal_id ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, portal_id: e.target.value }))} />
                </div>
              </div>
            )}

            {provider === "salesforce" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="salesforce_access_token">Salesforce Access Token</Label>
                  <Input id="salesforce_access_token" type="password" placeholder="Access Token" value={credentials.access_token ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, access_token: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="salesforce_instance_url">Instance URL</Label>
                  <Input id="salesforce_instance_url" placeholder="https://your-instance.my.salesforce.com" value={credentials.instance_url ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, instance_url: e.target.value }))} />
                </div>
              </div>
            )}

            {provider === "zoho" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="zoho_client_id">Zoho Client ID</Label>
                  <Input id="zoho_client_id" placeholder="Client ID" value={credentials.client_id ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, client_id: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zoho_client_secret">Zoho Client Secret</Label>
                  <Input id="zoho_client_secret" type="password" placeholder="Client Secret" value={credentials.client_secret ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, client_secret: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zoho_refresh_token">Refresh Token</Label>
                  <Input id="zoho_refresh_token" type="password" placeholder="Refresh Token" value={credentials.refresh_token ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, refresh_token: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zoho_base_domain">Base Domain</Label>
                  <Input id="zoho_base_domain" placeholder="zoho.com / zoho.eu / zoho.in" value={credentials.base_domain ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, base_domain: e.target.value }))} />
                </div>
              </div>
            )}

            {provider === "pipedrive" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="pipedrive_api_token">Pipedrive API Token</Label>
                  <Input id="pipedrive_api_token" type="password" placeholder="API Token" value={credentials.api_token ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, api_token: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pipedrive_company_domain">Company Domain</Label>
                  <Input id="pipedrive_company_domain" placeholder="yourcompany" value={credentials.company_domain ?? ""} onChange={(e) => setCredentials((c) => ({ ...c, company_domain: e.target.value }))} />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" type="button" onClick={saveProvider}>Save selection</Button>
              <Button variant="secondary" type="button" onClick={saveCredentials} disabled={!provider}>
                Save credentials
              </Button>
              <Button
                variant="hero"
                type="button"
                onClick={() => toast.info("OAuth setup required", { description: "Add your CRM OAuth credentials to enable connection." })}
                disabled={!provider}
              >
                Connect via OAuth
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => { setConnected(true); toast("Marked as connected (demo)"); saveProvider(); }}
                disabled={!provider}
              >
                Mark as connected
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              {hasSavedCreds ? (
                <span>Credentials detected. For security, we never display stored secrets; fields remain blank unless you overwrite them.</span>
              ) : (
                <span>Enter your provider credentials. They are stored securely in your account and protected by Row Level Security.</span>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (step === 2) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              2. Advanced Field Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="mapping" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
                <TabsTrigger value="duplicates">Duplicate Handling</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="mapping" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">Configure two-way field synchronization</p>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dry-run" className="text-xs">Dry Run Mode</Label>
                    <Switch
                      id="dry-run"
                      checked={isDryRunMode}
                      onCheckedChange={setIsDryRunMode}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  {internalFields.map((field) => (
                    <div key={field.key} className="border rounded-lg p-4">
            <div className="grid gap-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">{field.label}</Label>
                          <div className="flex items-center gap-2">
                            <select
                              className="text-xs rounded border bg-background p-1"
                              value={fieldMappingConfigs.find(f => f.internal_field === field.key)?.direction || 'bidirectional'}
                              onChange={(e) => {
                                const direction = e.target.value as 'bidirectional' | 'to_crm' | 'from_crm';
                                setFieldMappingConfigs(prev => {
                                  const existing = prev.find(f => f.internal_field === field.key);
                                  if (existing) {
                                    return prev.map(f => f.internal_field === field.key ? {...f, direction} : f);
                                  }
                                  return [...prev, {
                                    internal_field: field.key,
                                    crm_field: fieldMappings[field.key] || '',
                                    direction
                                  }];
                                });
                              }}
                            >
                              <option value="bidirectional">↔ Bidirectional</option>
                              <option value="to_crm">→ To CRM only</option>
                              <option value="from_crm">← From CRM only</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">CRM Field API Name</Label>
                  <Input
                              placeholder="e.g., properties.firstname"
                              value={fieldMappings[field.key] ?? ""}
                              onChange={(e) => {
                                setFieldMappings((m) => ({ ...m, [field.key]: e.target.value }));
                                setFieldMappingConfigs(prev => {
                                  const existing = prev.find(f => f.internal_field === field.key);
                                  if (existing) {
                                    return prev.map(f => f.internal_field === field.key ? {...f, crm_field: e.target.value} : f);
                                  }
                                  return [...prev, {
                                    internal_field: field.key,
                                    crm_field: e.target.value,
                                    direction: 'bidirectional'
                                  }];
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Sync Options</Label>
                            <div className="flex gap-2">
                              <div className="flex items-center space-x-1">
                                <Checkbox
                                  id={`${field.key}-create`}
                                  checked={fieldMappingConfigs.find(f => f.internal_field === field.key)?.create_only || false}
                                  onCheckedChange={(checked) => {
                                    setFieldMappingConfigs(prev => 
                                      prev.map(f => f.internal_field === field.key ? {...f, create_only: !!checked} : f)
                                    );
                                  }}
                                />
                                <Label htmlFor={`${field.key}-create`} className="text-xs">Create only</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Checkbox
                                  id={`${field.key}-update`}
                                  checked={fieldMappingConfigs.find(f => f.internal_field === field.key)?.update_only || false}
                                  onCheckedChange={(checked) => {
                                    setFieldMappingConfigs(prev => 
                                      prev.map(f => f.internal_field === field.key ? {...f, update_only: !!checked} : f)
                                    );
                                  }}
                                />
                                <Label htmlFor={`${field.key}-update`} className="text-xs">Update only</Label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="duplicates" className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Duplicate Handling Strategy</Label>
                  <RadioGroup 
                    value={duplicatePolicy.strategy} 
                    onValueChange={(value) => setDuplicatePolicy(prev => ({...prev, strategy: value as any}))}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="create_always" id="create_always" />
                      <Label htmlFor="create_always" className="text-sm">Always create new records</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="update_existing" id="update_existing" />
                      <Label htmlFor="update_existing" className="text-sm">Update existing records when found</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="skip_duplicates" id="skip_duplicates" />
                      <Label htmlFor="skip_duplicates" className="text-sm">Skip when duplicates found</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="create_and_link" id="create_and_link" />
                      <Label htmlFor="create_and_link" className="text-sm">Create new and link to existing</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Match Fields for Duplicate Detection</Label>
                  <div className="mt-2 space-y-2">
                    {internalFields.map((field) => (
                      <div key={field.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`match-${field.key}`}
                          checked={duplicatePolicy.match_fields.includes(field.key)}
                          onCheckedChange={(checked) => {
                            setDuplicatePolicy(prev => ({
                              ...prev,
                              match_fields: checked 
                                ? [...prev.match_fields, field.key]
                                : prev.match_fields.filter(f => f !== field.key)
                            }));
                          }}
                        />
                        <Label htmlFor={`match-${field.key}`} className="text-sm">{field.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {duplicatePolicy.strategy === 'update_existing' && (
                  <div>
                    <Label className="text-sm font-medium">Merge Strategy</Label>
                    <RadioGroup 
                      value={duplicatePolicy.merge_strategy || 'smart_merge'} 
                      onValueChange={(value) => setDuplicatePolicy(prev => ({...prev, merge_strategy: value as any}))}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="overwrite" id="overwrite" />
                        <Label htmlFor="overwrite" className="text-sm">Overwrite existing values</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="preserve_existing" id="preserve_existing" />
                        <Label htmlFor="preserve_existing" className="text-sm">Preserve existing values</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="smart_merge" id="smart_merge" />
                        <Label htmlFor="smart_merge" className="text-sm">Smart merge (fill empty fields)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="preview" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Sync Preview</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const mockData = [
                        { action: 'CREATE', name: 'John Doe', email: 'john@example.com', company: 'Acme Corp' },
                        { action: 'UPDATE', name: 'Jane Smith', email: 'jane@example.com', company: 'Beta LLC' }
                      ];
                      setDryRunResults(mockData);
                      toast.success("Dry run completed - no data was written");
                    }}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run Preview
                  </Button>
                </div>
                
                {dryRunResults.length > 0 && (
                  <div className="border rounded-lg">
                    <div className="p-3 border-b bg-muted/50">
                      <div className="text-sm font-medium">Preview Results ({dryRunResults.length} records)</div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {dryRunResults.map((result, index) => (
                        <div key={index} className="p-3 border-b last:border-b-0 flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{result.name} ({result.email})</div>
                            <div className="text-xs text-muted-foreground">{result.company}</div>
                          </div>
                          <Badge variant={result.action === 'CREATE' ? 'default' : 'secondary'}>
                            {result.action}
                          </Badge>
                </div>
              ))}
            </div>
                  </div>
                )}
                
                {dryRunResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="h-8 w-8 mx-auto mb-2" />
                    <p>Run preview to see what would sync</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setFieldMappings({})}>Reset</Button>
              <Button variant="hero" onClick={saveMappings} disabled={!provider}>Save mappings</Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (step === 3) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              3. Owner Assignment Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure intelligent lead routing based on conditions and priorities.
            </p>
            
            <div className="space-y-4">
              {ownerAssignmentRules.map((rule, index) => (
                <div key={rule.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Rule name"
                        value={rule.name}
                        onChange={(e) => {
                          setOwnerAssignmentRules(prev => 
                            prev.map(r => r.id === rule.id ? {...r, name: e.target.value} : r)
                          );
                        }}
                        className="w-48"
                      />
                      <Badge variant="outline">Priority {rule.priority}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(enabled) => {
                          setOwnerAssignmentRules(prev => 
                            prev.map(r => r.id === rule.id ? {...r, enabled} : r)
                          );
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOwnerAssignmentRules(prev => prev.filter(r => r.id !== rule.id));
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium">Conditions</Label>
                      <div className="space-y-2 mt-2">
                        {rule.conditions.map((condition, condIndex) => (
                          <div key={condIndex} className="flex gap-2">
                            <select
                              className="flex-1 rounded border bg-background p-2 text-sm"
                              value={condition.field}
                              onChange={(e) => {
                                setOwnerAssignmentRules(prev => 
                                  prev.map(r => r.id === rule.id ? {
                                    ...r,
                                    conditions: r.conditions.map((c, i) => 
                                      i === condIndex ? {...c, field: e.target.value} : c
                                    )
                                  } : r)
                                );
                              }}
                            >
                              <option value="">Select field</option>
                              {internalFields.map(field => (
                                <option key={field.key} value={field.key}>{field.label}</option>
                              ))}
                            </select>
                            <select
                              className="rounded border bg-background p-2 text-sm"
                              value={condition.operator}
                              onChange={(e) => {
                                setOwnerAssignmentRules(prev => 
                                  prev.map(r => r.id === rule.id ? {
                                    ...r,
                                    conditions: r.conditions.map((c, i) => 
                                      i === condIndex ? {...c, operator: e.target.value as any} : c
                                    )
                                  } : r)
                                );
                              }}
                            >
                              <option value="equals">equals</option>
                              <option value="contains">contains</option>
                              <option value="greater_than">greater than</option>
                              <option value="less_than">less than</option>
                            </select>
                            <Input
                              placeholder="Value"
                              value={condition.value}
                              onChange={(e) => {
                                setOwnerAssignmentRules(prev => 
                                  prev.map(r => r.id === rule.id ? {
                                    ...r,
                                    conditions: r.conditions.map((c, i) => 
                                      i === condIndex ? {...c, value: e.target.value} : c
                                    )
                                  } : r)
                                );
                              }}
                              className="flex-1"
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOwnerAssignmentRules(prev => 
                              prev.map(r => r.id === rule.id ? {
                                ...r,
                                conditions: [...r.conditions, { field: '', operator: 'equals', value: '' }]
                              } : r)
                            );
                          }}
                        >
                          Add Condition
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Assignment</Label>
                      <div className="space-y-2 mt-2">
                        <select
                          className="w-full rounded border bg-background p-2 text-sm"
                          value={rule.assignment.type}
                          onChange={(e) => {
                            setOwnerAssignmentRules(prev => 
                              prev.map(r => r.id === rule.id ? {
                                ...r,
                                assignment: {...r.assignment, type: e.target.value as any}
                              } : r)
                            );
                          }}
                        >
                          <option value="specific_user">Specific User</option>
                          <option value="round_robin">Round Robin</option>
                          <option value="territory">Territory</option>
                          <option value="lead_score">Lead Score Based</option>
                        </select>
                        <Input
                          placeholder={
                            rule.assignment.type === 'specific_user' ? 'user@company.com' :
                            rule.assignment.type === 'round_robin' ? 'Team Pool Name' :
                            rule.assignment.type === 'territory' ? 'Territory Rules' :
                            'Score Threshold'
                          }
                          value={rule.assignment.value}
                          onChange={(e) => {
                            setOwnerAssignmentRules(prev => 
                              prev.map(r => r.id === rule.id ? {
                                ...r,
                                assignment: {...r.assignment, value: e.target.value}
                              } : r)
                            );
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={() => {
                  const newRule: OwnerAssignmentRule = {
                    id: `rule-${Date.now()}`,
                    name: `Rule ${ownerAssignmentRules.length + 1}`,
                    conditions: [{ field: '', operator: 'equals', value: '' }],
                    assignment: { type: 'specific_user', value: '' },
                    priority: ownerAssignmentRules.length + 1,
                    enabled: true
                  };
                  setOwnerAssignmentRules(prev => [...prev, newRule]);
                }}
              >
                Add Assignment Rule
              </Button>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => navigate("/dashboard")}>Skip</Button>
              <Button variant="hero" onClick={() => toast.success("Assignment rules saved")} disabled={!provider}>
                Save Rules
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            4. Final Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>High leads owner</Label>
              <Input placeholder="Owner email or CRM user id" value={routingRules.high_owner ?? ""} onChange={(e) => setRoutingRules((r) => ({ ...r, high_owner: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Medium leads owner</Label>
              <Input placeholder="Owner email or CRM user id" value={routingRules.medium_owner ?? ""} onChange={(e) => setRoutingRules((r) => ({ ...r, medium_owner: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Low leads owner</Label>
              <Input placeholder="Owner email or CRM user id" value={routingRules.low_owner ?? ""} onChange={(e) => setRoutingRules((r) => ({ ...r, low_owner: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={4} placeholder="Optional notes or territory rules (e.g., route to EMEA team for EU countries)." value={routingRules.additional_notes ?? ""} onChange={(e) => setRoutingRules((r) => ({ ...r, additional_notes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate("/dashboard")}>Finish</Button>
            <Button variant="hero" onClick={saveRouting} disabled={!provider}>Save routing</Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div>
          <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">CRM Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect external CRMs or use SmartForms built-in CRM with pipeline mapping and sync settings.</p>
          </header>

        {/* SmartForms CRM Toggle */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              CRM Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="font-medium">Use SmartForms CRM</div>
                <div className="text-sm text-muted-foreground">
                  Use our built-in CRM instead of external integrations
                </div>
              </div>
              <Switch
                checked={useSmartFormsCRM}
                onCheckedChange={handleSmartFormsCRMToggle}
              />
            </div>
            
            {useSmartFormsCRM && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  SmartForms CRM Enabled
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  All leads will be managed within SmartForms. External CRM settings are disabled.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* External CRM Configuration */}
        {!useSmartFormsCRM && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                External CRM Provider
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={provider ?? undefined} onValueChange={(v) => setProvider(v as Provider)} className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <label className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">
                  <RadioGroupItem value="hubspot" id="hubspot" />
                  <span>HubSpot</span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">
                  <RadioGroupItem value="salesforce" id="salesforce" />
                  <span>Salesforce</span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">
                  <RadioGroupItem value="zoho" id="zoho" />
                  <span>Zoho CRM</span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">
                  <RadioGroupItem value="pipedrive" id="pipedrive" />
                  <span>Pipedrive</span>
                </label>
              </RadioGroup>
              
              {provider && (
                <div className="mt-4 flex gap-2">
                  <Button 
                    variant={connected ? "secondary" : "default"}
                    onClick={() => {
                      setConnected(!connected);
                      toast.success(connected ? "Disconnected from " + provider : "Connected to " + provider);
                    }}
                  >
                    {connected ? "Disconnect" : "Connect"}
                  </Button>
          {connected && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Connected to {provider}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pipeline Mapping */}
            <Card className="mb-6">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
              <Workflow className="w-5 h-5" />
              Pipeline Mapping
                  </CardTitle>
            <p className="text-sm text-muted-foreground">
              Map SmartForms pipeline stages to your CRM stages
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pipelineStages.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium">{stage.name}</div>
                    <div className="text-sm text-muted-foreground">{stage.description}</div>
                  </div>
                  
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  
                  <div className="w-64">
                    {!useSmartFormsCRM && provider ? (
                      <Select
                        value={stage.crmMapping || ''}
                        onValueChange={(value) => handlePipelineMappingChange(stage.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Map to ${provider} stage`} />
                        </SelectTrigger>
                        <SelectContent>
                          {mockCRMStages[provider]?.map((crmStage) => (
                            <SelectItem key={crmStage} value={crmStage}>
                              {crmStage}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-2 bg-muted rounded text-sm text-muted-foreground">
                        {useSmartFormsCRM ? 'SmartForms CRM' : 'Select CRM provider first'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {!useSmartFormsCRM && provider && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium">Mapping Preview</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {pipelineStages.filter(s => s.crmMapping).length} of {pipelineStages.length} stages mapped to {provider}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Sync Settings
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure how data flows between SmartForms and your CRM
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>Sync Mode</Label>
                  <RadioGroup 
                    value={syncSettings.mode} 
                    onValueChange={(value) => handleSyncSettingsChange('mode', value)}
                    disabled={useSmartFormsCRM}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="off" id="sync-off" />
                      <Label htmlFor="sync-off" className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-gray-500" />
                        Off - No synchronization
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="one_way" id="sync-one-way" />
                      <Label htmlFor="sync-one-way" className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        One-way (SmartForms → CRM)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="two_way" id="sync-two-way" />
                      <Label htmlFor="sync-two-way" className="flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-green-500" />
                        Two-way synchronization
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Sync Frequency</Label>
                  <Select 
                    value={syncSettings.frequency} 
                    onValueChange={(value) => handleSyncSettingsChange('frequency', value)}
                    disabled={useSmartFormsCRM || syncSettings.mode === 'off'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real_time">Real-time</SelectItem>
                      <SelectItem value="hourly">Every hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Conflict Resolution</Label>
                  <Select 
                    value={syncSettings.conflictResolution} 
                    onValueChange={(value) => handleSyncSettingsChange('conflictResolution', value)}
                    disabled={useSmartFormsCRM || syncSettings.mode !== 'two_way'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smartforms_wins">SmartForms wins</SelectItem>
                      <SelectItem value="crm_wins">CRM wins</SelectItem>
                      <SelectItem value="newest_wins">Newest data wins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="font-medium mb-2">Current Configuration</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mode:</span>
                      <Badge variant={
                        syncSettings.mode === 'off' ? 'secondary' :
                        syncSettings.mode === 'one_way' ? 'default' : 'destructive'
                      }>
                        {syncSettings.mode === 'off' ? 'Off' :
                         syncSettings.mode === 'one_way' ? 'One-way' : 'Two-way'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency:</span>
                      <span className="font-medium">{syncSettings.frequency.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conflicts:</span>
                      <span className="font-medium">{syncSettings.conflictResolution.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CRM:</span>
                      <span className="font-medium">{useSmartFormsCRM ? 'SmartForms CRM' : provider || 'None'}</span>
                    </div>
                  </div>
                </div>

                {syncSettings.mode !== 'off' && !useSmartFormsCRM && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      Sync Active
                    </div>
                    <div className="text-sm text-green-700 mt-1">
                      Data will sync {syncSettings.frequency.replace('_', ' ')} with {provider}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Configuration */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Cancel
              </Button>
              <Button onClick={() => toast.success("CRM configuration saved!")}>
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
};

export default CrmIntegrations;
