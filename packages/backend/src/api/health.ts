import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({
        status: 'ok',
        version: process.env.npm_package_version ?? '0.1.0',
        database: 'ok',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return reply.status(503).send({ status: 'error', database: 'unreachable' });
    }
  });
};
