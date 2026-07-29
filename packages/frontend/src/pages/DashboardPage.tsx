import { useEffect, useState } from 'react';
import { api, type Stats, type Notification } from '@/lib/api';
import { useNotificationStore } from '@/stores/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Bell, AlertTriangle, CheckCircle2, Activity, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const PRIORITY_COLORS: Record<string, string> = {
  EMERGENCY: '#7c3aed',
  CRITICAL:  '#dc2626',
  ERROR:     '#ef4444',
  WARNING:   '#eab308',
  INFO:      '#3b82f6',
  SUCCESS:   '#16a34a',
};

function StatCard({
  icon: Icon, label, value, sub, color,
}: { icon: any; label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg ${color ?? 'bg-muted'}`}>
          <Icon className="size-4 text-white" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const live = useNotificationStore((s) => s.live);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getNotifications({ limit: '15', page: '1' }),
    ])
      .then(([s, n]) => { setStats(s); setRecent(n.items); })
      .finally(() => setLoading(false));
  }, []);

  const allRecent = [...live, ...recent]
    .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i) // deduplicate
    .slice(0, 15);

  const chartData = (stats?.byPriority ?? []).map((d) => ({
    name: d.priority,
    count: d._count.id,
    fill: PRIORITY_COLORS[d.priority] ?? '#94a3b8',
  }));

  const sourceData = (stats?.bySource ?? [])
    .slice(0, 8)
    .map((d) => ({ name: d.source, count: d._count.id }));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {live.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            {live.length} live
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Bell}          label="Today"           value={stats?.today ?? 0}           color="bg-blue-600" />
        <StatCard icon={TrendingUp}    label="This week"       value={stats?.week ?? 0}            color="bg-indigo-600" />
        <StatCard icon={AlertTriangle} label="Critical / Error" value={(stats?.critical ?? 0)}    color="bg-red-600" />
        <StatCard icon={CheckCircle2}  label="Unacknowledged"  value={stats?.unacknowledged ?? 0} color="bg-yellow-600"
          sub={stats?.unacknowledged ? 'needs attention' : 'all clear'} />
      </div>

      {/* Charts row */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* By Priority */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }}
                    labelStyle={{ fontSize: 11 }}
                    itemStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* By Source */}
          {sourceData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">By Source (top 8)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={sourceData} layout="vertical" margin={{ top: 4, right: 8, left: 60, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }}
                      labelStyle={{ fontSize: 11 }}
                      itemStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="size-4" /> Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allRecent.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">No notifications yet.</p>
          )}
          <div className="divide-y divide-border">
            {allRecent.map((n) => (
              <div key={n.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                <PriorityBadge priority={n.priority} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.source}{n.service ? ` · ${n.service}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: de })}
                  </p>
                  {n.acknowledgedAt && (
                    <p className="text-[10px] text-green-500">ack</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
