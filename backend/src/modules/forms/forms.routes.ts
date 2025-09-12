import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CreateFormSchema = z.object({
  name: z.string().min(1),
  schema: z.object({}).passthrough(),
});

const UpdateFormSchema = z.object({
  name: z.string().min(1).optional(),
  schema: z.object({}).passthrough().optional(),
});

import { authenticateSupabase } from '../../middleware/supabase-auth';
import { AuthenticatedRequest } from '../../types/auth';

export async function registerFormRoutes(app: FastifyInstance) {
  // Get all forms for authenticated user
  app.get('/api/forms', {
    preHandler: [authenticateSupabase],
    handler: async (request: AuthenticatedRequest) => {
      const userId = request.user!.id;
      const forms = await app.prisma.form.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return { ok: true, data: forms };
    },
  });

  // Get single form
  app.get('/api/forms/:id', {
    preHandler: [authenticateSupabase],
    handler: async (request: AuthenticatedRequest) => {
      const { id } = request.params as { id: string };
      const userId = request.user!.id;
      
      const form = await app.prisma.form.findFirst({
        where: { id, userId },
        include: { leads: true },
      });
      
      if (!form) {
        return { ok: false, error: 'Form not found' };
      }
      
      return { ok: true, data: form };
    },
  });

  // Create form
  app.post('/api/forms', {
    preHandler: [authenticateSupabase],
    handler: async (request: AuthenticatedRequest) => {
      const userId = request.user!.id;
      const teamId = request.teamId;
      const body = CreateFormSchema.parse(request.body);
      
      const form = await app.prisma.form.create({
        data: {
          name: body.name,
          schema: body.schema,
          userId,
          teamId: teamId || undefined,
        },
      });
      
      return { ok: true, data: form };
    },
  });

  // Update form
  app.put('/api/forms/:id', {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };
      const body = UpdateFormSchema.parse(request.body);
      
      const form = await app.prisma.form.updateMany({
        where: { id, userId: user.id },
        data: body,
      });
      
      if (form.count === 0) {
        return reply.code(404).send({ error: 'Form not found' });
      }
      
      const updatedForm = await app.prisma.form.findUnique({
        where: { id },
      });
      
      return { success: true, data: updatedForm };
    },
  });

  // Delete form
  app.delete('/api/forms/:id', {
    preHandler: [app.authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };
      
      const result = await app.prisma.form.deleteMany({
        where: { id, userId: user.id },
      });
      
      if (result.count === 0) {
        return reply.code(404).send({ error: 'Form not found' });
      }
      
      return { success: true };
    },
  });
}
