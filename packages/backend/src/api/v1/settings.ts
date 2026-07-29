import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { auditLog } from '../../lib/audit.js';

// Default settings shipped on first run
const DEFAULTS: Record<string, string> = {
  'app.name':                 'NotificationHub',
  'app.timezone':             'Europe/Berlin',
  'notifications.retention':  '90',
  'notifications.dedup':      'false',
  'notifications.dedup_ttl':  '60',
  'quiet_hours.enabled':      'false',
  'quiet_hours.start':        '22:00',
  'quiet_hours.end':          '07:00',
};

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  /** GET /api/v1/settings */
  app.get('/', { onRequest: auth }, async (_req, reply) => {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = { ...DEFAULTS };
    for (const s of settings) result[s.key] = s.value;
    return reply.send(result);
  });

  /** PUT /api/v1/settings */
  app.put('/', { onRequest: auth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const updates = req.body as Record<string, string>;
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
      ),
    );
    auditLog({ userId: sub, action: 'update', resource: 'settings' });
    return reply.send({ updated: true });
  });

  /** GET /api/v1/settings/:key – single key */
  app.get('/:key', { onRequest: auth }, async (req, reply) => {
    const { key } = req.params as { key: string };
    const setting = await prisma.setting.findUnique({ where: { key } });
    const value = setting?.value ?? DEFAULTS[key];
    if (value === undefined) return reply.status(404).send({ error: 'Setting not found' });
    return reply.send({ key, value });
  });
};
