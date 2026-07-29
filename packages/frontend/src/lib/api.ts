import { useAuthStore } from '@/stores/auth';

const BASE = '/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ApiError(resp.status, body?.error ?? resp.statusText);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/auth/me'),

  // Notifications
  getNotifications: (params?: Record<string, string>) =>
    request<NotificationListResponse>(`/notifications?${new URLSearchParams(params).toString()}`),
  getNotification: (id: string) => request<Notification>(`/notifications/${id}`),
  getStats: () => request<Stats>('/notifications/stats/summary'),
  acknowledgeNotification: (id: string) =>
    request<Notification>(`/notifications/${id}/acknowledge`, { method: 'POST' }),
  bulkAcknowledge: (ids: string[]) =>
    request<{ acknowledged: number }>('/notifications/bulk/acknowledge', {
      method: 'POST', body: JSON.stringify({ ids }),
    }),
  bulkDelete: (ids: string[]) =>
    request<{ deleted: number }>('/notifications/bulk', {
      method: 'DELETE', body: JSON.stringify({ ids }),
    }),
  deleteNotification: (id: string) =>
    request<void>(`/notifications/${id}`, { method: 'DELETE' }),

  // Rules
  getRules: () => request<Rule[]>('/rules'),
  createRule: (data: unknown) =>
    request<Rule>('/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id: string, data: unknown) =>
    request<Rule>(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleRule: (id: string) =>
    request<Rule>(`/rules/${id}/toggle`, { method: 'PATCH' }),
  deleteRule: (id: string) =>
    request<void>(`/rules/${id}`, { method: 'DELETE' }),

  // Providers
  getProviders: () => request<Provider[]>('/providers'),
  createProvider: (data: unknown) =>
    request<Provider>('/providers', { method: 'POST', body: JSON.stringify(data) }),
  updateProvider: (id: string, data: unknown) =>
    request<Provider>(`/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProvider: (id: string) =>
    request<void>(`/providers/${id}`, { method: 'DELETE' }),
  testProvider: (id: string) =>
    request<{ success: boolean; error?: string }>(`/providers/${id}/test`, { method: 'POST' }),

  // Settings
  getSettings: () => request<Record<string, string>>('/settings'),
  updateSettings: (data: Record<string, string>) =>
    request<void>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Users
  getUsers: () => request<User[]>('/users'),
  createUser: (data: unknown) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: 'DELETE' }),

  // Send test notification
  sendTestNotification: (data: unknown) =>
    request<{ id: string }>('/notify', { method: 'POST', body: JSON.stringify(data) }),
};

// ---------- Types ----------
export interface User {
  id: string; name: string; email: string; role: string;
  isActive?: boolean; createdAt?: string;
}
export interface Notification {
  id: string; source: string; service?: string; title: string; message: string;
  priority: string; tags: string; hostname?: string; timestamp: string;
  receivedAt?: string; acknowledgedAt?: string | null; duplicateCount?: number;
}
export interface NotificationListResponse {
  items: Notification[]; total: number; page: number; limit: number; pages: number;
}
export interface Stats {
  today: number; week: number; critical: number; warnings: number;
  unacknowledged: number;
  byPriority: { priority: string; _count: { id: number } }[];
  bySource:   { source: string;   _count: { id: number } }[];
}
export interface Rule {
  id: string; name: string; description?: string; isEnabled: boolean;
  priority: number; conditions: string; conditionLogic: string;
  actions: RuleAction[]; createdAt: string;
}
export interface RuleAction {
  id: string; type: string; config: string; sortOrder: number;
  providerId?: string; provider?: Provider;
}
export interface Provider {
  id: string; name: string; type: string; isEnabled: boolean; createdAt: string;
}
