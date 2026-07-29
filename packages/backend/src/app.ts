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
import { apiTokensRoutes } from './api/v1/apiTokens.js';
import { incidentsRoutes } from './api/v1/incidents.js';
import { escalationRoutes } from './api/v1/escalation.js';
import { templatesRoutes } from './api/v1/templates.js';
import { auditLogRoutes } from './api/v1/auditLog.js';
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

  // Decorate authenticate helper (JWT or API-Key)
  app.decorate('authenticate', async (req: any, reply: any) => {
    // Try X-API-Key header first
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey) {
      const { validateApiToken } = await import('./lib/apiToken.js');
      const user = await validateApiToken(apiKey);
      if (!user) return reply.status(401).send({ error: 'Invalid API key' });
      req.user = { sub: user.userId, role: 'API_USER' };
      return;
    }
    // Fall back to JWT
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // requireRole decorator
  app.decorate('requireRole', (roles: string[]) => async (req: any, reply: any) => {
    await (app as any).authenticate(req, reply);
    if (reply.sent) return;
    const role = (req.user as any)?.role;
    if (!roles.includes(role)) {
      return reply.status(403).send({ error: 'Forbidden' });
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
      security: [{ bearerAuth: [] }, { apiKey: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: { docExpansion: 'list' },
  });

  // Serve built frontend
  const frontendDist = join(__dirname, '..', '..', '..', 'frontend', 'dist');
  await app.register(staticPlugin, { root: frontendDist, prefix: '/', wildcard: false });

  await app.register(healthRoute);
  await app.register(wsRoute);

  // Auth (public)
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Ingestion endpoint – needs auth (JWT or API-Key)
  await app.register(notifyRoute,         { prefix: '/api/v1' });

  // Protected routes
  await app.register(notificationsRoutes, { prefix: '/api/v1/notifications' });
  await app.register(rulesRoutes,         { prefix: '/api/v1/rules' });
  await app.register(providersRoutes,     { prefix: '/api/v1/providers' });
  await app.register(settingsRoutes,      { prefix: '/api/v1/settings' });
  await app.register(usersRoutes,         { prefix: '/api/v1/users' });
  await app.register(apiTokensRoutes,     { prefix: '/api/v1/tokens' });
  await app.register(incidentsRoutes,     { prefix: '/api/v1/incidents' });
  await app.register(escalationRoutes,    { prefix: '/api/v1/escalation' });
  await app.register(templatesRoutes,     { prefix: '/api/v1/templates' });
  await app.register(auditLogRoutes,      { prefix: '/api/v1/audit' });

  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html', frontendDist);
  });

  app.setErrorHandler((error, _req, reply) => {
    logger.error(error);
    // Don't leak internals in production
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode < 500 ? error.message : 'Internal Server Error',
      statusCode,
    });
  });

  return app;
}
