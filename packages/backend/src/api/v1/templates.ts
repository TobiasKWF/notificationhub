import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { renderTemplate } from '../../lib/template.js';

const TemplateSchema = z.object({
  name:      z.string().min(1).max(100),
  subject:   z.string().max(255).optional(),
  body:      z.string().min(1),
  isDefault: z.boolean().optional().default(false),
});

export const templatesRoutes: FastifyPluginAsync = async (app) => {
  const auth = [(app as any).authenticate];

  /** GET /api/v1/templates */
  app.get('/', { onRequest: auth }, async (_req, reply) => {
    const templates = await prisma.template.findMany({ orderBy: { name: 'asc' } });
    return reply.send(templates);
  });

  /** GET /api/v1/templates/:id */
  app.get('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) return reply.status(404).send({ error: 'Not found' });
    return reply.send(template);
  });

  /** POST /api/v1/templates */
  app.post('/', { onRequest: auth }, async (req, reply) => {
    const data = TemplateSchema.parse(req.body);
    const template = await prisma.template.create({ data });
    return reply.status(201).send(template);
  });

  /** PUT /api/v1/templates/:id */
  app.put('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = TemplateSchema.partial().parse(req.body);
    const template = await prisma.template.update({ where: { id }, data });
    return reply.send(template);
  });

  /** DELETE /api/v1/templates/:id */
  app.delete('/:id', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.template.delete({ where: { id } });
    return reply.status(204).send();
  });

  /** POST /api/v1/templates/:id/preview – render with sample data */
  app.post('/:id/preview', { onRequest: auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) return reply.status(404).send({ error: 'Not found' });

    const vars = (req.body as any) ?? {};
    const rendered = {
      subject: template.subject ? renderTemplate(template.subject, vars) : null,
      body:    renderTemplate(template.body, vars),
    };
    return reply.send(rendered);
  });
};
