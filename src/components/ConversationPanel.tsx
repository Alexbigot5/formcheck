import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  X, 
  Mail, 
  MessageSquare, 
  Phone, 
  Linkedin, 
  Globe,
  User,
  UserPlus,
  Link2,
  Unlink,
  Eye,
  Clock,
  Pause,
  CheckCircle,
  Send
} from 'lucide-react';
import { Conversation, Channel, Message } from '@/lib/types';
import { uniboxStore } from '@/store/uniboxStore';
import { formatRelative, slaStatus } from '@/lib/time';
import { toast } from 'sonner';
import AssignDialog from './AssignDialog';
import LinkLeadDialog from './LinkLeadDialog';

interface ConversationPanelProps {
  conversationId: string;
  onClose: () => void;
  onViewLead: (leadId: string) => void;
  currentUserId: string;
  currentUserName: string;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversationId,
  onClose,
  onViewLead,
  currentUserId,
  currentUserName,
}) => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel>('email');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation data
  useEffect(() => {
    const loadData = () => {
      const conv = uniboxStore.get(conversationId);
      const msgs = uniboxStore.getMessages(conversationId);
      setConversation(conv || null);
      setMessages(msgs);
      
      if (conv) {
        setSelectedChannel(conv.channel);
      }
    };

    loadData();
    
    // Subscribe to store changes
    const unsubscribe = uniboxStore.subscribe(loadData);
    return unsubscribe;
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!replyText.trim() || !conversation || isSending) return;

    setIsSending(true);
    try {
      await uniboxStore.reply(conversationId, replyText.trim(), currentUserName, selectedChannel);
      setReplyText('');
      toast.success('Message sent');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClaim = async () => {
    if (!conversation || conversation.assigneeId) return;
    
    try {
      await uniboxStore.claim(conversationId, currentUserId, currentUserName);
      toast.success('Conversation claimed');
    } catch (error) {
      toast.error('Failed to claim conversation');
    }
  };

  const handleSnooze = async (minutes: number) => {
    if (!conversation) return;
    
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    try {
      await uniboxStore.snooze(conversationId, snoozeUntil);
      toast.success(`Snoozed for ${minutes === 15 ? '15 minutes' : minutes === 60 ? '1 hour' : '1 day'}`);
    } catch (error) {
      toast.error('Failed to snooze conversation');
    }
  };

  const handleClose = async () => {
    if (!conversation) return;
    
    try {
      await uniboxStore.close(conversationId);
      toast.success('Conversation closed');
      onClose();
    } catch (error) {
      toast.error('Failed to close conversation');
    }
  };

  const getChannelIcon = (channel: Channel) => {
    switch (channel) {
      case 'email': return Mail;
      case 'sms': return Phone;
      case 'linkedin': return Linkedin;
      case 'webform': return Globe;
      default: return MessageSquare;
    }
  };

  const getChannelColor = (channel: Channel) => {
    switch (channel) {
      case 'email': return 'text-blue-600 bg-blue-50';
      case 'sms': return 'text-green-600 bg-green-50';
      case 'linkedin': return 'text-blue-800 bg-blue-100';
      case 'webform': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSLAStatusColor = (status: 'none' | 'ok' | 'soon' | 'overdue') => {
    switch (status) {
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'soon': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ok': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!conversation) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading conversation...</div>
        </CardContent>
      </Card>
    );
  }

  const ChannelIcon = getChannelIcon(conversation.channel);
  const currentSLAStatus = conversation.slaDueAt ? slaStatus(new Date().toISOString(), conversation.slaDueAt) : 'none';

  return (
    <>
      <Card className="h-full flex flex-col">
        {/* Header */}
        <CardHeader className="flex-shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg truncate">{conversation.subject}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Contact info */}
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary/20 text-primary">
                {conversation.contactName?.charAt(0).toUpperCase() || 'C'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{conversation.contactName || 'Unknown Contact'}</div>
              <div className="text-sm text-muted-foreground truncate">{conversation.contactHandle}</div>
            </div>
          </div>

          {/* Channel and status badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={getChannelColor(conversation.channel)}>
              <ChannelIcon className="w-3 h-3 mr-1" />
              {conversation.channel.charAt(0).toUpperCase() + conversation.channel.slice(1)}
            </Badge>
            
            {conversation.unread && (
              <Badge variant="default" className="bg-blue-600">
                Unread
              </Badge>
            )}

            {conversation.slaDueAt && (
              <Badge 
                variant="outline" 
                className={getSLAStatusColor(currentSLAStatus)}
                role="status"
                aria-live={currentSLAStatus === 'overdue' ? 'polite' : 'off'}
              >
                <Clock className="w-3 h-3 mr-1" />
                {currentSLAStatus === 'overdue' 
                  ? 'SLA Overdue' 
                  : currentSLAStatus === 'soon'
                  ? 'SLA Due Soon'
                  : 'SLA On Track'
                }
              </Badge>
            )}
          </div>

          {/* Owner and lead info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {conversation.assigneeId ? (
                <div className="flex items-center space-x-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {conversation.assigneeName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{conversation.assigneeName}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </div>

            {conversation.leadId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewLead(conversation.leadId!)}
              >
                <Eye className="w-4 h-4 mr-2" />
                View Lead
              </Button>
            ) : null}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!conversation.assigneeId && (
              <Button variant="outline" size="sm" onClick={handleClaim}>
                <User className="w-4 h-4 mr-2" />
                Claim
              </Button>
            )}
            
            <Button variant="outline" size="sm" onClick={() => setIsAssignDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Assign
            </Button>

            <Button variant="outline" size="sm" onClick={() => setIsLinkDialogOpen(true)}>
              {conversation.leadId ? (
                <>
                  <Unlink className="w-4 h-4 mr-2" />
                  Unlink Lead
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Link Lead
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      message.direction === 'out'
                        ? 'bg-primary text-primary-foreground'
                        : message.direction === 'note'
                        ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="text-sm">{message.body}</div>
                    <div className={`text-xs mt-1 ${
                      message.direction === 'out' 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {message.authorName && `${message.authorName} • `}
                      {formatRelative(message.sentAt)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Composer */}
          <div className="border-t pt-4 mt-4">
            {/* Channel selector */}
            <div className="flex items-center space-x-2 mb-3">
              <Select 
                value={selectedChannel} 
                onValueChange={(value: Channel) => setSelectedChannel(value)}
                disabled={conversation.channel === 'webform'}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      SMS
                    </div>
                  </SelectItem>
                  <SelectItem value="linkedin">
                    <div className="flex items-center">
                      <Linkedin className="w-4 h-4 mr-2" />
                      LinkedIn
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {conversation.channel === 'webform' && (
                <span className="text-xs text-muted-foreground">
                  Webform contacts can only receive email replies
                </span>
              )}
            </div>

            {/* Message input */}
            <div className="flex space-x-2">
              <Textarea
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-h-[80px] resize-none"
                disabled={isSending}
              />
              <Button 
                onClick={handleSend} 
                disabled={!replyText.trim() || isSending}
                className="self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t">
            <div className="text-sm text-muted-foreground">Quick actions:</div>
            <div className="flex space-x-2">
              <Button variant="ghost" size="sm" onClick={() => handleSnooze(15)}>
                <Pause className="w-4 h-4 mr-1" />
                15m
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleSnooze(60)}>
                <Pause className="w-4 h-4 mr-1" />
                1h
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleSnooze(24 * 60)}>
                <Pause className="w-4 h-4 mr-1" />
                Tomorrow
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Close
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AssignDialog
        isOpen={isAssignDialogOpen}
        onClose={() => setIsAssignDialogOpen(false)}
        conversationId={conversationId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />

      <LinkLeadDialog
        isOpen={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        conversation={conversation}
      />
    </>
  );
};

export default ConversationPanel;
