import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/notifications
  app.get('/', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, Number(q.page  ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50)));
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (q.priority) where.priority = q.priority;
    if (q.source)   where.source   = { contains: q.source };
    if (q.search)   where.OR = [
      { title:   { contains: q.search } },
      { message: { contains: q.search } },
    ];
    if (q.since || q.until) {
      where.timestamp = {};
      if (q.since) where.timestamp.gte = new Date(q.since);
      if (q.until) where.timestamp.lte = new Date(q.until);
    }

    const [total, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({ where, orderBy: { timestamp: 'desc' }, skip, take: limit }),
    ]);

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) });
  });

  // GET /api/v1/notifications/stats/summary
  app.get('/stats/summary', async (_req, reply) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [today, critical, warnings, byPriority, bySource] = await Promise.all([
      prisma.notification.count({ where: { timestamp: { gte: todayStart } } }),
      prisma.notification.count({ where: { priority: { in: ['CRITICAL','EMERGENCY'] }, acknowledgedAt: null } }),
      prisma.notification.count({ where: { priority: 'WARNING', acknowledgedAt: null } }),
      prisma.notification.groupBy({ by: ['priority'], _count: { id: true } }),
      prisma.notification.groupBy({ by: ['source'],   _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    ]);

    return reply.send({ today, critical, warnings, byPriority, bySource });
  });

  // GET /api/v1/notifications/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const n = await prisma.notification.findUnique({
      where: { id },
      include: { routingResults: { include: { provider: true, rule: true } } },
    });
    if (!n) return reply.status(404).send({ error: 'Not found' });
    return reply.send(n);
  });

  // POST /api/v1/notifications/:id/acknowledge
  app.post('/:id/acknowledge', async (req, reply) => {
    const { id } = req.params as { id: string };
    const updated = await prisma.notification.update({
      where: { id },
      data: { acknowledgedAt: new Date() },
    });
    return reply.send(updated);
  });

  // DELETE /api/v1/notifications/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.notification.delete({ where: { id } });
    return reply.status(204).send();
  });
};
