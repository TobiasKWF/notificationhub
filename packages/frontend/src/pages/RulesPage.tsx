import { useEffect, useState } from 'react';
import { api, type Rule } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';

interface RuleForm { name: string; description: string; conditions: string; conditionLogic: string; isEnabled: boolean; }
const empty: RuleForm = { name: '', description: '', conditions: '[]', conditionLogic: 'AND', isEnabled: true };

export function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(empty);
  const { toast } = useToast();

  useEffect(() => {
    api.getRules().then(setRules).finally(() => setLoading(false));
  }, []);

  function startCreate() { setEditing('new'); setForm(empty); }
  function startEdit(r: Rule) {
    setEditing(r.id);
    setForm({ name: r.name, description: r.description ?? '', conditions: r.conditions, conditionLogic: r.conditionLogic, isEnabled: r.isEnabled });
  }
  function cancel() { setEditing(null); }

  async function save() {
    try {
      if (editing === 'new') {
        const created = await api.createRule(form);
        setRules((prev) => [...prev, created]);
        toast({ title: 'Rule created' });
      } else if (editing) {
        const updated = await api.updateRule(editing, form);
        setRules((prev) => prev.map((r) => r.id === editing ? updated : r));
        toast({ title: 'Rule updated' });
      }
      setEditing(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this rule?')) return;
    try {
      await api.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rules</h1>
        <Button size="sm" onClick={startCreate}><Plus className="size-4 mr-1" /> New Rule</Button>
      </div>

      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing === 'new' ? 'New Rule' : 'Edit Rule'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="space-y-1">
              <label className="text-sm font-medium">Conditions (JSON array)</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.conditions}
                onChange={(e) => setForm({ ...form, conditions: e.target.value })}
              />
            </div>
            <div className="flex gap-3 items-center">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.conditionLogic}
                onChange={(e) => setForm({ ...form, conditionLogic: e.target.value })}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} />
                Enabled
              </label>
            </div>
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
            {rules.length === 0 && <p className="text-sm text-muted-foreground">No rules defined.</p>}
            {rules.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.name}</span>
                      <Badge variant={r.isEnabled ? 'default' : 'secondary'}>{r.isEnabled ? 'enabled' : 'disabled'}</Badge>
                      <Badge variant="outline">{r.conditionLogic}</Badge>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{r.actions.length} action(s)</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
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
