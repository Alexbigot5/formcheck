import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash, createHmac } from 'crypto';
import { env } from '../config/env.js';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    teamId: string;
    role: string;
  };
  apiKey?: {
    id: string;
    teamId: string;
    name: string;
  };
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token and extracts user info
 */
export async function jwtAuth(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return reply.code(401).send({ error: 'Missing authorization token' });
    }

    // Verify JWT token using Fastify JWT
    const decoded = await request.jwtVerify();
    
    // Get user details from database
    const user = await request.server.prisma.user.findUnique({
      where: { id: decoded.sub as string },
      include: {
        owners: {
          include: { team: true }
        }
      }
    });

    if (!user || !user.owners.length) {
      return reply.code(401).send({ error: 'Invalid user or no team access' });
    }

    // For simplicity, use the first team. In production, you might want team switching logic
    const primaryOwner = user.owners[0];
    
    request.user = {
      id: user.id,
      teamId: primaryOwner.teamId,
      role: user.role
    };

  } catch (error) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
}

/**
 * API Key Authentication Middleware
 * Verifies API key hash and checks IP allowlist
 */
export async function apiKeyAuth(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return reply.code(401).send({ error: 'Missing API key' });
    }

    // Hash the provided API key
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    
    // Find API key in database
    const apiKeyRecord = await request.server.prisma.apiKey.findFirst({
      where: { keyHash },
      include: { team: true }
    });

    if (!apiKeyRecord) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    // Check IP allowlist if configured
    if (apiKeyRecord.ipAllowlist && Array.isArray(apiKeyRecord.ipAllowlist)) {
      const clientIP = getClientIP(request);
      const allowedIPs = apiKeyRecord.ipAllowlist as string[];
      
      if (!allowedIPs.includes(clientIP)) {
        return reply.code(403).send({ error: 'IP not allowed' });
      }
    }

    request.apiKey = {
      id: apiKeyRecord.id,
      teamId: apiKeyRecord.teamId,
      name: apiKeyRecord.name
    };

  } catch (error) {
    return reply.code(401).send({ error: 'API key authentication failed' });
  }
}

/**
 * Webhook HMAC Verification Middleware
 * Verifies X-Signature header using HMAC-SHA256
 */
export async function webhookAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const signature = request.headers['x-signature'] as string;
    if (!signature) {
      return reply.code(401).send({ error: 'Missing X-Signature header' });
    }

    // Get raw body for HMAC verification
    const rawBody = request.body as string;
    if (!rawBody) {
      return reply.code(400).send({ error: 'Missing request body' });
    }

    // Calculate expected signature
    const expectedSignature = createHmac('sha256', env.HMAC_SECRET)
      .update(rawBody)
      .digest('hex');

    // Remove 'sha256=' prefix if present
    const providedSignature = signature.replace(/^sha256=/, '');

    // Constant-time comparison to prevent timing attacks
    if (!constantTimeEquals(expectedSignature, providedSignature)) {
      return reply.code(401).send({ error: 'Invalid signature' });
    }

  } catch (error) {
    return reply.code(401).send({ error: 'Webhook authentication failed' });
  }
}

/**
 * Multi-tenant isolation middleware
 * Ensures requests can only access data from their team
 */
export async function teamIsolation(request: AuthenticatedRequest, reply: FastifyReply) {
  // Get teamId from either JWT user or API key
  const teamId = request.user?.teamId || request.apiKey?.teamId;
  
  if (!teamId) {
    return reply.code(401).send({ error: 'No team context available' });
  }

  // Add teamId to request for use in route handlers
  (request as any).teamId = teamId;
}

/**
 * Combined authentication middleware that tries JWT first, then API key
 */
export async function authenticate(request: AuthenticatedRequest, reply: FastifyReply) {
  const hasJWT = extractBearerToken(request);
  const hasApiKey = extractApiKey(request);

  if (hasJWT) {
    await jwtAuth(request, reply);
  } else if (hasApiKey) {
    await apiKeyAuth(request, reply);
  } else {
    return reply.code(401).send({ error: 'Authentication required' });
  }

  // Apply team isolation after authentication
  await teamIsolation(request, reply);
}

// Helper functions
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function extractApiKey(request: FastifyRequest): string | null {
  // Check X-API-Key header
  const apiKeyHeader = request.headers['x-api-key'] as string;
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check Authorization header with API key format
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('ApiKey ')) {
    return authHeader.slice(7);
  }

  return null;
}

function getClientIP(request: FastifyRequest): string {
  // Check common headers for real IP (when behind proxy)
  const forwarded = request.headers['x-forwarded-for'] as string;
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers['x-real-ip'] as string;
  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
