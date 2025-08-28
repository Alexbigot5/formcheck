import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Users, 
  Settings, 
  Clock, 
  Play, 
  Plus,
  Trash2,
  Edit,
  ArrowRight,
  Target,
  Timer
} from "lucide-react";
import { routingApi, ownersApi, slaApi, routingHelpers, type RoutingRule, type TestLead, type Owner, type Pool, type SLAThresholds } from "@/lib/routingApi";

const RoutingDemo = () => {
  // State for routing rules
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [testLead, setTestLead] = useState<TestLead>({
    email: "ceo@enterprise.com",
    name: "John CEO",
    company: "Enterprise Corp",
    score: 85,
    scoreBand: "HIGH",
    fields: {
      title: "CEO",
      employees: 5000,
      budget: 500000
    }
  });
  const [routingResult, setRoutingResult] = useState(null);

  // State for owners
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);

  // State for SLA
  const [slaSettings, setSlaSettings] = useState<SLAThresholds | null>(null);
  const [slaTestResult, setSlaTestResult] = useState(null);
  const [testPriority, setTestPriority] = useState(3);

  // Loading states
  const [loading, setLoading] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesData, ownersData, slaData] = await Promise.all([
        routingApi.getRules(),
        ownersApi.getOwners(),
        slaApi.getSettings()
      ]);

      setRules(rulesData.rules);
      setOwners(ownersData.owners);
      setPools(ownersData.pools);
      setSlaSettings(slaData.thresholds);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load routing data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testRouting = async () => {
    try {
      setLoading(true);
      const result = await routingApi.testRouting(testLead);
      setRoutingResult(result);
      toast.success('Routing test completed');
    } catch (error: any) {
      console.error('Routing test failed:', error);
      toast.error('Routing test failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testSLA = async () => {
    try {
      setLoading(true);
      const result = await slaApi.testSLA(testLead, testPriority);
      setSlaTestResult(result);
      toast.success('SLA test completed');
    } catch (error: any) {
      console.error('SLA test failed:', error);
      toast.error('SLA test failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const saveSLASettings = async () => {
    if (!slaSettings) return;
    
    try {
      setLoading(true);
      await slaApi.saveSettings(slaSettings);
      toast.success('SLA settings saved');
    } catch (error: any) {
      console.error('Failed to save SLA settings:', error);
      toast.error('Failed to save SLA settings', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <section className="container mx-auto px-4 py-10">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Routing & SLA Management</h1>
            <p className="text-muted-foreground mt-1">Configure lead routing rules, manage owners, and set SLA thresholds.</p>
          </header>

          <Tabs defaultValue="routing" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="routing">Routing Rules</TabsTrigger>
              <TabsTrigger value="owners">Owners & Pools</TabsTrigger>
              <TabsTrigger value="sla">SLA Settings</TabsTrigger>
              <TabsTrigger value="test">Live Testing</TabsTrigger>
            </TabsList>

            {/* Routing Rules Tab */}
            <TabsContent value="routing" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Routing Rules</h2>
                <Button onClick={loadData} disabled={loading}>
                  <Settings className="w-4 h-4 mr-2" />
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>

              <div className="grid gap-4">
                {rules.map((rule, index) => (
                  <Card key={rule.id || index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">#{rule.order}</Badge>
                          <CardTitle className="text-base">{rule.name}</CardTitle>
                          {!rule.enabled && <Badge variant="secondary">Disabled</Badge>}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Conditions:</strong>
                          <ul className="mt-1 space-y-1">
                            {rule.definition.if.map((condition, i) => (
                              <li key={i} className="text-muted-foreground">
                                • {routingHelpers.getConditionText(condition)}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-sm">
                          <strong>Action:</strong> Assign to{' '}
                          <Badge className={routingHelpers.getPoolColor(rule.definition.then.assign)}>
                            {rule.definition.then.assign}
                          </Badge>
                          {rule.definition.then.sla && (
                            <span className="ml-2">
                              • SLA: {routingHelpers.formatSLATime(rule.definition.then.sla)}
                            </span>
                          )}
                          {rule.definition.then.priority && (
                            <span className="ml-2">
                              • Priority: {routingHelpers.getPriorityLabel(rule.definition.then.priority)}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {rules.length === 0 && !loading && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">No routing rules configured</p>
                      <Button className="mt-4" onClick={() => routingApi.initializeDefault()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Initialize Default Rules
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Owners & Pools Tab */}
            <TabsContent value="owners" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Owners & Pools</h2>
                <Button onClick={loadData} disabled={loading}>
                  <Users className="w-4 h-4 mr-2" />
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>

              {/* Pools Overview */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pools.map((pool) => (
                  <Card key={pool.name}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <Badge className={routingHelpers.getPoolColor(pool.name)}>
                          {pool.name}
                        </Badge>
                        <span className="text-sm font-normal">{pool.owners} owners</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div>Strategy: <strong>{pool.strategy}</strong></div>
                        {pool.roundRobinState && (
                          <div>
                            Next: <strong>{pool.roundRobinState.nextOwner || 'None'}</strong>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Owners List */}
              <Card>
                <CardHeader>
                  <CardTitle>All Owners</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {owners.map((owner) => {
                      const utilization = routingHelpers.getOwnerUtilization(owner);
                      return (
                        <div key={owner.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div>
                              <div className="font-medium">{owner.name || owner.email}</div>
                              <div className="text-sm text-muted-foreground">{owner.email}</div>
                            </div>
                            <Badge className={routingHelpers.getPoolColor(owner.pool)}>
                              {owner.pool}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="text-center">
                              <div className="font-medium">{owner.currentLoad}/{owner.capacity}</div>
                              <div className="text-muted-foreground">Load</div>
                            </div>
                            <div className="text-center">
                              <div className={`font-medium ${routingHelpers.getUtilizationColor(utilization)}`}>
                                {utilization}%
                              </div>
                              <div className="text-muted-foreground">Util</div>
                            </div>
                            <div className="text-center">
                              <Badge variant={owner.isActive ? "default" : "secondary"}>
                                {owner.isActive ? "Active" : "Full"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SLA Settings Tab */}
            <TabsContent value="sla" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">SLA Settings</h2>
                <Button onClick={saveSLASettings} disabled={loading || !slaSettings}>
                  <Clock className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>

              {slaSettings && (
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Priority Thresholds</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[1, 2, 3, 4].map((priority) => (
                        <div key={priority} className="flex items-center justify-between">
                          <Label>Priority {priority} ({routingHelpers.getPriorityLabel(priority)})</Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              value={slaSettings[`priority${priority}` as keyof SLAThresholds] as number}
                              onChange={(e) => setSlaSettings({
                                ...slaSettings,
                                [`priority${priority}`]: Number(e.target.value)
                              })}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">min</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Escalation Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Enable Escalation</Label>
                        <Switch
                          checked={slaSettings.escalation.enabled}
                          onCheckedChange={(checked) => setSlaSettings({
                            ...slaSettings,
                            escalation: { ...slaSettings.escalation, enabled: checked }
                          })}
                        />
                      </div>
                      
                      {slaSettings.escalation.enabled && (
                        <div className="space-y-3">
                          {slaSettings.escalation.levels.map((level, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Input
                                type="number"
                                value={level.minutes}
                                onChange={(e) => {
                                  const newLevels = [...slaSettings.escalation.levels];
                                  newLevels[index] = { ...level, minutes: Number(e.target.value) };
                                  setSlaSettings({
                                    ...slaSettings,
                                    escalation: { ...slaSettings.escalation, levels: newLevels }
                                  });
                                }}
                                className="w-20"
                              />
                              <span className="text-sm">min →</span>
                              <Input
                                value={level.action}
                                onChange={(e) => {
                                  const newLevels = [...slaSettings.escalation.levels];
                                  newLevels[index] = { ...level, action: e.target.value };
                                  setSlaSettings({
                                    ...slaSettings,
                                    escalation: { ...slaSettings.escalation, levels: newLevels }
                                  });
                                }}
                                className="flex-1"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Live Testing Tab */}
            <TabsContent value="test" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Test Lead Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Test Lead Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input
                          value={testLead.email || ''}
                          onChange={(e) => setTestLead({ ...testLead, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                          value={testLead.name || ''}
                          onChange={(e) => setTestLead({ ...testLead, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Company</Label>
                        <Input
                          value={testLead.company || ''}
                          onChange={(e) => setTestLead({ ...testLead, company: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Score</Label>
                        <Input
                          type="number"
                          value={testLead.score || 50}
                          onChange={(e) => setTestLead({ ...testLead, score: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label>Custom Fields (JSON)</Label>
                      <Textarea
                        value={JSON.stringify(testLead.fields || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const fields = JSON.parse(e.target.value);
                            setTestLead({ ...testLead, fields });
                          } catch (error) {
                            // Invalid JSON, ignore
                          }
                        }}
                        rows={4}
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={testRouting} disabled={loading} className="flex-1">
                        <Target className="w-4 h-4 mr-2" />
                        Test Routing
                      </Button>
                      <div className="flex items-center space-x-2">
                        <Select value={testPriority.toString()} onValueChange={(value) => setTestPriority(Number(value))}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Priority 1</SelectItem>
                            <SelectItem value="2">Priority 2</SelectItem>
                            <SelectItem value="3">Priority 3</SelectItem>
                            <SelectItem value="4">Priority 4</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={testSLA} disabled={loading}>
                          <Timer className="w-4 h-4 mr-2" />
                          Test SLA
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Test Results */}
                <div className="space-y-4">
                  {/* Routing Results */}
                  {routingResult && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Routing Result</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <strong>Assigned to:</strong>
                          {routingResult.pool ? (
                            <Badge className={routingHelpers.getPoolColor(routingResult.pool)}>
                              {routingResult.pool}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                        
                        <div>
                          <strong>Reason:</strong>
                          <p className="text-sm text-muted-foreground mt-1">{routingResult.reason}</p>
                        </div>

                        {routingResult.trace && routingResult.trace.length > 0 && (
                          <details className="text-sm">
                            <summary className="cursor-pointer font-medium">
                              View Routing Trace ({routingResult.trace.length} steps)
                            </summary>
                            <div className="mt-2 space-y-1">
                              {routingResult.trace.map((trace, index) => (
                                <div key={index} className="border-l-2 border-muted pl-2">
                                  <div className="font-medium">{trace.step}</div>
                                  <div className="text-muted-foreground">{trace.reason}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* SLA Results */}
                  {slaTestResult && (
                    <Card>
                      <CardHeader>
                        <CardTitle>SLA Result</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-2 text-sm">
                          <div>
                            <strong>Priority:</strong> {routingHelpers.getPriorityLabel(slaTestResult.priority)}
                          </div>
                          <div>
                            <strong>SLA Time:</strong> {routingHelpers.formatSLATime(slaTestResult.slaMinutes)}
                          </div>
                          <div>
                            <strong>Due:</strong> {slaTestResult.dueTime}
                          </div>
                        </div>

                        {slaTestResult.escalationSchedule && slaTestResult.escalationSchedule.length > 0 && (
                          <div>
                            <strong>Escalation Schedule:</strong>
                            <div className="mt-1 space-y-1 text-sm">
                              {slaTestResult.escalationSchedule.map((escalation, index) => (
                                <div key={index} className="text-muted-foreground">
                                  • {routingHelpers.formatSLATime(escalation.minutes)}: {escalation.action}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
};

export default RoutingDemo;
