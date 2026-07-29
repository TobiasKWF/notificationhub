import { useEffect, useState, useCallback } from 'react';
import { api, type Notification } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { NotificationDetailSheet } from '@/components/shared/NotificationDetailSheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Check, Trash2, RefreshCw, CheckCheck, Filter, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const PRIORITIES = ['EMERGENCY', 'CRITICAL', 'ERROR', 'WARNING', 'INFO', 'SUCCESS'];
const TIME_RANGES = [
  { label: 'All time', value: '' },
  { label: 'Last hour', value: '1h' },
  { label: 'Last 6 h', value: '6h' },
  { label: 'Last 24 h', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
];

function timeRangeToSince(range: string): string {
  if (!range) return '';
  const now = new Date();
  const map: Record<string, number> = {
    '1h':  60 * 60 * 1000,
    '6h':  6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d':  7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return new Date(now.getTime() - (map[range] ?? 0)).toISOString();
}

export function NotificationsPage() {
  const [items, setItems]       = useState<Notification[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail]     = useState<Notification | null>(null);

  // Filters
  const [search, setSearch]         = useState('');
  const [priority, setPriority]     = useState('');
  const [source, setSource]         = useState('');
  const [ackFilter, setAckFilter]   = useState('');   // '' | 'unacked' | 'acked'
  const [timeRange, setTimeRange]   = useState('');
  const [sources, setSources]       = useState<string[]>([]);

  const { toast } = useToast();

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: '25' };
      if (search)    params.search   = search;
      if (priority)  params.priority = priority;
      if (source)    params.source   = source;
      if (ackFilter === 'unacked') params.acknowledged = 'false';
      if (ackFilter === 'acked')   params.acknowledged = 'true';
      if (timeRange) params.since    = timeRangeToSince(timeRange);

      const res = await api.getNotifications(params);
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setPages(res.pages);

      // Collect unique sources for filter dropdown
      if (p === 1 && !source) {
        setSources((prev) => {
          const all = new Set([...prev, ...res.items.map((n) => n.source)]);
          return Array.from(all).sort();
        });
      }
    } catch (err: any) {
      toast({ title: 'Load error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, priority, source, ackFilter, timeRange]);

  useEffect(() => { load(1); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, priority, source, ackFilter, timeRange]);

  const hasActiveFilter = search || priority || source || ackFilter || timeRange;

  function clearFilters() {
    setSearch(''); setPriority(''); setSource(''); setAckFilter(''); setTimeRange('');
  }

  // Toggle selection
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(items.every((n) => selected.has(n.id)) ? new Set() : new Set(items.map((n) => n.id)));
  }

  async function ack(id: string) {
    try {
      const updated = await api.acknowledgeNotification(id);
      setItems((prev) => prev.map((n) => n.id === id ? updated : n));
      if (detail?.id === id) setDetail(updated);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function del(id: string) {
    try {
      await api.deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => t - 1);
      if (detail?.id === id) setDetail(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function bulkAck() {
    const ids = Array.from(selected);
    try {
      await api.bulkAcknowledge(ids);
      setItems((prev) => prev.map((n) => selected.has(n.id) ? { ...n, acknowledgedAt: new Date().toISOString() } : n));
      setSelected(new Set());
      toast({ title: `${ids.length} notifications acknowledged` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function bulkDel() {
    const ids = Array.from(selected);
    try {
      await api.bulkDelete(ids);
      setItems((prev) => prev.filter((n) => !selected.has(n.id)));
      setTotal((t) => t - ids.length);
      setSelected(new Set());
      toast({ title: `${ids.length} notifications deleted` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">
            Notifications
            <span className="ml-2 text-base font-normal text-muted-foreground">{total.toLocaleString()}</span>
          </h1>
          <Button variant="outline" size="sm" onClick={() => load(page)}>
            <RefreshCw className="size-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
          <Filter className="size-4 text-muted-foreground shrink-0" />

          <Input
            placeholder="Search title / message…"
            className="h-8 w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select value={priority || 'all'} onValueChange={(v) => setPriority(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          {sources.length > 0 && (
            <Select value={source || 'all'} onValueChange={(v) => setSource(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={ackFilter || 'all'} onValueChange={(v) => setAckFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unacked">Unacknowledged</SelectItem>
              <SelectItem value="acked">Acknowledged</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange || 'all'} onValueChange={(v) => setTimeRange(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Time range" /></SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => <SelectItem key={r.value || 'all'} value={r.value || 'all'}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasActiveFilter && (
            <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
              <X className="size-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md border border-primary/20">
            <span className="text-sm font-medium ml-1">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={bulkAck}>
              <CheckCheck className="size-3.5 mr-1.5" /> Acknowledge all
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={bulkDel}>
              <Trash2 className="size-3.5 mr-1.5" /> Delete all
            </Button>
          </div>
        )}

        {/* Table header */}
        {!loading && items.length > 0 && (
          <div className="flex items-center gap-3 px-3 py-1 text-xs text-muted-foreground border-b border-border">
            <input
              type="checkbox"
              className="size-3.5 rounded"
              checked={items.every((n) => selected.has(n.id))}
              onChange={selectAll}
            />
            <span className="w-20">Priority</span>
            <span className="flex-1">Title</span>
            <span className="w-28">Source</span>
            <span className="w-28 text-right">Time</span>
            <span className="w-16" />
          </div>
        )}

        {/* Rows */}
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          : (
            <div className="divide-y divide-border rounded-md border border-border">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground p-8 text-center">No notifications match your filters.</p>
              )}
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors
                    ${n.acknowledgedAt ? 'opacity-50' : ''}
                    ${detail?.id === n.id ? 'bg-muted' : ''}`}
                  onClick={() => setDetail(detail?.id === n.id ? null : n)}
                >
                  <input
                    type="checkbox"
                    className="size-3.5 rounded shrink-0"
                    checked={selected.has(n.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(n.id)}
                  />
                  <span className="w-20 shrink-0"><PriorityBadge priority={n.priority} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                  </div>
                  <span className="w-28 text-xs text-muted-foreground truncate hidden sm:block">{n.source}</span>
                  <span className="w-28 text-xs text-muted-foreground text-right whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: de })}
                  </span>
                  <div className="flex gap-0.5 w-16 justify-end" onClick={(e) => e.stopPropagation()}>
                    {!n.acknowledgedAt && (
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => ack(n.id)} title="Acknowledge">
                        <Check className="size-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => del(n.id)} title="Delete">
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        }

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center gap-2 justify-between pt-1">
            <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Sheet (inline slide-in) */}
      {detail && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDetail(null)} />
          <NotificationDetailSheet
            notification={detail}
            onClose={() => setDetail(null)}
            onAck={ack}
          />
        </>
      )}
    </div>
  );
}
