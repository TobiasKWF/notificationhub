import type { Notification } from '@prisma/client';

const COLOR_MAP: Record<string, number> = {
  INFO: 0x5865f2, SUCCESS: 0x57f287, WARNING: 0xfee75c,
  ERROR: 0xed4245, CRITICAL: 0xff0000, EMERGENCY: 0x990000,
};

export async function discordAdapter(
  config: Record<string, unknown>,
  n: Notification,
): Promise<void> {
  const url = String(config.webhookUrl);

  const embed = {
    title:       n.title,
    description: n.message,
    color:       COLOR_MAP[n.priority] ?? COLOR_MAP.INFO,
    timestamp:   n.timestamp.toISOString(),
    fields: [
      { name: 'Source',   value: n.source,             inline: true },
      { name: 'Priority', value: n.priority,            inline: true },
      n.hostname ? { name: 'Host', value: n.hostname, inline: true } : null,
      n.service  ? { name: 'Service', value: n.service, inline: true } : null,
    ].filter(Boolean),
    footer: { text: 'NotificationHub' },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!resp.ok) throw new Error(`Discord error ${resp.status}: ${await resp.text()}`);
}
