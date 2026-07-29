import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return reply.send(users);
  });

  app.post('/', async (req, reply) => {
    const body = req.body as any;
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash, role: body.role ?? 'VIEWER' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return reply.status(201).send(user);
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.delete({ where: { id } });
    return reply.status(204).send();
  });
};
