import type { Notification } from '@prisma/client';

const PRIORITY_MAP: Record<string, number> = {
  INFO: 2, SUCCESS: 2, WARNING: 3, ERROR: 4, CRITICAL: 5, EMERGENCY: 5,
};

export async function ntfyAdapter(
  config: Record<string, unknown>,
  n: Notification,
): Promise<void> {
  const server = String(config.server ?? 'https://ntfy.sh');
  const topic  = String(config.topic  ?? 'notifications');
  const auth   = config.token ? `Bearer ${config.token}` : undefined;

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    'Title':        n.title,
    'Priority':     String(PRIORITY_MAP[n.priority] ?? 3),
    'Tags':         (JSON.parse(n.tags) as string[]).join(','),
  };
  if (auth) headers['Authorization'] = auth;

  const resp = await fetch(`${server}/${topic}`, {
    method: 'POST',
    headers,
    body: n.message,
  });

  if (!resp.ok) throw new Error(`ntfy responded ${resp.status}: ${await resp.text()}`);
}
