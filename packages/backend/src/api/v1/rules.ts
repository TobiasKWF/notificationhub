import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const rulesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const rules = await prisma.rule.findMany({
      include: { actions: { include: { provider: true } } },
      orderBy: { priority: 'asc' },
    });
    return reply.send(rules);
  });

  app.post('/', async (req, reply) => {
    const body = req.body as any;
    const rule = await prisma.rule.create({
      data: {
        name:           body.name,
        description:    body.description,
        isEnabled:      body.isEnabled ?? true,
        priority:       body.priority ?? 100,
        stopProcessing: body.stopProcessing ?? false,
        conditions:     JSON.stringify(body.conditions ?? []),
        conditionLogic: body.conditionLogic ?? 'AND',
        actions: {
          create: (body.actions ?? []).map((a: any, i: number) => ({
            type:       a.type,
            config:     JSON.stringify(a.config ?? {}),
            sortOrder:  a.sortOrder ?? i,
            providerId: a.providerId,
          })),
        },
      },
      include: { actions: { include: { provider: true } } },
    });
    return reply.status(201).send(rule);
  });

  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const rule = await prisma.rule.update({
      where: { id },
      data: {
        ...body,
        conditions: body.conditions ? JSON.stringify(body.conditions) : undefined,
      },
      include: { actions: { include: { provider: true } } },
    });
    return reply.send(rule);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.rule.delete({ where: { id } });
    return reply.status(204).send();
  });

  // POST /api/v1/rules/:id/test  – simulate notification against one rule
  app.post('/:id/test', async (req, reply) => {
    // TODO: dry-run a test payload through the rule without persisting
    return reply.send({ result: 'matched', actions: [] });
  });
};
