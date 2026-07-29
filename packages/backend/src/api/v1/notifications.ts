import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  /** GET /api/v1/notifications */
  app.get('/', { onRequest: auth }, async (req, reply) => {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, Number(q.page  ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50)));
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (q.priority)   where.priority  = q.priority;
    if (q.source)     where.source    = { contains: q.source };
    if (q.hostname)   where.hostname  = { contains: q.hostname };
    if (q.incidentId) where.incidentId = q.incidentId;
    if (q.acknowledged === 'true')  where.acknowledgedAt = { not: null };
    if (q.acknowledged === 'false') where.acknowledgedAt = null;
    if (q.search) {
      where.OR = [
        { title:   { contains: q.search } },
        { message: { contains: q.search } },
        { source:  { contains: q.search } },
      ];
    }
    if (q.since || q.until) {
      where.timestamp = {};
      if (q.since) where.timestamp.gte = new Date(q.since);
      if (q.until) where.timestamp.lte = new Date(q.until);
    }
    if (q.tags) where.tags = { contains: q.tags };

    const [total, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) });
  });

  /** GET /api/v1/notifications/stats/summary
   *  MUST be before /:id so Fastify does not swallow "stats" as an id param. */
  app.get('/stats/summary', { onRequest: auth }, async (_req, reply) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart  = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [today, week, critical, warnings, unacknowledged, byPriority, bySource] = await Promise.all([
      prisma.notification.count({ where: { timestamp: { gte: todayStart } } }),
      prisma.notification.count({ where: { timestamp: { gte: weekStart } } }),
      prisma.notification.count({ where: { priority: { in: ['CRITICAL', 'EMERGENCY'] }, acknowledgedAt: null } }),
      prisma.notification.count({ where: { priority: 'WARNING', acknowledgedAt: null } }),
      prisma.notification.count({ where: { acknowledgedAt: null } }),
      prisma.notification.groupBy({ by: ['priority'], _count: { id: true } }),
      prisma.notification.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    ]);

    return reply.send({ today, week, critical, warnings, unacknowledged, byPriority, bySource });
  });

  /** POST /api/v1/notifications/bulk/acknowledge
   *  MUST be before /:id/acknowledge so "bulk" is not treated as an id. */
  app.post('/bulk/acknowledge', { onRequest: auth }, async (req, reply) => {
    const { ids } = req.body as { ids: string[] };
    const { sub } = req.user as { sub: string };
    const result = await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: { acknowledgedAt: new Date(), acknowledgedById: sub },
    });
    return reply.send({ updated: result.count });
  });

  /** DELETE /api/v1/notifications/bulk
   *  MUST be before /:id so "bulk" is not treated as an id. */
  app.delete('/bulk', { onRequest: auth }, async (req, reply) => {
    const { ids } = req.body as { ids: string[] };
    const result = await prisma.notification.deleteMany({ where: { id: { in: ids } } });
    return reply.send({ deleted: result.count });
  });

  // ───────────────────────────────────────────────────────
  //  Dynamic routes below – these MUST come after all static paths
  // ───────────────────────────────────────────────────────

  /** GET /api/v1/notifications/:id */
  app.get('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const n = await prisma.notification.findUnique({
      where: { id },
      include: { routingResults: { include: { provider: true, rule: true } } },
    });
    if (!n) return reply.status(404).send({ error: 'Not found' });
    return reply.send(n);
  });

  /** POST /api/v1/notifications/:id/acknowledge */
  app.post('/:id/acknowledge', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const updated = await prisma.notification.update({
      where: { id },
      data: { acknowledgedAt: new Date(), acknowledgedById: sub },
    });
    return reply.send(updated);
  });

  /** DELETE /api/v1/notifications/:id */
  app.delete('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.notification.delete({ where: { id } });
    return reply.status(204).send();
  });
};
