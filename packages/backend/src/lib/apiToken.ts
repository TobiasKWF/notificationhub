import crypto from 'crypto';
import { prisma } from './prisma.js';

/** Hash a raw token for storage */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Generate a new random API token. Returns { raw, prefix, hash } */
export function generateToken(): { raw: string; prefix: string; hash: string } {
  const raw = `nhub_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = raw.slice(0, 12);
  const hash = hashToken(raw);
  return { raw, prefix, hash };
}

/** Validate an incoming X-API-Key header value. Returns userId or null. */
export async function validateApiToken(raw: string): Promise<{ userId: string } | null> {
  const hash = hashToken(raw);
  const token = await prisma.apiToken.findUnique({ where: { tokenHash: hash } });
  if (!token) return null;
  if (token.expiresAt && token.expiresAt < new Date()) return null;

  // Update last-used timestamp (fire-and-forget)
  prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return { userId: token.userId };
}
