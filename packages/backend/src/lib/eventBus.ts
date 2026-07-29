/**
 * In-process event bus: decouples ingestion from the rules engine
 * and WebSocket broadcast layer.
 */
import { EventEmitter } from 'events';
import type { Notification } from '@prisma/client';

class NotificationEventBus extends EventEmitter {
  emitNotification(notification: Notification) {
    this.emit('notification', notification);
  }

  onNotification(listener: (n: Notification) => void) {
    this.on('notification', listener);
  }
}

export const eventBus = new NotificationEventBus();
