import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { auditLog } from '../../lib/audit.js';

const CreateUserSchema = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().email(),
  password: z.string().min(8),
  role:     z.enum(['ADMIN', 'OPERATOR', 'VIEWER']).default('VIEWER'),
});

export const usersRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  /** GET /api/v1/users */
  app.get('/', { onRequest: auth }, async (_req, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(users);
  });

  /** GET /api/v1/users/:id */
  app.get('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    if (!user) return reply.status(404).send({ error: 'Not found' });
    return reply.send(user);
  });

  /** POST /api/v1/users */
  app.post('/', { onRequest: auth }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = CreateUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash, role: body.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    auditLog({ userId: sub, action: 'create', resource: 'user', resourceId: user.id });
    return reply.status(201).send(user);
  });

  /** PATCH /api/v1/users/:id – update name, role, isActive */
  app.patch('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const body = req.body as { name?: string; role?: string; isActive?: boolean };
    const user = await prisma.user.update({
      where: { id },
      data: {
        name:     body.name,
        role:     body.role     as any,
        isActive: body.isActive,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    auditLog({ userId: sub, action: 'update', resource: 'user', resourceId: id });
    return reply.send(user);
  });

  /** DELETE /api/v1/users/:id */
  app.delete('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    if (id === sub) return reply.status(400).send({ error: 'Cannot delete yourself' });
    await prisma.user.delete({ where: { id } });
    auditLog({ userId: sub, action: 'delete', resource: 'user', resourceId: id });
    return reply.status(204).send();
  });
};
