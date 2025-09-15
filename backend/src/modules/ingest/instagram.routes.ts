import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';
import { NormalizedLead } from './normalizer';
import { deduplicateLead } from '../dedupe/index';
import { applyScoring, getScoringConfig, getScoringRules, initializeDefaultScoringConfig } from '../scoring/index';
import { routeLead, getRoutingRules, initializeDefaultRoutingRules } from '../routing/index';
import { enrichLead } from './enrichment';

// Instagram DM payload schema
const instagramDmSchema = z.object({
  // Core message data
  messageId: z.string(),
  conversationId: z.string(),
  timestamp: z.string().or(z.number()),
  
  // Sender information
  sender: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string().optional(),
    profilePicture: z.string().url().optional(),
    isVerified: z.boolean().optional(),
    followerCount: z.number().optional(),
    followingCount: z.number().optional(),
    postCount: z.number().optional(),
    bio: z.string().optional(),
    website: z.string().optional(),
    businessCategory: z.string().optional()
  }),
  
  // Message content
  message: z.object({
    text: z.string().optional(),
    type: z.enum(['text', 'image', 'video', 'audio', 'story_reply', 'post_share']).default('text'),
    attachments: z.array(z.object({
      type: z.string(),
      url: z.string().url(),
      thumbnail: z.string().url().optional(),
      size: z.number().optional(),
      duration: z.number().optional()
    })).optional()
  }),
  
  // Context
  isFirstMessage: z.boolean().optional(),
  replyToStory: z.boolean().optional(),
  sharedPost: z.object({
    id: z.string(),
    url: z.string().url(),
    caption: z.string().optional()
  }).optional(),
  
  // Metadata
  source: z.string().default('instagram_dm'),
  integrationId: z.string().optional()
});

type InstagramDmPayload = z.infer<typeof instagramDmSchema>;

