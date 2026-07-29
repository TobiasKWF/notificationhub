import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { testProvider } from '../../providers/index.js';

export const providersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const providers = await prisma.provider.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, isEnabled: true, createdAt: true, updatedAt: true },
    });
    return reply.send(providers);
  });

  app.post('/', async (req, reply) => {
    const body = req.body as any;
    const provider = await prisma.provider.create({
      data: {
        name:      body.name,
        type:      body.type,
        isEnabled: body.isEnabled ?? true,
        config:    JSON.stringify(body.config ?? {}),
      },
    });
    const { config: _, ...safe } = provider;
    return reply.status(201).send(safe);
  });

  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const provider = await prisma.provider.update({
      where: { id },
      data: {
        name:      body.name,
        isEnabled: body.isEnabled,
        config:    body.config ? JSON.stringify(body.config) : undefined,
      },
    });
    const { config: _, ...safe } = provider;
    return reply.send(safe);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.provider.delete({ where: { id } });
    return reply.status(204).send();
  });

  // POST /api/v1/providers/:id/test
  app.post('/:id/test', async (req, reply) => {
    const { id } = req.params as { id: string };
    const provider = await prisma.provider.findUnique({ where: { id } });
    if (!provider) return reply.status(404).send({ error: 'Provider not found' });
    try {
      await testProvider(provider.type, JSON.parse(provider.config));
      return reply.send({ success: true });
    } catch (err) {
      return reply.status(400).send({ success: false, error: String(err) });
    }
  });
};
