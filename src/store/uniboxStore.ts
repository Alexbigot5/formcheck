import { Conversation, Message, Channel } from '@/lib/types';

// SDR interface
export interface SDR { 
  id: string; 
  name: string; 
  email?: string; 
  avatarUrl?: string;
}

// Mock data for SDRs
const SDRS: SDR[] = [
  { id: 'u-alex', name: 'Alex Thompson', email: 'alex@company.com' },
  { id: 'u-sarah', name: 'Sarah Johnson', email: 'sarah@company.com' },
  { id: 'u-ben', name: 'Ben Rodriguez', email: 'ben@company.com' },
  { id: 'u-dana', name: 'Dana Thompson', email: 'dana@company.com' },
  { id: 'u-eli', name: 'Eli Johnson', email: 'eli@company.com' },
  { id: 'u-freya', name: 'Freya Martinez', email: 'freya@company.com' },
];

export const getSDRs = (): SDR[] => SDRS;

// Mock leads data
const mockLeads = [
  { id: 'lead-1', name: 'John Smith', email: 'john@acme.com' },
  { id: 'lead-2', name: 'Sarah Johnson', email: 'sarah@techstart.com' },
  { id: 'lead-3', name: 'Mike Wilson', email: 'mike@innovation.com' },
  { id: 'lead-4', name: 'Lisa Chen', email: 'lisa@global.com' },
  { id: 'lead-5', name: 'David Brown', email: 'david@future.com' },
  { id: 'lead-6', name: 'Emily Davis', email: 'emily@dataflow.com' },
  { id: 'lead-7', name: 'Alex Thompson', email: 'alex@cloudtech.com' },
  { id: 'lead-8', name: 'Rachel Green', email: 'rachel@smartops.com' },
];

class UniboxStore {
  private ev = new EventTarget();
  private conversations: Conversation[] = [];
  private messages: Record<string, Message[]> = {};

  constructor() {
    this.seedData();
    this.startBackgroundActivity();
  }

