import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { scoringApi, type AuditEntry, type ConfigHistory } from "@/lib/scoringApi";

interface ApiAuditPanelProps {
  onRestore: (config: any) => void;
}

export const ApiAuditPanel: React.FC<ApiAuditPanelProps> = ({ onRestore }) => {
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [configHistory, setConfigHistory] = useState<ConfigHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      const [auditData, historyData] = await Promise.all([
        scoringApi.getAudits(20),
        scoringApi.getConfigHistory(10)
      ]);
      
      setAudits(auditData);
      setConfigHistory(historyData.configs);
    } catch (error: any) {
      console.error('Failed to load audit data:', error);
      toast.error('Failed to load audit data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const handleRestore = async (config: any) => {
    try {
      onRestore(config);
      toast.success("Configuration restored");
    } catch (error: any) {
      toast.error("Failed to restore configuration", { description: error.message });
    }
  };

  const handleRollback = async (version: string) => {
    try {
      const result = await scoringApi.rollbackConfig(version);
      onRestore(result.config);
      toast.success(result.message);
      await loadAuditData(); // Refresh audit data
    } catch (error: any) {
      toast.error("Failed to rollback configuration", { description: error.message });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-muted rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail & History</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">Config History</TabsTrigger>
            <TabsTrigger value="audits">Audit Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="history">
            <ScrollArea className="h-96">
              {configHistory.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No configuration history available
                </div>
              ) : (
                <div className="space-y-3">
                  {configHistory.map((config, index) => (
                    <div
                      key={config.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Badge variant="secondary">Latest</Badge>}
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(config.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(config.config)}
                          >
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRollback(config.id)}
                          >
                            Rollback
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Created by: {config.createdBy}
                      </div>
                      
                      {config.config?.weights && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>
                            Weights: {Object.entries(config.config.weights)
                              .map(([key, value]) => `${key}:${value}`)
                              .join(', ')}
                          </div>
                          {config.config?.bands && (
                            <div>
                              Bands: L{config.config.bands.low.min}+ M{config.config.bands.medium.min}+ H{config.config.bands.high.min}+
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="audits">
            <ScrollArea className="h-96">
              {audits.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No audit logs available
                </div>
              ) : (
                <div className="space-y-3">
                  {audits.map((audit) => (
                    <div
                      key={audit.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              audit.action.includes('create') ? 'default' :
                              audit.action.includes('update') ? 'secondary' :
                              audit.action.includes('delete') ? 'destructive' :
                              'outline'
                            }
                          >
                            {audit.action}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <div>Entity: {audit.entityType} ({audit.entityId.slice(0, 8)}...)</div>
                        {audit.userId && (
                          <div className="text-xs text-muted-foreground">
                            User: {audit.userId.slice(0, 8)}...
                          </div>
                        )}
                      </div>

                      {(audit.before || audit.after) && (
                        <details className="text-xs">
                          <summary className="cursor-pointer hover:text-foreground">
                            View Changes
                          </summary>
                          <div className="mt-2 space-y-1">
                            {audit.before && (
                              <div>
                                <div className="font-medium text-red-600">Before:</div>
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                  {JSON.stringify(audit.before, null, 2)}
                                </pre>
                              </div>
                            )}
                            {audit.after && (
                              <div>
                                <div className="font-medium text-green-600">After:</div>
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                  {JSON.stringify(audit.after, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
