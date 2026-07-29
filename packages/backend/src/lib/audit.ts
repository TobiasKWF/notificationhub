import { prisma } from './prisma.js';

export interface AuditParams {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

/**
 * Write an audit log entry (fire-and-forget, never throws).
 * Call from route handlers after successful mutations.
 */
export function auditLog(params: AuditParams): void {
  prisma.auditLog.create({
    data: {
      userId:     params.userId,
      action:     params.action,
      resource:   params.resource,
      resourceId: params.resourceId,
      details:    JSON.stringify(params.details ?? {}),
      ip:         params.ip,
    },
  }).catch(() => { /* silent */ });
}
