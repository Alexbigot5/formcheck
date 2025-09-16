import { FastifyInstance } from 'fastify';
import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';
import { crmApiService } from '../../services/crm-api.service';
import { WebSocketMessage } from '../../plugins/websocket';

export async function registerWebSocketRoutes(app: FastifyInstance) {
  
  /**
   * POST /api/ws/broadcast - Broadcast message to team
   */
  app.post('/api/ws/broadcast', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const { type, data, targetTeam } = request.body as {
      type: string;
      data: any;
      targetTeam?: string;
    };
    const teamId = targetTeam || request.teamId;

    try {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: new Date().toISOString()
      };

      app.broadcastToTeam(teamId, message);

      return reply.send({
        success: true,
        message: 'Broadcast sent successfully'
      });
    } catch (error) {
      app.log.error('Broadcast error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send broadcast'
      });
    }
  });

  /**
   * POST /api/ws/lead-update - Notify team of lead updates
   */
  app.post('/api/ws/lead-update', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const { leadId, leadData, action } = request.body as {
      leadId: string;
      leadData: any;
      action: 'created' | 'updated' | 'deleted' | 'assigned';
    };
    const teamId = request.teamId;

    try {
      const message: WebSocketMessage = {
        type: 'lead_update',
        data: {
          leadId,
          leadData,
          action,
          teamId
        },
        timestamp: new Date().toISOString()
      };

      app.broadcastToSubscribers('lead_update', message);

      return reply.send({
        success: true,
        message: 'Lead update notification sent'
      });
    } catch (error) {
      app.log.error('Lead update broadcast error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send lead update notification'
      });
    }
  });

  /**
   * POST /api/ws/form-submission - Notify team of new form submissions
   */
  app.post('/api/ws/form-submission', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const { formId, submissionData, leadId } = request.body as {
      formId: string;
      submissionData: any;
      leadId?: string;
    };
    const teamId = request.teamId;

    try {
      const message: WebSocketMessage = {
        type: 'form_submission',
        data: {
          formId,
          submissionData,
          leadId,
          teamId
        },
        timestamp: new Date().toISOString()
      };

      app.broadcastToSubscribers('form_submission', message);

      // Also try to sync to CRM if integration is active
      try {
        const integration = await app.prisma.integration.findFirst({
          where: {
            teamId,
            kind: 'CRM',
            status: 'ACTIVE'
          }
        });

        if (integration && integration.config) {
          const config = integration.config as any;
          const provider = config.provider;
          
          if (config.syncSettings?.mode !== 'off') {
            const contactData = {
              email: submissionData.email,
              firstName: submissionData.firstName || submissionData.first_name,
              lastName: submissionData.lastName || submissionData.last_name,
              company: submissionData.company,
              phone: submissionData.phone,
              customFields: submissionData
            };

            const syncResult = await crmApiService.syncContactToCRM(
              app,
              teamId,
              provider,
              contactData,
              process.env.SECRET_VAULT_KEY!
            );

            if (syncResult.success) {
              // Notify about successful CRM sync
              const crmMessage: WebSocketMessage = {
                type: 'crm_sync',
                data: {
                  provider,
                  action: syncResult.action,
                  contactId: syncResult.contactId,
                  leadId,
                  success: true,
                  message: syncResult.message
                },
                timestamp: new Date().toISOString()
              };

              app.broadcastToSubscribers('crm_sync', crmMessage);
            }
          }
        }
      } catch (crmError) {
        app.log.error('CRM sync error during form submission:', crmError);
        // Don't fail the main operation, just log the error
      }

      return reply.send({
        success: true,
        message: 'Form submission notification sent'
      });
    } catch (error) {
      app.log.error('Form submission broadcast error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send form submission notification'
      });
    }
  });

  /**
   * POST /api/ws/crm-sync - Notify team of CRM sync events
   */
  app.post('/api/ws/crm-sync', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const { provider, action, contactId, leadId, success, message, errors } = request.body as {
      provider: string;
      action: string;
      contactId?: string;
      leadId?: string;
      success: boolean;
      message: string;
      errors?: string[];
    };
    const teamId = request.teamId;

    try {
      const wsMessage: WebSocketMessage = {
        type: 'crm_sync',
        data: {
          provider,
          action,
          contactId,
          leadId,
          success,
          message,
          errors,
          teamId
        },
        timestamp: new Date().toISOString()
      };

      app.broadcastToSubscribers('crm_sync', wsMessage);

      return reply.send({
        success: true,
        message: 'CRM sync notification sent'
      });
    } catch (error) {
      app.log.error('CRM sync broadcast error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send CRM sync notification'
      });
    }
  });

  /**
   * POST /api/ws/analytics-update - Notify team of analytics updates
   */
  app.post('/api/ws/analytics-update', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const { analyticsData, type: updateType } = request.body as {
      analyticsData: any;
      type: 'dashboard' | 'realtime' | 'summary';
    };
    const teamId = request.teamId;

    try {
      const message: WebSocketMessage = {
        type: 'analytics_update',
        data: {
          analyticsData,
          updateType,
          teamId
        },
        timestamp: new Date().toISOString()
      };

      app.broadcastToSubscribers('analytics_update', message);

      return reply.send({
        success: true,
        message: 'Analytics update notification sent'
      });
    } catch (error) {
      app.log.error('Analytics update broadcast error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send analytics update notification'
      });
    }
  });

  /**
   * GET /api/ws/connections - Get active WebSocket connections info (admin)
   */
  app.get('/api/ws/connections', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const teamId = request.teamId;

    try {
      // This is a simplified version - in a real implementation,
      // you'd want to track connections properly
      return reply.send({
        success: true,
        data: {
          teamId,
          message: 'WebSocket connection info would be here',
          // In real implementation, return connection stats
          activeConnections: 0,
          lastActivity: new Date().toISOString()
        }
      });
    } catch (error) {
      app.log.error('WebSocket connections info error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get connection info'
      });
    }
  });
}
