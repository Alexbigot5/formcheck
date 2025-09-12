import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { FastifyInstance } from 'fastify';
import { loadEnv } from '../../config/env';
import { parseEmailToLead } from './email.parser';
import { deduplicateLead } from '../dedupe/index';
import { applyScoring, getScoringConfig, getScoringRules, initializeDefaultScoringConfig } from '../scoring/index';
import { routeLead, getRoutingRules, initializeDefaultRoutingRules } from '../routing/index';
import { enrichLead } from './enrichment';

export interface EmailListenerConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  teamId: string;
  integrationId: string;
}

export class EmailListener {
  private client: ImapFlow | null = null;
  private isConnected = false;
  private isListening = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds

  constructor(
    private app: FastifyInstance,
    private config: EmailListenerConfig
  ) {}

  /**
   * Start IMAP listener
   */
  async start(): Promise<void> {
    try {
      this.app.log.info('Starting IMAP email listener', {
        host: this.config.host,
        user: this.config.auth.user,
        teamId: this.config.teamId
      });

      await this.connect();
      await this.startListening();

    } catch (error) {
      this.app.log.error('Failed to start IMAP listener:', error);
      await this.scheduleReconnect();
    }
  }

  /**
   * Stop IMAP listener
   */
  async stop(): Promise<void> {
    this.isListening = false;
    
    if (this.client) {
      try {
        await this.client.logout();
        this.app.log.info('IMAP listener stopped');
      } catch (error) {
        this.app.log.error('Error stopping IMAP listener:', error);
      }
    }
    
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Connect to IMAP server
   */
  private async connect(): Promise<void> {
    this.client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
      logger: false // Disable imapflow logging to avoid noise
    });

    // Set up event handlers
    this.client.on('error', (error) => {
      this.app.log.error('IMAP connection error:', error);
      this.handleConnectionError(error);
    });

    this.client.on('close', () => {
      this.app.log.warn('IMAP connection closed');
      this.isConnected = false;
      if (this.isListening) {
        this.scheduleReconnect();
      }
    });

    // Connect to server
    await this.client.connect();
    this.isConnected = true;
    this.reconnectAttempts = 0;

    this.app.log.info('Connected to IMAP server', {
      host: this.config.host,
      user: this.config.auth.user
    });

