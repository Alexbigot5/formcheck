import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from '../config/env';

// Version 2.1 - Fixed lazy loading of Supabase client

// Lazy load environment and supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    try {
      const env = loadEnv();
      if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
        supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
      }
    } catch (error) {
      console.error('Failed to load Supabase environment:', error);
    }
  }
  return supabase;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
  teamId?: string;
}

/**
 * Middleware to authenticate requests using Supabase JWT tokens
 */
export async function authenticateSupabase(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return reply.code(500).send({ error: 'Supabase not configured' });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (error || !user) {
      return reply.code(401).send({ error: 'Invalid token' });
    }

    // Get or create user profile in our database
    let profile = await request.server.prisma.user.findUnique({
      where: { id: user.id },
      include: { team: true }
    });

    if (!profile) {
      // Create new user profile
      const defaultTeam = await request.server.prisma.team.create({
        data: {
          name: `${user.email?.split('@')[0] || 'User'}'s Team`
        }
      });

      profile = await request.server.prisma.user.create({
        data: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          teamId: defaultTeam.id,
          role: 'OWNER' // First user is owner
        },
        include: { team: true }
      });
    }

    // Add user info to request
    (request as AuthenticatedRequest).user = {
      id: profile.id,
      email: profile.email,
      name: profile.name || undefined,
      role: profile.role
    };
    (request as AuthenticatedRequest).teamId = profile.teamId || undefined;

  } catch (error) {
    console.error('Authentication error:', error);
    return reply.code(401).send({ error: 'Authentication failed' });
  }
}

/**
 * Create a user from Supabase auth user
 */
export async function createUserFromSupabase(
  app: FastifyInstance,
  supabaseUser: any
): Promise<any> {
  
  // Create default team for the user
  const team = await app.prisma.team.create({
    data: {
      name: `${supabaseUser.email?.split('@')[0] || 'User'}'s Team`
    }
  });

  // Create user profile
  const user = await app.prisma.user.create({
    data: {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
      teamId: team.id,
      role: 'OWNER'
    },
    include: { team: true }
  });

  return user;
}
