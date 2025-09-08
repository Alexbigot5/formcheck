import { toast } from "sonner";

export interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string;
  jobRole?: string;
  score: number;
  scoreBand: 'LOW' | 'MEDIUM' | 'HIGH';
  channel?: string;
  campaign?: string;
  responseSummary?: string;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  segment: 'hot' | 'warm' | 'cold';
  subject: string;
  body: string;
  variables: string[];
}

export interface SendEmailOptions {
  templateId?: string;
  subject: string;
  body: string;
  segment: 'hot' | 'warm' | 'cold';
  dryRun?: boolean;
  scheduleAt?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  scheduledFor?: string;
  dryRun?: boolean;
}

// Mock email service - in production this would connect to a real email service
export class EmailSender {
  private static instance: EmailSender;

  static getInstance(): EmailSender {
    if (!EmailSender.instance) {
      EmailSender.instance = new EmailSender();
    }
    return EmailSender.instance;
  }

  async sendEmailToLead(
    lead: Lead, 
    options: SendEmailOptions
  ): Promise<EmailSendResult> {
    try {
      // Validate lead has email
      if (!lead.email) {
        throw new Error('Lead does not have an email address');
      }

      // Replace template variables
      const compiledSubject = this.compileTemplate(options.subject, lead);
      const compiledBody = this.compileTemplate(options.body, lead);

      // Simulate API call to email service
      await new Promise(resolve => setTimeout(resolve, 1000));

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const scheduledFor = options.scheduleAt || new Date().toISOString();

      // Mock success/failure (95% success rate)
      const success = Math.random() > 0.05;

      if (!success) {
        throw new Error('Email service temporarily unavailable');
      }

      const result: EmailSendResult = {
        success: true,
        messageId,
        scheduledFor,
        dryRun: options.dryRun || false
      };

      // Log email activity (in production, this would go to analytics)
      console.log('Email sent:', {
        leadId: lead.id,
        leadEmail: lead.email,
        segment: options.segment,
        subject: compiledSubject,
        messageId,
        dryRun: options.dryRun
      });

      return result;

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  }

  async sendBulkEmails(
    leads: Lead[], 
    options: SendEmailOptions
  ): Promise<{ results: EmailSendResult[]; summary: { sent: number; failed: number; total: number } }> {
    const results: EmailSendResult[] = [];
    let sent = 0;
    let failed = 0;

    // Filter leads by segment based on score
    const filteredLeads = this.filterLeadsBySegment(leads, options.segment);

    for (const lead of filteredLeads) {
      try {
        const result = await this.sendEmailToLead(lead, options);
        results.push(result);
        
        if (result.success) {
          sent++;
        } else {
          failed++;
        }

        // Add small delay to prevent overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failed++;
      }
    }

    return {
      results,
      summary: {
        sent,
        failed,
        total: filteredLeads.length
      }
    };
  }

  private filterLeadsBySegment(leads: Lead[], segment: 'hot' | 'warm' | 'cold'): Lead[] {
    return leads.filter(lead => {
      switch (segment) {
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
  }

  private compileTemplate(template: string, lead: Lead): string {
    const variables: Record<string, string> = {
      '{{lead.name}}': lead.name || 'there',
      '{{lead.email}}': lead.email,
      '{{lead.company}}': lead.company || 'your company',
      '{{lead.jobRole}}': lead.jobRole || 'professional',
      '{{lead.responseSummary}}': lead.responseSummary || 'your inquiry',
      '{{score}}': lead.score.toString(),
      '{{scoreBand}}': lead.scoreBand,
      '{{channel}}': lead.channel || 'our website',
      '{{campaign}}': lead.campaign || 'campaign',
      '{{date}}': new Date().toLocaleDateString(),
      '{{time}}': new Date().toLocaleTimeString(),
    };

    let compiled = template;
    Object.entries(variables).forEach(([placeholder, value]) => {
      compiled = compiled.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    return compiled;
  }

  // Get available template variables
  getAvailableVariables(): { name: string; description: string; example: string }[] {
    return [
      { name: '{{lead.name}}', description: 'Lead\'s name', example: 'John Smith' },
      { name: '{{lead.email}}', description: 'Lead\'s email', example: 'john@example.com' },
      { name: '{{lead.company}}', description: 'Lead\'s company', example: 'Acme Corp' },
      { name: '{{lead.jobRole}}', description: 'Lead\'s job role', example: 'Marketing Manager' },
      { name: '{{score}}', description: 'Lead score', example: '85' },
      { name: '{{scoreBand}}', description: 'Score band', example: 'HIGH' },
      { name: '{{channel}}', description: 'Source channel', example: 'LinkedIn' },
      { name: '{{campaign}}', description: 'Campaign name', example: 'Q4 Product Launch' },
      { name: '{{date}}', description: 'Current date', example: '1/15/2024' },
      { name: '{{time}}', description: 'Current time', example: '2:30 PM' },
    ];
  }

  // Preview compiled template
  previewTemplate(template: string, sampleLead?: Partial<Lead>): string {
    const defaultLead: Lead = {
      id: 'sample',
      name: 'John Smith',
      email: 'john@example.com',
      company: 'Acme Corp',
      jobRole: 'Marketing Manager',
      score: 85,
      scoreBand: 'HIGH',
      channel: 'LinkedIn',
      campaign: 'Q4 Product Launch',
      responseSummary: 'Interested in our enterprise solution',
      createdAt: new Date().toISOString(),
      ...sampleLead
    };

    return this.compileTemplate(template, defaultLead);
  }
}
