import type { Notification, Provider, ProviderType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { renderTemplate } from '../lib/template.js';
import { ntfyAdapter } from './ntfy.js';
import { telegramAdapter } from './telegram.js';
import { discordAdapter } from './discord.js';
import { emailAdapter } from './email.js';
import { webhookAdapter } from './webhook.js';
import { mqttAdapter } from './mqtt.js';

type Adapter = (config: Record<string, unknown>, notification: Notification) => Promise<void>;

const ADAPTERS: Partial<Record<ProviderType, Adapter>> = {
  NTFY:     ntfyAdapter,
  TELEGRAM: telegramAdapter,
  DISCORD:  discordAdapter,
  EMAIL:    emailAdapter,
  WEBHOOK:  webhookAdapter,
  MQTT:     mqttAdapter,
};

export async function dispatchToProvider(
  provider: Provider,
  notification: Notification,
  ruleId?: string,
): Promise<void> {
  const adapter = ADAPTERS[provider.type];
  if (!adapter) {
    logger.warn({ type: provider.type }, 'No adapter for provider type');
    return;
  }

  const config = JSON.parse(provider.config) as Record<string, unknown>;

  try {
    // Apply template if configured
    if (config.titleTemplate) notification = { ...notification, title:   renderTemplate(String(config.titleTemplate), notification) };
    if (config.bodyTemplate)  notification = { ...notification, message: renderTemplate(String(config.bodyTemplate),  notification) };

    await adapter(config, notification);
    await prisma.routingResult.create({
      data: { notificationId: notification.id, ruleId, providerId: provider.id, status: 'SENT' },
    });
  } catch (err) {
    logger.error({ err, provider: provider.id }, 'Provider dispatch failed');
    await prisma.routingResult.create({
      data: {
        notificationId: notification.id,
        ruleId,
        providerId: provider.id,
        status: 'FAILED',
        error: String(err),
      },
    });
  }
}

export async function testProvider(
  type: ProviderType,
  config: Record<string, unknown>,
): Promise<void> {
  const adapter = ADAPTERS[type];
  if (!adapter) throw new Error(`No adapter for type: ${type}`);
  const testNotification = {
    id: 'test',
    source: 'NotificationHub',
    service: 'Test',
    title: 'Test Notification',
    message: 'This is a test notification from NotificationHub.',
    priority: 'INFO',
    tags: '[]',
    hostname: 'notificationhub',
    externalId: null,
    timestamp: new Date(),
    receivedAt: new Date(),
    acknowledgedAt: null,
    acknowledgedById: null,
    duplicateOf: null,
    duplicateCount: 1,
    incidentId: null,
    extra: '{}',
  } as Notification;
  await adapter(config, testNotification);
}
