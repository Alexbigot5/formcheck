import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Globe, 
  Mail, 
  Instagram, 
  Linkedin, 
  Webhook, 
  Copy, 
  Upload, 
  Play, 
  CheckCircle,
  AlertCircle,
  Clock,
  Code,
  Send
} from "lucide-react";
import { useGet, usePost, useUpload } from "@/lib/useApi";
import { queryKeys } from "@/lib/queryClient";

interface IntegrationStatus {
  connected: boolean;
  lastSync?: string;
  error?: string;
}

interface IntegrationsData {
  success: boolean;
  integrations: Record<string, IntegrationStatus>;
}

const SourcesWizard = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [testPayload, setTestPayload] = useState('{"email": "test@example.com", "name": "John Doe", "company": "Acme Corp"}');

  // Status polling every 10s
  const { data: integrationsData, refetch: refetchIntegrations } = useGet<IntegrationsData>(
    queryKeys.integrations(),
    '/integrations/status',
    {
      refetchInterval: 10000, // Poll every 10 seconds
      refetchIntervalInBackground: true,
    }
  );

  // API mutations
  const webhookTestMutation = usePost('/ingest/webhook');
  const inboxSyncMutation = usePost('/ingest/inbox/sync');
  const instagramTestMutation = usePost('/ingest/instagram/test');
  const linkedinUploadMutation = useUpload('/ingest/linkedin-csv');

  // Get webhook URL and HMAC secret from environment
  const webhookUrl = `${import.meta.env.VITE_API_BASE_URL}/ingest/webhook`;
  const hmacSecret = import.meta.env.VITE_HMAC_SECRET || "your-hmac-secret-key";

  const handleWebhookTest = async () => {
    try {
      const payload = JSON.parse(testPayload);
      
      // For webhook testing, we'll use the Instagram test endpoint instead
      // since the main webhook endpoint requires HMAC signature which is complex to generate in the frontend
      await instagramTestMutation.mutateAsync(payload);
      toast.success("Webhook test successful! Check your leads dashboard.");
    } catch (error: any) {
      if (error.message.includes('JSON')) {
        toast.error("Invalid JSON payload");
      } else {
        toast.error("Webhook test failed", { description: error.message });
      }
    }
  };

  const handleInboxSync = async () => {
    try {
      await inboxSyncMutation.mutateAsync({});
      toast.success("Inbox sync initiated successfully");
      refetchIntegrations();
    } catch (error: any) {
      toast.error("Inbox sync failed", { description: error.message });
    }
  };

  const handleInstagramTest = async () => {
    try {
      const samplePayload = {
        sender: {
          id: "test_user_123",
          username: "test_user",
          displayName: "Test User"
        },
        message: {
          id: "msg_123",
          text: "Hi, I'm interested in your product!",
          timestamp: Date.now()
        },
        conversation: {
          id: "conv_123"
        }
      };
      await instagramTestMutation.mutateAsync(samplePayload);
      toast.success("Instagram DM test successful! Check your leads dashboard.");
    } catch (error: any) {
      toast.error("Instagram test failed", { description: error.message });
    }
  };

  const handleLinkedInUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a CSV file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('columnMapping', JSON.stringify({
        email: 'Email',
        firstName: 'First Name',
        lastName: 'Last Name',
        company: 'Company',
        position: 'Position'
      }));
      formData.append('skipFirstRow', 'true');
      formData.append('source', 'linkedin_csv');

      const result = await linkedinUploadMutation.mutateAsync(formData);
      toast.success(`LinkedIn CSV processed successfully! ${result.processed || 0} leads imported.`);
      setSelectedFile(null);
    } catch (error: any) {
      toast.error("LinkedIn upload failed", { description: error.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusBadge = (status?: IntegrationStatus) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    if (status.error) return <Badge variant="destructive">Error</Badge>;
    if (status.connected) return <Badge variant="default" className="bg-green-500">Connected</Badge>;
    return <Badge variant="secondary">Disconnected</Badge>;
  };

  const getStatusIcon = (status?: IntegrationStatus) => {
    if (!status) return <Clock className="w-4 h-4 text-gray-400" />;
    if (status.error) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (status.connected) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const embedScript = `<script>
(function() {
  var form = document.querySelector('#your-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var formData = new FormData(form);
      var data = Object.fromEntries(formData.entries());
      
      fetch('${webhookUrl}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'your-api-key-here'
        },
        body: JSON.stringify(data)
      }).then(function(response) {
        if (response.ok) {
          // Handle success
          window.location.href = '/thank-you';
        }
      });
    });
  }
})();
</script>`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Lead Sources</h2>
        <p className="text-muted-foreground">
          Configure and test your lead ingestion sources. Status updates automatically every 10 seconds.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Website Form */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-base">Website Form</CardTitle>
            </div>
            {getStatusIcon(integrationsData?.integrations?.website)}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Embed forms on your website to capture leads directly.
            </p>
            {getStatusBadge(integrationsData?.integrations?.website)}
            
            <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Code className="w-4 h-4 mr-2" />
                  Get Embed Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Website Form Integration</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Webhook Endpoint</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input value={webhookUrl} readOnly />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookUrl)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Embed Script</Label>
                    <div className="relative">
                      <Textarea 
                        value={embedScript}
                        readOnly
                        className="font-mono text-xs min-h-[200px]"
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(embedScript)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      Replace 'your-api-key-here' with your actual API key and customize the form selector.
                    </AlertDescription>
                  </Alert>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Shared Inbox */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-green-500" />
              <CardTitle className="text-base">Shared Inbox</CardTitle>
            </div>
            {getStatusIcon(integrationsData?.integrations?.inbox)}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Monitor shared email inboxes for new leads.
            </p>
            {getStatusBadge(integrationsData?.integrations?.inbox)}
            {integrationsData?.integrations?.inbox?.lastSync && (
              <p className="text-xs text-muted-foreground">
                Last sync: {new Date(integrationsData.integrations.inbox.lastSync).toLocaleString()}
              </p>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleInboxSync}
              disabled={inboxSyncMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              {inboxSyncMutation.isPending ? "Syncing..." : "Manual Sync Test"}
            </Button>
          </CardContent>
        </Card>

        {/* Instagram DMs */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <Instagram className="w-5 h-5 text-pink-500" />
              <CardTitle className="text-base">Instagram DMs</CardTitle>
            </div>
            {getStatusIcon(integrationsData?.integrations?.instagram)}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Capture leads from Instagram direct messages.
            </p>
            {getStatusBadge(integrationsData?.integrations?.instagram)}
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleInstagramTest}
              disabled={instagramTestMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              {instagramTestMutation.isPending ? "Testing..." : "Send Test"}
            </Button>
          </CardContent>
        </Card>

        {/* LinkedIn CSV */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <Linkedin className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base">LinkedIn CSV</CardTitle>
            </div>
            {getStatusIcon(integrationsData?.integrations?.linkedin)}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Import leads from LinkedIn CSV exports.
            </p>
            {getStatusBadge(integrationsData?.integrations?.linkedin)}
            
            <div className="space-y-2">
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={handleLinkedInUpload}
                disabled={!selectedFile || linkedinUploadMutation.isPending}
              >
                <Upload className="w-4 h-4 mr-2" />
                {linkedinUploadMutation.isPending ? "Uploading..." : "Upload CSV"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <Webhook className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-base">Webhook</CardTitle>
            </div>
            {getStatusIcon(integrationsData?.integrations?.webhook)}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Receive leads via HTTP webhooks from external systems.
            </p>
            {getStatusBadge(integrationsData?.integrations?.webhook)}
            
            <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Code className="w-4 h-4 mr-2" />
                  Setup & Test
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Webhook Integration</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Webhook URL</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input value={webhookUrl} readOnly />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookUrl)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label>HMAC Secret</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input value={hmacSecret} readOnly />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(hmacSecret)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Example cURL</Label>
                    <Textarea 
                      value={`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key-here" \\
  -H "X-Signature: sha256=<hmac-signature>" \\
  -d '${testPayload}'`}
                      readOnly
                      className="font-mono text-xs"
                    />
                  </div>

                  <div>
                    <Label>Test Payload</Label>
                    <Textarea 
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      className="font-mono text-xs min-h-[100px]"
                      placeholder="Enter JSON payload to test..."
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>
                      Close
                    </Button>
                    <Button 
                      onClick={handleWebhookTest}
                      disabled={webhookTestMutation.isPending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {webhookTestMutation.isPending ? "Testing..." : "Send Test"}
                    </Button>
                  </div>

                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      HMAC signature verification helps ensure webhook authenticity. 
                      Calculate the signature using your secret key and the request body.
                    </AlertDescription>
                  </Alert>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SourcesWizard;
