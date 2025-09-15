import { FastifyInstance, FastifyReply } from 'fastify';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  company_name: z.string().min(1).max(100).optional()
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  ipAllowlist: z.array(z.string().ip()).optional()
});

const deleteApiKeySchema = z.object({
  id: z.string().cuid()
});

export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * POST /auth/login - User login
   */
  app.post('/auth/login', async (request, reply: FastifyReply) => {
    const { email, password } = request.body as z.infer<typeof loginSchema>;

    try {
      // Find user by email
      const user = await app.prisma.user.findUnique({
        where: { email },
        include: { team: true }
      });

      if (!user) {
        return reply.sendError('Invalid email or password', 401);
      }

      // Verify password (assuming you have a password hash field)
      const passwordHash = createHash('sha256').update(password).digest('hex');
      if (user.passwordHash !== passwordHash) {
        return reply.sendError('Invalid email or password', 401);
      }

      // Generate JWT token
      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        teamId: user.teamId
      });

      return reply.sendSuccess({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          team_id: user.teamId
        },
        team_id: user.teamId
      });

    } catch (error) {
      app.log.error('Login error:', error as any);
      return reply.sendError('Login failed', 500);
    }
  });

  /**
   * POST /auth/register - User registration
   */
  app.post('/auth/register', async (request, reply: FastifyReply) => {
    const { email, password, name, company_name } = request.body as z.infer<typeof registerSchema>;

    try {
      // Check if user already exists
      const existingUser = await app.prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return reply.sendError('User already exists', 409);
      }

      // Hash password
      const passwordHash = createHash('sha256').update(password).digest('hex');

      // Create team and user in transaction
      const result = await app.prisma.$transaction(async (prisma) => {
        // Create team
        const team = await prisma.team.create({
          data: {
            name: company_name || `${name}'s Team`,
            // Add other team fields as needed
          }
        });

        // Create user
        const user = await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            teamId: team.id,
            role: 'OWNER', // First user is owner
            // Add other user fields as needed
          }
        });

        return { user, team };
      });

      // Generate JWT token
      const token = app.jwt.sign({
        sub: result.user.id,
        email: result.user.email,
        teamId: result.user.teamId
      });

      return reply.sendSuccess({
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          team_id: result.user.teamId
        },
        team_id: result.user.teamId
      }, 201);

    } catch (error) {
      app.log.error('Registration error:', error as any);
      return reply.sendError('Registration failed', 500);
    }
  });

  // Note: Authentication is applied per route using preHandler option below

  /**
   * POST /api/keys - Create a new API key
   */
  app.post('/api/keys', { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { name, ipAllowlist } = request.body as z.infer<typeof createApiKeySchema>;
    const teamId = (request as any).teamId;

    try {
      // Generate a secure random API key
      const apiKey = generateApiKey();
      const keyHash = createHash('sha256').update(apiKey).digest('hex');

      // Create API key record
      const apiKeyRecord = await app.prisma.apiKey.create({
        data: {
          teamId,
          name,
          keyHash,
          ipAllowlist: ipAllowlist || null
        }
      });

      // Return the API key (only time it's shown in plain text)
      return reply.sendSuccess({
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        key: apiKey, // This is the only time we return the actual key
        ipAllowlist: apiKeyRecord.ipAllowlist as string[] | undefined,
        createdAt: apiKeyRecord.createdAt.toISOString()
      }, 201);

    } catch (error) {
      app.log.error('Failed to create API key:', error as any);
      return reply.sendError('Failed to create API key', 500);
    }
  });

  /**
   * GET /api/keys - List all API keys for the team
   */
  app.get('/api/keys', { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const teamId = (request as any).teamId;

    try {
      const apiKeys = await app.prisma.apiKey.findMany({
        where: { teamId },
        select: {
          id: true,
          name: true,
          ipAllowlist: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.sendSuccess({
        keys: apiKeys.map(key => ({
          id: key.id,
          name: key.name,
          ipAllowlist: key.ipAllowlist as string[] | undefined,
          createdAt: key.createdAt.toISOString(),
          // TODO: Add lastUsed tracking in future
          lastUsed: undefined
        }))
      });

    } catch (error) {
      app.log.error('Failed to list API keys:', error as any);
      return reply.sendError('Failed to list API keys', 500);
    }
  });

  /**
   * DELETE /api/keys/:id - Delete an API key
   */
  app.delete('/api/keys/:id', { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof deleteApiKeySchema>;
    const teamId = (request as any).teamId;

    try {
      // Ensure the API key belongs to the team (multi-tenant isolation)
      const apiKey = await app.prisma.apiKey.findFirst({
        where: { id, teamId }
      });

      if (!apiKey) {
        return reply.sendError('API key not found', 404);
      }

      // Delete the API key
      await app.prisma.apiKey.delete({
        where: { id }
      });

      return reply.sendSuccess({ message: 'API key deleted successfully' });

    } catch (error) {
      app.log.error('Failed to delete API key:', error as any);
      return reply.sendError('Failed to delete API key', 500);
    }
  });
}

/**
 * Generate a secure API key
 * Format: sk_live_[32 random bytes as hex]
 */
function generateApiKey(): string {
  const randomPart = randomBytes(32).toString('hex');
  return `sk_live_${randomPart}`;
}
