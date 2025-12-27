/**
 * Service Discovery Utility
 * Handles service discovery, port conflict resolution, and network management
 */

import { spawn } from 'child_process';
import * as net from 'net';
import * as dns from 'dns';
import { promisify } from 'util';

export interface ServiceEndpoint {
  name: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'tcp' | 'udp';
  healthEndpoint?: string;
  isAvailable: boolean;
  lastCheck: Date;
}

export interface PortRange {
  start: number;
  end: number;
}

export interface NetworkInfo {
  networkName: string;
  subnet: string;
  gateway: string;
  containers: ContainerInfo[];
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: PortMapping[];
  networks: string[];
  ipAddress?: string;
}

export interface PortMapping {
  containerPort: number;
  hostPort: number;
  protocol: 'tcp' | 'udp';
}

export class ServiceDiscovery {
  private static readonly DEFAULT_PORT_RANGE: PortRange = { start: 3000, end: 9999 };
  private static readonly RESERVED_PORTS = [22, 80, 443, 3306, 5432, 6379, 27017];

  /**
   * Find an available port in the specified range
   */
  static async findAvailablePort(
    preferredPort?: number,
    range: PortRange = ServiceDiscovery.DEFAULT_PORT_RANGE
  ): Promise<number> {
    // Try preferred port first if specified
    if (preferredPort && await ServiceDiscovery.isPortAvailable(preferredPort)) {
      return preferredPort;
    }

    // Search for available port in range
    for (let port = range.start; port <= range.end; port++) {
      if (ServiceDiscovery.RESERVED_PORTS.includes(port)) {
        continue;
      }

      if (await ServiceDiscovery.isPortAvailable(port)) {
        return port;
      }
    }

    throw new Error(`No available ports found in range ${range.start}-${range.end}`);
  }

