import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/auth/login
  app.post('/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    logger.info({ userId: user.id }, 'User logged in');
    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  // GET /api/v1/auth/me
  app.get('/me', { onRequest: [(app as any).authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send(user);
  });
};
