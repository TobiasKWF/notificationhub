import type { FastifyPluginAsync } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { eventBus } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';

// Use SocketStream (the type @fastify/websocket actually provides)
const clients = new Set<SocketStream>();

export const wsRoute: FastifyPluginAsync = async (app) => {
  app.get('/ws', { websocket: true }, (socket: SocketStream) => {
    clients.add(socket);
    logger.debug({ total: clients.size }, 'WS client connected');

    socket.on('close', () => {
      clients.delete(socket);
      logger.debug({ total: clients.size }, 'WS client disconnected');
    });

    socket.socket.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
  });
};

export function broadcastNotification(notification: object) {
  const payload = JSON.stringify({ type: 'notification', data: notification });
  for (const client of clients) {
    try {
      if (client.socket.readyState === 1) client.socket.send(payload);
    } catch { /* ignore closed sockets */ }
  }
}

eventBus.onNotification((n) => broadcastNotification(n));
