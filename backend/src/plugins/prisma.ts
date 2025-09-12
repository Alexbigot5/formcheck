import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (fastify) => {
  const prisma = new PrismaClient();
  
  // Try to connect to database, but don't fail if it's not available
  try {
    await prisma.$connect();
    fastify.log.info('Database connected successfully');
  } catch (error) {
    fastify.log.error('Database connection failed:', error);
    fastify.log.warn('Server will start without database connection');
  }
  
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      fastify.log.error('Error disconnecting from database:', error);
    }
  });
});


