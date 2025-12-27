import fs from 'fs';
import path from 'path';

const BASE_DIR = path.resolve(process.cwd(), 'logs', 'backend');

function ensureDir() {
  try {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  } catch {}
}

function line(data: unknown) {
  try {
    if (typeof data === 'string') return data + '\n';
    return JSON.stringify(data) + '\n';
  } catch {
    return String(data) + '\n';
  }
}

export function logToFile(filename: string, data: unknown) {
  if (process.env['NODE_ENV'] !== 'development') return;
  ensureDir();
  const file = path.join(BASE_DIR, filename);
  try {
    fs.appendFile(file, line(data), () => {});
  } catch {
    // swallow
  }
}

export const DevFileLogger = {
  app: (msg: string, payload?: any) => logToFile('app.log', { ts: new Date().toISOString(), msg, payload }),
  http: (payload: any) => logToFile('requests.log', payload),
  socket: (payload: any) => logToFile('socket.log', payload),
  db: (payload: any) => logToFile('database.log', payload),
  game: (payload: any) => logToFile('game.log', payload),
  error: (payload: any) => logToFile('errors.log', payload),
};
