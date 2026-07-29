import type { Notification } from '@prisma/client';

const EMOJI: Record<string, string> = {
  INFO: 'ℹ️', SUCCESS: '✅', WARNING: '⚠️', ERROR: '❌', CRITICAL: '🚨', EMERGENCY: '🔴',
};

export async function telegramAdapter(
  config: Record<string, unknown>,
  n: Notification,
): Promise<void> {
  const token  = String(config.botToken);
  const chatId = String(config.chatId);

  const emoji = EMOJI[n.priority] ?? '🔔';
  const tags  = (JSON.parse(n.tags) as string[]).map(t => `#${t}`).join(' ');

  const text = [
    `${emoji} *${escMd(n.title)}*`,
    ``,
    escMd(n.message),
    ``,
    `│ Source: \`${escMd(n.source)}\``,
    n.service  ? `│ Service: \`${escMd(n.service)}\`` : null,
    n.hostname ? `│ Host: \`${escMd(n.hostname)}\`` : null,
    tags       ? `│ Tags: ${tags}` : null,
  ].filter(Boolean).join('\n');

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
  });

  if (!resp.ok) throw new Error(`Telegram error ${resp.status}: ${await resp.text()}`);
}

function escMd(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
