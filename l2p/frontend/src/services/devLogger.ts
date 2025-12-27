// Dev logger: duplicates console logs to Vite dev server, writing to logs/frontend
// Safe no-op in production builds

function postLog(level: 'log' | 'warn' | 'error', args: any[]) {
  try {
    fetch('/__frontend-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        level,
        message: args.map(a => {
          try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
        }).join(' ')
      })
    }).catch(() => {})
  } catch {}
}

export function installDevConsoleTee() {
  if (typeof window === 'undefined') return;
  const isDev = (import.meta as any)?.env?.DEV === true || (import.meta as any)?.env?.MODE === 'development';
  if (!isDev) return;
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: any[]) => { try { postLog('log', args); } catch {} origLog(...args) };
  console.warn = (...args: any[]) => { try { postLog('warn', args); } catch {} origWarn(...args) };
  console.error = (...args: any[]) => { try { postLog('error', args); } catch {} origError(...args) };
}

// Auto-install in dev
try { installDevConsoleTee(); } catch {}

