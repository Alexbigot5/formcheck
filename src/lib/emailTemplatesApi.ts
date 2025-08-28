import apiClient from './apiClient';

// Types for email templates
export interface EmailTemplate {
  id: string;
  name: string;
  segment: 'hot' | 'warm' | 'cold';
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  performance?: {
    openRate: number;
    replyRate: number;
    clickRate: number;
    sent: number;
  };
}

export interface LeadData {
  name?: string;
  email?: string;
  company?: string;
  score?: number;
  channel?: string;
  campaign?: string;
  jobRole?: string;
  responseSummary?: string;
}

export interface CompiledTemplate {
  subject: string;
  body: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId: string;
  to: string;
  subject: string;
  scheduledFor: string;
  dryRun: boolean;
  message: string;
}

export interface TemplatePerformance {
  templateId: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  lastSent: string;
}

// Email Templates API functions
export const emailTemplatesApi = {
  // GET /api/email-templates - Get all templates
  async getTemplates(): Promise<{ templates: EmailTemplate[] }> {
    const response = await apiClient.get('/api/email-templates');
    return response.data;
  },

  // POST /api/email-templates - Create template
  async createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'performance'>): Promise<{
    template: EmailTemplate;
    message: string;
  }> {
    const response = await apiClient.post('/api/email-templates', template);
    return response.data;
  },

  // PUT /api/email-templates/:id - Update template
  async updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<{
    template: EmailTemplate;
    message: string;
  }> {
    const response = await apiClient.put(`/api/email-templates/${id}`, updates);
    return response.data;
  },

  // DELETE /api/email-templates/:id - Delete template
  async deleteTemplate(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/email-templates/${id}`);
    return response.data;
  },

  // POST /api/email-templates/compile - Compile template with lead data
  async compileTemplate(params: {
    templateId?: string;
    subject?: string;
    body?: string;
    leadData: LeadData;
  }): Promise<{
    compiled: CompiledTemplate;
    variables: string[];
    leadData: LeadData;
  }> {
    const response = await apiClient.post('/api/email-templates/compile', params);
    return response.data;
  },

  // POST /api/email-templates/send - Send email using template
  async sendEmail(params: {
    templateId: string;
    leadId: string;
    sendAt?: string;
    dryRun?: boolean;
  }): Promise<EmailSendResult> {
    const response = await apiClient.post('/api/email-templates/send', params);
    return response.data;
  },

  // GET /api/email-templates/:id/performance - Get template performance
  async getTemplatePerformance(id: string): Promise<{ performance: TemplatePerformance }> {
    const response = await apiClient.get(`/api/email-templates/${id}/performance`);
    return response.data;
  }
};

// Helper functions
export const emailTemplateHelpers = {
  // Get available template variables
  getAvailableVariables(): { name: string; description: string; example: string }[] {
    return [
      { name: '{{lead.name}}', description: 'Lead\'s name', example: 'John Smith' },
      { name: '{{lead.email}}', description: 'Lead\'s email', example: 'john@company.com' },
      { name: '{{lead.company}}', description: 'Lead\'s company', example: 'Acme Corp' },
      { name: '{{lead.jobRole}}', description: 'Lead\'s job role', example: 'Marketing Director' },
      { name: '{{score}}', description: 'Lead score', example: '85' },
      { name: '{{channel}}', description: 'Traffic source', example: 'LinkedIn' },
      { name: '{{campaign}}', description: 'Campaign name', example: 'Q4 Product Launch' },
      { name: '{{lead.responseSummary}}', description: 'Lead response summary', example: 'Interested in enterprise features' }
    ];
  },

  // Extract variables from template string
  extractVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  },

  // Get default templates for each segment
  getDefaultTemplates(): Record<'hot' | 'warm' | 'cold', Omit<EmailTemplate, 'id' | 'createdAt'>> {
    return {
      hot: {
        name: 'Hot Lead Follow-up',
        segment: 'hot',
        subject: '{{lead.name}}, let\'s discuss your {{campaign}} interest (Score: {{score}})',
        body: 'Hi {{lead.name}},\n\nI noticed you came from our {{channel}} {{campaign}} and scored {{score}} - that tells me you\'re serious about finding a solution!\n\nGiven your role ({{lead.jobRole}}), I\'d love to schedule a quick 15-minute call to discuss your specific needs.\n\nWhen works better for you - this afternoon or tomorrow morning?\n\nBest,\nYour Sales Team',
        variables: ['lead.name', 'campaign', 'score', 'channel', 'lead.jobRole'],
        isActive: true
      },
      warm: {
        name: 'Warm Lead Nurture',
        segment: 'warm',
        subject: '{{lead.name}}, resources for {{campaign}} from {{channel}}',
        body: 'Hi {{lead.name}},\n\nThanks for your interest through our {{channel}} {{campaign}}! With a score of {{score}}, I can see you\'re evaluating options.\n\nI\'ve put together some resources specifically for {{lead.jobRole}} professionals that might be helpful:\n\n• Industry benchmark report\n• ROI calculator\n• Case study from similar companies\n\nWould you like me to send these over?\n\nBest,\nYour Team',
        variables: ['lead.name', 'campaign', 'channel', 'score', 'lead.jobRole'],
        isActive: true
      },
      cold: {
        name: 'Cold Lead Welcome',
        segment: 'cold',
        subject: 'Welcome {{lead.name}} - staying connected after {{campaign}}',
        body: 'Hi {{lead.name}},\n\nThanks for checking out our {{campaign}} on {{channel}}. While your current score is {{score}}, I know timing isn\'t always right.\n\nI\'ll add you to our newsletter for {{lead.jobRole}} professionals so you can stay updated on industry trends and our latest features.\n\nFeel free to reach out when you\'re ready to explore further!\n\nBest,\nYour Team',
        variables: ['lead.name', 'campaign', 'channel', 'score', 'lead.jobRole'],
        isActive: true
      }
    };
  },

  // Calculate template effectiveness score
  calculateEffectivenessScore(performance: TemplatePerformance): number {
    const openWeight = 0.3;
    const clickWeight = 0.4;
    const replyWeight = 0.3;
    
    return Math.round(
      (performance.openRate * openWeight + 
       performance.clickRate * clickWeight + 
       performance.replyRate * replyWeight) * 100
    ) / 100;
  }
};
