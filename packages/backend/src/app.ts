import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { healthRoute } from './api/health.js';
import { authRoutes } from './api/v1/auth.js';
import { notifyRoute } from './api/v1/notify.js';
import { notificationsRoutes } from './api/v1/notifications.js';
import { rulesRoutes } from './api/v1/rules.js';
import { providersRoutes } from './api/v1/providers.js';
import { settingsRoutes } from './api/v1/settings.js';
import { usersRoutes } from './api/v1/users.js';
import { wsRoute } from './api/ws.js';
import { logger } from './lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: process.env.APP_URL ?? true,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 1000),
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
  });

  // Decorate authenticate helper
  app.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  await app.register(websocket);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'NotificationHub API',
        description: 'Self-hosted notification routing engine',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: { docExpansion: 'list' },
  });

  const publicDir = join(__dirname, '..', 'public');
  await app.register(staticPlugin, { root: publicDir, prefix: '/', wildcard: false });

  await app.register(healthRoute);
  await app.register(wsRoute);
  await app.register(authRoutes,         { prefix: '/api/v1/auth' });
  await app.register(notifyRoute,        { prefix: '/api/v1' });
  await app.register(notificationsRoutes,{ prefix: '/api/v1/notifications' });
  await app.register(rulesRoutes,        { prefix: '/api/v1/rules' });
  await app.register(providersRoutes,    { prefix: '/api/v1/providers' });
  await app.register(settingsRoutes,     { prefix: '/api/v1/settings' });
  await app.register(usersRoutes,        { prefix: '/api/v1/users' });

  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html', publicDir);
  });

  app.setErrorHandler((error, _req, reply) => {
    logger.error(error);
    reply.status(error.statusCode ?? 500).send({
      error: error.message,
      statusCode: error.statusCode ?? 500,
    });
  });

  return app;
}
