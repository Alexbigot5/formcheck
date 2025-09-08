import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, TrendingUp, Eye, MousePointer, Reply, Plus, Save, Trash2, Edit3, Send } from "lucide-react";
import { SendEmailDialog } from "@/components/SendEmailDialog";

const segments = ["hot", "warm", "cold"] as const;

type Segment = typeof segments[number];

interface TemplateState {
  subject: string;
  body: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  segment: Segment;
  subject: string;
  body: string;
  createdAt: string;
  performance?: {
    openRate: number;
    replyRate: number;
    clickRate: number;
    sent: number;
  };
}

interface PerformanceStats {
  openRate: number;
  replyRate: number;
  clickRate: number;
  sent: number;
}

const defaultTemplates: Record<Segment, TemplateState> = {
  hot: {
    subject: "{{lead.name}}, let's discuss your {{campaign}} interest (Score: {{score}})",
    body: "Hi {{lead.name}},\n\nI noticed you came from our {{channel}} {{campaign}} and scored {{score}} - that tells me you're serious about finding a solution!\n\nGiven your role ({{lead.jobRole}}), I'd love to schedule a quick 15-minute call to discuss your specific needs.\n\nWhen works better for you - this afternoon or tomorrow morning?\n\nBest,\nYour Sales Team",
  },
  warm: {
    subject: "{{lead.name}}, resources for {{campaign}} from {{channel}}",
    body: "Hi {{lead.name}},\n\nThanks for your interest through our {{channel}} {{campaign}}! With a score of {{score}}, I can see you're evaluating options.\n\nI've put together some resources specifically for {{lead.jobRole}} professionals that might be helpful:\n\n• Industry benchmark report\n• ROI calculator\n• Case study from similar companies\n\nWould you like me to send these over?\n\nBest,\nYour Team",
  },
  cold: {
    subject: "Welcome {{lead.name}} - staying connected after {{campaign}}",
    body: "Hi {{lead.name}},\n\nThanks for checking out our {{campaign}} on {{channel}}. While your current score is {{score}}, I know timing isn't always right.\n\nI'll add you to our newsletter for {{lead.jobRole}} professionals so you can stay updated on industry trends and our latest features.\n\nFeel free to reach out when you're ready to explore further!\n\nBest,\nYour Team",
  },
};

const placeholderHelp = (
  <div className="text-xs text-muted-foreground space-y-1">
    <div>Available placeholders:</div>
    <div className="grid grid-cols-2 gap-1 text-xs">
      <span>{"{{lead.name}}"}</span>
      <span>{"{{lead.jobRole}}"}</span>
      <span>{"{{channel}}"}</span>
      <span>{"{{campaign}}"}</span>
      <span>{"{{score}}"}</span>
      <span>{"{{lead.responseSummary}}"}</span>
    </div>
  </div>
);

