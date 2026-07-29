import type { Notification } from '@prisma/client';

export async function webhookAdapter(
  config: Record<string, unknown>,
  n: Notification,
): Promise<void> {
  const url     = String(config.url);
  const method  = String(config.method ?? 'POST').toUpperCase();
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    ...(config.headers as Record<string,string> ?? {}),
  };
  if (config.secret) headers['X-Hub-Secret'] = String(config.secret);

  const resp = await fetch(url, {
    method,
    headers,
    body: JSON.stringify({
      id:        n.id,
      source:    n.source,
      service:   n.service,
      title:     n.title,
      message:   n.message,
      priority:  n.priority,
      tags:      JSON.parse(n.tags),
      hostname:  n.hostname,
      timestamp: n.timestamp,
    }),
  });

  if (!resp.ok) throw new Error(`Webhook responded ${resp.status}: ${await resp.text()}`);
}