  private seedData(): void {
    // Generate ~30 conversations
    const channels: Channel[] = ['email', 'sms', 'linkedin', 'webform'];
    const subjects = [
      'Pricing inquiry for Enterprise plan',
      'Demo request - urgent',
      'Follow up on yesterday\'s call',
      'Question about API integration',
      'Interested in your services',
      'Meeting reschedule request',
      'Contract terms discussion',
      'Technical support needed',
      'Product feature request',
      'Partnership opportunity',
      'Invoice question',
      'Account setup help',
      'Bulk pricing inquiry',
      'Implementation timeline',
      'Security questionnaire',
    ];

    for (let i = 1; i <= 30; i++) {
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const isAssigned = Math.random() < 0.6; // 60% assigned
      const assignedSDR = isAssigned ? SDRS[Math.floor(Math.random() * SDRS.length)] : null;
      const hasLead = Math.random() < 0.4; // 40% have linked leads
      const linkedLead = hasLead ? mockLeads[Math.floor(Math.random() * mockLeads.length)] : null;
      
      // Create contact info based on channel
      let contactName = `Contact ${i}`;
      let contactHandle = '';
      
      switch (channel) {
        case 'email':
          contactHandle = `contact${i}@example.com`;
          break;
        case 'sms':
          contactHandle = `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
          break;
        case 'linkedin':
          contactHandle = `linkedin.com/in/contact${i}`;
          break;
        case 'webform':
          contactHandle = `contact${i}@example.com`;
          break;
      }

      const lastMessageAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
      const isHot = Math.random() < 0.3; // 30% are hot leads requiring faster SLA
      const slaMinutes = isHot ? 10 : 120; // 10 minutes for hot, 2 hours for normal
      const slaDueAt = new Date(new Date(lastMessageAt).getTime() + slaMinutes * 60 * 1000).toISOString();

      const conversation: Conversation = {
        id: `conv-${i}`,
        subject,
        contactName,
        contactHandle,
        channel,
        leadId: linkedLead?.id,
        leadName: linkedLead?.name,
        assigneeId: assignedSDR?.id,
        assigneeName: assignedSDR?.name,
        status: Math.random() < 0.1 ? 'snoozed' : 'open', // 10% snoozed
        lastMessageAt,
        slaDueAt,
        unread: Math.random() < 0.4, // 40% unread
      };

      this.conversations.push(conversation);

      // Generate messages for each conversation
      const messageCount = Math.floor(Math.random() * 5) + 1; // 1-5 messages
      const conversationMessages: Message[] = [];

      for (let j = 1; j <= messageCount; j++) {
        const direction = j === 1 ? 'in' : (Math.random() < 0.6 ? 'in' : 'out');
        const sentAt = new Date(
          new Date(lastMessageAt).getTime() - (messageCount - j) * 30 * 60 * 1000
        ).toISOString();

        const message: Message = {
          id: `msg-${i}-${j}`,
          conversationId: conversation.id,
          direction,
          body: this.generateMessageBody(direction, channel, subject),
          sentAt,
          authorName: direction === 'out' ? (assignedSDR?.name || 'System') : contactName,
        };

        conversationMessages.push(message);
      }

      this.messages[conversation.id] = conversationMessages;
    }
  }

  private generateMessageBody(direction: 'in' | 'out' | 'note', channel: Channel, subject: string): string {
    const inboundMessages = [
      'Hi, I\'m interested in learning more about your enterprise solution.',
      'Could you please send me pricing information?',
      'I\'d like to schedule a demo for next week.',
      'We\'re evaluating your platform against competitors.',
      'What\'s your implementation timeline typically?',
      'Do you have any case studies from similar companies?',
      'I have some questions about your security features.',
      'Can you help me understand your API capabilities?',
    ];

    const outboundMessages = [
      'Thanks for your interest! I\'d be happy to help.',
      'I\'ve sent the pricing information to your email.',
      'Let me check our calendar for available demo slots.',
      'I can definitely provide some competitive analysis.',
      'Our typical implementation takes 2-4 weeks depending on complexity.',
      'I\'ll send over some relevant case studies.',
      'I can connect you with our security team for detailed answers.',
      'Our API documentation is quite comprehensive - let me share the link.',
    ];

    if (direction === 'in') {
      return inboundMessages[Math.floor(Math.random() * inboundMessages.length)];
    } else {
      return outboundMessages[Math.floor(Math.random() * outboundMessages.length)];
    }
  }

  private startBackgroundActivity(): void {
    // Every 15 seconds, update a random open conversation
    setInterval(() => {
      const openConversations = this.conversations.filter(c => c.status === 'open');
      if (openConversations.length > 0) {
        const randomConv = openConversations[Math.floor(Math.random() * openConversations.length)];
        randomConv.lastMessageAt = new Date().toISOString();
        randomConv.unread = true;
        this.emit();
      }
    }, 15000);
  }

  private emit(): void {
    this.ev.dispatchEvent(new Event('change'));
  }

  subscribe(callback: () => void): () => void {
    this.ev.addEventListener('change', callback);
    return () => this.ev.removeEventListener('change', callback);
  }

  // Query methods
  list(filter: 'unassigned' | 'mine' | 'all', channel: 'all' | Channel, q: string, meId: string): Conversation[] {
    let filtered = [...this.conversations];

    // Filter by assignment
    switch (filter) {
      case 'unassigned':
        filtered = filtered.filter(c => !c.assigneeId);
        break;
      case 'mine':
        filtered = filtered.filter(c => c.assigneeId === meId);
        break;
      // 'all' shows everything
    }

    // Filter by channel
    if (channel !== 'all') {
      filtered = filtered.filter(c => c.channel === channel);
    }

    // Filter by search query
    if (q.trim()) {
      const query = q.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.subject.toLowerCase().includes(query) ||
        c.contactName?.toLowerCase().includes(query) ||
        c.contactHandle?.toLowerCase().includes(query) ||
        c.leadName?.toLowerCase().includes(query)
      );
    }

    // Sort by last message time (newest first)
    filtered.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return filtered;
  }

  counts(meId: string): { unassigned: number; mine: number; all: number } {
    const unassigned = this.conversations.filter(c => !c.assigneeId && c.status === 'open').length;
    const mine = this.conversations.filter(c => c.assigneeId === meId && c.status === 'open').length;
    const all = this.conversations.filter(c => c.status === 'open').length;

    return { unassigned, mine, all };
  }

  get(convId: string): Conversation | undefined {
    return this.conversations.find(c => c.id === convId);
  }

  getMessages(convId: string): Message[] {
    return this.messages[convId] || [];
  }

  listByAssignee(assigneeId: string, channel: 'all' | Channel, q: string): Conversation[] {
    let filtered = this.conversations.filter(c => c.assigneeId === assigneeId);

    // Filter by channel
    if (channel !== 'all') {
      filtered = filtered.filter(c => c.channel === channel);
    }

    // Filter by search query
    if (q.trim()) {
      const query = q.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.subject.toLowerCase().includes(query) ||
        c.contactName?.toLowerCase().includes(query) ||
        c.contactHandle?.toLowerCase().includes(query) ||
        c.leadName?.toLowerCase().includes(query)
      );
    }

    // Sort by last message time (newest first)
    filtered.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return filtered;
  }

  countsByAssignee(): Array<{ assigneeId: string; assigneeName: string; count: number }> {
    const counts: Record<string, { assigneeName: string; count: number }> = {};
    
    this.conversations
      .filter(c => c.assigneeId && c.status === 'open')
      .forEach(c => {
        if (!counts[c.assigneeId!]) {
          counts[c.assigneeId!] = { assigneeName: c.assigneeName!, count: 0 };
        }
        counts[c.assigneeId!].count++;
      });

    return Object.entries(counts).map(([assigneeId, data]) => ({
      assigneeId,
      assigneeName: data.assigneeName,
      count: data.count
    }));
  }

  // Mutation methods
  async claim(convId: string, meId: string, meName: string): Promise<void> {
    const conv = this.get(convId);
    if (conv && !conv.assigneeId) {
      // Optimistic update
      conv.assigneeId = meId;
      conv.assigneeName = meName;
      this.emit();

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  async assign(convId: string, assigneeId: string, assigneeName: string): Promise<void> {
    const conv = this.get(convId);
    if (conv) {
      // Optimistic update
      conv.assigneeId = assigneeId;
      conv.assigneeName = assigneeName;
      this.emit();

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  async linkLead(convId: string, leadId: string, leadName: string): Promise<void> {
    const conv = this.get(convId);
    if (conv) {
      // Optimistic update
      conv.leadId = leadId;
      conv.leadName = leadName;
      this.emit();

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  async unlinkLead(convId: string): Promise<void> {
    const conv = this.get(convId);
    if (conv) {
      // Optimistic update
      conv.leadId = undefined;
      conv.leadName = undefined;
      this.emit();

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  async reply(convId: string, body: string, authorName: string, channel: Channel): Promise<void> {
    const conv = this.get(convId);
    if (conv) {
      // Create new message
      const message: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        conversationId: convId,
        direction: 'out',
        body,
        sentAt: new Date().toISOString(),
        authorName,
      };

      // Optimistic update
      if (!this.messages[convId]) {
        this.messages[convId] = [];
      }
      this.messages[convId].push(message);
      conv.lastMessageAt = message.sentAt;
      conv.unread = false;
      this.emit();

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  async snooze(convId: string, untilISO: string): Promise<void> {
    const conv = this.get(convId);
    if (conv) {
      // Optimistic update
      conv.status = 'snoozed';
      conv.slaDueAt = untilISO;
      this.emit();

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  async close(convId: string): Promise<void> {
    const conv = this.get(convId);
    if (conv) {
      // Optimistic update
      conv.status = 'closed';
      conv.unread = false;
      this.emit();

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  // Helper methods for dialogs
  getSDRs() {
    return SDRS;
  }

  getLeads() {
    return mockLeads;
  }
}

export const uniboxStore = new UniboxStore();
