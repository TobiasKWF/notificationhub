import { useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/stores/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Plus, Check, X } from 'lucide-react';

interface UserForm { name: string; email: string; password: string; role: string; }
const empty: UserForm = { name: '', email: '', password: '', role: 'user' };

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserForm>(empty);
  const currentUser = useAuthStore((s) => s.user);
  const { toast } = useToast();

  useEffect(() => {
    api.getUsers().then(setUsers).finally(() => setLoading(false));
  }, []);

  async function create() {
    try {
      const created = await api.createUser(form);
      setUsers((prev) => [...prev, created]);
      setCreating(false);
      setForm(empty);
      toast({ title: 'User created' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function del(id: string) {
    if (id === currentUser?.id) return toast({ title: 'Cannot delete yourself', variant: 'destructive' });
    if (!confirm('Delete this user?')) return;
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button size="sm" onClick={() => { setCreating(true); setForm(empty); }}><Plus className="size-4 mr-1" /> New User</Button>
      </div>

      {creating && (
        <Card>
          <CardHeader><CardTitle>New User</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={create}><Check className="size-4 mr-1" /> Create</Button>
              <Button size="sm" variant="outline" onClick={() => setCreating(false)}><X className="size-4 mr-1" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        : (
          <div className="space-y-2">
            {users.map((u) => (
              <Card key={u.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{u.name}</span>
                      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                      {u.id === currentUser?.id && <Badge variant="outline">You</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => del(u.id)} disabled={u.id === currentUser?.id}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
}
