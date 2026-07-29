import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const incidentsRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  /** GET /api/v1/incidents */
  app.get('/', { onRequest: auth }, async (req, reply) => {
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.status)   where.status   = q.status;
    if (q.priority) where.priority = q.priority;

    const incidents = await prisma.incident.findMany({
      where,
      include: { _count: { select: { notifications: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(incidents);
  });

  /** GET /api/v1/incidents/:id */
  app.get('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: { notifications: { orderBy: { timestamp: 'desc' }, take: 50 } },
    });
    if (!incident) return reply.status(404).send({ error: 'Not found' });
    return reply.send(incident);
  });

  /** POST /api/v1/incidents */
  app.post('/', { onRequest: auth }, async (req, reply) => {
    const body = req.body as any;
    const incident = await prisma.incident.create({
      data: {
        title:    body.title,
        status:   body.status   ?? 'OPEN',
        priority: body.priority ?? 'ERROR',
      },
    });
    return reply.status(201).send(incident);
  });

  /** PATCH /api/v1/incidents/:id */
  app.patch('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const data: any = {};
    if (body.status !== undefined)   data.status   = body.status;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.title !== undefined)    data.title    = body.title;
    if (body.status === 'RESOLVED')  data.resolvedAt = new Date();

    const incident = await prisma.incident.update({ where: { id }, data });
    return reply.send(incident);
  });

  /** DELETE /api/v1/incidents/:id */
  app.delete('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.incident.delete({ where: { id } });
    return reply.status(204).send();
  });

  /** POST /api/v1/incidents/:id/notifications – add notification to incident */
  app.post('/:id/notifications', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { notificationId } = req.body as { notificationId: string };
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { incidentId: id },
    });
    return reply.send(updated);
  });
};
