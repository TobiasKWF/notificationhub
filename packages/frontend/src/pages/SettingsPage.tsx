import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    api.getSettings().then(setSettings).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      toast({ title: 'Settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      {loading
        ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        : (
          <Card>
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(settings).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <label className="text-sm font-medium">{key}</label>
                  <Input
                    value={value}
                    onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
              {Object.keys(settings).length === 0 && (
                <p className="text-sm text-muted-foreground">No settings available.</p>
              )}
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
            </CardContent>
          </Card>
        )
      }
    </div>
  );
}
