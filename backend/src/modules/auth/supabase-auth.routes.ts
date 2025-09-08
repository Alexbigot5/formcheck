import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { authenticateSupabase, AuthenticatedRequest } from '../../middleware/supabase-auth.js';
import { loadEnv } from '../../config/env.js';

const env = loadEnv();

// Only create Supabase client if environment variables are provided
let supabase: ReturnType<typeof createClient> | null = null;

if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

// Validation schemas
const verifyTokenSchema = z.object({
  token: z.string().optional()
});

export async function registerSupabaseAuthRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/verify - Verify Supabase token and get/create user profile
   */
  app.post('/api/auth/verify', {
    schema: {
      body: verifyTokenSchema
    }
  }, async (request, reply) => {
    try {
      if (!supabase) {
        return reply.code(500).send({ ok: false, error: 'Supabase not configured' });
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ ok: false, error: 'Missing authorization header' });
      }

      const token = authHeader.substring(7);
      
      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return reply.code(401).send({ ok: false, error: 'Invalid token' });
      }

      // Get or create user profile
      let profile = await app.prisma.user.findUnique({
        where: { id: user.id },
        include: { team: true }
      });

      if (!profile) {
        // Create default team
        const team = await app.prisma.team.create({
          data: {
            name: `${user.email?.split('@')[0] || 'User'}'s Team`
          }
        });

        // Create user profile
        profile = await app.prisma.user.create({
          data: {
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            teamId: team.id,
            role: 'OWNER'
          },
          include: { team: true }
        });
      }

      return reply.send({
        ok: true,
        data: {
          user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role
          },
          team_id: profile.teamId
        }
      });

    } catch (error) {
      app.log.error('Token verification error:', error);
      return reply.code(500).send({ ok: false, error: 'Verification failed' });
    }
  });

  /**
   * GET /api/auth/me - Get current user info (authenticated)
   */
  app.get('/api/auth/me', {
    preHandler: [authenticateSupabase]
  }, async (request: AuthenticatedRequest, reply) => {
    const user = request.user!;
    const teamId = request.teamId;

    return reply.send({
      ok: true,
      data: {
        user,
        team_id: teamId
      }
    });
  });

  /**
   * POST /api/auth/profile - Update user profile
   */
  app.post('/api/auth/profile', {
    preHandler: [authenticateSupabase],
    schema: {
      body: z.object({
        name: z.string().optional(),
        // Add other updatable fields as needed
      })
    }
  }, async (request: AuthenticatedRequest, reply) => {
    const { name } = request.body as { name?: string };
    const userId = request.user!.id;

    try {
      const updatedUser = await app.prisma.user.update({
        where: { id: userId },
        data: {
          ...(name && { name })
        }
      });

      return reply.send({
        ok: true,
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role
          }
        }
      });

    } catch (error) {
      app.log.error('Profile update error:', error);
      return reply.code(500).send({ ok: false, error: 'Profile update failed' });
    }
  });
}