import nodemailer from 'nodemailer';
import type { Notification } from '@prisma/client';
import { renderTemplate } from '../lib/template.js';

export async function emailAdapter(
  config: Record<string, unknown>,
  n: Notification,
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: String(config.host),
    port: Number(config.port ?? 587),
    secure: Boolean(config.secure ?? false),
    auth: config.user ? { user: String(config.user), pass: String(config.pass ?? '') } : undefined,
  });

  const defaultBody = `{{title}}\n\n{{message}}\n\nSource: {{source}}\nPriority: {{priority}}\nHost: {{hostname}}`;
  const bodyTpl = String(config.bodyTemplate ?? defaultBody);

  await transport.sendMail({
    from: String(config.from),
    to:   String(config.to),
    subject: `[${n.priority}] ${n.title}`,
    text: renderTemplate(bodyTpl, n),
  });
}
