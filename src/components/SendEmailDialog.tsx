import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Send, 
  Eye, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Mail,
  Target,
  Calendar
} from "lucide-react";
import { EmailSender, Lead, SendEmailOptions, EmailSendResult } from "@/lib/emailSender";

interface SendEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate?: {
    subject: string;
    body: string;
    segment: 'hot' | 'warm' | 'cold';
  };
}

export const SendEmailDialog: React.FC<SendEmailDialogProps> = ({
  isOpen,
  onClose,
  initialTemplate
}) => {
  const [emailOptions, setEmailOptions] = useState<SendEmailOptions>({
    subject: '',
    body: '',
    segment: 'hot',
    dryRun: true
  });

  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<{
    results: EmailSendResult[];
    summary: { sent: number; failed: number; total: number };
  } | null>(null);

  const emailSender = EmailSender.getInstance();

  // Mock leads data
  const mockLeads: Lead[] = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      company: 'Acme Corp',
      jobRole: 'Marketing Manager',
      score: 85,
      scoreBand: 'HIGH',
      channel: 'LinkedIn',
      campaign: 'Q4 Product Launch',
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@techcorp.com',
      company: 'TechCorp',
      jobRole: 'VP of Sales',
      score: 92,
      scoreBand: 'HIGH',
      channel: 'Website Form',
      campaign: 'Enterprise Demo',
      createdAt: '2024-01-15T11:15:00Z'
    },
    {
      id: '3',
      name: 'Mike Brown',
      email: 'mike@startup.io',
      company: 'StartupCorp',
      jobRole: 'Founder',
      score: 78,
      scoreBand: 'HIGH',
      channel: 'Webinar',
      campaign: 'Growth Series',
      createdAt: '2024-01-15T09:45:00Z'
    },
    {
      id: '4',
      name: 'Lisa Davis',
      email: 'lisa@midsize.com',
      company: 'MidSize Inc',
      jobRole: 'Director',
      score: 65,
      scoreBand: 'MEDIUM',
      channel: 'Newsletter',
      campaign: 'Monthly Update',
      createdAt: '2024-01-14T16:20:00Z'
    },
    {
      id: '5',
      name: 'Tom Wilson',
      email: 'tom@smallbiz.com',
      company: 'Small Business',
      jobRole: 'Owner',
      score: 35,
      scoreBand: 'LOW',
      channel: 'Social Media',
      campaign: 'Brand Awareness',
      createdAt: '2024-01-14T14:30:00Z'
    }
  ];

  useEffect(() => {
    if (initialTemplate) {
      setEmailOptions(prev => ({
        ...prev,
        subject: initialTemplate.subject,
        body: initialTemplate.body,
        segment: initialTemplate.segment
      }));
    }
  }, [initialTemplate]);

  useEffect(() => {
    // Auto-select leads based on segment
    const filtered = mockLeads.filter(lead => {
      switch (emailOptions.segment) {
        case 'hot':
          return lead.scoreBand === 'HIGH' || lead.score >= 75;
        case 'warm':
          return lead.scoreBand === 'MEDIUM' || (lead.score >= 45 && lead.score < 75);
        case 'cold':
          return lead.scoreBand === 'LOW' || lead.score < 45;
        default:
          return true;
      }
    });
    setSelectedLeads(filtered);
  }, [emailOptions.segment]);

  const handleSend = async () => {
    if (!emailOptions.subject.trim() || !emailOptions.body.trim()) {
      toast.error('Please fill in subject and body');
      return;
    }

    if (selectedLeads.length === 0) {
      toast.error('No leads selected');
      return;
    }

    setSending(true);
    setSendResults(null);

    try {
      const results = await emailSender.sendBulkEmails(selectedLeads, emailOptions);
      setSendResults(results);

      if (emailOptions.dryRun) {
        toast.success(`Dry run completed! Would send to ${results.summary.total} leads`);
      } else {
        toast.success(`Sent ${results.summary.sent} emails successfully!`);
      }
    } catch (error: any) {
      toast.error('Failed to send emails: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const previewTemplate = () => {
    if (!emailOptions.subject && !emailOptions.body) return null;
    
    const sampleLead = selectedLeads[0] || mockLeads[0];
    return {
      subject: emailSender.previewTemplate(emailOptions.subject, sampleLead),
      body: emailSender.previewTemplate(emailOptions.body, sampleLead)
    };
  };

  const preview = previewTemplate();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Email Campaign
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="compose" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="send">Send</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Segment</Label>
                <select
                  value={emailOptions.segment}
                  onChange={(e) => setEmailOptions(prev => ({ 
                    ...prev, 
                    segment: e.target.value as 'hot' | 'warm' | 'cold' 
                  }))}
                  className="w-full p-2 border rounded"
                >
                  <option value="hot">Hot Leads (75+ score)</option>
                  <option value="warm">Warm Leads (45-74 score)</option>
                  <option value="cold">Cold Leads (<45 score)</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="dry-run"
                  checked={emailOptions.dryRun}
                  onCheckedChange={(checked) => setEmailOptions(prev => ({ ...prev, dryRun: checked }))}
                />
                <Label htmlFor="dry-run">Dry Run (test mode)</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={emailOptions.subject}
                onChange={(e) => setEmailOptions(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Enter email subject..."
              />
            </div>

            <div>
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={emailOptions.body}
                onChange={(e) => setEmailOptions(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Enter email content..."
                rows={12}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Available Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {emailSender.getAvailableVariables().map((variable) => (
                    <Badge key={variable.name} variant="outline" className="justify-start">
                      {variable.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {preview ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Email Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject:</Label>
                    <div className="font-medium">{preview.subject}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Body:</Label>
                    <div className="whitespace-pre-wrap border rounded p-3 bg-gray-50">
                      {preview.body}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Please compose your email first to see the preview.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="audience" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Selected Leads ({selectedLeads.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-sm text-muted-foreground">{lead.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.company} • Score: {lead.score}
                        </div>
                      </div>
                      <Badge variant={
                        lead.scoreBand === 'HIGH' ? 'default' : 
                        lead.scoreBand === 'MEDIUM' ? 'secondary' : 'outline'
                      }>
                        {lead.scoreBand}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="send" className="space-y-4">
            {!sendResults ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Ready to Send
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{selectedLeads.length}</div>
                      <div className="text-sm text-muted-foreground">Recipients</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold capitalize">{emailOptions.segment}</div>
                      <div className="text-sm text-muted-foreground">Segment</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{emailOptions.dryRun ? 'Test' : 'Live'}</div>
                      <div className="text-sm text-muted-foreground">Mode</div>
                    </div>
                  </div>

                  {emailOptions.dryRun && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Dry run mode is enabled. No actual emails will be sent.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Send Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{sendResults.summary.sent}</div>
                      <div className="text-sm text-muted-foreground">Sent</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{sendResults.summary.failed}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{sendResults.summary.total}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                  </div>
                  
                  <Progress 
                    value={(sendResults.summary.sent / sendResults.summary.total) * 100} 
                    className="w-full" 
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={sending || !emailOptions.subject.trim() || !emailOptions.body.trim()}
            className="flex items-center gap-2"
          >
            {sending ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {emailOptions.dryRun ? 'Test Send' : 'Send Emails'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