const EmailTemplates: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSeg = (searchParams.get("segment") as Segment) || "hot";
  const [active, setActive] = useState<Segment>(initialSeg);
  const [templates, setTemplates] = useState<Record<Segment, TemplateState>>(defaultTemplates);
  const [previewLead, setPreviewLead] = useState({ 
    name: "Alex Chen", 
    jobRole: "Marketing Manager", 
    responseSummary: "Requested a demo; high urgency",
    channel: "YouTube",
    campaign: "Product Demo Series",
    score: "85"
  });
  const [testEmail, setTestEmail] = useState<string>("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState<string>("");
  const [sendEmailOpen, setSendEmailOpen] = useState(false);

  // Mock performance stats for each segment
  const mockPerformanceStats: Record<Segment, PerformanceStats> = {
    hot: { openRate: 78, replyRate: 45, clickRate: 32, sent: 156 },
    warm: { openRate: 65, replyRate: 28, clickRate: 18, sent: 284 },
    cold: { openRate: 42, replyRate: 12, clickRate: 8, sent: 521 }
  };

  // Mock saved templates
  const mockSavedTemplates: SavedTemplate[] = [
    {
      id: '1',
      name: 'Q4 Product Launch - Hot',
      segment: 'hot',
      subject: 'Ready to see {{campaign}} in action, {{lead.name}}?',
      body: 'Hi {{lead.name}},\n\nYour {{score}} score from {{channel}} shows you\'re ready for our {{campaign}}...',
      createdAt: '2024-01-15',
      performance: { openRate: 82, replyRate: 48, clickRate: 35, sent: 89 }
    },
    {
      id: '2',
      name: 'Nurture Series - Warm',
      segment: 'warm',
      subject: 'Following up on {{campaign}}, {{lead.name}}',
      body: 'Hi {{lead.name}},\n\nSince you engaged with our {{campaign}} on {{channel}}...',
      createdAt: '2024-01-10',
      performance: { openRate: 71, replyRate: 31, clickRate: 22, sent: 145 }
    },
    {
      id: '3',
      name: 'Welcome Series - Cold',
      segment: 'cold',
      subject: 'Thanks for joining us from {{channel}}, {{lead.name}}',
      body: 'Welcome {{lead.name}},\n\nWe noticed you found us through {{channel}}...',
      createdAt: '2024-01-05',
      performance: { openRate: 38, replyRate: 9, clickRate: 5, sent: 312 }
    }
  ];

  const renderTemplate = (segment: Segment) => {
    const t = templates[segment];
    const dict: Record<string, string> = {
      "{{lead.name}}": previewLead.name,
      "{{lead.jobRole}}": previewLead.jobRole,
      "{{lead.responseSummary}}": previewLead.responseSummary,
      "{{channel}}": previewLead.channel,
      "{{campaign}}": previewLead.campaign,
      "{{score}}": previewLead.score,
    };
    const compile = (s: string) => Object.entries(dict).reduce((acc, [k, v]) => acc.split(k).join(v), s);
    return { subject: compile(t.subject), body: compile(t.body) };
  };

  const preview = useMemo(() => renderTemplate(active), [active, templates, previewLead]);

  // Template management functions
  const saveNewTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    
    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      segment: active,
      subject: templates[active].subject,
      body: templates[active].body,
      createdAt: new Date().toISOString().split('T')[0],
      performance: mockPerformanceStats[active]
    };
    
    setSavedTemplates(prev => [newTemplate, ...prev]);
    setNewTemplateName("");
    toast.success(`Template "${newTemplate.name}" saved`);
  };

  const loadTemplate = (template: SavedTemplate) => {
    setTemplates(prev => ({
      ...prev,
      [template.segment]: {
        subject: template.subject,
        body: template.body
      }
    }));
    setActive(template.segment);
    setSelectedTemplate(template.id);
    toast.success(`Loaded template "${template.name}"`);
  };

  const deleteTemplate = (templateId: string) => {
    const template = savedTemplates.find(t => t.id === templateId);
    setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
    if (selectedTemplate === templateId) {
      setSelectedTemplate(null);
    }
    toast.success(`Deleted template "${template?.name}"`);
  };

  // Initialize with mock templates
  useEffect(() => {
    setSavedTemplates(mockSavedTemplates);
  }, []);

  useEffect(() => {
    // SEO
    document.title = "Email Templates | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Create follow-up email templates for high, medium, and low-scoring leads with live preview.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/email-templates${searchParams.get("segment") ? `?segment=${encodeURIComponent(searchParams.get("segment") as string)}` : ""}`);

    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (!USE_MOCK_AUTH) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) navigate("/login");
      });
      // Load existing templates
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.user) return navigate("/login");
        const { data, error } = await supabase
          .from("email_templates")
          .select("segment, subject, body")
          .eq("user_id", session.user.id);
        if (!error && data && data.length) {
          const next = { ...templates } as Record<Segment, TemplateState>;
          data.forEach((row) => {
            const seg = row.segment as Segment;
            if (segments.includes(seg)) {
              next[seg] = { subject: row.subject, body: row.body };
            }
          });
          setTemplates(next);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [navigate]);

  const saveCurrent = async () => {
    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (USE_MOCK_AUTH) {
      toast.success("Template saved (mock mode)");
      navigate("/email-templates/saved");
      return;
    }
    
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return navigate("/login");

    const t = templates[active];
    // Upsert via unique index (user_id, segment)
    const { error } = await supabase
      .from("email_templates")
      .upsert({ user_id: user.id, segment: active, subject: t.subject, body: t.body }, { onConflict: "user_id,segment" });
    if (error) return toast.error("Couldn't save template", { description: error.message });
    toast.success("Template saved");
    navigate("/email-templates/saved");
  };

  const testSend = async () => {
    if (!testEmail) return toast.error("Enter a test email address");
    
    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (USE_MOCK_AUTH) {
      toast.success("Test email sent (mock mode)", { description: `Sent to ${testEmail}` });
      return;
    }
    
    try {
      const compiled = renderTemplate(active);
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {
          to: testEmail,
          subject: compiled.subject,
          body: compiled.body,
        },
      });
      if (error) throw error;
      toast.success("Test email sent", { description: `Sent to ${testEmail}` });
    } catch (e: any) {
      toast.error("Failed to send test email", { description: e.message });
    }
  };

  return (
    <Layout>
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-80 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Saved Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Template name..."
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && saveNewTemplate()}
                  />
                  <Button size="sm" onClick={saveNewTemplate} disabled={!newTemplateName.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {savedTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                          selectedTemplate === template.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => loadTemplate(template)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{template.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={
                                template.segment === 'hot' ? 'destructive' :
                                template.segment === 'warm' ? 'default' : 'secondary'
                              } className="text-xs">
                                {template.segment}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{template.createdAt}</span>
                            </div>
                            {template.performance && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{template.performance.openRate}% open</span>
                                <span>{template.performance.replyRate}% reply</span>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplate(template.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Email Templates</h1>
            <p className="text-muted-foreground mt-1">Create follow-up emails for each lead segment with dynamic placeholders.</p>
            
            {/* Segment Dropdown */}
            <div className="mt-4">
              <Label>Lead Segment</Label>
              <Select value={active} onValueChange={(v) => setActive(v as Segment)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">🔥 Hot Leads</SelectItem>
                  <SelectItem value="warm">🌤️ Warm Leads</SelectItem>
                  <SelectItem value="cold">❄️ Cold Leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Compose ({active})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Subject</Label>
                  <Input
                    value={templates[active].subject}
                    onChange={(e) => setTemplates((prev) => ({ ...prev, [active]: { ...prev[active], subject: e.target.value } }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Body</Label>
                  <Textarea
                    rows={12}
                    value={templates[active].body}
                    onChange={(e) => setTemplates((prev) => ({ ...prev, [active]: { ...prev[active], body: e.target.value } }))}
                  />
                  {placeholderHelp}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setTemplates({ ...defaultTemplates })}>Reset</Button>
                  <Button variant="outline" onClick={() => setSendEmailOpen(true)}>
                    <Send className="w-4 h-4 mr-2" />
                    Send Email
                  </Button>
                  <Button variant="hero" onClick={saveCurrent}>Save</Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview and Performance */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Lead name</Label>
                      <Input value={previewLead.name} onChange={(e) => setPreviewLead((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Job role</Label>
                      <Input value={previewLead.jobRole} onChange={(e) => setPreviewLead((p) => ({ ...p, jobRole: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Channel</Label>
                      <Select value={previewLead.channel} onValueChange={(value) => setPreviewLead((p) => ({ ...p, channel: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="YouTube">YouTube</SelectItem>
                          <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                          <SelectItem value="Newsletter">Newsletter</SelectItem>
                          <SelectItem value="Google Ads">Google Ads</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Campaign</Label>
                      <Input value={previewLead.campaign} onChange={(e) => setPreviewLead((p) => ({ ...p, campaign: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Score</Label>
                      <Input value={previewLead.score} onChange={(e) => setPreviewLead((p) => ({ ...p, score: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Response details</Label>
                      <Input value={previewLead.responseSummary} onChange={(e) => setPreviewLead((p) => ({ ...p, responseSummary: e.target.value }))} />
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="text-sm text-muted-foreground">Subject</div>
                    <div className="font-medium">{renderTemplate(active).subject}</div>
                    <div className="text-sm text-muted-foreground mt-3">Body</div>
                    <pre className="whitespace-pre-wrap text-sm">{renderTemplate(active).body}</pre>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="testEmail">Send test to</Label>
                      <Input id="testEmail" type="email" className="w-48" placeholder="you@company.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                    </div>
                    <Button variant="outline" onClick={testSend} disabled={!testEmail}>Test send</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Performance Stats (Mock)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">Open Rate</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{mockPerformanceStats[active].openRate}%</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Reply className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Reply Rate</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">{mockPerformanceStats[active].replyRate}%</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <MousePointer className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">Click Rate</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-600">{mockPerformanceStats[active].clickRate}%</div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Sent:</span>
                      <span className="font-medium">{mockPerformanceStats[active].sent} emails</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      
      <SendEmailDialog
        isOpen={sendEmailOpen}
        onClose={() => setSendEmailOpen(false)}
        initialTemplate={{
          subject: templates[active].subject,
          body: templates[active].body,
          segment: active
        }}
      />
    </Layout>
  );
};

export default EmailTemplates;
