import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z, ZodError } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { auditLog } from '../../lib/audit.js';

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  /** POST /api/v1/auth/login */
  app.post('/login', async (req, reply) => {
    try {
      const body = LoginSchema.parse(req.body);

      let user: any;
      try {
        user = await prisma.user.findUnique({ where: { email: body.email } });
      } catch (dbErr: any) {
        logger.error({ err: dbErr }, 'DB error during login');
        return reply.status(500).send({ error: 'Database error: ' + (dbErr?.message ?? String(dbErr)) });
      }

      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

      const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
      logger.info({ userId: user.id }, 'User logged in');
      auditLog({ userId: user.id, action: 'login', resource: 'auth', ip: req.ip });

      return reply.send({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: 'Invalid request: ' + err.errors.map(e => e.message).join(', ') });
      }
      logger.error({ err }, 'Unexpected login error');
      return reply.status(500).send({ error: err?.message ?? 'Internal Server Error' });
    }
  });

  /** GET /api/v1/auth/me */
  app.get('/me', { onRequest: auth }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send(user);
  });

  /** POST /api/v1/auth/change-password */
  app.post('/change-password', { onRequest: auth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = ChangePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) return reply.status(400).send({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({ where: { id: sub }, data: { passwordHash: newHash } });
    auditLog({ userId: sub, action: 'change_password', resource: 'auth', ip: req.ip });

    return reply.send({ success: true });
  });

  /** POST /api/v1/auth/logout – client-side only (stateless JWT), just audit */
  app.post('/logout', { onRequest: auth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    auditLog({ userId: sub, action: 'logout', resource: 'auth', ip: req.ip });
    return reply.send({ success: true });
  });
};
