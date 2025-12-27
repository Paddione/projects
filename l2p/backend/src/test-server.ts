import { createServer } from 'http';
import { createApp } from './app.js';

export function createTestServer() {
  const app = createApp();
  const server = createServer(app);
  return { app, server };
}

const { app, server } = createTestServer();

export { app, server };
export default app;