export async function registerInstagramRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  // Note: Authentication is applied per route using preHandler option

  /**
   * POST /ingest/instagram/test - Process Instagram DM payload
   */
  app.post('/ingest/instagram/test', { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const dmPayload = request.body as InstagramDmPayload;
    const teamId = (request as any).teamId;

    try {
      app.log.info('Processing Instagram DM', {
        messageId: dmPayload.messageId,
        username: dmPayload.sender.username,
        teamId
      });

      // Step 1: Convert Instagram DM to normalized lead
      const leadData = mapInstagramDmToLead(dmPayload, teamId);

      app.log.debug('Lead data extracted from Instagram DM', {
        username: dmPayload.sender.username,
        displayName: leadData.name,
        hasWebsite: !!leadData.fields.website,
        messageType: dmPayload.message.type
      });

      // Step 2: Enrichment
      const enrichedLead = await enrichLead(app, leadData, teamId);

      // Step 3: Scoring
      let scoringConfig = await getScoringConfig(app, teamId);
      let scoringRules = await getScoringRules(app, teamId);

      if (!scoringConfig) {
        const initialized = await initializeDefaultScoringConfig(app, teamId, 'system');
        scoringConfig = initialized.config;
        scoringRules = initialized.rules;
      }

      const scoringResult = await applyScoring(app, enrichedLead, scoringConfig, scoringRules);

      // Update lead with scoring results
      const scoredLead = {
        ...enrichedLead,
        score: scoringResult.score,
        scoreBand: scoringResult.band
      };

      // Step 4: Deduplication
      const dedupeResult = await deduplicateLead(app, scoredLead, teamId);

      // Step 5: Routing (only for new leads)
      let routingResult = null;
      let slaTargetAt: string | null = null;

      if (dedupeResult.action === 'created') {
        let routingRules = await getRoutingRules(app, teamId);
        
        if (routingRules.length === 0) {
          routingRules = await initializeDefaultRoutingRules(app, teamId);
        }

        routingResult = await routeLead(app, scoredLead, routingRules, teamId);

        // Update lead with routing assignment
        if (routingResult.ownerId) {
          await app.prisma.lead.update({
            where: { id: dedupeResult.leadId },
            data: { ownerId: routingResult.ownerId }
          });
        }

        // Create SLA clock if needed
        if (routingResult.sla) {
          const slaTarget = new Date(Date.now() + routingResult.sla * 60 * 1000);
          slaTargetAt = slaTarget.toISOString();

          await app.prisma.sLAClock.create({
            data: {
              leadId: dedupeResult.leadId,
              targetAt: slaTarget
            }
          });
        }
      }

      // Step 6: Save Instagram DM as Message
      const dmMessage = await app.prisma.message.create({
        data: {
          leadId: dedupeResult.leadId,
          direction: 'IN',
          channel: 'DM',
          subject: `Instagram DM from @${dmPayload.sender.username}`,
          body: dmPayload.message.text || `[${dmPayload.message.type} message]`,
          meta: {
            messageId: dmPayload.messageId,
            conversationId: dmPayload.conversationId,
            sender: dmPayload.sender,
            messageType: dmPayload.message.type,
            attachments: dmPayload.message.attachments || [],
            isFirstMessage: dmPayload.isFirstMessage,
            replyToStory: dmPayload.replyToStory,
            sharedPost: dmPayload.sharedPost,
            source: 'instagram_dm',
            integrationId: dmPayload.integrationId,
            timestamp: dmPayload.timestamp
          }
        }
      });

      // Step 7: Save Timeline Events
      await Promise.all([
        // DM received event
        app.prisma.timelineEvent.create({
          data: {
            leadId: dedupeResult.leadId,
            type: 'EMAIL_RECEIVED', // Reusing existing enum value
            payload: {
              action: 'instagram_dm_received',
              messageId: dmPayload.messageId,
              username: dmPayload.sender.username,
              messageType: dmPayload.message.type,
              isFirstMessage: dmPayload.isFirstMessage,
              enrichment: JSON.parse(JSON.stringify(enrichedLead)),
              source: 'instagram_dm'
            }
          }
        }),

        // Scoring event
        app.prisma.timelineEvent.create({
          data: {
            leadId: dedupeResult.leadId,
            type: 'SCORE_UPDATED',
            payload: {
              action: 'instagram_dm_scoring',
              score: scoringResult.score,
              band: scoringResult.band,
              tags: scoringResult.tags,
              trace: JSON.parse(JSON.stringify(scoringResult.trace))
            }
          }
        }),

        // Routing event (only for new leads)
        ...(dedupeResult.action === 'created' && routingResult ? [
          app.prisma.timelineEvent.create({
            data: {
              leadId: dedupeResult.leadId,
              type: 'SCORE_UPDATED', // Reusing existing enum value
              payload: {
                action: 'instagram_dm_routing',
                ownerId: routingResult.ownerId,
                pool: routingResult.pool,
                reason: routingResult.reason,
                trace: routingResult.trace,
                alerts: routingResult.alerts,
                sla: routingResult.sla
              }
            }
          })
        ] : [])
      ]);

      // Update integration last seen if provided
      if (dmPayload.integrationId) {
        await app.prisma.integration.update({
          where: { id: dmPayload.integrationId },
          data: { lastSeenAt: new Date() }
        });
      }

      const response = {
        success: true,
        leadId: dedupeResult.leadId,
        messageId: dmMessage.id,
        action: dedupeResult.action,
        duplicateId: dedupeResult.duplicateId,
        score: scoringResult.score,
        band: scoringResult.band,
        tags: scoringResult.tags,
        ownerId: routingResult?.ownerId,
        pool: routingResult?.pool,
        sla: slaTargetAt ? {
          targetAt: slaTargetAt,
          minutes: routingResult?.sla || 0
        } : undefined,
        message: `Instagram DM from @${dmPayload.sender.username} processed successfully`,
        trace: {
          enrichment: [], // Would be populated by enrichment module
          scoring: scoringResult.trace,
          routing: routingResult?.trace || []
        }
      };

      app.log.info('Instagram DM processed successfully', {
        messageId: dmPayload.messageId,
        leadId: dedupeResult.leadId,
        action: dedupeResult.action,
        score: scoringResult.score,
        band: scoringResult.band,
        ownerId: routingResult?.ownerId
      });

      return reply.send(response);

    } catch (error) {
      app.log.error('Instagram DM processing failed:', error);
      return reply.code(500).send({ 
        error: 'Instagram DM processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /ingest/instagram/recent - Get recent Instagram DMs
   */
  app.get('/ingest/instagram/recent', { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { limit, integrationId } = request.query as { limit: number; integrationId?: string };
    const teamId = (request as any).teamId;

    try {
      const where: any = {
        channel: 'DM',
        direction: 'IN',
        lead: { teamId }
      };

      if (integrationId) {
        where['meta.integrationId'] = integrationId;
      }

      const [messages, total] = await Promise.all([
        app.prisma.message.findMany({
          where,
          include: {
            lead: {
              select: {
                name: true,
                company: true,
                score: true,
                scoreBand: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit
        }),
        app.prisma.message.count({ where })
      ]);

      const formattedMessages = messages.map(msg => {
        const meta = msg.meta as any;
        return {
          id: msg.id,
          leadId: msg.leadId,
          username: meta?.sender?.username || 'Unknown',
          displayName: meta?.sender?.displayName,
          messageType: meta?.messageType || 'text',
          text: msg.body,
          createdAt: msg.createdAt.toISOString(),
          lead: msg.lead
        };
      });

      return reply.send({
        messages: formattedMessages,
        total
      });

    } catch (error) {
      app.log.error('Failed to get recent Instagram DMs:', error);
      return reply.code(500).send({ 
        error: 'Failed to get recent Instagram DMs' 
      });
    }
  });
}

/**
 * Map Instagram DM payload to normalized lead data
 */
function mapInstagramDmToLead(dmPayload: InstagramDmPayload, teamId: string): NormalizedLead {
  const { sender, message } = dmPayload;

  const leadData: NormalizedLead = {
    source: 'instagram_dm',
    sourceRef: dmPayload.messageId,
    fields: {},
    utm: {}
  };

  // Extract lead information from Instagram profile
  leadData.name = sender.displayName || sender.username;

  // Try to extract email from bio or website
  leadData.email = extractEmailFromBio(sender.bio);
  
  // Try to extract company from bio
  leadData.company = extractCompanyFromBio(sender.bio);

  // Try to extract phone from bio
  leadData.phone = extractPhoneFromBio(sender.bio);

  // Set domain from website or email
  if (sender.website) {
    leadData.domain = extractDomainFromUrl(sender.website);
    leadData.fields.website = sender.website;
  } else if (leadData.email) {
    leadData.domain = leadData.email.split('@')[1];
  }

  // Instagram-specific fields
  leadData.fields.instagramUsername = sender.username;
  leadData.fields.instagramId = sender.id;
  leadData.fields.instagramDisplayName = sender.displayName;
  leadData.fields.instagramVerified = sender.isVerified || false;
  leadData.fields.instagramFollowers = sender.followerCount;
  leadData.fields.instagramFollowing = sender.followingCount;
  leadData.fields.instagramPosts = sender.postCount;
  leadData.fields.instagramBio = sender.bio;
  leadData.fields.instagramProfilePicture = sender.profilePicture;
  leadData.fields.instagramBusinessCategory = sender.businessCategory;

  // Message context
  leadData.fields.messageText = message.text;
  leadData.fields.messageType = message.type;
  leadData.fields.isFirstMessage = dmPayload.isFirstMessage;
  leadData.fields.replyToStory = dmPayload.replyToStory;
  leadData.fields.hasAttachments = (message.attachments?.length || 0) > 0;
  leadData.fields.attachmentCount = message.attachments?.length || 0;

  // Shared post context
  if (dmPayload.sharedPost) {
    leadData.fields.sharedPostId = dmPayload.sharedPost.id;
    leadData.fields.sharedPostUrl = dmPayload.sharedPost.url;
    leadData.fields.sharedPostCaption = dmPayload.sharedPost.caption;
  }

  // Engagement analysis
  leadData.fields.engagementLevel = calculateEngagementLevel(sender);
  leadData.fields.profileCompleteness = calculateProfileCompleteness(sender);

  // Intent analysis from message
  leadData.fields.messageIntent = analyzeMessageIntent(message.text || '');
  leadData.fields.urgency = analyzeMessageUrgency(message.text || '');

  // UTM-like tracking
  leadData.utm.source = 'instagram';
  leadData.utm.medium = 'dm';
  leadData.utm.campaign = 'instagram_direct_message';
  leadData.utm.content = message.type;

  return leadData;
}

/**
 * Extract email from Instagram bio
 */
function extractEmailFromBio(bio?: string): string | undefined {
  if (!bio) return undefined;

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = bio.match(emailRegex);
  
  return matches?.[0];
}

/**
 * Extract company name from Instagram bio
 */
function extractCompanyFromBio(bio?: string): string | undefined {
  if (!bio) return undefined;

  // Common patterns in Instagram bios
  const companyPatterns = [
    /(?:CEO|Founder|Owner)\s+(?:@|at)\s+([A-Za-z\s&.,'-]+)/i,
    /(?:^|\n)([A-Z][A-Za-z\s&.,'-]+(?:Inc|LLC|Corp|Company|Ltd))/,
    /(?:Work|Working)\s+(?:@|at)\s+([A-Za-z\s&.,'-]+)/i,
    /🏢\s*([A-Za-z\s&.,'-]+)/,
    /💼\s*([A-Za-z\s&.,'-]+)/
  ];

  for (const pattern of companyPatterns) {
    const match = bio.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Extract phone from Instagram bio
 */
function extractPhoneFromBio(bio?: string): string | undefined {
  if (!bio) return undefined;

  const phonePatterns = [
    /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    /\b\+?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}\b/g,
    /📞\s*([+0-9\s\-\(\)\.]{10,})/g,
    /☎️\s*([+0-9\s\-\(\)\.]{10,})/g
  ];

  for (const pattern of phonePatterns) {
    const matches = bio.match(pattern);
    if (matches && matches.length > 0) {
      const phone = matches[0].replace(/[^\d+]/g, '');
      if (phone.length >= 10) {
        return matches[0].trim();
      }
    }
  }

  return undefined;
}

/**
 * Extract domain from URL
 */
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

/**
 * Calculate engagement level based on follower metrics
 */
function calculateEngagementLevel(sender: InstagramDmPayload['sender']): string {
  const followers = sender.followerCount || 0;
  const following = sender.followingCount || 0;
  const posts = sender.postCount || 0;

  // Calculate engagement indicators
  const followerToFollowingRatio = following > 0 ? followers / following : 0;
  const postsPerFollower = followers > 0 ? posts / followers : 0;

  if (followers > 10000 && followerToFollowingRatio > 2) {
    return 'high'; // Influencer/business account
  } else if (followers > 1000 && posts > 50) {
    return 'medium'; // Active user
  } else if (followers > 100) {
    return 'low'; // Regular user
  }

  return 'minimal'; // New or inactive account
}

/**
 * Calculate profile completeness score
 */
function calculateProfileCompleteness(sender: InstagramDmPayload['sender']): string {
  let score = 0;
  const factors = [
    sender.displayName, // Has display name
    sender.bio, // Has bio
    sender.website, // Has website
    sender.profilePicture, // Has profile picture
    sender.businessCategory, // Business account
    (sender.followerCount || 0) > 10, // Has followers
    (sender.postCount || 0) > 5 // Has posts
  ];

  score = factors.filter(Boolean).length;

  if (score >= 6) return 'complete';
  if (score >= 4) return 'good';
  if (score >= 2) return 'basic';
  return 'minimal';
}

/**
 * Analyze message intent
 */
function analyzeMessageIntent(text: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('interested') || lowerText.includes('inquiry') || lowerText.includes('quote')) {
    return 'inquiry';
  }
  if (lowerText.includes('demo') || lowerText.includes('meeting') || lowerText.includes('call')) {
    return 'demo_request';
  }
  if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('budget')) {
    return 'pricing_inquiry';
  }
  if (lowerText.includes('support') || lowerText.includes('help') || lowerText.includes('issue')) {
    return 'support';
  }
  if (lowerText.includes('partnership') || lowerText.includes('collaborate') || lowerText.includes('work together')) {
    return 'partnership';
  }
  if (lowerText.includes('feedback') || lowerText.includes('review') || lowerText.includes('opinion')) {
    return 'feedback';
  }

  return 'general';
}

/**
 * Analyze message urgency
 */
function analyzeMessageUrgency(text: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('urgent') || lowerText.includes('asap') || lowerText.includes('immediately') || lowerText.includes('emergency')) {
    return 'high';
  }
  if (lowerText.includes('soon') || lowerText.includes('quickly') || lowerText.includes('priority') || lowerText.includes('important')) {
    return 'medium';
  }

  return 'normal';
}
