/**
 * Resource Cleanup Manager
 * Handles proper cleanup of Docker resources, volumes, networks, and processes
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
export class ResourceCleanup {
    constructor(projectName = 'learn2play-test', composeFile = 'docker-compose.test.yml') {
        this.projectName = projectName;
        this.composeFile = composeFile;
    }
    /**
     * Perform complete cleanup of test environment resources
     */
    async cleanup(options = {}) {
        const opts = {
            removeVolumes: true,
            removeNetworks: true,
            removeImages: true,
            removeOrphans: true,
            force: false,
            preserveLogs: false,
            ...options
        };
        const result = {
            removed: [],
            preserved: [],
            errors: [],
            totalSpaceFreed: '0B'
        };
        console.log('Starting resource cleanup...');
        try {
            // Stop and remove containers
            await this.stopContainers(result, opts);
            // Remove volumes if requested
            if (opts.removeVolumes) {
                await this.removeVolumes(result, opts);
            }
            // Remove networks if requested
            if (opts.removeNetworks) {
                await this.removeNetworks(result, opts);
            }
            // Remove images if requested
            if (opts.removeImages) {
                await this.removeImages(result, opts);
            }
            // Clean up orphaned resources
            if (opts.removeOrphans) {
                await this.removeOrphanedResources(result, opts);
            }
            // Preserve logs if requested
            if (opts.preserveLogs) {
                await this.preserveLogs(result);
            }
            // Calculate total space freed
            result.totalSpaceFreed = await this.calculateSpaceFreed();
            console.log(`Cleanup completed. Removed ${result.removed.length} resources, freed ${result.totalSpaceFreed}`);
        }
        catch (error) {
            result.errors.push(`Cleanup failed: ${error}`);
            console.error('Cleanup failed:', error);
        }
        return result;
    }
    /**
     * Stop and remove containers
     */
    async stopContainers(result, options) {
        try {
            console.log('Stopping containers...');
            // Get list of containers before stopping
            const containers = await this.listContainers();
            // Stop containers gracefully first
            await this.executeCommand('docker-compose', [
                '-f', this.composeFile,
                '-p', this.projectName,
                'stop'
            ]);
            // Remove containers
            const removeArgs = [
                '-f', this.composeFile,
                '-p', this.projectName,
                'down'
            ];
            if (options.removeVolumes) {
                removeArgs.push('-v');
            }
            if (options.removeOrphans) {
                removeArgs.push('--remove-orphans');
            }
            await this.executeCommand('docker-compose', removeArgs);
            // Mark containers as removed
            containers.forEach(container => {
                result.removed.push({
                    id: container.id,
                    name: container.name,
                    type: 'container',
                    created: container.created,
                    inUse: false
                });
            });
        }
        catch (error) {
            result.errors.push(`Failed to stop containers: ${error}`);
        }
    }
    /**
     * Remove volumes
     */
    async removeVolumes(result, options) {
        try {
            console.log('Removing volumes...');
            const volumes = await this.listVolumes();
            for (const volume of volumes) {
                try {
                    if (options.force || !volume.inUse) {
                        await this.executeCommand('docker', ['volume', 'rm', volume.id]);
                        result.removed.push(volume);
                    }
                    else {
                        result.preserved.push(volume);
                    }
                }
                catch (error) {
                    result.errors.push(`Failed to remove volume ${volume.name}: ${error}`);
                }
            }
            // Clean up unused volumes
            try {
                await this.executeCommand('docker', ['volume', 'prune', '-f']);
            }
            catch (error) {
                result.errors.push(`Failed to prune volumes: ${error}`);
            }
        }
        catch (error) {
            result.errors.push(`Failed to remove volumes: ${error}`);
        }
    }
    /**
     * Remove networks
     */
    async removeNetworks(result, options) {
        try {
            console.log('Removing networks...');
            const networks = await this.listNetworks();
            for (const network of networks) {
                try {
                    if (options.force || !network.inUse) {
                        await this.executeCommand('docker', ['network', 'rm', network.id]);
                        result.removed.push(network);
                    }
                    else {
                        result.preserved.push(network);
                    }
                }
                catch (error) {
                    result.errors.push(`Failed to remove network ${network.name}: ${error}`);
                }
            }
            // Clean up unused networks
            try {
                await this.executeCommand('docker', ['network', 'prune', '-f']);
            }
            catch (error) {
                result.errors.push(`Failed to prune networks: ${error}`);
            }
        }
        catch (error) {
            result.errors.push(`Failed to remove networks: ${error}`);
        }
    }
    /**
     * Remove images
     */
    async removeImages(result, options) {
        try {
            console.log('Removing images...');
            const images = await this.listImages();
            for (const image of images) {
                try {
                    if (options.force || !image.inUse) {
                        await this.executeCommand('docker', ['rmi', '-f', image.id]);
                        result.removed.push(image);
                    }
                    else {
                        result.preserved.push(image);
                    }
                }
                catch (error) {
                    result.errors.push(`Failed to remove image ${image.name}: ${error}`);
                }
            }
            // Clean up dangling images
            try {
                await this.executeCommand('docker', ['image', 'prune', '-f']);
            }
            catch (error) {
                result.errors.push(`Failed to prune images: ${error}`);
            }
        }
        catch (error) {
            result.errors.push(`Failed to remove images: ${error}`);
        }
    }
    /**
     * Remove orphaned resources
     */
    async removeOrphanedResources(result, options) {
        try {
            console.log('Removing orphaned resources...');
            // Remove orphaned containers
            try {
                const output = await this.executeCommand('docker', [
                    'ps', '-a', '--filter', 'status=exited', '--filter', 'status=dead', '-q'
                ]);
                const orphanedContainers = output.trim().split('\n').filter(id => id.trim());
                if (orphanedContainers.length > 0) {
                    await this.executeCommand('docker', ['rm', '-f', ...orphanedContainers]);
                    orphanedContainers.forEach(id => {
                        result.removed.push({
                            id,
                            name: 'orphaned-container',
                            type: 'container',
                            created: new Date(),
                            inUse: false
                        });
                    });
                }
            }
            catch (error) {
                result.errors.push(`Failed to remove orphaned containers: ${error}`);
            }
            // System prune
            try {
                await this.executeCommand('docker', ['system', 'prune', '-f']);
            }
            catch (error) {
                result.errors.push(`Failed to run system prune: ${error}`);
            }
        }
        catch (error) {
            result.errors.push(`Failed to remove orphaned resources: ${error}`);
        }
    }
    /**
     * Preserve logs before cleanup
     */
    async preserveLogs(result) {
        try {
            console.log('Preserving logs...');
            const logsDir = path.join(process.cwd(), 'test-logs');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const logFile = path.join(logsDir, `test-environment-${timestamp}.log`);
            // Create logs directory
            await fs.mkdir(logsDir, { recursive: true });
            // Get logs from all services
            try {
                const logs = await this.executeCommand('docker-compose', [
                    '-f', this.composeFile,
                    '-p', this.projectName,
                    'logs', '--no-color'
                ]);
                await fs.writeFile(logFile, logs);
                console.log(`Logs preserved to: ${logFile}`);
            }
            catch (error) {
                result.errors.push(`Failed to preserve logs: ${error}`);
            }
        }
        catch (error) {
            result.errors.push(`Failed to preserve logs: ${error}`);
        }
    }
    /**
     * List containers for the project
     */
    async listContainers() {
        try {
            const output = await this.executeCommand('docker', [
                'ps', '-a', '--filter', `label=com.docker.compose.project=${this.projectName}`,
                '--format', '{{.ID}}\t{{.Names}}\t{{.CreatedAt}}\t{{.Status}}'
            ]);
            return output.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                const [id, name, created, status] = line.split('\t');
                return {
                    id,
                    name,
                    type: 'container',
                    created: new Date(created),
                    inUse: status.includes('Up')
                };
            });
        }
        catch (error) {
            return [];
        }
    }
    /**
     * List volumes for the project
     */
    async listVolumes() {
        try {
            const output = await this.executeCommand('docker', [
                'volume', 'ls', '--filter', `label=com.docker.compose.project=${this.projectName}`,
                '--format', '{{.Name}}\t{{.CreatedAt}}'
            ]);
            return output.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                const [name, created] = line.split('\t');
                return {
                    id: name,
                    name,
                    type: 'volume',
                    created: new Date(created || Date.now()),
                    inUse: false // Will be checked separately
                };
            });
        }
        catch (error) {
            return [];
        }
    }
    /**
     * List networks for the project
     */
    async listNetworks() {
        try {
            const output = await this.executeCommand('docker', [
                'network', 'ls', '--filter', `label=com.docker.compose.project=${this.projectName}`,
                '--format', '{{.ID}}\t{{.Name}}\t{{.CreatedAt}}'
            ]);
            return output.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                const [id, name, created] = line.split('\t');
                return {
                    id,
                    name,
                    type: 'network',
                    created: new Date(created || Date.now()),
                    inUse: false // Will be checked separately
                };
            });
        }
        catch (error) {
            return [];
        }
    }
    /**
     * List images for the project
     */
    async listImages() {
        try {
            const output = await this.executeCommand('docker', [
                'images', '--filter', `label=com.docker.compose.project=${this.projectName}`,
                '--format', '{{.ID}}\t{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}'
            ]);
            return output.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                const [id, name, created, size] = line.split('\t');
                return {
                    id,
                    name,
                    type: 'image',
                    size,
                    created: new Date(created || Date.now()),
                    inUse: false // Will be checked separately
                };
            });
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Calculate total space freed
     */
    async calculateSpaceFreed() {
        try {
            const output = await this.executeCommand('docker', ['system', 'df']);
            // Parse the output to get space information
            // This is a simplified implementation
            return '0B'; // TODO: Implement proper space calculation
        }
        catch (error) {
            return '0B';
        }
    }
    /**
     * Execute command and return output
     */
    async executeCommand(command, args) {
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
     * Emergency cleanup - force remove all resources
     */
    async emergencyCleanup() {
        console.log('Performing emergency cleanup...');
        return this.cleanup({
            removeVolumes: true,
            removeNetworks: true,
            removeImages: true,
            removeOrphans: true,
            force: true,
            preserveLogs: true
        });
    }
    /**
     * Gentle cleanup - preserve important resources
     */
    async gentleCleanup() {
        console.log('Performing gentle cleanup...');
        return this.cleanup({
            removeVolumes: false,
            removeNetworks: false,
            removeImages: false,
            removeOrphans: true,
            force: false,
            preserveLogs: true
        });
    }
}
