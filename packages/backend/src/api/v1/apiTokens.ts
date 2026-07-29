import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { generateToken } from '../../lib/apiToken.js';

export const apiTokensRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  /** GET /api/v1/tokens – list tokens for the current user */
  app.get('/', { onRequest: auth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const tokens = await prisma.apiToken.findMany({
      where: { userId: sub },
      select: { id: true, name: true, tokenPrefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(tokens);
  });

  /** POST /api/v1/tokens – create a new token */
  app.post('/', { onRequest: auth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = req.body as { name: string; expiresAt?: string };
    const { raw, prefix, hash } = generateToken();

    const token = await prisma.apiToken.create({
      data: {
        name:        body.name,
        tokenHash:   hash,
        tokenPrefix: prefix,
        userId:      sub,
        expiresAt:   body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    // Return raw token ONCE – not stored in plain text
    return reply.status(201).send({
      id:          token.id,
      name:        token.name,
      tokenPrefix: token.tokenPrefix,
      token:       raw,   // shown only on creation
      expiresAt:   token.expiresAt,
      createdAt:   token.createdAt,
    });
  });

  /** DELETE /api/v1/tokens/:id */
  app.delete('/:id', { onRequest: auth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { id } = req.params as { id: string };
    await prisma.apiToken.deleteMany({ where: { id, userId: sub } });
    return reply.status(204).send();
  });
};
