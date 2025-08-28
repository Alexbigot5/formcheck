import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useForm } from "react-hook-form";
import { Upload, Palette, Shield, Eye, FileText, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

// Small sortable item component
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export type FieldType = "text" | "textarea" | "dropdown" | "checkbox" | "date";
export interface FieldSchema {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[]; // for dropdown
}

// Conditional logic types
type VisibilityOperator = "equals" | "not_equals" | "is_checked" | "contains";
type ComparisonOperator = "gt" | "gte" | "lt" | "lte" | "eq";

interface VisibilityCondition {
  id: string;
  kind: "visibility";
  sourceFieldId: string;
  operator: VisibilityOperator;
  value?: string; // not used for is_checked
  targets: string[]; // field ids to show when condition true
}

interface ActionCondition {
  id: string;
  kind: "action";
  type: "follow_up_email" | "adjust_score" | "route_to_owner" | "route_to_pool" | "slack_alert" | "set_sla";
  operator: ComparisonOperator;
  value: number; // threshold
  // Additional properties for new action types
  scoreAdjustment?: number; // for adjust_score
  routeTarget?: string; // for routing actions
  slackChannel?: string; // for slack_alert
  slackMessage?: string; // for slack_alert
  slaMinutes?: number; // for set_sla
}

type Condition = VisibilityCondition | ActionCondition;

const toolbox: { type: FieldType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "textarea", label: "Textarea" },
  { type: "dropdown", label: "Dropdown" },
  { type: "checkbox", label: "Checkbox" },
  { type: "date", label: "Date" },
];

const FormBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sensors = useSensors(useSensor(PointerSensor));

  const [formName, setFormName] = useState<string>(searchParams.get("name") || "Untitled Form");
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});
  const [testLeadScore, setTestLeadScore] = useState<number>(0);
  const [newVis, setNewVis] = useState<{ source?: string; operator: VisibilityOperator; value?: string; targets: Record<string, boolean> }>({ operator: "equals", targets: {} });
  const [newAction, setNewAction] = useState<{ 
    operator: ComparisonOperator; 
    value: number;
    type: ActionCondition['type'];
    scoreAdjustment: number;
    routeTarget: string;
    slackChannel: string;
    slackMessage: string;
    slaMinutes: number;
  }>({ 
    operator: "gt", 
    value: 50,
    type: "follow_up_email",
    scoreAdjustment: 10,
    routeTarget: "",
    slackChannel: "#sales",
    slackMessage: "New high-value lead!",
    slaMinutes: 15
  });
  
  // Brand Kit & Theme state
  const [brandKit, setBrandKit] = useState({
    logo: null as File | null,
    primaryColor: "#3b82f6",
    secondaryColor: "#64748b",
    fontFamily: "Inter"
  });
  
  // Accessibility checklist state
  const [accessibilityChecklist, setAccessibilityChecklist] = useState({
    colorContrast: false,
    keyboardNavigation: false,
    screenReaderLabels: false,
    focusIndicators: false,
    altText: false,
    semanticHTML: false
  });
  
  // Tracking & Security state
  const [trackingSettings, setTrackingSettings] = useState({
    captureUTM: true,
    captureReferrer: true,
    captureGclid: true,
    enableHCaptcha: true,
    enableHoneypot: true
  });

  const selectedField = useMemo(() => fields.find(f => f.id === selectedId) || null, [fields, selectedId]);

  const addField = (type: FieldType) => {
    const id = `${type}-${crypto.randomUUID()}`;
    const base: FieldSchema = { id, type, label: `${type[0].toUpperCase()}${type.slice(1)} field`, required: false };
    const withOptions = type === "dropdown" ? { ...base, options: ["Option 1", "Option 2"] } : base;
    setFields(prev => [...prev, withOptions]);
    setSelectedId(id);
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);
    setFields(arrayMove(fields, oldIndex, newIndex));
  };

  // Helpers: evaluate conditional visibility
  const isVisibilityConditionSatisfied = (cond: VisibilityCondition) => {
    const sourceVal = previewValues[cond.sourceFieldId];
    switch (cond.operator) {
      case "is_checked":
        return !!sourceVal === true;
      case "equals":
        return String(sourceVal ?? "") === String(cond.value ?? "");
      case "not_equals":
        return String(sourceVal ?? "") !== String(cond.value ?? "");
      case "contains":
        return String(sourceVal ?? "").toLowerCase().includes(String(cond.value ?? "").toLowerCase());
      default:
        return false;
    }
  };

  const isFieldVisible = (fieldId: string) => {
    const relevant = conditions.filter((c): c is VisibilityCondition => c.kind === "visibility" && c.targets.includes(fieldId));
    if (relevant.length === 0) return true; // visible by default if no rule targets it
    return relevant.some(isVisibilityConditionSatisfied);
  };

  const isFollowUpActionSatisfied = () => {
    const conds = conditions.filter((c): c is ActionCondition => c.kind === "action");
    return conds.some((c) => {
      switch (c.operator) {
        case "gt": return testLeadScore > c.value;
        case "gte": return testLeadScore >= c.value;
        case "lt": return testLeadScore < c.value;
        case "lte": return testLeadScore <= c.value;
        case "eq": return testLeadScore === c.value;
        default: return false;
      }
    });
  };

  const getTriggeredActions = () => {
    return conditions.filter((c): c is ActionCondition => {
      if (c.kind !== "action") return false;
      switch (c.operator) {
        case "gt": return testLeadScore > c.value;
        case "gte": return testLeadScore >= c.value;
        case "lt": return testLeadScore < c.value;
        case "lte": return testLeadScore <= c.value;
        case "eq": return testLeadScore === c.value;
        default: return false;
      }
    });
  };

  useEffect(() => {
    // SEO
    document.title = "New Form | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Drag-and-drop builder to create forms with text, dropdowns, checkboxes, and dates.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/forms/new`);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) navigate("/login");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) navigate("/login");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSave = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return navigate("/login");

    const payload = {
      user_id: user.id,
      name: formName || "Untitled Form",
      schema: ({ 
        fields, 
        conditions,
        brandKit,
        accessibilityChecklist,
        trackingSettings
      } as unknown) as any,
    };

    const { error } = await supabase.from("forms").insert(payload as any);
    if (error) {
      toast.error("Couldn't save form", { description: error.message });
      return;
    }
    toast.success("Form saved");
    navigate("/dashboard");
  };

  // Inspector updates
  const updateSelected = (patch: Partial<FieldSchema>) => {
    if (!selectedId) return;
    setFields(prev => prev.map(f => (f.id === selectedId ? { ...f, ...patch } : f)));
  };

  const form = useForm(); // only used to get shadcn consistent styles if needed later

  // Helper functions
  const handleLogoUpload = (file: File) => {
    setBrandKit(prev => ({...prev, logo: file}));
    toast.success("Logo uploaded successfully");
  };

  const getAccessibilityScore = () => {
    return Object.values(accessibilityChecklist).filter(Boolean).length;
  };

  const getTrackingFieldsCount = () => {
    return Object.values(trackingSettings).filter(Boolean).length;
  };

  return (
    <Layout>
      <div>
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Form Builder</h1>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-64" aria-label="Form name" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="preview">Preview</Label>
                <Switch id="preview" checked={previewEnabled} onCheckedChange={setPreviewEnabled} />
              </div>
              {previewEnabled && (
                <>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="leadScore">Lead score</Label>
                    <Input
                      id="leadScore"
                      type="number"
                      className="w-24"
                      value={isNaN(testLeadScore) ? 0 : testLeadScore}
                      onChange={(e) => setTestLeadScore(Number(e.target.value))}
                    />
                  </div>
                  {getTriggeredActions().length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Actions triggered: {getTriggeredActions().map(action => {
                        switch (action.type) {
                          case "follow_up_email": return "Email";
                          case "adjust_score": return `Score ${action.scoreAdjustment > 0 ? '+' : ''}${action.scoreAdjustment}`;
                          case "route_to_owner": return `→ ${action.routeTarget}`;
                          case "route_to_pool": return `→ ${action.routeTarget}`;
                          case "slack_alert": return `Slack ${action.slackChannel}`;
                          case "set_sla": return `SLA ${action.slaMinutes}m`;
                          default: return action.type;
                        }
                      }).join(", ")}
                    </div>
                  )}
                </>
              )}
              <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
              <Button variant="hero" onClick={handleSave}>Save form</Button>
            </div>
          </header>

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Enhanced Toolbox with Tabs */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="fields" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="fields" className="text-xs">Fields</TabsTrigger>
                    <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="fields" className="space-y-2 mt-4">
                    {toolbox.map((t) => (
                      <Button key={t.type} variant="outline" className="w-full justify-start" onClick={() => addField(t.type)}>
                        + {t.label}
                      </Button>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="settings" className="space-y-3 mt-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Tracking
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="utm"
                            checked={trackingSettings.captureUTM}
                            onCheckedChange={(checked) => setTrackingSettings(prev => ({...prev, captureUTM: !!checked}))}
                          />
                          <Label htmlFor="utm">UTM Parameters</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="referrer"
                            checked={trackingSettings.captureReferrer}
                            onCheckedChange={(checked) => setTrackingSettings(prev => ({...prev, captureReferrer: !!checked}))}
                          />
                          <Label htmlFor="referrer">Referrer</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="gclid"
                            checked={trackingSettings.captureGclid}
                            onCheckedChange={(checked) => setTrackingSettings(prev => ({...prev, captureGclid: !!checked}))}
                          />
                          <Label htmlFor="gclid">Google Click ID</Label>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Security
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="hcaptcha"
                            checked={trackingSettings.enableHCaptcha}
                            onCheckedChange={(checked) => setTrackingSettings(prev => ({...prev, enableHCaptcha: !!checked}))}
                          />
                          <Label htmlFor="hcaptcha">hCaptcha</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="honeypot"
                            checked={trackingSettings.enableHoneypot}
                            onCheckedChange={(checked) => setTrackingSettings(prev => ({...prev, enableHoneypot: !!checked}))}
                          />
                          <Label htmlFor="honeypot">Honeypot</Label>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Canvas */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Canvas</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Theme Preview */}
                <div className="mb-4 p-3 rounded-lg border" style={{
                  backgroundColor: brandKit.primaryColor + '10',
                  borderColor: brandKit.primaryColor + '30',
                  fontFamily: brandKit.fontFamily
                }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-muted-foreground">Theme Preview</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>A11y: {getAccessibilityScore()}/6</span>
                      <span>•</span>
                      <span>Tracking: {getTrackingFieldsCount()}/5</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {brandKit.logo && (
                      <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-sm font-medium" style={{ color: brandKit.primaryColor }}>
                      {formName} - {brandKit.fontFamily}
                    </div>
                  </div>
                </div>

                {/* Hidden Fields Info */}
                {(trackingSettings.captureUTM || trackingSettings.captureReferrer || trackingSettings.captureGclid) && (
                  <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                    <div className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Hidden Tracking Fields</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                      {trackingSettings.captureUTM && <div>• UTM Parameters (source, medium, campaign, etc.)</div>}
                      {trackingSettings.captureReferrer && <div>• Referrer URL</div>}
                      {trackingSettings.captureGclid && <div>• Google Click ID (gclid)</div>}
                    </div>
                  </div>
                )}

                {/* Security Features Info */}
                {(trackingSettings.enableHCaptcha || trackingSettings.enableHoneypot) && (
                  <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800">
                    <div className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">Security Features</div>
                    <div className="text-xs text-green-600 dark:text-green-400 space-y-1">
                      {trackingSettings.enableHCaptcha && <div>• hCaptcha verification enabled</div>}
                      {trackingSettings.enableHoneypot && <div>• Honeypot spam protection active</div>}
                    </div>
                  </div>
                )}

                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add fields from the left to get started. Drag to reorder.</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
                        {fields.filter(f => isFieldVisible(f.id)).map((field) => (
                          <SortableItem key={field.id} id={field.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedId(field.id)}
                              className={`rounded-lg border p-4 ${selectedId === field.id ? "ring-2 ring-ring" : ""}`}
                              style={{
                                fontFamily: brandKit.fontFamily,
                                borderColor: selectedId === field.id ? brandKit.primaryColor : undefined
                              }}
                            >
                              <div className="text-sm font-medium">{field.label} {field.required && <span className="text-muted-foreground">(required)</span>}</div>
                              <div className="mt-2">
                                {field.type === "text" && (
                                  <Input
                                    placeholder="Text input"
                                    disabled={!previewEnabled}
                                    value={previewValues[field.id] ?? ""}
                                    onChange={(e) => setPreviewValues(v => ({ ...v, [field.id]: e.target.value }))}
                                    style={{
                                      fontFamily: brandKit.fontFamily,
                                      borderColor: previewEnabled && previewValues[field.id] ? brandKit.primaryColor : undefined
                                    }}
                                  />
                                )}
                                {field.type === "textarea" && (
                                  <Textarea
                                    placeholder="Textarea"
                                    disabled={!previewEnabled}
                                    value={previewValues[field.id] ?? ""}
                                    onChange={(e) => setPreviewValues(v => ({ ...v, [field.id]: e.target.value }))}
                                    style={{
                                      fontFamily: brandKit.fontFamily,
                                      borderColor: previewEnabled && previewValues[field.id] ? brandKit.primaryColor : undefined
                                    }}
                                  />
                                )}
                                {field.type === "dropdown" && (
                                  <select
                                    className="w-full rounded-md border bg-background p-2"
                                    disabled={!previewEnabled}
                                    value={previewValues[field.id] ?? ""}
                                    onChange={(e) => setPreviewValues(v => ({ ...v, [field.id]: e.target.value }))}
                                    style={{
                                      fontFamily: brandKit.fontFamily,
                                      borderColor: previewEnabled && previewValues[field.id] ? brandKit.primaryColor : undefined
                                    }}
                                  >
                                    <option value="" disabled>Select an option</option>
                                    {(field.options || []).map((o, i) => (
                                      <option key={i} value={o}>{o}</option>
                                    ))}
                                  </select>
                                )}
                                {field.type === "checkbox" && (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      disabled={!previewEnabled}
                                      checked={!!previewValues[field.id]}
                                      onChange={(e) => setPreviewValues(v => ({ ...v, [field.id]: e.target.checked }))}
                                      style={{
                                        accentColor: brandKit.primaryColor
                                      }}
                                    />
                                    <span className="text-sm text-muted-foreground" style={{ fontFamily: brandKit.fontFamily }}>
                                      Checkbox
                                    </span>
                                  </div>
                                )}
                                {field.type === "date" && (
                                  <Input
                                    type="date"
                                    disabled={!previewEnabled}
                                    value={previewValues[field.id] ?? ""}
                                    onChange={(e) => setPreviewValues(v => ({ ...v, [field.id]: e.target.value }))}
                                    style={{
                                      fontFamily: brandKit.fontFamily,
                                      borderColor: previewEnabled && previewValues[field.id] ? brandKit.primaryColor : undefined
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </SortableItem>
                        ))}
                        
                        {/* Security Features at bottom of form */}
                        {(trackingSettings.enableHCaptcha || trackingSettings.enableHoneypot) && (
                          <div className="mt-6 space-y-3">
                            {trackingSettings.enableHCaptcha && (
                              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-900/20 dark:border-gray-600">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Shield className="h-4 w-4" />
                                  hCaptcha verification will appear here
                                </div>
                              </div>
                            )}
                            {trackingSettings.enableHoneypot && (
                              <div className="sr-only">
                                <Input 
                                  placeholder="Leave this field empty" 
                                  tabIndex={-1}
                                  autoComplete="off"
                                  style={{ display: 'none' }}
                                />
                                <div className="text-xs text-muted-foreground italic">
                                  Honeypot field (hidden from users)
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>

            {/* Inspector */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Inspector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedField ? (
                  <p className="text-sm text-muted-foreground">Select a field to edit its settings.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="label">Label</Label>
                      <Input id="label" value={selectedField.label} onChange={(e) => updateSelected({ label: e.target.value })} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="required">Required</Label>
                      <Switch id="required" checked={selectedField.required} onCheckedChange={(v) => updateSelected({ required: v })} />
                    </div>

                    {selectedField.type === "dropdown" && (
                      <div className="space-y-2">
                        <Label htmlFor="options">Options (one per line)</Label>
                        <Textarea
                          id="options"
                          value={(selectedField.options || []).join("\n")}
                          onChange={(e) => updateSelected({ options: e.target.value.split("\n").filter(Boolean) })}
                          rows={6}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Brand Kit & Theme */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Brand & Theme
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logo-upload" className="text-xs font-medium">Brand Logo</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setBrandKit(prev => ({...prev, logo: file}));
                          toast.success("Logo uploaded");
                        }
                      }}
                    />
                    <Label htmlFor="logo-upload" className="cursor-pointer text-xs text-muted-foreground">
                      {brandKit.logo ? brandKit.logo.name : "Upload logo"}
                    </Label>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-medium">Theme Tokens</h4>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="primary-color" className="text-xs">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary-color"
                          type="color"
                          value={brandKit.primaryColor}
                          onChange={(e) => setBrandKit(prev => ({...prev, primaryColor: e.target.value}))}
                          className="w-12 h-8 p-1 border rounded"
                        />
                        <Input
                          value={brandKit.primaryColor}
                          onChange={(e) => setBrandKit(prev => ({...prev, primaryColor: e.target.value}))}
                          className="text-xs"
                          placeholder="#3b82f6"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="secondary-color" className="text-xs">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondary-color"
                          type="color"
                          value={brandKit.secondaryColor}
                          onChange={(e) => setBrandKit(prev => ({...prev, secondaryColor: e.target.value}))}
                          className="w-12 h-8 p-1 border rounded"
                        />
                        <Input
                          value={brandKit.secondaryColor}
                          onChange={(e) => setBrandKit(prev => ({...prev, secondaryColor: e.target.value}))}
                          className="text-xs"
                          placeholder="#64748b"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="font-family" className="text-xs">Font Family</Label>
                      <select
                        id="font-family"
                        className="w-full rounded-md border bg-background p-2 text-xs"
                        value={brandKit.fontFamily}
                        onChange={(e) => setBrandKit(prev => ({...prev, fontFamily: e.target.value}))}
                      >
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Lato">Lato</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Poppins">Poppins</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-medium flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    Accessibility
                  </h4>
                  <div className="space-y-2 text-xs">
                    {Object.entries({
                      colorContrast: "Color Contrast (WCAG AA)",
                      keyboardNavigation: "Keyboard Navigation",
                      screenReaderLabels: "Screen Reader Labels",
                      focusIndicators: "Focus Indicators",
                      altText: "Alt Text for Images",
                      semanticHTML: "Semantic HTML"
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox 
                          id={key}
                          checked={accessibilityChecklist[key as keyof typeof accessibilityChecklist]}
                          onCheckedChange={(checked) => 
                            setAccessibilityChecklist(prev => ({...prev, [key]: !!checked}))
                          }
                        />
                        <Label htmlFor={key} className="text-xs">{label}</Label>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {Object.values(accessibilityChecklist).filter(Boolean).length}/6 completed
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conditional Logic */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Conditional Logic</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Visibility rule</h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>When field</Label>
                      <select
                        className="w-full rounded-md border bg-background p-2"
                        value={newVis.source ?? ""}
                        onChange={(e) => setNewVis((v) => ({ ...v, source: e.target.value || undefined }))}
                      >
                        <option value="">Select field</option>
                        {fields.map((f) => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Operator</Label>
                        <select
                          className="w-full rounded-md border bg-background p-2"
                          value={newVis.operator}
                          onChange={(e) => setNewVis((v) => ({ ...v, operator: e.target.value as VisibilityOperator }))}
                        >
                          {(() => {
                            const f = fields.find(ff => ff.id === newVis.source);
                            if (f?.type === "checkbox") {
                              return <option value="is_checked">is checked</option>;
                            }
                            if (f?.type === "dropdown") {
                              return (<>
                                <option value="equals">equals</option>
                                <option value="not_equals">not equals</option>
                              </>);
                            }
                            return (<>
                              <option value="equals">equals</option>
                              <option value="not_equals">not equals</option>
                              <option value="contains">contains</option>
                            </>);
                          })()}
                        </select>
                      </div>

                      {newVis.operator !== "is_checked" && (
                        <div className="space-y-1">
                          <Label>Value</Label>
                          <Input
                            placeholder="Enter value"
                            value={newVis.value ?? ""}
                            onChange={(e) => setNewVis((v) => ({ ...v, value: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Targets to show</Label>
                      <div className="grid gap-2">
                        {fields.map((f) => (
                          <label key={f.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!newVis.targets[f.id]}
                              onChange={(e) => setNewVis((v) => ({ ...v, targets: { ...v.targets, [f.id]: e.target.checked } }))}
                            />
                            <span className="text-sm">{f.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          if (!newVis.source) return toast.error("Please select a source field");
                          const targets = Object.entries(newVis.targets).filter(([,v]) => v).map(([k]) => k);
                          if (targets.length === 0) return toast.error("Select at least one target field");
                          const rule: VisibilityCondition = {
                            id: `vis-${crypto.randomUUID()}`,
                            kind: "visibility",
                            sourceFieldId: newVis.source,
                            operator: newVis.operator,
                            value: newVis.operator === "is_checked" ? undefined : (newVis.value ?? ""),
                            targets,
                          };
                          setConditions((prev) => [...prev, rule]);
                          setNewVis({ operator: "equals", targets: {} });
                          toast.success("Visibility rule added");
                        }}
                      >
                        Add rule
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Action Rules</h4>
                  
                  {/* Trigger Condition */}
                  <div className="grid gap-3 sm:grid-cols-2 mb-4">
                    <div className="space-y-1">
                      <Label>When field value</Label>
                      <select
                        className="w-full rounded-md border bg-background p-2"
                        value={newAction.operator}
                        onChange={(e) => setNewAction((a) => ({ ...a, operator: e.target.value as ComparisonOperator }))}
                      >
                        <option value="gt">greater than</option>
                        <option value="gte">≥ greater or equal</option>
                        <option value="lt">less than</option>
                        <option value="lte">≤ less or equal</option>
                        <option value="eq">equals</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Threshold value</Label>
                      <Input type="number" value={newAction.value} onChange={(e) => setNewAction((a) => ({ ...a, value: Number(e.target.value) }))} />
                    </div>
                  </div>

                  {/* Action Type Selection */}
                  <div className="space-y-3 mb-4">
                    <Label>Then perform action:</Label>
                    <select
                      className="w-full rounded-md border bg-background p-2"
                      value={newAction.type}
                      onChange={(e) => setNewAction((a) => ({ ...a, type: e.target.value as ActionCondition['type'] }))}
                    >
                      <option value="follow_up_email">Send follow-up email</option>
                      <option value="adjust_score">Adjust lead score</option>
                      <option value="route_to_owner">Route to specific owner</option>
                      <option value="route_to_pool">Route to team pool</option>
                      <option value="slack_alert">Send Slack alert</option>
                      <option value="set_sla">Set SLA target</option>
                    </select>
                  </div>

                  {/* Dynamic Action Configuration */}
                  {newAction.type === "adjust_score" && (
                    <div className="space-y-1 mb-4">
                      <Label>Score adjustment</Label>
                      <Input 
                        type="number" 
                        value={newAction.scoreAdjustment} 
                        onChange={(e) => setNewAction((a) => ({ ...a, scoreAdjustment: Number(e.target.value) }))}
                        placeholder="e.g. +15 or -10"
                      />
                    </div>
                  )}

                  {(newAction.type === "route_to_owner" || newAction.type === "route_to_pool") && (
                    <div className="space-y-1 mb-4">
                      <Label>{newAction.type === "route_to_owner" ? "Owner email" : "Pool name"}</Label>
                      <Input 
                        value={newAction.routeTarget} 
                        onChange={(e) => setNewAction((a) => ({ ...a, routeTarget: e.target.value }))}
                        placeholder={newAction.type === "route_to_owner" ? "john@company.com" : "AE Pool A"}
                      />
                    </div>
                  )}

                  {newAction.type === "slack_alert" && (
                    <div className="space-y-3 mb-4">
                      <div className="space-y-1">
                        <Label>Slack channel</Label>
                        <Input 
                          value={newAction.slackChannel} 
                          onChange={(e) => setNewAction((a) => ({ ...a, slackChannel: e.target.value }))}
                          placeholder="#sales"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Alert message</Label>
                        <Input 
                          value={newAction.slackMessage} 
                          onChange={(e) => setNewAction((a) => ({ ...a, slackMessage: e.target.value }))}
                          placeholder="New high-value lead!"
                        />
                      </div>
                    </div>
                  )}

                  {newAction.type === "set_sla" && (
                    <div className="space-y-1 mb-4">
                      <Label>SLA target (minutes)</Label>
                      <Input 
                        type="number" 
                        value={newAction.slaMinutes} 
                        onChange={(e) => setNewAction((a) => ({ ...a, slaMinutes: Number(e.target.value) }))}
                        placeholder="15"
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        const rule: ActionCondition = {
                          id: `act-${crypto.randomUUID()}`,
                          kind: "action",
                          type: newAction.type,
                          operator: newAction.operator,
                          value: newAction.value,
                          ...(newAction.type === "adjust_score" && { scoreAdjustment: newAction.scoreAdjustment }),
                          ...(newAction.type === "route_to_owner" && { routeTarget: newAction.routeTarget }),
                          ...(newAction.type === "route_to_pool" && { routeTarget: newAction.routeTarget }),
                          ...(newAction.type === "slack_alert" && { 
                            slackChannel: newAction.slackChannel,
                            slackMessage: newAction.slackMessage 
                          }),
                          ...(newAction.type === "set_sla" && { slaMinutes: newAction.slaMinutes }),
                        };
                        setConditions((prev) => [...prev, rule]);
                        toast.success("Action rule saved");
                      }}
                    >
                      Add action rule
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Example Rule</h4>
                  <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                    <div className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Complex Rule Example
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      If Budget ≥ 10,000 then:
                      <br />• Score +15 points
                      <br />• Route to AE Pool A  
                      <br />• Slack alert to #sales
                      <br />• SLA target: 15 minutes
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Create multiple action rules with the same trigger condition to achieve this
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Current rules</h4>
                  <div className="space-y-2">
                    {conditions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No rules yet.</p>
                    )}
                    {conditions.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                        <span className="text-sm">
                          {c.kind === "visibility" ? (
                            <>If <strong>{fields.find(f => f.id === c.sourceFieldId)?.label || "(deleted)"}</strong> {((c as VisibilityCondition).operator).replace("_"," ")}
                            {((c as VisibilityCondition).operator) !== "is_checked" && <> "{(c as VisibilityCondition).value}"</>}
                            , show {((c as VisibilityCondition).targets.map(t => fields.find(f => f.id === t)?.label || t).join(", "))}</>
                          ) : (
                            <>If value {(c as ActionCondition).operator} {(c as ActionCondition).value}, then {(() => {
                              const action = c as ActionCondition;
                              switch (action.type) {
                                case "follow_up_email":
                                  return "send follow-up email";
                                case "adjust_score":
                                  return `adjust score by ${action.scoreAdjustment > 0 ? '+' : ''}${action.scoreAdjustment}`;
                                case "route_to_owner":
                                  return `route to ${action.routeTarget}`;
                                case "route_to_pool":
                                  return `route to ${action.routeTarget}`;
                                case "slack_alert":
                                  return `send Slack alert to ${action.slackChannel}`;
                                case "set_sla":
                                  return `set SLA to ${action.slaMinutes} minutes`;
                                default:
                                  return "perform action";
                              }
                            })()}</>
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConditions((prev) => prev.filter((r) => r.id !== c.id))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </Layout>
  );
};

export default FormBuilder;
