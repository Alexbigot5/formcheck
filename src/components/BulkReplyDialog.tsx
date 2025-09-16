import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Send, Mail, Users, Template } from 'lucide-react';

interface Message {
  id: string;
  subject: string;
  lead: {
    id: string;
    email: string;
    name: string;
    company?: string;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  segment: 'hot' | 'warm' | 'cold';
}

interface BulkReplyDialogProps {
  messages: Message[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkReplyDialog: React.FC<BulkReplyDialogProps> = ({
  messages,
  open,
  onClose,
  onSuccess
}) => {
  const [replyBody, setReplyBody] = useState('');
  const [subject, setSubject] = useState('');
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewLead, setPreviewLead] = useState<Message['lead'] | null>(null);
  const { toast } = useToast();

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setReplyBody('');
      setSubject('');
      setUseTemplate(false);
      setSelectedTemplate('');
      setPreviewMode(false);
      setPreviewLead(null);
    }
  }, [open]);

  // Update body when template is selected
  useEffect(() => {
    if (useTemplate && selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setReplyBody(template.body);
        setSubject(template.subject);
      }
    } else if (!useTemplate) {
      setReplyBody('');
      setSubject('');
    }
  }, [useTemplate, selectedTemplate, templates]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch('/api/email-templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load email templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSendBulkReplies = async () => {
    if (!replyBody.trim()) {
      toast.error('Please enter a reply message');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/messages/bulk-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        },
        body: JSON.stringify({
          messageIds: messages.map(m => m.id),
          body: replyBody,
          subject: subject || undefined,
          useTemplate,
          templateId: selectedTemplate || undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Bulk replies sent! ${result.summary.successful} successful, ${result.summary.failed} failed`
        );
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to send bulk replies');
      }
    } catch (error) {
      console.error('Failed to send bulk replies:', error);
      toast.error('Failed to send bulk replies');
    } finally {
      setLoading(false);
    }
  };

  const personalizeContent = (content: string, lead: Message['lead']): string => {
    return content
      .replace(/\{\{lead\.name\}\}/g, lead.name || 'there')
      .replace(/\{\{lead\.email\}\}/g, lead.email || '')
      .replace(/\{\{lead\.company\}\}/g, lead.company || 'your company');
  };

  const getPreviewContent = (): string => {
    if (!previewLead) return replyBody;
    return personalizeContent(replyBody, previewLead);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-500" />
            Bulk Reply to {messages.length} Messages
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left Column - Form */}
            <div className="space-y-4 flex flex-col">
              {/* Template Selection */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useTemplate"
                    checked={useTemplate}
                    onCheckedChange={(checked) => setUseTemplate(checked as boolean)}
                  />
                  <Label htmlFor="useTemplate" className="flex items-center gap-2">
                    <Template className="w-4 h-4" />
                    Use Email Template
                  </Label>
                </div>

                {useTemplate && (
                  <div className="space-y-2">
                    <Label>Select Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingTemplates ? "Loading templates..." : "Choose a template"} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant={template.segment === 'hot' ? 'destructive' : template.segment === 'warm' ? 'default' : 'secondary'}>
                                {template.segment}
                              </Badge>
                              {template.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject (optional)"
                  disabled={useTemplate && selectedTemplate !== ''}
                />
              </div>

              {/* Message Body */}
              <div className="space-y-2 flex-1 flex flex-col">
                <Label htmlFor="replyBody">Message</Label>
                <Textarea
                  id="replyBody"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Type your bulk reply message here..."
                  className="flex-1 min-h-[200px] resize-none"
                  disabled={useTemplate && selectedTemplate !== ''}
                />
                
                <div className="text-xs text-gray-500">
                  <p>Available variables:</p>
                  <p>• <code>{'{{lead.name}}'}</code> - Lead's name</p>
                  <p>• <code>{'{{lead.email}}'}</code> - Lead's email</p>
                  <p>• <code>{'{{lead.company}}'}</code> - Lead's company</p>
                </div>
              </div>
            </div>

            {/* Right Column - Recipients & Preview */}
            <div className="space-y-4 flex flex-col">
              {/* Recipients List */}
              <div className="space-y-2">
                <Label>Recipients ({messages.length})</Label>
                <ScrollArea className="h-48 border rounded-md p-3">
                  <div className="space-y-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-2 rounded border cursor-pointer transition-colors ${
                          previewLead?.id === message.lead.id 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setPreviewLead(message.lead);
                          setPreviewMode(true);
                        }}
                      >
                        <div className="text-sm font-medium">{message.lead.name}</div>
                        <div className="text-xs text-gray-500">{message.lead.email}</div>
                        {message.lead.company && (
                          <div className="text-xs text-gray-400">{message.lead.company}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="text-xs text-gray-500">
                  Click on a recipient to preview the personalized message
                </div>
              </div>

              {/* Preview */}
              {previewMode && previewLead && (
                <div className="space-y-2 flex-1 flex flex-col">
                  <Label>Preview for {previewLead.name}</Label>
                  <div className="flex-1 border rounded-md p-3 bg-gray-50">
                    <div className="text-sm font-medium mb-2">
                      Subject: {personalizeContent(subject || 'Re: Your Message', previewLead)}
                    </div>
                    <ScrollArea className="h-32">
                      <div className="text-sm whitespace-pre-wrap">
                        {getPreviewContent()}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">
              {messages.length} recipient{messages.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSendBulkReplies}
              disabled={loading || !replyBody.trim()}
            >
              {loading ? (
                'Sending...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {messages.length} Recipients
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
