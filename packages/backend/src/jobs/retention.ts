/**
 * Retention job – deletes notifications older than RETENTION_DAYS.
 * Runs every hour.
 */
import { CronJob } from 'cron';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export function retentionJob(): void {
  const days = Number(process.env.RETENTION_DAYS ?? 90);

  const job = new CronJob('0 * * * *', async () => {
    if (days <= 0) return;
    const cutoff = new Date(Date.now() - days * 86_400_000);
    try {
      const { count } = await prisma.notification.deleteMany({
        where: { timestamp: { lt: cutoff } },
      });
      if (count > 0) logger.info({ count, cutoff }, 'Retention: deleted old notifications');
    } catch (err) {
      logger.error(err, 'Retention job error');
    }
  });

  job.start();
  logger.info({ days }, 'Retention job scheduled (hourly)');
}
