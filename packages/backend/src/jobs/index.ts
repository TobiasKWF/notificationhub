import { logger } from '../lib/logger.js';
import { retentionJob } from './retention.js';

export async function startBackgroundJobs(): Promise<void> {
  logger.info('Starting background jobs');
  retentionJob();
}
