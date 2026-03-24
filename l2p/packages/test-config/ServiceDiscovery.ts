import * as net from 'net';

export class ServiceDiscovery {
  /**
   * Check if a port is available (not in use)
   */
  static async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Find an available port in a range
   */
  static async findAvailablePort(
    startPort: number,
    options: { start: number; end: number } = { start: startPort, end: 65535 }
  ): Promise<number> {
    for (let port = options.start; port <= options.end; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available port found in range ${options.start}-${options.end}`);
  }
}
