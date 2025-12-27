import { useEffect, useMemo, useState } from 'react';
import { ApiClient, HttpError } from '@/services/api-client';
import { serverHealth } from '@/services/server-health';
import { AuthService } from '@/services/auth';

type ClientError = {
  id: string;
  errorId: string;
  createdAt: string;
  message: string;
  code: string;
  severity: string;
  context?: Record<string, any> | null;
  userAgent?: string | null;
  url?: string | null;
  stack?: string | null;
  requestId?: string | null;
  ip?: string | null;
};

export default function AdminErrorsPage() {
  const [items, setItems] = useState<ClientError[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [code, setCode] = useState('');
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [selected, setSelected] = useState<ClientError | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const canPrev = offset > 0;
  const canNext = items.length === limit;

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set('limit', String(limit));
    q.set('offset', String(offset));
    if (code.trim()) q.set('code', code.trim());
    if (severity.trim()) q.set('severity', severity.trim());
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return q.toString();
  }, [limit, offset, code, severity, from, to]);

  async function load() {
    if (!(await serverHealth.isHealthy())) return;
    setLoading(true);
    try {
      const res = await ApiClient.get<{ total: number; items: ClientError[] }>(
        `/api/errors?${query}`,
      );
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        setAuthRequired(true);
      } else {
        serverHealth.markUnhealthy();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  async function openDetails(id: string) {
    try {
      const row = await ApiClient.get<ClientError>(`/api/errors/${encodeURIComponent(id)}`);
      setSelected(row);
    } catch {
      /* ignore */
    }
  }

  async function deleteOne(id: string) {
    if (!confirm('Delete this error log?')) return;
    try {
      await ApiClient.delete(`/api/errors/${encodeURIComponent(id)}`);
      setSelected(null);
      void load();
    } catch {
      /* ignore */
    }
  }

  async function bulkDelete() {
    if (!confirm('Bulk delete matching logs? This cannot be undone.')) return;
    try {
      await ApiClient.post('/api/errors/bulk_delete', {
        before: to || undefined,
        code: code || undefined,
        severity: severity || undefined,
      });
      setOffset(0);
      void load();
    } catch {
      /* ignore */
    }
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    const ok = await AuthService.login(username, password);
    if (ok) {
      setAuthRequired(false);
      void load();
    } else {
      setAuthError('Invalid credentials');
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Client Error Logs</h1>
      {authRequired && (
        <form
          onSubmit={(e) => void doLogin(e)}
          className="border rounded p-3 flex gap-2 items-end max-w-md"
        >
          <div className="flex-1">
            <label className="block text-sm font-medium">Username</label>
            <input
              className="border px-2 py-1 rounded w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              className="border px-2 py-1 rounded w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="border px-3 py-1 rounded bg-primary text-primary-foreground"
          >
            Login
          </button>
          {authError && <div className="text-destructive text-sm ml-2">{authError}</div>}
        </form>
      )}
      <div className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border px-2 py-1 rounded w-48"
            placeholder="e.g. NETWORK_ERROR"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="border px-2 py-1 rounded w-40"
          >
            <option value="">(any)</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border px-2 py-1 rounded w-40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border px-2 py-1 rounded w-40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Limit</label>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="border px-2 py-1 rounded w-28"
          >
            {[25, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void load()}
          className="border px-3 py-1 rounded bg-primary text-primary-foreground"
        >
          Apply
        </button>
        <button
          onClick={() => void bulkDelete()}
          className="border px-3 py-1 rounded bg-destructive text-destructive-foreground"
        >
          Bulk Delete
        </button>
        <div className="ml-auto text-sm text-muted-foreground">
          Showing {items.length} of ~{total}
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted text-left">
              <th className="p-2">Time</th>
              <th className="p-2">Code</th>
              <th className="p-2">Severity</th>
              <th className="p-2">Message</th>
              <th className="p-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={5}>
                  No results
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-accent cursor-pointer"
                  onClick={() => void openDetails(row.id)}
                >
                  <td className="p-2 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">{row.code}</td>
                  <td className="p-2">{row.severity}</td>
                  <td className="p-2 truncate max-w-[40ch]" title={row.message}>
                    {row.message}
                  </td>
                  <td className="p-2 font-mono text-xs">{row.id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={!canPrev}
          onClick={() => setOffset(Math.max(0, offset - limit))}
          className="border px-3 py-1 rounded disabled:opacity-50"
        >
          Prev
        </button>
        <button
          disabled={!canNext}
          onClick={() => setOffset(offset + limit)}
          className="border px-3 py-1 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {selected && (
        <div className="border rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Error Details</h2>
            <div className="flex gap-2">
              <button
                onClick={() => void deleteOne(selected.id)}
                className="border px-3 py-1 rounded bg-destructive text-destructive-foreground"
              >
                Delete
              </button>
              <button onClick={() => setSelected(null)} className="border px-3 py-1 rounded">
                Close
              </button>
            </div>
          </div>
          <pre className="bg-muted p-2 rounded overflow-auto text-xs">
            <code>{JSON.stringify(selected, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