  /**
   * Check if a port is available
   */
  static async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });

      server.on('error', () => resolve(false));
    });
  }

  /**
   * Find multiple available ports
   */
  static async findAvailablePorts(
    count: number,
    startPort: number = 3000
  ): Promise<number[]> {
    const ports: number[] = [];
    let currentPort = startPort;

    while (ports.length < count) {
      if (await ServiceDiscovery.isPortAvailable(currentPort)) {
        ports.push(currentPort);
      }
      currentPort++;

      // Prevent infinite loop
      if (currentPort > 65535) {
        throw new Error(`Could not find ${count} available ports`);
      }
    }

    return ports;
  }

  /**
   * Resolve port conflicts for multiple services
   */
  static async resolvePortConflicts(
    services: Record<string, { port: number }>
  ): Promise<Record<string, number>> {
    const resolvedPorts: Record<string, number> = {};
    const usedPorts = new Set<number>();

    for (const [serviceName, config] of Object.entries(services)) {
      let port = config.port;

      // Check if port is already used by another service in this batch
      if (usedPorts.has(port) || !(await ServiceDiscovery.isPortAvailable(port))) {
        port = await ServiceDiscovery.findAvailablePort(port + 1000);
        console.log(`Port conflict resolved for ${serviceName}: ${config.port} -> ${port}`);
      }

      resolvedPorts[serviceName] = port;
      usedPorts.add(port);
    }

    return resolvedPorts;
  }

  /**
   * Discover running Docker containers
   */
  static async discoverContainers(projectName?: string): Promise<ContainerInfo[]> {
    try {
      const args = ['ps', '--format', 'json'];
      if (projectName) {
        args.push('--filter', `label=com.docker.compose.project=${projectName}`);
      }

      const output = await ServiceDiscovery.executeCommand('docker', args);
      const lines = output.trim().split('\n').filter(line => line.trim());
      
      const containers: ContainerInfo[] = [];

      for (const line of lines) {
        try {
          const containerData = JSON.parse(line);
          const container: ContainerInfo = {
            id: containerData.ID,
            name: containerData.Names,
            image: containerData.Image,
            status: containerData.Status,
            ports: ServiceDiscovery.parsePortMappings(containerData.Ports),
            networks: await ServiceDiscovery.getContainerNetworks(containerData.ID),
            ipAddress: await ServiceDiscovery.getContainerIP(containerData.ID)
          };
          containers.push(container);
        } catch (error) {
          console.warn(`Failed to parse container data: ${line}`, error);
        }
      }

      return containers;
    } catch (error) {
      console.error('Failed to discover containers:', error);
      return [];
    }
  }

  /**
   * Get network information
   */
  static async getNetworkInfo(networkName: string): Promise<NetworkInfo | null> {
    try {
      const output = await ServiceDiscovery.executeCommand('docker', [
        'network', 'inspect', networkName
      ]);

      const networkData = JSON.parse(output)[0];
      
      if (!networkData) {
        return null;
      }

      const containers = await ServiceDiscovery.discoverContainers();
      const networkContainers = containers.filter(c => 
        c.networks.includes(networkName)
      );

      return {
        networkName: networkData.Name,
        subnet: networkData.IPAM?.Config?.[0]?.Subnet || 'unknown',
        gateway: networkData.IPAM?.Config?.[0]?.Gateway || 'unknown',
        containers: networkContainers
      };
    } catch (error) {
      console.error(`Failed to get network info for ${networkName}:`, error);
      return null;
    }
  }

  /**
   * Check service endpoints
   */
  static async checkServiceEndpoints(endpoints: ServiceEndpoint[]): Promise<ServiceEndpoint[]> {
    const results: ServiceEndpoint[] = [];

    for (const endpoint of endpoints) {
      const result = { ...endpoint, lastCheck: new Date() };

      try {
        if (endpoint.protocol === 'http' || endpoint.protocol === 'https') {
          result.isAvailable = await ServiceDiscovery.checkHttpEndpoint(
            endpoint.host,
            endpoint.port,
            endpoint.healthEndpoint || '/',
            endpoint.protocol === 'https'
          );
        } else {
          result.isAvailable = await ServiceDiscovery.checkTcpEndpoint(
            endpoint.host,
            endpoint.port
          );
        }
      } catch (error) {
        result.isAvailable = false;
        console.warn(`Failed to check endpoint ${endpoint.name}:`, error);
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Wait for service to be available
   */
  static async waitForService(
    endpoint: ServiceEndpoint,
    timeoutMs: number = 60000,
    intervalMs: number = 2000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const [result] = await ServiceDiscovery.checkServiceEndpoints([endpoint]);
        
        if (result && result.isAvailable) {
          return true;
        }
      } catch (error) {
        console.warn(`Error checking service ${endpoint.name}:`, error);
      }

      await ServiceDiscovery.sleep(intervalMs);
    }

    return false;
  }

  /**
   * Parse Docker port mappings
   */
  private static parsePortMappings(portsString: string): PortMapping[] {
    if (!portsString) return [];

    const mappings: PortMapping[] = [];
    const portPairs = portsString.split(', ');

    for (const pair of portPairs) {
      const match = pair.match(/(\d+):(\d+)\/(tcp|udp)/);
      if (match) {
        mappings.push({
          hostPort: parseInt(match[1]!),
          containerPort: parseInt(match[2]!),
          protocol: match[3]! as 'tcp' | 'udp'
        });
      }
    }

    return mappings;
  }

  /**
   * Get container networks
   */
  private static async getContainerNetworks(containerId: string): Promise<string[]> {
    try {
      const output = await ServiceDiscovery.executeCommand('docker', [
        'inspect', containerId, '--format', '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
      ]);
      return output.trim().split(' ').filter(n => n);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get container IP address
   */
  private static async getContainerIP(containerId: string): Promise<string | undefined> {
    try {
      const output = await ServiceDiscovery.executeCommand('docker', [
        'inspect', containerId, '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
      ]);
      return output.trim() || undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Check HTTP endpoint
   */
  private static async checkHttpEndpoint(
    host: string,
    port: number,
    path: string,
    https: boolean = false
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const protocol = https ? require('https') : require('http');
      const url = `${https ? 'https' : 'http'}://${host}:${port}${path}`;

      const req = protocol.get(url, { timeout: 5000 }, (res: any) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Check TCP endpoint
   */
  private static async checkTcpEndpoint(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(5000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  /**
   * Execute command and return output
   */
  private static async executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}