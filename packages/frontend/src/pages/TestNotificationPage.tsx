import { useState } from 'react';
import { Send, CheckCircle2, XCircle, Loader2, FlaskConical } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

type Severity = 'info' | 'warning' | 'critical';

interface TestResult {
  ok: boolean;
  message: string;
  detail?: string;
}

export function TestNotificationPage() {
  const token = useAuthStore((s) => s.token);

  const [title,    setTitle]    = useState('Test Notification');
  const [message,  setMessage]  = useState('This is a test notification sent from the NotificationHub UI.');
  const [severity, setSeverity] = useState<Severity>('info');
  const [channel,  setChannel]  = useState('__all__');
  const [source,   setSource]   = useState('ui-test');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<TestResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        title,
        message,
        severity,
        source,
      };
      if (channel !== '__all__') body.channel = channel;

      const res = await fetch('/api/v1/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setResult({
          ok: true,
          message: 'Notification sent successfully!',
          detail: data.id ? `ID: ${data.id}` : undefined,
        });
      } else {
        setResult({
          ok: false,
          message: `Error ${res.status}: ${data.error ?? res.statusText}`,
        });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err.message ?? 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  const severityOptions: { value: Severity; label: string; color: string }[] = [
    { value: 'info',     label: 'Info',     color: 'text-blue-500' },
    { value: 'warning',  label: 'Warning',  color: 'text-yellow-500' },
    { value: 'critical', label: 'Critical', color: 'text-red-500' },
  ];

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FlaskConical className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Test Notification</h1>
          <p className="text-sm text-muted-foreground">Send a test notification through the routing engine.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-xl p-6">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="notif-title">Title</label>
          <input
            id="notif-title"
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2
                       focus:ring-ring focus:ring-offset-1"
            placeholder="Notification title"
          />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="notif-message">Message</label>
          <textarea
            id="notif-message"
            required
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2
                       focus:ring-ring focus:ring-offset-1 resize-none"
            placeholder="Notification body text"
          />
        </div>

        {/* Severity + Source row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="notif-severity">Severity</label>
            <select
              id="notif-severity"
              value={severity}
              onChange={e => setSeverity(e.target.value as Severity)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            >
              {severityOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="notif-source">Source</label>
            <input
              id="notif-source"
              type="text"
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2
                         focus:ring-ring focus:ring-offset-1"
              placeholder="e.g. ui-test"
            />
          </div>
        </div>

        {/* Channel */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="notif-channel">Channel <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input
            id="notif-channel"
            type="text"
            value={channel === '__all__' ? '' : channel}
            onChange={e => setChannel(e.target.value || '__all__')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2
                       focus:ring-ring focus:ring-offset-1"
            placeholder="Leave empty to route through all matching rules"
          />
        </div>

        {/* Result banner */}
        {result && (
          <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
            result.ok
              ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
          }`}>
            {result.ok
              ? <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
              : <XCircle      className="size-4 mt-0.5 shrink-0" />}
            <div>
              <p className="font-medium">{result.message}</p>
              {result.detail && <p className="text-xs mt-0.5 opacity-75">{result.detail}</p>}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary
                     px-4 py-2 text-sm font-medium text-primary-foreground
                     hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {loading
            ? <><Loader2 className="size-4 animate-spin" /> Sending…</>
            : <><Send className="size-4" /> Send Test Notification</>}
        </button>
      </form>
    </div>
  );
}
