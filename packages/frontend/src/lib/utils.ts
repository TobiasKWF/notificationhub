import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PRIORITY_LEVELS = ['INFO','SUCCESS','WARNING','ERROR','CRITICAL','EMERGENCY'] as const;
export type Priority = typeof PRIORITY_LEVELS[number];

export function priorityClass(p: Priority): string {
  return `priority-${p.toLowerCase()}`;
}

export function priorityIcon(p: Priority): string {
  const map: Record<Priority, string> = {
    INFO: 'ℹ️', SUCCESS: '✅', WARNING: '⚠️',
    ERROR: '❌', CRITICAL: '🚨', EMERGENCY: '🔴',
  };
  return map[p];
}

export function formatRelative(date: string | Date): string {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString();
}
