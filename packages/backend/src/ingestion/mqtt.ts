/**
 * MQTT Ingestion – subscribes to notifications/# and injects into the pipeline.
 */
import { connect } from 'mqtt';
import { prisma } from '../lib/prisma.js';
import { eventBus } from '../lib/eventBus.js';
import { processNotification } from '../core/rulesEngine.js';
import { logger } from '../lib/logger.js';
import { NotificationSchema } from '../api/v1/notify.js';

export async function connectMqtt(): Promise<void> {
  const broker = process.env.MQTT_BROKER ?? 'mqtt://localhost:1883';
  const topic  = process.env.MQTT_TOPIC  ?? 'notifications/#';

  const client = connect(broker, {
    username:  process.env.MQTT_USERNAME,
    password:  process.env.MQTT_PASSWORD,
    clientId: `nhub_ingestion_${Date.now()}`,
  });

  client.on('connect', () => {
    client.subscribe(topic, { qos: 1 });
    logger.info({ broker, topic }, 'MQTT ingestion connected');
  });

  client.on('message', async (_topic, payload) => {
    try {
      const raw = JSON.parse(payload.toString());
      const data = NotificationSchema.parse(raw);
      const n = await prisma.notification.create({
        data: {
          source:   data.source,
          service:  data.service,
          title:    data.title,
          message:  data.message,
          priority: data.priority,
          tags:     JSON.stringify(data.tags),
          hostname: data.hostname,
          extra:    JSON.stringify(data.extra),
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        },
      });
      eventBus.emitNotification(n);
      await processNotification(n);
    } catch (err) {
      logger.warn({ err, payload: payload.toString() }, 'Failed to process MQTT message');
    }
  });

  client.on('error', (err) => logger.error(err, 'MQTT ingestion error'));
}
