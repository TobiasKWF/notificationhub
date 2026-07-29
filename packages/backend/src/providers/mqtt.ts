import type { Notification } from '@prisma/client';
import { connect } from 'mqtt';

export async function mqttAdapter(
  config: Record<string, unknown>,
  n: Notification,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = connect(String(config.broker), {
      username:  config.username  ? String(config.username)  : undefined,
      password:  config.password  ? String(config.password)  : undefined,
      clientId:  `nhub_provider_${Date.now()}`,
      connectTimeout: 5_000,
    });

    const topic   = String(config.topic ?? `notifications/${n.source}`);
    const payload = JSON.stringify({
      id: n.id, source: n.source, title: n.title, message: n.message,
      priority: n.priority, tags: JSON.parse(n.tags), timestamp: n.timestamp,
    });

    client.once('connect', () => {
      client.publish(topic, payload, { qos: 1 }, (err) => {
        client.end();
        err ? reject(err) : resolve();
      });
    });
    client.once('error', reject);
  });
}
