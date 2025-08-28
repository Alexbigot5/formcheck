import { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async (request, reply) => {
    return reply.sendSuccess({ status: 'ok', timestamp: new Date().toISOString() });
  });
}


