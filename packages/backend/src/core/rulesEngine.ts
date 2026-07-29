/**
 * Core Rules Engine
 */
import type { Notification, Rule, RuleAction, Provider } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { dispatchToProvider } from '../providers/index.js';

type RuleWithActions = Rule & { actions: (RuleAction & { provider: Provider | null })[] };

export type ConditionOperator =
  | 'eq' | 'neq' | 'contains' | 'not_contains'
  | 'regex' | 'in' | 'gt' | 'lt' | 'exists';

export type Condition = {
  field: string;
  operator: ConditionOperator;
  value: string | string[];
};

export type ConditionLogic = 'AND' | 'OR';

function evaluateCondition(n: Notification, cond: Condition): boolean {
  const tags: string[] = JSON.parse(n.tags);

  const fieldValue = ((): string | string[] | undefined => {
    switch (cond.field) {
      case 'source':   return n.source;
      case 'service':  return n.service ?? '';
      case 'priority': return n.priority;
      case 'hostname': return n.hostname ?? '';
      case 'title':    return n.title;
      case 'message':  return n.message;
      case 'tags':     return tags;
      default:
        try { return (JSON.parse(n.extra) as Record<string, string>)[cond.field]; }
        catch { return undefined; }
    }
  })();

  if (fieldValue === undefined) return false;

  const val = String(cond.value);
  const fv  = Array.isArray(fieldValue) ? fieldValue : [String(fieldValue)];

  switch (cond.operator) {
    case 'eq':           return fv[0] === val;
    case 'neq':          return fv[0] !== val;
    case 'contains':     return fv.some(v => v.toLowerCase().includes(val.toLowerCase()));
    case 'not_contains': return !fv.some(v => v.toLowerCase().includes(val.toLowerCase()));
    case 'regex': {
      try { return new RegExp(val).test(fv.join(' ')); } catch { return false; }
    }
    case 'in':
      return Array.isArray(cond.value)
        ? (cond.value as string[]).includes(fv[0])
        : val.split(',').map(s => s.trim()).includes(fv[0]);
    case 'gt':    return Number(fv[0]) > Number(val);
    case 'lt':    return Number(fv[0]) < Number(val);
    case 'exists':return fv.length > 0 && fv[0] !== '';
    default:      return false;
  }
}

export function evaluateConditions(
  conditions: Condition[],
  logic: ConditionLogic = 'AND',
  notification: Notification,
): boolean {
  if (conditions.length === 0) return true;
  return logic === 'AND'
    ? conditions.every(c => evaluateCondition(notification, c))
    : conditions.some(c  => evaluateCondition(notification, c));
}

function evaluateRule(n: Notification, rule: Rule): boolean {
  const conditions: Condition[] = JSON.parse(rule.conditions);
  return evaluateConditions(conditions, rule.conditionLogic as ConditionLogic, n);
}

async function executeAction(
  action: RuleAction & { provider: Provider | null },
  notification: Notification,
  ruleId: string,
): Promise<void> {
  const config = JSON.parse(action.config) as Record<string, unknown>;

  switch (action.type) {
    case 'DROP':
      logger.debug({ notificationId: notification.id }, 'Rule action: DROP');
      return;
    case 'STORE':
      return;
    case 'FORWARD':
      if (!action.provider) { logger.warn({ actionId: action.id }, 'FORWARD has no provider'); return; }
      await dispatchToProvider(action.provider, notification, ruleId);
      return;
    case 'ADD_TAG': {
      const tags: string[] = JSON.parse(notification.tags);
      const tag = String(config.tag ?? '');
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
        await prisma.notification.update({
          where: { id: notification.id },
          data:  { tags: JSON.stringify(tags) },
        });
      }
      return;
    }
    case 'MODIFY': {
      const update: Record<string, unknown> = {};
      if (config.priority) update.priority = config.priority;
      if (config.title)    update.title    = config.title;
      if (Object.keys(update).length)
        await prisma.notification.update({ where: { id: notification.id }, data: update as any });
      return;
    }
    case 'ESCALATE':
      logger.info({ notificationId: notification.id, policy: config.policyId }, 'Escalation triggered');
      return;
    default:
      logger.warn({ type: action.type }, 'Unhandled action type');
  }
}

let cachedRules: RuleWithActions[] = [];
let cacheTs = 0;
const CACHE_TTL_MS = 5_000;

async function loadRules(): Promise<RuleWithActions[]> {
  if (cachedRules.length > 0 && Date.now() - cacheTs < CACHE_TTL_MS) return cachedRules;
  cachedRules = await prisma.rule.findMany({
    where:   { isEnabled: true },
    orderBy: { priority: 'asc' },
    include: { actions: { include: { provider: true }, orderBy: { sortOrder: 'asc' } } },
  });
  cacheTs = Date.now();
  return cachedRules;
}

export function invalidateRulesCache(): void {
  cachedRules = [];
}

export async function processNotification(notification: Notification): Promise<void> {
  const rules = await loadRules();
  for (const rule of rules) {
    if (!evaluateRule(notification, rule)) continue;
    logger.debug({ ruleId: rule.id, notificationId: notification.id }, 'Rule matched');
    for (const action of rule.actions) {
      await executeAction(action, notification, rule.id);
    }
    if (rule.stopProcessing) break;
  }
}
