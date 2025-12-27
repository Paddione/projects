/**
 * Service Discovery Utility
 * Handles service discovery, port conflict resolution, and network management
 */
import { spawn } from 'child_process';
import * as net from 'net';
export class ServiceDiscovery {
    /**
     * Find an available port in the specified range
     */
    static async findAvailablePort(preferredPort, range = ServiceDiscovery.DEFAULT_PORT_RANGE) {
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
    static async isPortAvailable(port) {
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
    static async findAvailablePorts(count, startPort = 3000) {
        const ports = [];
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
    static async resolvePortConflicts(services) {
        const resolvedPorts = {};
        const usedPorts = new Set();
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
    static async discoverContainers(projectName) {
        try {
            const args = ['ps', '--format', 'json'];
            if (projectName) {
                args.push('--filter', `label=com.docker.compose.project=${projectName}`);
            }
            const output = await ServiceDiscovery.executeCommand('docker', args);
            const lines = output.trim().split('\n').filter(line => line.trim());
            const containers = [];
            for (const line of lines) {
                try {
                    const containerData = JSON.parse(line);
                    const container = {
                        id: containerData.ID,
                        name: containerData.Names,
                        image: containerData.Image,
                        status: containerData.Status,
                        ports: ServiceDiscovery.parsePortMappings(containerData.Ports),
                        networks: await ServiceDiscovery.getContainerNetworks(containerData.ID),
                        ipAddress: await ServiceDiscovery.getContainerIP(containerData.ID)
                    };
                    containers.push(container);
                }
                catch (error) {
                    console.warn(`Failed to parse container data: ${line}`, error);
                }
            }
            return containers;
        }
        catch (error) {
            console.error('Failed to discover containers:', error);
            return [];
        }
    }
    /**
     * Get network information
     */
    static async getNetworkInfo(networkName) {
        try {
            const output = await ServiceDiscovery.executeCommand('docker', [
                'network', 'inspect', networkName
            ]);
            const networkData = JSON.parse(output)[0];
            if (!networkData) {
                return null;
            }
            const containers = await ServiceDiscovery.discoverContainers();
            const networkContainers = containers.filter(c => c.networks.includes(networkName));
            return {
                networkName: networkData.Name,
                subnet: networkData.IPAM?.Config?.[0]?.Subnet || 'unknown',
                gateway: networkData.IPAM?.Config?.[0]?.Gateway || 'unknown',
                containers: networkContainers
            };
        }
        catch (error) {
            console.error(`Failed to get network info for ${networkName}:`, error);
            return null;
        }
    }
    /**
     * Check service endpoints
     */
    static async checkServiceEndpoints(endpoints) {
        const results = [];
        for (const endpoint of endpoints) {
            const result = { ...endpoint, lastCheck: new Date() };
            try {
                if (endpoint.protocol === 'http' || endpoint.protocol === 'https') {
                    result.isAvailable = await ServiceDiscovery.checkHttpEndpoint(endpoint.host, endpoint.port, endpoint.healthEndpoint || '/', endpoint.protocol === 'https');
                }
                else {
                    result.isAvailable = await ServiceDiscovery.checkTcpEndpoint(endpoint.host, endpoint.port);
                }
            }
            catch (error) {
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
    static async waitForService(endpoint, timeoutMs = 60000, intervalMs = 2000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            try {
                const [result] = await ServiceDiscovery.checkServiceEndpoints([endpoint]);
                if (result.isAvailable) {
                    return true;
                }
            }
            catch (error) {
                console.warn(`Error checking service ${endpoint.name}:`, error);
            }
            await ServiceDiscovery.sleep(intervalMs);
        }
        return false;
    }
    /**
     * Parse Docker port mappings
     */
    static parsePortMappings(portsString) {
        if (!portsString)
            return [];
        const mappings = [];
        const portPairs = portsString.split(', ');
        for (const pair of portPairs) {
            const match = pair.match(/(\d+):(\d+)\/(tcp|udp)/);
            if (match) {
                mappings.push({
                    hostPort: parseInt(match[1]),
                    containerPort: parseInt(match[2]),
                    protocol: match[3]
                });
            }
        }
        return mappings;
    }
    /**
     * Get container networks
     */
    static async getContainerNetworks(containerId) {
        try {
            const output = await ServiceDiscovery.executeCommand('docker', [
                'inspect', containerId, '--format', '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
            ]);
            return output.trim().split(' ').filter(n => n);
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Get container IP address
     */
    static async getContainerIP(containerId) {
        try {
            const output = await ServiceDiscovery.executeCommand('docker', [
                'inspect', containerId, '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
            ]);
            return output.trim() || undefined;
        }
        catch (error) {
            return undefined;
        }
    }
    /**
     * Check HTTP endpoint
     */
    static async checkHttpEndpoint(host, port, path, https = false) {
        return new Promise((resolve) => {
            const protocol = https ? require('https') : require('http');
            const url = `${https ? 'https' : 'http'}://${host}:${port}${path}`;
            const req = protocol.get(url, { timeout: 5000 }, (res) => {
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
    static async checkTcpEndpoint(host, port) {
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
    static async executeCommand(command, args) {
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
                }
                else {
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
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
ServiceDiscovery.DEFAULT_PORT_RANGE = { start: 3000, end: 9999 };
ServiceDiscovery.RESERVED_PORTS = [22, 80, 443, 3306, 5432, 6379, 27017];
