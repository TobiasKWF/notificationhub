import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const auditLogRoutes: FastifyPluginAsync = async (app) => {
  const adminAuth = [(app as any).authenticate];

  /** GET /api/v1/audit – paginated audit log (admin only) */
  app.get('/', { onRequest: adminAuth }, async (req, reply) => {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, Number(q.page  ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50)));
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (q.userId)   where.userId   = q.userId;
    if (q.resource) where.resource = q.resource;
    if (q.action)   where.action   = { contains: q.action };
    if (q.since || q.until) {
      where.createdAt = {};
      if (q.since) where.createdAt.gte = new Date(q.since);
      if (q.until) where.createdAt.lte = new Date(q.until);
    }

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) });
  });
};
