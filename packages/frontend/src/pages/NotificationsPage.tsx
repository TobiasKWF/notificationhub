import { useEffect, useState } from 'react';
import { api, type Notification } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const priorityColor: Record<string, string> = {
  critical: 'destructive', high: 'destructive', medium: 'default', low: 'secondary',
};

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  async function load(p = 1, q = search) {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: '20' };
      if (q) params.search = q;
      const res = await api.getNotifications(params);
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setPages(res.pages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function ack(id: string) {
    try {
      const updated = await api.acknowledgeNotification(id);
      setItems((prev) => prev.map((n) => n.id === id ? updated : n));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function del(id: string) {
    try {
      await api.deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => t - 1);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications <span className="text-base font-normal text-muted-foreground">({total})</span></h1>
        <Input
          placeholder="Search…"
          className="w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(1, search)}
        />
      </div>

      {loading
        ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        : (
          <div className="space-y-2">
            {items.length === 0 && <p className="text-sm text-muted-foreground">No notifications found.</p>}
            {items.map((n) => (
              <Card key={n.id} className={n.acknowledgedAt ? 'opacity-60' : ''}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{n.title}</span>
                      <Badge variant={(priorityColor[n.priority] ?? 'secondary') as any}>{n.priority}</Badge>
                      {n.acknowledgedAt && <Badge variant="outline">ACK</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.source}{n.service ? ` · ${n.service}` : ''} · {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}</p>
                  </div>
                  <div className="flex gap-1">
                    {!n.acknowledgedAt && (
                      <Button size="icon" variant="ghost" onClick={() => ack(n.id)} title="Acknowledge">
                        <Check className="size-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => del(n.id)} title="Delete">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }

      {pages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>Prev</Button>
          <span className="text-sm">{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
