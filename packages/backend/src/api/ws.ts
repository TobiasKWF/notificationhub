import type { FastifyPluginAsync } from 'fastify';
import { eventBus } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';

const clients = new Set<import('ws').WebSocket>();

export const wsRoute: FastifyPluginAsync = async (app) => {
  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    logger.debug({ total: clients.size }, 'WS client connected');

    socket.on('close', () => {
      clients.delete(socket);
      logger.debug({ total: clients.size }, 'WS client disconnected');
    });

    socket.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
  });
};

export function broadcastNotification(notification: object) {
  const payload = JSON.stringify({ type: 'notification', data: notification });
  for (const client of clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

eventBus.onNotification((n) => broadcastNotification(n));
