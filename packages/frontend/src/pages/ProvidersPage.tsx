import { useEffect, useState } from 'react';
import { api, type Provider } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, Plus, Check, X, Play } from 'lucide-react';

const PROVIDER_TYPES = ['email', 'webhook', 'slack', 'telegram', 'ntfy', 'gotify', 'matrix', 'pagerduty'];

interface ProviderForm { name: string; type: string; isEnabled: boolean; config: string; }
const empty: ProviderForm = { name: '', type: 'webhook', isEnabled: true, config: '{}' };

export function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderForm>(empty);
  const { toast } = useToast();

  useEffect(() => {
    api.getProviders().then(setProviders).finally(() => setLoading(false));
  }, []);

  function startCreate() { setEditing('new'); setForm(empty); }
  function startEdit(p: Provider) {
    setEditing(p.id);
    setForm({ name: p.name, type: p.type, isEnabled: p.isEnabled, config: '{}' });
  }
  function cancel() { setEditing(null); }

  async function save() {
    try {
      const data = { ...form, config: JSON.parse(form.config) };
      if (editing === 'new') {
        const created = await api.createProvider(data);
        setProviders((prev) => [...prev, created]);
        toast({ title: 'Provider created' });
      } else if (editing) {
        const updated = await api.updateProvider(editing, data);
        setProviders((prev) => prev.map((p) => p.id === editing ? updated : p));
        toast({ title: 'Provider updated' });
      }
      setEditing(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this provider?')) return;
    try {
      await api.deleteProvider(id);
      setProviders((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function testProv(id: string) {
    try {
      const res = await api.testProvider(id);
      if (res.success) toast({ title: 'Test successful ✓' });
      else toast({ title: 'Test failed', description: res.error, variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Providers</h1>
        <Button size="sm" onClick={startCreate}><Plus className="size-4 mr-1" /> New Provider</Button>
      </div>

      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing === 'new' ? 'New Provider' : 'Edit Provider'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {PROVIDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="space-y-1">
              <label className="text-sm font-medium">Config (JSON)</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.config}
                onChange={(e) => setForm({ ...form, config: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} />
              Enabled
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={save}><Check className="size-4 mr-1" /> Save</Button>
              <Button size="sm" variant="outline" onClick={cancel}><X className="size-4 mr-1" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        : (
          <div className="space-y-2">
            {providers.length === 0 && <p className="text-sm text-muted-foreground">No providers configured.</p>}
            {providers.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.name}</span>
                      <Badge variant="outline">{p.type}</Badge>
                      <Badge variant={p.isEnabled ? 'default' : 'secondary'}>{p.isEnabled ? 'enabled' : 'disabled'}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => testProv(p.id)} title="Test"><Play className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
}
