import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Version {
  id: string;
  config: any;
  note: string | null;
  created_at: string;
}

interface AuditPanelProps {
  onRestore: (config: any) => void;
}

export const AuditPanel: React.FC<AuditPanelProps> = ({ onRestore }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVersions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("lead_scoring_versions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setVersions(data || []);
    } catch (e: any) {
      toast.error("Failed to load versions", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  const handleRestore = (version: Version) => {
    if (version.config) {
      onRestore(version.config);
      toast.success("Configuration restored");
    }
  };

  const handleDelete = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from("lead_scoring_versions")
        .delete()
        .eq("id", versionId);

      if (error) throw error;
      setVersions(prev => prev.filter(v => v.id !== versionId));
      toast.success("Version deleted");
    } catch (e: any) {
      toast.error("Failed to delete version", { description: e.message });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
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
        <CardTitle>Version History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {versions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No saved versions yet
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Badge variant="secondary">Latest</Badge>}
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(version)}
                      >
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(version.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  
                  {version.note && (
                    <p className="text-sm text-foreground font-medium">
                      {version.note}
                    </p>
                  )}
                  
                  {version.config?.weights && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Weights: U{version.config.weights.urgency} E{version.config.weights.engagement} J{version.config.weights.jobRole}</div>
                      {version.config?.thresholds && (
                        <div>Thresholds: H{version.config.thresholds.high}+ M{version.config.thresholds.medium}+ L{version.config.thresholds.low}+</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};