import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { X, Server, Tag, Clock, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from './PriorityBadge';
import type { Notification } from '@/lib/api';

interface Props {
  notification: Notification | null;
  onClose: () => void;
  onAck: (id: string) => void;
}

export function NotificationDetailSheet({ notification: n, onClose, onAck }: Props) {
  if (!n) return null;

  const tags: string[] = (() => { try { return JSON.parse(n.tags); } catch { return []; } })();

  function copyId() {
    navigator.clipboard.writeText(n!.id);
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={n.priority} />
            {n.acknowledgedAt && (
              <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="size-3" /> Acknowledged</span>
            )}
          </div>
          <h2 className="mt-2 font-semibold text-base leading-tight">{n.title}</h2>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="size-4" /></Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Message */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Message</p>
          <p className="text-sm whitespace-pre-wrap break-words">{n.message}</p>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Source</p>
            <p className="font-medium">{n.source}</p>
          </div>
          {n.service && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Service</p>
              <p className="font-medium">{n.service}</p>
            </div>
          )}
          {n.hostname && (
            <div className="flex items-start gap-1">
              <Server className="size-3 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Hostname</p>
                <p className="font-medium">{n.hostname}</p>
              </div>
            </div>
          )}
          {(n.duplicateCount ?? 1) > 1 && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Duplicates</p>
              <p className="font-medium">{n.duplicateCount}x</p>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <Tag className="size-3" /> Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="space-y-1 text-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Clock className="size-3" /> Timeline
          </p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Received</span>
            <span>{format(new Date(n.timestamp), 'dd.MM.yyyy HH:mm:ss')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Relative</span>
            <span>{formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: de })}</span>
          </div>
          {n.acknowledgedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Acknowledged</span>
              <span>{format(new Date(n.acknowledgedAt), 'dd.MM.yyyy HH:mm:ss')}</span>
            </div>
          )}
        </div>

        {/* ID */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">ID</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{n.id}</code>
            <Button size="icon" variant="ghost" className="size-7" onClick={copyId}><Copy className="size-3" /></Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      {!n.acknowledgedAt && (
        <div className="p-4 border-t border-border">
          <Button className="w-full" onClick={() => onAck(n.id)}>
            <CheckCircle2 className="size-4 mr-2" /> Acknowledge
          </Button>
        </div>
      )}
    </div>
  );
}
