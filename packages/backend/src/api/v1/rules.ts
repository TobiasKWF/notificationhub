import type { FastifyPluginAsync } from 'fastify';
import type { RuleAction } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { auditLog } from '../../lib/audit.js';

export const rulesRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  app.get('/', { onRequest: auth }, async (_req, reply) => {
    const rules = await prisma.rule.findMany({
      include: { actions: { include: { provider: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { priority: 'asc' },
    });
    return reply.send(rules);
  });

  app.get('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rule = await prisma.rule.findUnique({
      where: { id },
      include: { actions: { include: { provider: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!rule) return reply.status(404).send({ error: 'Not found' });
    return reply.send(rule);
  });

  app.post('/', { onRequest: auth }, async (req, reply) => {
    const body = req.body as any;
    const { sub } = req.user as { sub: string };
    const rule = await prisma.rule.create({
      data: {
        name:           body.name,
        description:    body.description,
        isEnabled:      body.isEnabled      ?? true,
        priority:       body.priority       ?? 100,
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
    auditLog({ userId: sub, action: 'create', resource: 'rule', resourceId: rule.id });
    return reply.status(201).send(rule);
  });

  app.put('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const body = req.body as any;
    const rule = await prisma.rule.update({
      where: { id },
      data: {
        name:           body.name,
        description:    body.description,
        isEnabled:      body.isEnabled,
        priority:       body.priority,
        stopProcessing: body.stopProcessing,
        conditions:     body.conditions ? JSON.stringify(body.conditions) : undefined,
        conditionLogic: body.conditionLogic,
      },
      include: { actions: { include: { provider: true } } },
    });
    auditLog({ userId: sub, action: 'update', resource: 'rule', resourceId: id });
    return reply.send(rule);
  });

  app.patch('/:id/toggle', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const current = await prisma.rule.findUnique({ where: { id }, select: { isEnabled: true } });
    if (!current) return reply.status(404).send({ error: 'Not found' });
    const rule = await prisma.rule.update({
      where: { id },
      data: { isEnabled: !current.isEnabled },
    });
    return reply.send({ id: rule.id, isEnabled: rule.isEnabled });
  });

  app.delete('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    await prisma.rule.delete({ where: { id } });
    auditLog({ userId: sub, action: 'delete', resource: 'rule', resourceId: id });
    return reply.status(204).send();
  });

  app.post('/:id/test', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rule = await prisma.rule.findUnique({
      where: { id },
      include: { actions: { include: { provider: true } } },
    });
    if (!rule) return reply.status(404).send({ error: 'Not found' });

    const payload = req.body as any;
    let conditions: any[] = [];
    try { conditions = JSON.parse(rule.conditions); } catch { /* ignore */ }

    const { evaluateConditions } = await import('../../core/rulesEngine.js');
    const matched = evaluateConditions(conditions, rule.conditionLogic as any, payload);
    return reply.send({
      ruleId:  id,
      matched,
      actions: matched ? rule.actions.map((a: RuleAction) => ({ type: a.type, providerId: a.providerId })) : [],
    });
  });
};
