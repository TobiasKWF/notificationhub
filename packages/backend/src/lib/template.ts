/**
 * Mustache-style template renderer.
 * Supports: {{title}}, {{message}}, {{source}}, {{service}},
 *           {{priority}}, {{hostname}}, {{timestamp}}, {{tags}}
 */
import type { Notification } from '@prisma/client';

export function renderTemplate(template: string, notification: Notification): string {
  const vars: Record<string, string> = {
    title:     notification.title,
    message:   notification.message,
    source:    notification.source,
    service:   notification.service ?? '',
    priority:  notification.priority,
    hostname:  notification.hostname ?? '',
    timestamp: notification.timestamp.toISOString(),
    tags:      (JSON.parse(notification.tags) as string[]).join(', '),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
