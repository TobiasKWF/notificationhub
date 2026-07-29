import { useEffect, useState } from 'react';
import { api, type Stats, type Notification } from '@/lib/api';
import { useNotificationStore } from '@/stores/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

const priorityColor: Record<string, string> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
};

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const live = useNotificationStore((s) => s.live);

  useEffect(() => {
    Promise.all([api.getStats(), api.getNotifications({ limit: '10', page: '1' })])
      .then(([s, n]) => {
        setStats(s);
        setRecent(n.items);
      })
      .finally(() => setLoading(false));
  }, []);

  const allRecent = [...live, ...recent].slice(0, 10);

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats?.today ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-destructive">{stats?.critical ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-yellow-500">{stats?.warnings ?? 0}</p></CardContent>
        </Card>
      </div>

      {/* Recent */}
      <Card>
        <CardHeader><CardTitle>Recent Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {allRecent.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
          {allRecent.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-md border border-border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{n.title}</span>
                  <Badge variant={(priorityColor[n.priority] ?? 'secondary') as any}>{n.priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
