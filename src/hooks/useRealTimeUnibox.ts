import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface Conversation {
  id: string;
  leadName: string;
  leadEmail: string;
  leadCompany?: string;
  channel: 'email' | 'sms' | 'linkedin' | 'webform' | 'instagram' | 'chat';
  subject?: string;
  lastMessage: string;
  lastMessageAt: string;
  status: 'new' | 'open' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: string;
  assigneeName?: string;
  unreadCount: number;
  tags: string[];
  slaStatus: 'on_time' | 'due_soon' | 'overdue';
  slaDeadline?: string;
  leadScore: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface UseRealTimeUniboxOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
}

interface ConversationFilters {
  owner?: string;
  tab?: 'unassigned' | 'mine' | 'all';
  channel?: string;
  search?: string;
}

export const useRealTimeUnibox = (
  filters: ConversationFilters = {},
  options: UseRealTimeUniboxOptions = {}
) => {
  const { refreshInterval = 15000, autoRefresh = true } = options;
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Mock data generator for demo purposes
  const generateMockConversations = useCallback((): Conversation[] => {
    const channels: Conversation['channel'][] = ['email', 'webform', 'linkedin', 'instagram', 'sms'];
    const priorities: Conversation['priority'][] = ['low', 'medium', 'high', 'urgent'];
    const slaStatuses: Conversation['slaStatus'][] = ['on_time', 'due_soon', 'overdue'];
    
    const mockConversations: Conversation[] = [];
    
    for (let i = 1; i <= 25; i++) {
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const slaStatus = slaStatuses[Math.floor(Math.random() * slaStatuses.length)];
      const isAssigned = Math.random() > 0.4;
      
      // Simulate new messages arriving
      const isNew = Math.random() > 0.8;
      const createdAt = new Date();
      if (!isNew) {
        createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 24));
      }
      
      const conversation: Conversation = {
        id: `conv_${i}`,
        leadName: `Lead ${i}`,
        leadEmail: `lead${i}@example.com`,
        leadCompany: Math.random() > 0.5 ? `Company ${i}` : undefined,
        channel,
        subject: channel === 'email' ? `Subject ${i}` : undefined,
        lastMessage: `This is a sample message from conversation ${i}`,
        lastMessageAt: createdAt.toISOString(),
        status: isNew ? 'new' : (Math.random() > 0.5 ? 'open' : 'closed'),
        priority,
        assigneeId: isAssigned ? 'user1' : undefined,
        assigneeName: isAssigned ? 'John Doe' : undefined,
        unreadCount: Math.floor(Math.random() * 5),
        tags: [`tag${i % 3 + 1}`],
        slaStatus,
        slaDeadline: new Date(Date.now() + Math.random() * 86400000).toISOString(),
        leadScore: Math.floor(Math.random() * 100),
        source: channel,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString()
      };
      
      mockConversations.push(conversation);
    }
    
    return mockConversations;
  }, []);

  const loadConversations = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate mock data
      let mockData = generateMockConversations();

      // Apply filters
      if (filters.owner && filters.owner !== 'all') {
        if (filters.owner === 'me') {
          mockData = mockData.filter(c => c.assigneeId === 'user1');
        } else if (filters.owner === 'unassigned') {
          mockData = mockData.filter(c => !c.assigneeId);
        }
      }

      if (filters.tab && filters.tab !== 'all') {
        if (filters.tab === 'mine') {
          mockData = mockData.filter(c => c.assigneeId === 'user1');
        } else if (filters.tab === 'unassigned') {
          mockData = mockData.filter(c => !c.assigneeId);
        }
      }

      if (filters.channel && filters.channel !== 'all') {
        mockData = mockData.filter(c => c.channel === filters.channel);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        mockData = mockData.filter(c => 
          c.leadName.toLowerCase().includes(searchLower) ||
          c.leadEmail.toLowerCase().includes(searchLower) ||
          c.lastMessage.toLowerCase().includes(searchLower) ||
          (c.subject && c.subject.toLowerCase().includes(searchLower))
        );
      }

      // Sort by most recent
      mockData.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      setConversations(mockData);
      setLastUpdated(new Date());

      // Show toast for new conversations (only if not initial load)
      if (!showLoading && mockData.some(c => c.status === 'new')) {
        const newCount = mockData.filter(c => c.status === 'new').length;
        if (newCount > 0) {
          toast.success(`${newCount} new conversation${newCount > 1 ? 's' : ''} received`);
        }
      }

    } catch (error: any) {
      setError(error.message || 'Failed to load conversations');
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [filters, generateMockConversations]);

  // Auto-refresh effect
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadConversations(false); // Silent refresh
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadConversations]);

  const claimConversation = useCallback(async (conversationId: string, userId: string, userName: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, assigneeId: userId, assigneeName: userName, status: 'open' as const }
          : conv
      ));
      
      toast.success('Conversation claimed successfully');
    } catch (error) {
      toast.error('Failed to claim conversation');
      throw error;
    }
  }, []);

  const snoozeConversation = useCallback(async (conversationId: string, minutes: number) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const snoozeUntil = new Date(Date.now() + minutes * 60000);
      
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, slaDeadline: snoozeUntil.toISOString(), slaStatus: 'on_time' as const }
          : conv
      ));
      
      toast.success(`Conversation snoozed for ${minutes} minutes`);
    } catch (error) {
      toast.error('Failed to snooze conversation');
      throw error;
    }
  }, []);

  const closeConversation = useCallback(async (conversationId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, status: 'closed' as const }
          : conv
      ));
      
      toast.success('Conversation closed');
    } catch (error) {
      toast.error('Failed to close conversation');
      throw error;
    }
  }, []);

  const refreshNow = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    loading,
    error,
    lastUpdated,
    claimConversation,
    snoozeConversation,
    closeConversation,
    refreshNow
  };
};
