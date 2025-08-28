import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Link2,
  Settings,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Zap,
  Database,
  MapPin,
  TestTube,
  Unlink,
  Plus,
  Eye,
  Save,
  ArrowRight
} from "lucide-react";
import { 
  integrationsApi, 
  integrationsHelpers, 
  type Integration, 
  type CRMField, 
  type IntegrationHealth 
} from "@/lib/integrationsApi";

const IntegrationsPage = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Field mapping state
  const [selectedProvider, setSelectedProvider] = useState('');
  const [crmFields, setCrmFields] = useState<CRMField[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [mappingLoading, setMappingLoading] = useState(false);

  // Health monitoring state
  const [healthData, setHealthData] = useState<Record<string, IntegrationHealth>>({});

  const leadFields = [
    'email', 'name', 'firstName', 'lastName', 'company', 'phone', 
    'domain', 'score', 'source', 'status', 'createdAt'
  ];

  const availableProviders = [
    { id: 'hubspot', name: 'HubSpot', description: 'Connect your HubSpot CRM for lead sync' },
    { id: 'salesforce', name: 'Salesforce', description: 'Sync leads with Salesforce CRM' },
    { id: 'pipedrive', name: 'Pipedrive', description: 'Integrate with Pipedrive pipeline' }
  ];

  // Load data on mount
  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const { integrations: data } = await integrationsApi.getIntegrations();
      setIntegrations(data);
    } catch (error: any) {
      console.error('Failed to load integrations:', error);
      toast.error('Failed to load integrations', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const setProviderLoading = (provider: string, isLoading: boolean) => {
    setActionLoading(prev => ({ ...prev, [provider]: isLoading }));
  };

  // OAuth connection
  const handleConnect = async (provider: 'hubspot' | 'salesforce') => {
    try {
      await integrationsApi.startOAuth(provider, '/integrations');
    } catch (error: any) {
      toast.error('Failed to start OAuth', { description: error.message });
    }
  };

  // Test connection
  const handleTest = async (provider: string) => {
    try {
      setProviderLoading(`test-${provider}`, true);
      const result = await integrationsApi.testConnection(provider);
      
      if (result.success) {
        toast.success(`${integrationsHelpers.getProviderName(provider)} connection test successful`);
      } else {
        toast.error(`${integrationsHelpers.getProviderName(provider)} connection test failed`, {
          description: result.message
        });
      }
      
      // Refresh integrations to update lastSeenAt
      await loadIntegrations();
    } catch (error: any) {
      toast.error('Connection test failed', { description: error.message });
    } finally {
      setProviderLoading(`test-${provider}`, false);
    }
  };

  // Disconnect integration
  const handleDisconnect = async (provider: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to disconnect ${integrationsHelpers.getProviderName(provider)}? This will stop all syncing.`
    );

    if (!confirmed) return;

    try {
      setProviderLoading(`disconnect-${provider}`, true);
      const result = await integrationsApi.disconnect(provider);
      toast.success(result.message);
      await loadIntegrations();
    } catch (error: any) {
      toast.error('Failed to disconnect', { description: error.message });
    } finally {
      setProviderLoading(`disconnect-${provider}`, false);
    }
  };

  // Load field mapping
  const loadFieldMapping = async (provider: string) => {
    try {
      setMappingLoading(true);
      setSelectedProvider(provider);
      
      const [fieldsResult, mappingResult] = await Promise.all([
        integrationsApi.getFields(provider),
        integrationsApi.getFieldMapping(provider)
      ]);
      
      setCrmFields(fieldsResult.fields);
      setFieldMapping(mappingResult.mapping);
      
      // Auto-suggest mappings if none exist
      if (Object.keys(mappingResult.mapping).length === 0) {
        const suggestions = integrationsHelpers.autoSuggestMapping(leadFields, fieldsResult.fields);
        setFieldMapping(suggestions);
      }
    } catch (error: any) {
      toast.error('Failed to load field mapping', { description: error.message });
    } finally {
      setMappingLoading(false);
    }
  };

  // Save field mapping
  const saveFieldMapping = async () => {
    if (!selectedProvider) return;

    try {
      setMappingLoading(true);
      const result = await integrationsApi.saveFieldMapping(selectedProvider, fieldMapping);
      toast.success(result.message);
    } catch (error: any) {
      toast.error('Failed to save field mapping', { description: error.message });
    } finally {
      setMappingLoading(false);
    }
  };

  // Load health data
  const loadHealthData = async (provider: string) => {
    try {
      const health = await integrationsApi.getHealth(provider);
      setHealthData(prev => ({ ...prev, [provider]: health }));
    } catch (error: any) {
      console.error(`Failed to load health data for ${provider}:`, error);
    }
  };

  // Get integration by provider
  const getIntegration = (provider: string): Integration | undefined => {
    return integrations.find(i => i.kind.toLowerCase() === provider.toLowerCase());
  };

  // Integration card component
  const IntegrationCard: React.FC<{ provider: any }> = ({ provider }) => {
    const integration = getIntegration(provider.id);
    const isConnected = integration?.status === 'CONNECTED';
    const hasError = integration?.status === 'ERROR';

    return (
      <Card className={`transition-all ${hasError ? 'border-red-200' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">{integrationsHelpers.getProviderIcon(provider.id)}</div>
              <div>
                <CardTitle className="text-base">{provider.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{provider.description}</p>
              </div>
            </div>
            <Badge className={integrationsHelpers.getStatusColor(integration?.status || 'DISCONNECTED')}>
              {integration?.status || 'DISCONNECTED'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Connection info */}
          {integration && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last seen:</span>
                <span>{integrationsHelpers.formatRelativeTime(integration.lastSeenAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last sync:</span>
                <span>{integrationsHelpers.formatRelativeTime(integration.lastSyncAt)}</span>
              </div>
              {integration.error && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {integration.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!isConnected ? (
              <Button 
                onClick={() => handleConnect(provider.id as 'hubspot' | 'salesforce')}
                disabled={actionLoading[provider.id]}
                size="sm"
                className="flex-1"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Connect
              </Button>
            ) : (
              <>
                <Button 
                  onClick={() => handleTest(provider.id)}
                  disabled={actionLoading[`test-${provider.id}`]}
                  variant="outline"
                  size="sm"
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  {actionLoading[`test-${provider.id}`] ? 'Testing...' : 'Test'}
                </Button>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => loadFieldMapping(provider.id)}
                      variant="outline" 
                      size="sm"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Mapping
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Field Mapping - {provider.name}</DialogTitle>
                    </DialogHeader>
                    <FieldMappingContent />
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => loadHealthData(provider.id)}
                      variant="outline" 
                      size="sm"
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Health
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Health Status - {provider.name}</DialogTitle>
                    </DialogHeader>
                    <HealthMonitorContent provider={provider.id} />
                  </DialogContent>
                </Dialog>

                <Button 
                  onClick={() => handleDisconnect(provider.id)}
                  disabled={actionLoading[`disconnect-${provider.id}`]}
                  variant="destructive"
                  size="sm"
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  {actionLoading[`disconnect-${provider.id}`] ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Field mapping dialog content
  const FieldMappingContent: React.FC = () => {
    const validation = integrationsHelpers.validateMapping(fieldMapping, crmFields);

    return (
      <div className="space-y-4">
        {mappingLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading fields...</span>
          </div>
        ) : (
          <>
            {/* Validation alerts */}
            {validation.errors.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Errors:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {validation.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warnings:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {validation.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Field mapping table */}
            <ScrollArea className="h-96">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 font-medium text-sm border-b pb-2">
                  <span>Lead Field</span>
                  <span>CRM Field</span>
                  <span>Type</span>
                </div>
                
                {leadFields.map(leadField => {
                  const mappedField = crmFields.find(f => f.name === fieldMapping[leadField]);
                  
                  return (
                    <div key={leadField} className="grid grid-cols-3 gap-4 items-center">
                      <div className="font-medium">{leadField}</div>
                      
                      <Select
                        value={fieldMapping[leadField] || ''}
                        onValueChange={(value) => setFieldMapping(prev => ({
                          ...prev,
                          [leadField]: value
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {crmFields.map(field => (
                            <SelectItem key={field.name} value={field.name}>
                              <div className="flex items-center space-x-2">
                                <span>{integrationsHelpers.getFieldTypeIcon(field.type)}</span>
                                <span>{field.label}</span>
                                {field.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="flex items-center space-x-2">
                        {mappedField && (
                          <>
                            <span>{integrationsHelpers.getFieldTypeIcon(mappedField.type)}</span>
                            <span className="text-sm text-muted-foreground">{mappedField.type}</span>
                            {mappedField.required && (
                              <Badge variant="outline" className="text-xs">Required</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-end space-x-2">
              <Button
                onClick={() => {
                  const suggestions = integrationsHelpers.autoSuggestMapping(leadFields, crmFields);
                  setFieldMapping(suggestions);
                }}
                variant="outline"
              >
                <Zap className="w-4 h-4 mr-2" />
                Auto-map
              </Button>
              <Button
                onClick={saveFieldMapping}
                disabled={mappingLoading || !validation.valid}
              >
                <Save className="w-4 h-4 mr-2" />
                {mappingLoading ? 'Saving...' : 'Save Mapping'}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  };

  // Health monitoring dialog content
  const HealthMonitorContent: React.FC<{ provider: string }> = ({ provider }) => {
    const health = healthData[provider];

    if (!health) {
      return (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading health data...</span>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Status overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{health.queuedOps}</div>
              <div className="text-sm text-muted-foreground">Queued Ops</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{health.metrics.totalSyncs}</div>
              <div className="text-sm text-muted-foreground">Total Syncs</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${integrationsHelpers.getHealthColor(health.metrics.successRate)}`}>
                {integrationsHelpers.formatSuccessRate(health.metrics.successRate)}
              </div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">
                {integrationsHelpers.formatResponseTime(health.metrics.avgResponseTime)}
              </div>
              <div className="text-sm text-muted-foreground">Avg Response</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <div>
          <h3 className="font-medium mb-3">Recent Activity</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 bg-muted rounded">
              <span>Last seen</span>
              <span>{integrationsHelpers.formatRelativeTime(health.lastSeenAt)}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted rounded">
              <span>Last sync</span>
              <span>{integrationsHelpers.formatRelativeTime(health.lastSyncAt)}</span>
            </div>
          </div>
        </div>

        {/* Recent errors */}
        {health.recentErrors.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">Recent Errors</h3>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {health.recentErrors.map((error, index) => (
                  <Alert key={index}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <div className="font-medium">{error.error}</div>
                      <div className="text-muted-foreground">
                        {integrationsHelpers.formatRelativeTime(error.timestamp)}
                        {error.operation && ` • ${error.operation}`}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect and manage your CRM and third-party integrations
          </p>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin mr-3" />
            <span>Loading integrations...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Integration cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {availableProviders.map(provider => (
                <IntegrationCard key={provider.id} provider={provider} />
              ))}
            </div>

            {/* Connected integrations summary */}
            {integrations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="w-5 h-5 mr-2" />
                    Integration Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {integrations.filter(i => i.status === 'CONNECTED').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Connected</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {integrations.filter(i => i.status === 'ERROR').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">
                        {integrations.filter(i => i.status === 'DISCONNECTED').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Disconnected</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default IntegrationsPage;
