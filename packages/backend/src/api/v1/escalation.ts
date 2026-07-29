import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const escalationRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  // ── Policies ────────────────────────────────────────────

  /** GET /api/v1/escalation/policies */
  app.get('/policies', { onRequest: auth }, async (_req, reply) => {
    const policies = await prisma.escalationPolicy.findMany({
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return reply.send(policies);
  });

  /** GET /api/v1/escalation/policies/:id */
  app.get('/policies/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const policy = await prisma.escalationPolicy.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!policy) return reply.status(404).send({ error: 'Not found' });
    return reply.send(policy);
  });

  /** POST /api/v1/escalation/policies */
  app.post('/policies', { onRequest: auth }, async (req, reply) => {
    const body = req.body as any;
    const policy = await prisma.escalationPolicy.create({
      data: {
        name:      body.name,
        isEnabled: body.isEnabled ?? true,
        steps: {
          create: (body.steps ?? []).map((s: any) => ({
            stepNumber: s.stepNumber,
            delayMins:  s.delayMins  ?? 10,
            providerId: s.providerId,
            message:    s.message,
          })),
        },
      },
      include: { steps: true },
    });
    return reply.status(201).send(policy);
  });

  /** PUT /api/v1/escalation/policies/:id */
  app.put('/policies/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;

    // Replace steps: delete old, create new
    await prisma.escalationStep.deleteMany({ where: { policyId: id } });
    const policy = await prisma.escalationPolicy.update({
      where: { id },
      data: {
        name:      body.name,
        isEnabled: body.isEnabled,
        steps: {
          create: (body.steps ?? []).map((s: any) => ({
            stepNumber: s.stepNumber,
            delayMins:  s.delayMins  ?? 10,
            providerId: s.providerId,
            message:    s.message,
          })),
        },
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });
    return reply.send(policy);
  });

  /** DELETE /api/v1/escalation/policies/:id */
  app.delete('/policies/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.escalationPolicy.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ── Active Escalations ─────────────────────────────────

  /** GET /api/v1/escalation/active – list pending escalations */
  app.get('/active', { onRequest: auth }, async (_req, reply) => {
    const active = await prisma.activeEscalation.findMany({
      where: { resolvedAt: null },
      orderBy: { nextEscalationAt: 'asc' },
    });
    return reply.send(active);
  });

  /** POST /api/v1/escalation/active/:id/resolve – manually resolve */
  app.post('/active/:id/resolve', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const updated = await prisma.activeEscalation.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });
    return reply.send(updated);
  });
};