    // Update integration status
    await this.updateIntegrationStatus('CONNECTED');
  }

  /**
   * Start listening for new emails
   */
  private async startListening(): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('IMAP client not connected');
    }

    this.isListening = true;

    // Select INBOX
    const lock = await this.client.getMailboxLock('INBOX');
    
    try {
      this.app.log.info('Starting IMAP IDLE listener on INBOX');

      // Set up IDLE listener for new messages
      this.client.on('exists', async (data) => {
        if (!this.isListening) return;

        this.app.log.debug('New email detected', { count: data.count });
        await this.processNewEmails();
      });

      // Start IDLE
      await this.client.idle();

    } finally {
      lock.release();
    }
  }

  /**
   * Process new emails in the inbox
   */
  private async processNewEmails(): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      // Get unseen messages
      const messages = this.client.fetch('UNSEEN', {
        envelope: true,
        source: true,
        flags: true
      });

      for await (const message of messages) {
        try {
          await this.processEmail(message);
          
          // Mark as seen after processing
          await this.client.messageFlagsAdd(message.seq, ['\\Seen']);
          
        } catch (error) {
          this.app.log.error('Failed to process email:', error, {
            messageId: message.envelope?.messageId,
            from: message.envelope?.from?.[0]?.address
          });
        }
      }

      // Update integration last seen time
      await this.updateIntegrationLastSeen();

    } catch (error) {
      this.app.log.error('Failed to process new emails:', error);
    }
  }

  /**
   * Process a single email message
   */
  private async processEmail(message: any): Promise<void> {
    const messageId = message.envelope?.messageId || `msg_${Date.now()}`;
    
    this.app.log.info('Processing email', {
      messageId,
      from: message.envelope?.from?.[0]?.address,
      subject: message.envelope?.subject
    });

    try {
      // Parse email content
      const parsed = await simpleParser(message.source);
      
      // Extract lead data from email
      const leadData = await parseEmailToLead(parsed, this.config.teamId);
      
      if (!leadData) {
        this.app.log.debug('No lead data extracted from email', { messageId });
        return;
      }

      this.app.log.debug('Lead data extracted from email', {
        messageId,
        email: leadData.email,
        name: leadData.name,
        company: leadData.company
      });

      // Step 1: Enrichment
      const enrichedLead = await enrichLead(this.app, leadData, this.config.teamId);

      // Step 2: Scoring
      let config = await getScoringConfig(this.app, this.config.teamId);
      let rules = await getScoringRules(this.app, this.config.teamId);

      if (!config) {
        const initialized = await initializeDefaultScoringConfig(this.app, this.config.teamId, 'system');
        config = initialized.config;
        rules = initialized.rules;
      }

      const scoringResult = await applyScoring(this.app, enrichedLead, config, rules);

      // Update lead with scoring results
      const scoredLead = {
        ...enrichedLead,
        score: scoringResult.score,
        scoreBand: scoringResult.band
      };

      // Step 3: Deduplication
      const dedupeResult = await deduplicateLead(this.app, scoredLead, this.config.teamId);

      // Step 4: Routing (only for new leads)
      let routingResult = null;
      let slaTargetAt: string | null = null;

      if (dedupeResult.action === 'created') {
        let routingRules = await getRoutingRules(this.app, this.config.teamId);
        
        if (routingRules.length === 0) {
          routingRules = await initializeDefaultRoutingRules(this.app, this.config.teamId);
        }

        routingResult = await routeLead(this.app, scoredLead, routingRules);

        // Update lead with routing assignment
        if (routingResult.ownerId) {
          await this.app.prisma.lead.update({
            where: { id: dedupeResult.leadId },
            data: { ownerId: routingResult.ownerId }
          });
        }

        // Step 5: SLA Management
        if (routingResult.sla) {
          const slaTarget = new Date(Date.now() + routingResult.sla * 60 * 1000);
          slaTargetAt = slaTarget.toISOString();

          await this.app.prisma.sLAClock.create({
            data: {
              leadId: dedupeResult.leadId,
              targetAt: slaTarget
            }
          });
        }
      }

      // Step 6: Save email as Message
      const emailMessage = await this.saveEmailMessage(
        dedupeResult.leadId,
        parsed,
        message.envelope,
        messageId
      );

      // Step 7: Save Timeline Events
      await this.saveEmailTimelineEvents(
        dedupeResult.leadId,
        {
          action: dedupeResult.action,
          scoring: scoringResult,
          routing: routingResult,
          enrichment: enrichedLead,
          messageId: emailMessage.id,
          emailSubject: parsed.subject || 'No Subject'
        }
      );

      this.app.log.info('Email processed successfully', {
        messageId,
        leadId: dedupeResult.leadId,
        action: dedupeResult.action,
        score: scoringResult.score,
        band: scoringResult.band,
        ownerId: routingResult?.ownerId
      });

    } catch (error) {
      this.app.log.error('Email processing failed:', error, { messageId });
      throw error;
    }
  }

  /**
   * Save email as Message record
   */
  private async saveEmailMessage(
    leadId: string,
    parsed: any,
    envelope: any,
    messageId: string
  ): Promise<any> {
    const message = await this.app.prisma.message.create({
      data: {
        leadId,
        direction: 'IN',
        channel: 'EMAIL',
        subject: parsed.subject || 'No Subject',
        body: parsed.text || parsed.html || '',
        meta: {
          messageId,
          from: envelope?.from?.[0],
          to: envelope?.to?.[0],
          date: envelope?.date?.toISOString(),
          headers: parsed.headers,
          attachments: parsed.attachments?.map((att: any) => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size
          })) || [],
          source: 'imap',
          integrationId: this.config.integrationId
        }
      }
    });

    return message;
  }

  /**
   * Save timeline events for email processing
   */
  private async saveEmailTimelineEvents(
    leadId: string,
    data: {
      action: string;
      scoring: any;
      routing: any;
      enrichment: any;
      messageId: string;
      emailSubject: string;
    }
  ): Promise<void> {
    // Email received event
    await this.app.prisma.timelineEvent.create({
      data: {
        leadId,
        type: 'EMAIL_RECEIVED',
        payload: {
          action: 'email_received',
          subject: data.emailSubject,
          messageId: data.messageId,
          enrichment: data.enrichment,
          source: 'imap'
        }
      }
    });

    // Scoring event
    await this.app.prisma.timelineEvent.create({
      data: {
        leadId,
        type: 'SCORE_UPDATED',
        payload: {
          action: 'email_scoring',
          score: data.scoring.score,
          band: data.scoring.band,
          tags: data.scoring.tags,
          trace: data.scoring.trace
        }
      }
    });

    // Routing event (only for new leads)
    if (data.action === 'created' && data.routing) {
      await this.app.prisma.timelineEvent.create({
        data: {
          leadId,
          type: 'SCORE_UPDATED', // Using existing enum value
          payload: {
            action: 'email_routing',
            ownerId: data.routing.ownerId,
            pool: data.routing.pool,
            reason: data.routing.reason,
            trace: data.routing.trace,
            alerts: data.routing.alerts,
            sla: data.routing.sla
          }
        }
      });
    }
  }

  /**
   * Update integration status
   */
  private async updateIntegrationStatus(status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'): Promise<void> {
    try {
      await this.app.prisma.integration.update({
        where: { id: this.config.integrationId },
        data: { 
          status,
          error: status === 'ERROR' ? 'Connection failed' : null
        }
      });
    } catch (error) {
      this.app.log.error('Failed to update integration status:', error);
    }
  }

  /**
   * Update integration last seen time
   */
  private async updateIntegrationLastSeen(): Promise<void> {
    try {
      await this.app.prisma.integration.update({
        where: { id: this.config.integrationId },
        data: { lastSeenAt: new Date() }
      });
    } catch (error) {
      this.app.log.error('Failed to update integration lastSeenAt:', error);
    }
  }

  /**
   * Handle connection errors
   */
  private async handleConnectionError(error: Error): Promise<void> {
    this.isConnected = false;
    
    await this.updateIntegrationStatus('ERROR');
    
    if (this.isListening) {
      await this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.app.log.error('Max reconnection attempts reached, stopping IMAP listener');
      this.isListening = false;
      await this.updateIntegrationStatus('ERROR');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    this.app.log.info(`Scheduling IMAP reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      if (this.isListening) {
        try {
          await this.start();
        } catch (error) {
          this.app.log.error('Reconnection attempt failed:', error);
        }
      }
    }, delay);
  }

  /**
   * Manual sync for testing
   */
  async manualSync(): Promise<{
    processed: number;
    errors: number;
    messages: Array<{ messageId: string; leadId?: string; error?: string }>;
  }> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    const result = {
      processed: 0,
      errors: 0,
      messages: [] as Array<{ messageId: string; leadId?: string; error?: string }>
    };

    try {
      // Get recent unseen messages (last 10)
      const messages = this.client!.fetch('UNSEEN', {
        envelope: true,
        source: true,
        flags: true
      });

      let count = 0;
      for await (const message of messages) {
        if (count >= 10) break; // Limit for manual sync
        count++;

        const messageId = message.envelope?.messageId || `msg_${Date.now()}_${count}`;
        
        try {
          await this.processEmail(message);
          
          // Mark as seen
          await this.client!.messageFlagsAdd(message.seq, ['\\Seen']);
          
          result.processed++;
          result.messages.push({ messageId, leadId: 'processed' });
          
        } catch (error) {
          result.errors++;
          result.messages.push({ 
            messageId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      // Update integration last seen time
      await this.updateIntegrationLastSeen();

    } catch (error) {
      this.app.log.error('Manual sync failed:', error);
      throw error;
    }

    return result;
  }
}

/**
 * Email listener manager
 */
export class EmailListenerManager {
  private listeners = new Map<string, EmailListener>();

  constructor(private app: FastifyInstance) {}

  /**
   * Start email listeners for all configured teams
   */
  async startAllListeners(): Promise<void> {
    const env = loadEnv();
    if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASS) {
      this.app.log.info('IMAP configuration not found, skipping email listeners');
      return;
    }

    try {
      // Get all INBOX integrations
      const integrations = await this.app.prisma.integration.findMany({
        where: { 
          kind: 'INBOX',
          status: { not: 'DISCONNECTED' }
        }
      });

      for (const integration of integrations) {
        await this.startListener(integration);
      }

      this.app.log.info(`Started ${this.listeners.size} email listeners`);

    } catch (error) {
      this.app.log.error('Failed to start email listeners:', error);
    }
  }

  /**
   * Start listener for specific integration
   */
  async startListener(integration: any): Promise<void> {
    const env = loadEnv();
    const config: EmailListenerConfig = {
      host: env.IMAP_HOST!,
      port: env.IMAP_PORT || 993,
      secure: env.IMAP_SECURE !== 'false',
      auth: {
        user: env.IMAP_USER!,
        pass: env.IMAP_PASS!
      },
      teamId: integration.teamId,
      integrationId: integration.id
    };

    const listener = new EmailListener(this.app, config);
    
    try {
      await listener.start();
      this.listeners.set(integration.id, listener);
      
      this.app.log.info('Email listener started', {
        integrationId: integration.id,
        teamId: integration.teamId
      });
      
    } catch (error) {
      this.app.log.error('Failed to start email listener:', error, {
        integrationId: integration.id
      });
    }
  }

  /**
   * Stop all listeners
   */
  async stopAllListeners(): Promise<void> {
    for (const [id, listener] of this.listeners) {
      try {
        await listener.stop();
        this.app.log.info('Email listener stopped', { integrationId: id });
      } catch (error) {
        this.app.log.error('Failed to stop email listener:', error, { integrationId: id });
      }
    }
    
    this.listeners.clear();
  }

  /**
   * Get listener for integration
   */
  getListener(integrationId: string): EmailListener | undefined {
    return this.listeners.get(integrationId);
  }

  /**
   * Manual sync for integration
   */
  async manualSync(integrationId: string): Promise<any> {
    const listener = this.listeners.get(integrationId);
    if (!listener) {
      throw new Error('Email listener not found for integration');
    }

    return await listener.manualSync();
  }
}
