import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuditPanel } from "@/components/lead-scoring/AuditPanel";
import { ApiAuditPanel } from "@/components/lead-scoring/ApiAuditPanel";
import { scoringApi, scoringHelpers, type ScoringConfig, type ScoringRule, type TestLead, type ScoringResult } from "@/lib/scoringApi";
import { TrendingUp, Target, Zap } from "lucide-react";

interface Weights { urgency: number; engagement: number; jobRole: number }
interface ChannelWeights { newsletter: number; youtube: number; linkedin: number }
interface Thresholds { high: number; medium: number; low: number }
interface ScoringProfile { 
  id: string; 
  name: string; 
  description: string;
  weights: Weights; 
  channelWeights: ChannelWeights;
  thresholds: Thresholds;
}

const LeadScoring: React.FC = () => {
  const navigate = useNavigate();
  const [weights, setWeights] = useState<Weights>({ urgency: 30, engagement: 40, jobRole: 30 });
  const [channelWeights, setChannelWeights] = useState<ChannelWeights>({ newsletter: 25, youtube: 35, linkedin: 20 });
  const [thresholds, setThresholds] = useState<Thresholds>({ high: 75, medium: 45, low: 0 });
  const [sample, setSample] = useState<{ urgency: number; engagement: number; jobRole: number; channel: string }>({ 
    urgency: 50, 
    engagement: 50, 
    jobRole: 50, 
    channel: 'newsletter' 
  });
  const [selectedProfile, setSelectedProfile] = useState<string>('default');
  const [rawLeadScoring, setRawLeadScoring] = useState<any | null>(null);
  const [versionNote, setVersionNote] = useState("");
  
  // New API-based state
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig | null>(null);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<ScoringResult | null>(null);
  const [testLead, setTestLead] = useState<TestLead>({
    email: "test@example.com",
    name: "John Doe",
    company: "Acme Corp",
    fields: {
      urgency: 50,
      engagement: 50,
      jobRole: 50
    }
  });

  // Mock scoring profiles
  const scoringProfiles: ScoringProfile[] = useMemo(() => [
    {
      id: 'default',
      name: 'Default',
      description: 'Balanced approach for most use cases',
      weights: { urgency: 30, engagement: 40, jobRole: 30 },
      channelWeights: { newsletter: 25, youtube: 35, linkedin: 20 },
      thresholds: { high: 75, medium: 45, low: 0 }
    },
    {
      id: 'aggressive',
      name: 'Aggressive',
      description: 'High thresholds, prioritizes hot leads',
      weights: { urgency: 45, engagement: 35, jobRole: 20 },
      channelWeights: { newsletter: 20, youtube: 50, linkedin: 30 },
      thresholds: { high: 85, medium: 60, low: 0 }
    },
    {
      id: 'conservative',
      name: 'Conservative',
      description: 'Lower thresholds, nurtures more leads',
      weights: { urgency: 20, engagement: 30, jobRole: 50 },
      channelWeights: { newsletter: 35, youtube: 25, linkedin: 25 },
      thresholds: { high: 65, medium: 35, low: 0 }
    }
  ], []);

  // Mock attribution rules
  const attributionRules = useMemo(() => [
    { channel: 'youtube', points: 10, description: 'Video engagement indicates high intent' },
    { channel: 'linkedin', points: 8, description: 'Professional network referral' },
    { channel: 'newsletter', points: 5, description: 'Existing subscriber engagement' },
    { channel: 'demo', points: 15, description: 'Direct demo request' },
    { channel: 'webinar', points: 12, description: 'Educational content engagement' }
  ], []);

  const totalWeight = useMemo(() => weights.urgency + weights.engagement + weights.jobRole, [weights]);
  const totalChannelWeight = useMemo(() => channelWeights.newsletter + channelWeights.youtube + channelWeights.linkedin, [channelWeights]);
  const score = useMemo(() => {
    const total = totalWeight || 1;
    const baseScore = (sample.urgency * weights.urgency + sample.engagement * weights.engagement + sample.jobRole * weights.jobRole) / total;
    
    // Add channel attribution bonus
    const channelRule = attributionRules.find(rule => rule.channel === sample.channel);
    const channelBonus = channelRule ? channelRule.points : 0;
    
    // Apply channel weight multiplier
    const channelMultiplier = sample.channel === 'youtube' ? channelWeights.youtube / 100 :
                             sample.channel === 'linkedin' ? channelWeights.linkedin / 100 :
                             sample.channel === 'newsletter' ? channelWeights.newsletter / 100 : 1;
    
    const finalScore = baseScore + channelBonus + (baseScore * channelMultiplier * 0.1);
    return Math.round(Math.min(finalScore, 100)); // Cap at 100
  }, [sample, weights, totalWeight, channelWeights, attributionRules]);

  const classification = useMemo(() => {
    if (score >= thresholds.high) return "High";
    if (score >= thresholds.medium) return "Medium";
    return "Low";
  }, [score, thresholds]);

  // Load scoring configuration from API
  const loadScoringConfig = async () => {
    try {
      setLoading(true);
      
      const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
      
      if (USE_MOCK_AUTH) {
        // Mock configuration for development
        const mockConfig: ScoringConfig = {
          weights: {
            urgency: 30,
            engagement: 40,
            jobRole: 30,
          },
          bands: {
            low: { min: 0, max: 44 },
            medium: { min: 45, max: 74 },
            high: { min: 75, max: 100 }
          },
          negative: [],
          enrichment: {}
        };
        
        setScoringConfig(mockConfig);
        setScoringRules([]);
        setWeights(mockConfig.weights);
        setThresholds({
          high: mockConfig.bands.high.min,
          medium: mockConfig.bands.medium.min,
          low: mockConfig.bands.low.min,
        });
        setLoading(false);
        return;
      }
      
      const { config, rules } = await scoringApi.getCurrentConfig();
      
      if (config) {
        setScoringConfig(config);
        setScoringRules(rules);
        
        // Update legacy UI state for backward compatibility
        if (config.weights) {
          setWeights({
            urgency: config.weights.urgency || 30,
            engagement: config.weights.engagement || 40,
            jobRole: config.weights.jobRole || 30,
          });
        }
        
        if (config.bands) {
          setThresholds({
            high: config.bands.high.min,
            medium: config.bands.medium.min,
            low: config.bands.low.min,
          });
        }
      } else {
        // Initialize default configuration if none exists
        const { config: defaultConfig, rules: defaultRules } = await scoringApi.initializeDefault();
        setScoringConfig(defaultConfig);
        setScoringRules(defaultRules);
      }
    } catch (error: any) {
      console.error('Failed to load scoring config:', error);
      toast.error('Failed to load scoring configuration', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // SEO
    document.title = "Lead Scoring | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Configure lead scoring rules with weights and thresholds. Preview results in real time.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/lead-scoring`);

    // Auth + load current profile (fallback for legacy data)
    const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
    
    if (USE_MOCK_AUTH) {
      // Skip Supabase auth check in mock mode
      loadScoringConfig();
    } else {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          navigate("/login");
        } else {
          // Load scoring config from API
          await loadScoringConfig();
          
          // Also load legacy data from Supabase for migration purposes
          try {
            const { data, error } = await supabase
              .from("profiles")
              .select("lead_scoring")
              .eq("id", session.user.id)
              .maybeSingle();
            
            if (!error && data?.lead_scoring) {
              setRawLeadScoring(data.lead_scoring as any);
              
              // If API config is empty but legacy data exists, migrate it
              if (!scoringConfig && data.lead_scoring) {
                const ls: any = data.lead_scoring as any;
                const migratedConfig = scoringHelpers.convertLegacyConfig(ls);
                
                try {
                  await scoringApi.saveConfig(migratedConfig);
                  setScoringConfig(migratedConfig);
                  toast.success('Legacy scoring configuration migrated to new system');
                } catch (migrationError: any) {
                  console.error('Failed to migrate legacy config:', migrationError);
                }
              }
            }
          } catch (supabaseError) {
            console.error('Failed to load legacy config:', supabaseError);
          }
        }
      });
      
      return () => subscription.unsubscribe();
    }
  }, [navigate]);

  const save = async () => {
    try {
      setLoading(true);
      
      const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
      
      if (USE_MOCK_AUTH) {
        toast.success("Lead scoring saved (mock mode)" + (versionNote.trim() ? " and versioned" : ""));
        setVersionNote("");
        return;
      }
      
      // Build the scoring configuration
      const config: ScoringConfig = {
        weights: {
          urgency: weights.urgency,
          engagement: weights.engagement,
          jobRole: weights.jobRole
        },
        bands: {
          low: { min: thresholds.low, max: thresholds.medium - 1 },
          medium: { min: thresholds.medium, max: thresholds.high - 1 },
          high: { min: thresholds.high, max: 100 }
        },
        negative: scoringConfig?.negative || [],
        enrichment: scoringConfig?.enrichment || {}
      };

      // Validate configuration
      const validation = scoringHelpers.validateConfig(config);
      if (!validation.valid) {
        toast.error('Invalid configuration', { 
          description: validation.errors.join(', ') 
        });
        return;
      }

      // Save configuration via API
      await scoringApi.saveConfig(config);
      setScoringConfig(config);

      // Save rules if they exist
      if (scoringRules.length > 0) {
        await scoringApi.saveRules(scoringRules);
      }

      // Legacy: Save to Supabase profiles for backward compatibility
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (user) {
        const merged = {
          ...(rawLeadScoring || {}),
          weights,
          thresholds,
        };

        await supabase
          .from("profiles")
          .update({ lead_scoring: merged })
          .eq("id", user.id);

        // Save version if note provided
        if (versionNote.trim()) {
          await supabase
            .from("lead_scoring_versions")
            .insert({
              user_id: user.id,
              config: merged,
              note: versionNote.trim(),
            });
          setVersionNote("");
        }
        
        setRawLeadScoring(merged);
      }

      toast.success("Lead scoring saved" + (versionNote.trim() ? " and versioned" : ""));
    } catch (e: any) {
      console.error('Failed to save scoring config:', e);
      toast.error("Couldn't save lead scoring", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = (config: any) => {
    if (config.weights) {
      setWeights(config.weights);
    }
    if (config.thresholds) {
      setThresholds(config.thresholds);
    }
  };

  // Live preview sandbox functionality
  const runLiveTest = async () => {
    try {
      setLoading(true);
      
      const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
      
      if (USE_MOCK_AUTH) {
        // Mock test result
        const mockResult: ScoringResult = {
          score: Math.floor(Math.random() * 100),
          band: Math.random() > 0.6 ? 'HIGH' : Math.random() > 0.3 ? 'MEDIUM' : 'LOW',
          tags: ['demo', 'mock-data'],
          trace: [
            { step: 'Base Score', operation: 'calculate', points: 45, reason: 'Initial calculation', total: 45 },
            { step: 'Urgency Bonus', operation: 'add', points: 15, reason: 'High urgency detected', total: 60 },
            { step: 'Engagement Bonus', operation: 'add', points: 10, reason: 'Active engagement', total: 70 }
          ]
        };
        setTestResult(mockResult);
        toast.success('Live test completed (mock mode)');
        setLoading(false);
        return;
      }
      
      const result = await scoringApi.testScoring(testLead);
      setTestResult(result);
      toast.success('Live test completed');
    } catch (error: any) {
      console.error('Live test failed:', error);
      toast.error('Live test failed', { description: error.message });
      setTestResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle profile switching
  const handleProfileChange = (profileId: string) => {
    const profile = scoringProfiles.find(p => p.id === profileId);
    if (profile) {
      setSelectedProfile(profileId);
      setWeights(profile.weights);
      setChannelWeights(profile.channelWeights);
      setThresholds(profile.thresholds);
      toast.success(`Applied ${profile.name} profile`);
    }
  };

  // Update test lead when sample values change
  useEffect(() => {
    setTestLead(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        urgency: sample.urgency,
        engagement: sample.engagement,
        jobRole: sample.jobRole
      }
    }));
  }, [sample]);

  const slider = (label: string, value: number, onChange: (n: number) => void) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Input
          type="number"
          className="w-20"
          value={isNaN(value) ? 0 : value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <Slider value={[value]} onValueChange={(v) => onChange(v[0] ?? 0)} min={0} max={100} step={1} />
    </div>
  );

  return (
    <Layout>
      <div>
        <header className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Lead Scoring</h1>
            <p className="text-muted-foreground mt-1">Define weights, thresholds, and channel attribution. Preview results in real time.</p>
          </div>
          
          {/* Scoring Profiles Dropdown */}
          <Card className="w-80">
            <CardContent className="p-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Scoring Profiles</Label>
                <Select value={selectedProfile} onValueChange={handleProfileChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scoringProfiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center space-x-2">
                          {profile.id === 'aggressive' && <Zap className="w-4 h-4 text-orange-500" />}
                          {profile.id === 'conservative' && <Target className="w-4 h-4 text-blue-500" />}
                          {profile.id === 'default' && <TrendingUp className="w-4 h-4 text-green-500" />}
                          <div>
                            <div className="font-medium">{profile.name}</div>
                            <div className="text-xs text-muted-foreground">{profile.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </header>

        <div className="grid gap-6">
          {/* Weights and Channel Weights Row */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Core Weights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {slider("Urgency", weights.urgency, (n) => setWeights((w) => ({ ...w, urgency: n })))}
                {slider("Engagement", weights.engagement, (n) => setWeights((w) => ({ ...w, engagement: n })))}
                {slider("Job role match", weights.jobRole, (n) => setWeights((w) => ({ ...w, jobRole: n })))}
                <div className="text-sm text-muted-foreground">Total weight: {totalWeight}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Weights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {slider("Newsletter", channelWeights.newsletter, (n) => setChannelWeights((w) => ({ ...w, newsletter: n })))}
                {slider("YouTube", channelWeights.youtube, (n) => setChannelWeights((w) => ({ ...w, youtube: n })))}
                {slider("LinkedIn", channelWeights.linkedin, (n) => setChannelWeights((w) => ({ ...w, linkedin: n })))}
                <div className="text-sm text-muted-foreground">Total channel weight: {totalChannelWeight}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Thresholds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>High (≥)</Label>
                  <Input type="number" value={thresholds.high} onChange={(e) => setThresholds((t) => ({ ...t, high: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Medium (≥)</Label>
                  <Input type="number" value={thresholds.medium} onChange={(e) => setThresholds((t) => ({ ...t, medium: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Low (&lt; Medium)</Label>
                  <Input type="number" value={thresholds.low} onChange={(e) => setThresholds((t) => ({ ...t, low: Number(e.target.value) }))} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attribution Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Attribution Preview</CardTitle>
              <p className="text-sm text-muted-foreground">Mock channel attribution rules and point bonuses</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {attributionRules.map((rule, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="capitalize">{rule.channel}</Badge>
                      <span className="text-sm">+{rule.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium">Example: YouTube Lead</div>
                <div className="text-sm text-muted-foreground">Base score + 10 points (video engagement) + YouTube channel weight multiplier</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Urgency (0–100)</Label>
                      <Input type="number" value={sample.urgency} onChange={(e) => setSample((s) => ({ ...s, urgency: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Engagement (0–100)</Label>
                      <Input type="number" value={sample.engagement} onChange={(e) => setSample((s) => ({ ...s, engagement: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Job role match (0–100)</Label>
                      <Input type="number" value={sample.jobRole} onChange={(e) => setSample((s) => ({ ...s, jobRole: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Channel Source</Label>
                      <Select value={sample.channel} onValueChange={(value) => setSample((s) => ({ ...s, channel: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newsletter">Newsletter</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="demo">Demo</SelectItem>
                          <SelectItem value="webinar">Webinar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Enhanced Score Calculation</div>
                    <div className="text-2xl font-semibold">{score}</div>
                    <div className="text-sm mt-1">Classification: <span className="font-medium">{classification}</span></div>
                    
                    {/* Score Breakdown */}
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Base Score:</span>
                        <span>{Math.round((sample.urgency * weights.urgency + sample.engagement * weights.engagement + sample.jobRole * weights.jobRole) / (totalWeight || 1))}</span>
                      </div>
                      {attributionRules.find(rule => rule.channel === sample.channel) && (
                        <div className="flex justify-between text-green-600">
                          <span>Channel Bonus ({sample.channel}):</span>
                          <span>+{attributionRules.find(rule => rule.channel === sample.channel)?.points}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-blue-600">
                        <span>Channel Weight Multiplier:</span>
                        <span>×{(sample.channel === 'youtube' ? channelWeights.youtube / 100 :
                                 sample.channel === 'linkedin' ? channelWeights.linkedin / 100 :
                                 sample.channel === 'newsletter' ? channelWeights.newsletter / 100 : 1).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Live API Test */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Live API Test</Label>
                      <Button 
                        onClick={runLiveTest} 
                        disabled={loading}
                        size="sm"
                        variant="outline"
                      >
                        {loading ? 'Testing...' : 'Test Live'}
                      </Button>
                    </div>
                    
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input 
                          value={testLead.email || ''} 
                          onChange={(e) => setTestLead(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="test@example.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Company</Label>
                        <Input 
                          value={testLead.company || ''} 
                          onChange={(e) => setTestLead(prev => ({ ...prev, company: e.target.value }))}
                          placeholder="Acme Corp"
                        />
                      </div>
                    </div>

                    {testResult && (
                      <div className="rounded-md border p-4 bg-muted/50">
                        <div className="text-sm text-muted-foreground">Live API Result</div>
                        <div className="text-2xl font-semibold">{testResult.score}</div>
                        <div className="text-sm mt-1">
                          Band: <span className="font-medium">{testResult.band}</span>
                          {testResult.tags.length > 0 && (
                            <span className="ml-2">Tags: {testResult.tags.join(', ')}</span>
                          )}
                        </div>
                        
                        {testResult.trace.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-sm cursor-pointer hover:text-foreground">
                              View Scoring Trace ({testResult.trace.length} steps)
                            </summary>
                            <div className="mt-2 space-y-1 text-xs">
                              {testResult.trace.map((trace, index) => (
                                <div key={index} className="border-l-2 border-muted pl-2">
                                  <div className="font-medium">{trace.step}: +{trace.points} points</div>
                                  <div className="text-muted-foreground">{trace.reason}</div>
                                  <div className="text-xs">Total: {trace.total}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Save Version</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Version Note (optional)</Label>
                    <Textarea
                      placeholder="Describe this configuration..."
                      value={versionNote}
                      onChange={(e) => setVersionNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
                    <Button variant="hero" onClick={save} disabled={loading}>
                      {loading ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Use the new API-based audit panel */}
            <ApiAuditPanel onRestore={handleRestoreVersion} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LeadScoring;
