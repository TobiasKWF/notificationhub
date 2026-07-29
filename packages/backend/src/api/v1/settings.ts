import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) result[s.key] = s.value;
    return reply.send(result);
  });

  app.put('/', async (req, reply) => {
    const updates = req.body as Record<string, string>;
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
      ),
    );
    return reply.send({ updated: true });
  });
};
