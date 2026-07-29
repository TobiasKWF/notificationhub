import { create } from 'zustand';
import type { Notification } from '@/lib/api';

interface NotificationStore {
  live: Notification[];
  pushLive: (n: Notification) => void;
  clearLive: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  live: [],
  pushLive: (n) =>
    set((s) => ({ live: [n, ...s.live].slice(0, 100) })),
  clearLive: () => set({ live: [] }),
}));
