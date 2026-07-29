import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { eventBus } from '../../lib/eventBus.js';
import { processNotification } from '../../core/rulesEngine.js';
import { logger } from '../../lib/logger.js';

export const NotificationSchema = z.object({
  source:     z.string().min(1).max(100),
  service:    z.string().max(100).optional(),
  title:      z.string().min(1).max(255),
  message:    z.string().max(4096),
  priority:   z.enum(['INFO','SUCCESS','WARNING','ERROR','CRITICAL','EMERGENCY']).default('INFO'),
  tags:       z.array(z.string()).default([]),
  hostname:   z.string().max(253).optional(),
  externalId: z.string().max(255).optional(),
  timestamp:  z.string().datetime().optional(),
  extra:      z.record(z.unknown()).default({}),
});

export type NotificationPayload = z.infer<typeof NotificationSchema>;

export const notifyRoute: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/v1/notify
   * Main ingestion endpoint — accepts notifications from any source.
   */
  app.post('/notify', async (req, reply) => {
    const payload = NotificationSchema.parse(req.body);

    const notification = await prisma.notification.create({
      data: {
        source:     payload.source,
        service:    payload.service,
        title:      payload.title,
        message:    payload.message,
        priority:   payload.priority,
        tags:       JSON.stringify(payload.tags),
        hostname:   payload.hostname,
        externalId: payload.externalId,
        timestamp:  payload.timestamp ? new Date(payload.timestamp) : new Date(),
        extra:      JSON.stringify(payload.extra),
      },
    });

    logger.info(
      { notificationId: notification.id, source: payload.source, priority: payload.priority },
      'Notification received',
    );

    eventBus.emitNotification(notification);
    processNotification(notification).catch((err) => logger.error(err, 'Rules engine error'));

    return reply.status(202).send({
      id: notification.id,
      received: true,
      timestamp: notification.receivedAt,
    });
  });
};
