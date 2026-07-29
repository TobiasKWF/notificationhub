import 'dotenv/config';
import { buildApp } from './app.js';
import { logger } from './lib/logger.js';
import { startBackgroundJobs } from './jobs/index.js';
import { connectMqtt } from './ingestion/mqtt.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main() {
  const app = await buildApp();

  await startBackgroundJobs();

  if (process.env.MQTT_ENABLED === 'true') {
    await connectMqtt();
  }

  await app.listen({ port: PORT, host: HOST });
  logger.info({ port: PORT, host: HOST }, 'NotificationHub started 🔔');
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
