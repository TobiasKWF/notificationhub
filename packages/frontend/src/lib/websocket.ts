import { useNotificationStore } from '@/stores/notifications';
import type { Notification } from '@/lib/api';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connectWebSocket() {
  if (ws && ws.readyState < 2) return;

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data) as { type: string; data?: Notification };
      if (msg.type === 'notification' && msg.data) {
        useNotificationStore.getState().pushLive(msg.data);
      }
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    reconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => ws?.close();
}

export function disconnectWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
}
