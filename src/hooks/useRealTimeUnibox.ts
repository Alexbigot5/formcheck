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

  // Load real conversations from API or return empty array
  const loadConversationsFromAPI = useCallback(async (): Promise<Conversation[]> => {
    try {
      // TODO: Replace with actual API call when conversations endpoint is available
      // const response = await conversationsApi.getConversations(filters);
      // return response.conversations;
      
      // For now, return empty array since no real conversations API exists yet
      return [];
    } catch (error) {
      console.error('Failed to load conversations:', error);
      return [];
    }
  }, [filters]);

  const loadConversations = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // Load real conversations from API
      let conversationsData = await loadConversationsFromAPI();

      // Apply client-side filters if needed
      if (filters.owner && filters.owner !== 'all') {
        if (filters.owner === 'me') {
          conversationsData = conversationsData.filter(c => c.assigneeId === 'user1');
        } else if (filters.owner === 'unassigned') {
          conversationsData = conversationsData.filter(c => !c.assigneeId);
        }
      }

      if (filters.tab && filters.tab !== 'all') {
        if (filters.tab === 'mine') {
          conversationsData = conversationsData.filter(c => c.assigneeId === 'user1');
        } else if (filters.tab === 'unassigned') {
          conversationsData = conversationsData.filter(c => !c.assigneeId);
        }
      }

      if (filters.channel && filters.channel !== 'all') {
        conversationsData = conversationsData.filter(c => c.channel === filters.channel);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        conversationsData = conversationsData.filter(c => 
          c.leadName.toLowerCase().includes(searchLower) ||
          c.leadEmail.toLowerCase().includes(searchLower) ||
          c.lastMessage.toLowerCase().includes(searchLower) ||
          (c.subject && c.subject.toLowerCase().includes(searchLower))
        );
      }

      // Sort by most recent
      conversationsData.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      setConversations(conversationsData);
      setLastUpdated(new Date());

      // Show toast for new conversations (only if not initial load)
      if (!showLoading && conversationsData.some(c => c.status === 'new')) {
        const newCount = conversationsData.filter(c => c.status === 'new').length;
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
  }, [filters, loadConversationsFromAPI]);

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
