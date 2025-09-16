import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ConversationPanel from '@/components/ConversationPanel';
import { MessageReplyDialog } from '@/components/MessageReplyDialog';
import { BulkReplyDialog } from '@/components/BulkReplyDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Search, 
  MessageSquare, 
  Mail, 
  Phone, 
  Linkedin, 
  Globe,
  Clock,
  User,
  UserPlus,
  Link2,
  Pause,
  CheckCircle,
  MoreHorizontal,
  RefreshCw,
  Inbox,
  Users,
  AlertCircle,
  X
} from 'lucide-react';
import { Conversation, Channel } from '@/lib/types';
import { uniboxStore, SDR, getSDRs } from '@/store/uniboxStore';
import { formatRelative, slaStatus } from '@/lib/time';
import { getTab, setTab, getChannel, setChannel, getQuery, setQuery, getConversation, setConversation, getOwner, setOwner } from '@/lib/url';
import { toast } from 'sonner';

// Mock current user - in real app this would come from auth context
const CURRENT_USER = {
  id: 'u-alex',
  name: 'Alex Thompson'
};

const UniboxPage: React.FC = () => {
  const navigate = useNavigate();
  
  // URL state
  const [owner, setOwnerState] = useState<string>(() => {
    try {
      return getOwner();
    } catch (e) {
      console.error('Error getting owner from URL:', e);
      return 'me';
    }
  });
  const [activeTab, setActiveTab] = useState<'unassigned' | 'mine' | 'all'>(() => {
    try {
      return getTab();
    } catch (e) {
      console.error('Error getting tab from URL:', e);
      return 'unassigned';
    }
  });
  const [activeChannel, setActiveChannel] = useState<'all' | Channel>(() => {
    try {
      return getChannel();
    } catch (e) {
      console.error('Error getting channel from URL:', e);
      return 'all';
    }
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return getQuery();
    } catch (e) {
      console.error('Error getting query from URL:', e);
      return '';
    }
  });
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
    try {
      return getConversation();
    } catch (e) {
      console.error('Error getting conversation from URL:', e);
      return null;
    }
  });
  
  // Local state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counts, setCounts] = useState({ unassigned: 0, mine: 0, all: 0 });
  
  // Reply dialog states
  const [replyDialog, setReplyDialog] = useState<{
    open: boolean;
    message: any | null;
  }>({ open: false, message: null });
  const [bulkReplyDialog, setBulkReplyDialog] = useState<{
    open: boolean;
    messages: any[];
  }>({ open: false, messages: [] });
  const [sdrCounts, setSdrCounts] = useState<Array<{ assigneeId: string; assigneeName: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchDebounceTimeout, setSearchDebounceTimeout] = useState<NodeJS.Timeout | null>(null);
  const [groupBySdr, setGroupBySdr] = useState(false);

  // Load conversations and counts
  const loadData = useCallback(() => {
    try {
      let convs: Conversation[] = [];
      
      // Determine which conversations to load based on owner
      if (owner === 'me') {
        convs = uniboxStore.list('mine', activeChannel, searchQuery, CURRENT_USER.id);
      } else if (owner === 'unassigned') {
        convs = uniboxStore.list('unassigned', activeChannel, searchQuery, CURRENT_USER.id);
      } else if (owner === 'all') {
        convs = uniboxStore.list('all', activeChannel, searchQuery, CURRENT_USER.id);
      } else {
        // Viewing a specific SDR
        convs = uniboxStore.listByAssignee(owner, activeChannel, searchQuery);
      }
      
      const cnts = uniboxStore.counts(CURRENT_USER.id);
      const sdrCnts = uniboxStore.countsByAssignee();
      
      setConversations(convs);
      setCounts(cnts);
      setSdrCounts(sdrCnts);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load conversations');
    }
  }, [owner, activeTab, activeChannel, searchQuery]);

  // Subscribe to store changes
  useEffect(() => {
    loadData();
    const unsubscribe = uniboxStore.subscribe(loadData);
    return unsubscribe;
  }, [loadData]);

  // Handle URL parameter changes
  const handleOwnerChange = (newOwner: string) => {
    setOwnerState(newOwner);
    setOwner(newOwner);
    
    // Auto-reconcile tab based on owner
    let newTab: 'unassigned' | 'mine' | 'all';
    if (newOwner === 'me') {
      newTab = 'mine';
    } else if (newOwner === 'unassigned') {
      newTab = 'unassigned';
    } else {
      newTab = 'all';
    }
    
    if (newTab !== activeTab) {
      setActiveTab(newTab);
      setTab(newTab);
    }
  };

  const handleTabChange = (tab: 'unassigned' | 'mine' | 'all') => {
    setActiveTab(tab);
    setTab(tab);
    
    // Auto-reconcile owner based on tab
    let newOwner: string;
    if (tab === 'mine') {
      newOwner = 'me';
    } else if (tab === 'unassigned') {
      newOwner = 'unassigned';
    } else {
      newOwner = 'all';
    }
    
    if (newOwner !== owner) {
      setOwnerState(newOwner);
      setOwner(newOwner);
    }
  };

  const handleChannelChange = (channel: 'all' | Channel) => {
    setActiveChannel(channel);
    setChannel(channel);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    
    // Debounce URL update
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }
    
    const timeout = setTimeout(() => {
      setQuery(query);
    }, 400);
    
    setSearchDebounceTimeout(timeout);
  };

  const handleConversationSelect = (conversationId: string | null) => {
    setSelectedConversationId(conversationId);
    setConversation(conversationId);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const focusedRow = document.querySelector('[data-conversation-row]:focus') as HTMLElement;
      const conversationId = focusedRow?.getAttribute('data-conversation-id');
      
      if (!conversationId) return;

      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          handleClaim(conversationId);
          break;
        case 'a':
          e.preventDefault();
          // Focus would open assign dialog - simplified for this demo
          toast.info('Assign dialog would open (keyboard shortcut: A)');
          break;
        case 'r':
          e.preventDefault();
          if (!selectedConversationId) {
            handleConversationSelect(conversationId);
          }
          // Focus composer in conversation panel
          setTimeout(() => {
            const textarea = document.querySelector('textarea');
            textarea?.focus();
          }, 100);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedConversationId]);

  // Conversation actions
  const handleClaim = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv && !conv.assigneeId) {
      try {
        await uniboxStore.claim(conversationId, CURRENT_USER.id, CURRENT_USER.name);
        toast.success('Conversation claimed');
      } catch (error) {
        toast.error('Failed to claim conversation');
      }
    }
  };

  const handleSnooze = async (conversationId: string, minutes: number) => {
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    try {
      await uniboxStore.snooze(conversationId, snoozeUntil);
      toast.success(`Conversation snoozed`);
    } catch (error) {
      toast.error('Failed to snooze conversation');
    }
  };

  const handleClose = async (conversationId: string) => {
    try {
      await uniboxStore.close(conversationId);
      toast.success('Conversation closed');
    } catch (error) {
      toast.error('Failed to close conversation');
    }
  };



  const handleViewLead = (leadId: string) => {
    navigate(`/leads?selected=${leadId}`);
  };

  // Get current owner display info
  const getCurrentOwnerInfo = () => {
    const sdrs = getSDRs();
    if (owner === 'me') return { name: 'Me', isSpecialOwner: true };
    if (owner === 'unassigned') return { name: 'Unassigned', isSpecialOwner: true };
    if (owner === 'all') return { name: 'All', isSpecialOwner: true };
    
    const sdr = sdrs.find(s => s.id === owner);
    return { name: sdr?.name || 'Unknown', isSpecialOwner: false };
  };

  const currentOwnerInfo = getCurrentOwnerInfo();

  // Empty state messages
  const getEmptyStateMessage = () => {
    switch (activeTab) {
      case 'unassigned':
        return {
          title: 'All caught up!',
          description: 'New messages will land here.',
          icon: Inbox
        };
      case 'mine':
        return {
          title: 'No assigned conversations',
          description: 'Claim one from Unassigned to get started.',
          icon: User
        };
      default:
        return {
          title: 'No conversations match your filters',
          description: 'Try adjusting your search or channel filter.',
          icon: Search
        };
    }
  };

  const emptyState = getEmptyStateMessage();
  const EmptyIcon = emptyState.icon;

  // Group conversations by SDR if enabled
  const groupedConversations = useMemo(() => {
    if (!groupBySdr || owner !== 'all') {
      return { ungrouped: conversations };
    }

    const groups: Record<string, Conversation[]> = { 'Unassigned': [] };
    
    conversations.forEach(conv => {
      const groupKey = conv.assigneeName || 'Unassigned';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(conv);
    });

    // Sort group keys: Unassigned first, then alphabetical
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Unassigned') return -1;
      if (b === 'Unassigned') return 1;
      return a.localeCompare(b);
    });

    const sortedGroups: Record<string, Conversation[]> = {};
    sortedGroupKeys.forEach(key => {
      if (groups[key].length > 0) {
        sortedGroups[key] = groups[key];
      }
    });

    return sortedGroups;
  }, [conversations, groupBySdr, owner]);

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-semibold">Unibox</h1>
            
            {/* Owner switcher */}
            <div className="flex items-center space-x-3">
              <Select value={owner} onValueChange={handleOwnerChange}>
                <SelectTrigger className="w-40">
                  <User className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">SDRs</div>
                  {getSDRs().filter(sdr => sdr.id !== CURRENT_USER.id).map(sdr => (
                    <SelectItem key={sdr.id} value={sdr.id}>
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-5 h-5">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {sdr.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{sdr.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View-as indicator */}
              {!currentOwnerInfo.isSpecialOwner && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-sm text-blue-700">
                    Viewing: {currentOwnerInfo.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOwnerChange('me')}
                    className="h-5 w-5 p-0 text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Tab counters */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
              <TabsList className="grid w-fit grid-cols-3">
                <TabsTrigger value="unassigned" className="relative">
                  Unassigned
                  {counts.unassigned > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                      {counts.unassigned}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="mine" className="relative">
                  Assigned to Me
                  {counts.mine > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                      {counts.mine}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all" className="relative">
                  All
                  {counts.all > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                      {counts.all}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* SDR count chips */}
            <div className="flex items-center space-x-1">
              <span className="text-sm text-muted-foreground">By SDR:</span>
              {sdrCounts.map(({ assigneeId, assigneeName, count }) => (
                <Button
                  key={assigneeId}
                  variant="outline"
                  size="sm"
                  onClick={() => handleOwnerChange(assigneeId)}
                  className="h-6 px-2 text-xs"
                >
                  <Avatar className="w-4 h-4 mr-1">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {assigneeName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {count}
                </Button>
              ))}
            </div>

            {/* Group by SDR toggle for 'all' view */}
            {owner === 'all' && (
              <Button
                variant={groupBySdr ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupBySdr(!groupBySdr)}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                {groupBySdr ? 'List' : 'Group by SDR'}
              </Button>
            )}

            {/* Bulk Reply Button - only show for email conversations */}
            {filteredConversations.some(c => c.channel === 'EMAIL') && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const emailConversations = filteredConversations.filter(c => c.channel === 'EMAIL');
                  setBulkReplyDialog({
                    open: true,
                    messages: emailConversations.map(conv => ({
                      id: conv.id,
                      subject: conv.subject,
                      lead: {
                        id: conv.leadId,
                        email: conv.leadEmail,
                        name: conv.leadName,
                        company: conv.leadCompany
                      }
                    }))
                  });
                }}
                disabled={filteredConversations.filter(c => c.channel === 'EMAIL').length === 0}
              >
                <Mail className="w-4 h-4 mr-2" />
                Bulk Reply ({filteredConversations.filter(c => c.channel === 'EMAIL').length})
              </Button>
            )}
            
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          {/* Channel filter */}
          <Select value={activeChannel} onValueChange={handleChannelChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
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
              <SelectItem value="webform">
                <div className="flex items-center">
                  <Globe className="w-4 h-4 mr-2" />
                  Webform
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Main content */}
        <div className="flex gap-6 h-[calc(100vh-240px)]">
          {/* Conversation list */}
          <div className={`${selectedConversationId ? 'w-2/5' : 'w-full'} transition-all duration-300`}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    Conversations ({conversations.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-full">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <EmptyIcon className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">{emptyState.title}</h3>
                    <p className="text-muted-foreground">{emptyState.description}</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {groupBySdr && owner === 'all' ? (
                      // Grouped display
                      Object.entries(groupedConversations).map(([groupName, groupConversations]) => (
                        <div key={groupName}>
                          {/* Group header */}
                          <div className="px-4 py-3 bg-gray-50 border-b">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm text-gray-900">
                                {groupName} ({groupConversations.length})
                              </h4>
                            </div>
                          </div>
                          
                          {/* Group conversations */}
                          {groupConversations.map((conversation) => (
                            <ConversationRow 
                              key={conversation.id} 
                              conversation={conversation} 
                              isSelected={selectedConversationId === conversation.id}
                              onSelect={() => handleConversationSelect(conversation.id)}
                              onClaim={() => handleClaim(conversation.id)}
                              onSnooze={(minutes) => handleSnooze(conversation.id, minutes)}
                              onClose={() => handleClose(conversation.id)}
                            />
                          ))}
                        </div>
                      ))
                    ) : (
                      // Regular list display
                      conversations.map((conversation) => (
                        <ConversationRow 
                          key={conversation.id} 
                          conversation={conversation} 
                          isSelected={selectedConversationId === conversation.id}
                          onSelect={() => handleConversationSelect(conversation.id)}
                          onClaim={() => handleClaim(conversation.id)}
                          onSnooze={(minutes) => handleSnooze(conversation.id, minutes)}
                          onClose={() => handleClose(conversation.id)}
                        />
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Conversation panel */}
          {selectedConversationId && (
            <div className="w-3/5">
              <ConversationPanel
                conversationId={selectedConversationId}
                onClose={() => handleConversationSelect(null)}
                onViewLead={handleViewLead}
                currentUserId={CURRENT_USER.id}
                currentUserName={CURRENT_USER.name}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

// Conversation row component
interface ConversationRowProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  onClaim: () => void;
  onSnooze: (minutes: number) => void;
  onClose: () => void;
}

// Helper functions (defined before the component)
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
    case 'email': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'sms': return 'text-green-600 bg-green-50 border-green-200';
    case 'linkedin': return 'text-blue-800 bg-blue-100 border-blue-300';
    case 'webform': return 'text-purple-600 bg-purple-50 border-purple-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
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

const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
  isSelected,
  onSelect,
  onClaim,
  onSnooze,
  onClose,
}) => {
  const ChannelIcon = getChannelIcon(conversation.channel);
  const currentSLAStatus = conversation.slaDueAt 
    ? slaStatus(new Date().toISOString(), conversation.slaDueAt) 
    : 'none';

  return (
    <div
      data-conversation-row
      data-conversation-id={conversation.id}
      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors focus:outline-none focus:bg-muted/70 ${
        isSelected ? 'bg-muted border-r-4 border-r-primary' : ''
      }`}
      onClick={onSelect}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between space-x-3">
        {/* Left: Subject and contact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-medium text-sm truncate">{conversation.subject}</h4>
            {conversation.unread && (
              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span className="truncate">
              {conversation.contactName || 'Unknown'} • {conversation.contactHandle}
            </span>
            <Badge variant="outline" className={`text-xs ${getChannelColor(conversation.channel)}`}>
              <ChannelIcon className="w-3 h-3 mr-1" />
              {conversation.channel}
            </Badge>
          </div>
        </div>

        {/* Right: Time and SLA */}
        <div className="flex flex-col items-end space-y-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            {formatRelative(conversation.lastMessageAt)}
          </span>
          {currentSLAStatus !== 'none' && (
            <Badge 
              variant="outline" 
              className={`text-xs ${getSLAStatusColor(currentSLAStatus)}`}
            >
              <Clock className="w-3 h-3 mr-1" />
              {currentSLAStatus === 'overdue' 
                ? 'Overdue' 
                : currentSLAStatus === 'soon'
                ? 'Due Soon'
                : 'On Track'
              }
            </Badge>
          )}
        </div>
      </div>

      {/* Bottom: Lead and owner info */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          {conversation.leadId ? (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              <Link2 className="w-3 h-3 mr-1" />
              {conversation.leadName}
            </Badge>
          ) : null}
          
          {conversation.assigneeId ? (
            <div className="flex items-center space-x-1">
              <Avatar className="w-4 h-4">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {conversation.assigneeName?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {conversation.assigneeName}
              </span>
            </div>
          ) : (
            <Badge variant="outline" className="text-xs">
              Unassigned
            </Badge>
          )}
        </div>

        {/* Row actions */}
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!conversation.assigneeId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClaim();
              }}
              className="h-6 px-2 text-xs"
            >
              Claim
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                className="h-6 w-6 p-0"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSelect}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Open
              </DropdownMenuItem>
              {conversation.channel === 'EMAIL' && (
                <DropdownMenuItem onClick={() => {
                  setReplyDialog({
                    open: true,
                    message: {
                      id: conversation.id,
                      subject: conversation.subject,
                      body: conversation.preview,
                      direction: 'IN',
                      createdAt: conversation.createdAt,
                      lead: {
                        id: conversation.leadId,
                        email: conversation.leadEmail,
                        name: conversation.leadName,
                        company: conversation.leadCompany
                      }
                    }
                  });
                }}>
                  <Mail className="w-4 h-4 mr-2" />
                  Reply
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onSnooze(15)}>
                <Pause className="w-4 h-4 mr-2" />
                Snooze 15m
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(60)}>
                <Pause className="w-4 h-4 mr-2" />
                Snooze 1h
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClose}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Close
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Reply Dialogs */}
      <MessageReplyDialog
        message={replyDialog.message}
        open={replyDialog.open}
        onClose={() => setReplyDialog({ open: false, message: null })}
        onReplySuccess={() => {
          // Refresh conversations after reply
          loadConversations();
        }}
      />
      
      <BulkReplyDialog
        messages={bulkReplyDialog.messages}
        open={bulkReplyDialog.open}
        onClose={() => setBulkReplyDialog({ open: false, messages: [] })}
        onSuccess={() => {
          // Refresh conversations after bulk reply
          loadConversations();
        }}
      />
    </div>
  );
};

export default UniboxPage;
