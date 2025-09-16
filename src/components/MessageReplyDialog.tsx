import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Reply, Forward, Send, Paperclip, X, Mail } from 'lucide-react';

interface Message {
  id: string;
  subject: string;
  body: string;
  direction: 'IN' | 'OUT';
  createdAt: string;
  status: string;
  lead: {
    id: string;
    email: string;
    name: string;
    company?: string;
  };
}

interface MessageReplyDialogProps {
  message: Message | null;
  open: boolean;
  onClose: () => void;
  onReplySuccess?: () => void;
}

type ReplyMode = 'reply' | 'forward' | 'conversation';

export const MessageReplyDialog: React.FC<MessageReplyDialogProps> = ({
  message,
  open,
  onClose,
  onReplySuccess
}) => {
  const [mode, setMode] = useState<ReplyMode>('reply');
  const [replyBody, setReplyBody] = useState('');
  const [subject, setSubject] = useState('');
  const [forwardTo, setForwardTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const { toast } = useToast();

  // Reset state when message changes
  useEffect(() => {
    if (message) {
      setReplyBody('');
      setSubject(mode === 'reply' ? `Re: ${message.subject || 'No Subject'}` : `Fwd: ${message.subject || 'No Subject'}`);
      setForwardTo('');
      setMode('reply');
    }
  }, [message]);

  // Load conversation when switching to conversation mode
  useEffect(() => {
    if (mode === 'conversation' && message && open) {
      loadConversation();
    }
  }, [mode, message, open]);

  const loadConversation = async () => {
    if (!message) return;
    
    setLoadingConversation(true);
    try {
      const response = await fetch(`/api/messages/${message.id}/conversation`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversation(data.conversation || []);
      } else {
        toast.error('Failed to load conversation');
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast.error('Failed to load conversation');
    } finally {
      setLoadingConversation(false);
    }
  };

  const handleSendReply = async () => {
    if (!message || !replyBody.trim()) {
      toast.error('Please enter a reply message');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/messages/${message.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        },
        body: JSON.stringify({
          body: replyBody,
          subject: subject || undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Reply sent successfully!');
        onReplySuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to send reply');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setLoading(false);
    }
  };

  const handleForwardEmail = async () => {
    if (!message || !forwardTo.trim() || !replyBody.trim()) {
      toast.error('Please enter recipient email and message');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forwardTo)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/messages/${message.id}/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_access_token')}`
        },
        body: JSON.stringify({
          to: forwardTo,
          body: replyBody,
          subject: subject || undefined,
          includeOriginal: true
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Email forwarded successfully!');
        onReplySuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to forward email');
      }
    } catch (error) {
      console.error('Failed to forward email:', error);
      toast.error('Failed to forward email');
    } finally {
      setLoading(false);
    }
  };

  const formatMessageBody = (body: string) => {
    // Strip HTML tags and format for display
    return body
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-500" />
            {mode === 'reply' && 'Reply to Message'}
            {mode === 'forward' && 'Forward Message'}
            {mode === 'conversation' && 'Email Conversation'}
          </DialogTitle>
          
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant={mode === 'reply' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('reply')}
            >
              <Reply className="w-4 h-4 mr-1" />
              Reply
            </Button>
            <Button
              variant={mode === 'forward' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('forward')}
            >
              <Forward className="w-4 h-4 mr-1" />
              Forward
            </Button>
            <Button
              variant={mode === 'conversation' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('conversation')}
            >
              <Mail className="w-4 h-4 mr-1" />
              Conversation
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {mode === 'conversation' ? (
            <div className="h-full flex flex-col">
              <div className="mb-4">
                <h4 className="font-medium text-sm text-gray-600 mb-2">Email Thread</h4>
                <div className="text-sm text-gray-500">
                  Lead: {message.lead.name} ({message.lead.email})
                  {message.lead.company && ` • ${message.lead.company}`}
                </div>
              </div>
              
              <ScrollArea className="flex-1 pr-4">
                {loadingConversation ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-500">Loading conversation...</div>
                  </div>
                ) : conversation.length > 0 ? (
                  <div className="space-y-4">
                    {conversation.map((msg, index) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-lg border ${
                          msg.direction === 'IN'
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-green-50 border-green-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={msg.direction === 'IN' ? 'secondary' : 'default'}>
                              {msg.direction === 'IN' ? 'Received' : 'Sent'}
                            </Badge>
                            <span className="text-sm font-medium">
                              {msg.direction === 'IN' ? msg.lead?.name || msg.lead?.email : 'You'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(msg.createdAt)}
                          </span>
                        </div>
                        
                        {msg.subject && (
                          <div className="text-sm font-medium mb-2">
                            Subject: {msg.subject}
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                          {formatMessageBody(msg.body).substring(0, 500)}
                          {formatMessageBody(msg.body).length > 500 && '...'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-500">No conversation history found</div>
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              {/* Original Message */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Original Message</Badge>
                    <span className="text-sm text-gray-600">
                      From: {message.lead.name} ({message.lead.email})
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(message.createdAt)}
                  </span>
                </div>
                
                <div className="text-sm font-medium mb-2">
                  Subject: {message.subject || 'No Subject'}
                </div>
                
                <ScrollArea className="max-h-32">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {formatMessageBody(message.body)}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Reply/Forward Form */}
              <div className="flex-1 flex flex-col space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                  />
                </div>

                {mode === 'forward' && (
                  <div className="space-y-2">
                    <Label htmlFor="forwardTo">Forward To</Label>
                    <Input
                      id="forwardTo"
                      type="email"
                      value={forwardTo}
                      onChange={(e) => setForwardTo(e.target.value)}
                      placeholder="recipient@example.com"
                    />
                  </div>
                )}

                <div className="space-y-2 flex-1 flex flex-col">
                  <Label htmlFor="replyBody">
                    {mode === 'reply' ? 'Your Reply' : 'Forward Message'}
                  </Label>
                  <Textarea
                    id="replyBody"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={
                      mode === 'reply'
                        ? 'Type your reply...'
                        : 'Add a message to include with the forwarded email...'
                    }
                    className="flex-1 min-h-[150px] resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          
          {mode !== 'conversation' && (
            <Button
              onClick={mode === 'reply' ? handleSendReply : handleForwardEmail}
              disabled={loading || !replyBody.trim() || (mode === 'forward' && !forwardTo.trim())}
            >
              {loading ? (
                'Sending...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {mode === 'reply' ? 'Send Reply' : 'Forward Email'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
