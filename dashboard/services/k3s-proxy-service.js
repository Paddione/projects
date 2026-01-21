/**
 * K3s Proxy Service
 * HTTP client for kubectl proxy API with caching
 * Replaces @kubernetes/client-node library
 */

const { CacheService, CACHE_TTL } = require('./cache-service');

class K3sProxyService {
    constructor(baseUrl = 'http://127.0.0.1:8001', namespaces = ['korczewski-infra', 'korczewski-services']) {
        this.baseUrl = baseUrl;
        this.namespaces = namespaces;
        this.cache = new CacheService();
        this.proxyAvailable = null;
        this.lastProxyCheck = 0;
        this.proxyCheckInterval = 5000; // Check proxy availability every 5 seconds
    }

    /**
     * Make HTTP request to kubectl proxy
     * @param {string} path - API path
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Response data
     */
    async fetch(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeout || 5000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    /**
     * Check if kubectl proxy is available
     * @returns {Promise<boolean>}
     */
    async checkProxyAvailable() {
        const now = Date.now();
        if (this.proxyAvailable !== null && now - this.lastProxyCheck < this.proxyCheckInterval) {
            return this.proxyAvailable;
        }

        try {
            await this.fetch('/healthz', { timeout: 2000 });
            this.proxyAvailable = true;
        } catch {
            this.proxyAvailable = false;
        }
        this.lastProxyCheck = now;
        return this.proxyAvailable;
    }

    // =========================================================================
    // HEALTH ENDPOINTS
    // =========================================================================

    /**
     * Get health status from a specific endpoint
     * @param {string} endpoint - Health endpoint (healthz, livez, readyz)
     * @returns {Promise<Object>}
     */
    async getHealthEndpoint(endpoint) {
        const cacheKey = `health:${endpoint}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            // Health endpoints return plain text, not JSON
            const url = `${this.baseUrl}/${endpoint}`;
            const response = await fetch(url, { timeout: 2000 });
            const text = await response.text();

            const result = {
                endpoint,
                status: response.ok ? 'healthy' : 'unhealthy',
                statusCode: response.status,
                message: text.trim()
            };

            this.cache.set(cacheKey, result, CACHE_TTL.HEALTH);
            return result;
        } catch (error) {
            return {
                endpoint,
                status: 'unavailable',
                statusCode: 0,
                message: error.message
            };
        }
    }

    /**
     * Get aggregated health from healthz, livez, readyz
     * @returns {Promise<Object>}
     */
    async getAggregatedHealth() {
        const cacheKey = 'health:aggregated';
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const [healthz, livez, readyz] = await Promise.all([
            this.getHealthEndpoint('healthz'),
            this.getHealthEndpoint('livez'),
            this.getHealthEndpoint('readyz')
        ]);

        const result = {
            overall: healthz.status === 'healthy' && livez.status === 'healthy' && readyz.status === 'healthy' ? 'healthy' : 'degraded',
            healthz,
            livez,
            readyz,
            timestamp: new Date().toISOString()
        };

        this.cache.set(cacheKey, result, CACHE_TTL.HEALTH);
        return result;
    }

    /**
     * Get cluster version
     * @returns {Promise<Object>}
     */
    async getVersion() {
        const cacheKey = 'version';
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch('/version');
            const result = {
                gitVersion: data.gitVersion,
                gitCommit: data.gitCommit,
                buildDate: data.buildDate,
                goVersion: data.goVersion,
                platform: data.platform,
                major: data.major,
                minor: data.minor
            };
            this.cache.set(cacheKey, result, CACHE_TTL.VERSION);
            return result;
        } catch (error) {
            return { error: error.message };
        }
    }

    // =========================================================================
    // METRICS API
    // =========================================================================

    /**
     * Get node metrics from metrics-server
     * @returns {Promise<Array>}
     */
    async getNodeMetrics() {
        const cacheKey = 'metrics:nodes';
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch('/apis/metrics.k8s.io/v1beta1/nodes');
            const metrics = (data.items || []).map(item => ({
                name: item.metadata.name,
                cpu: item.usage.cpu,
                memory: item.usage.memory,
                cpuCores: this.parseCpuToMillicores(item.usage.cpu),
                memoryBytes: this.parseMemoryToBytes(item.usage.memory),
                timestamp: item.timestamp
            }));
            this.cache.set(cacheKey, metrics, CACHE_TTL.METRICS);
            return metrics;
        } catch (error) {
            console.error('Error fetching node metrics:', error.message);
            return [];
        }
    }

    /**
     * Get pod metrics for a namespace
     * @param {string} namespace
     * @returns {Promise<Array>}
     */
    async getPodMetrics(namespace) {
        const cacheKey = `metrics:pods:${namespace}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch(`/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods`);
            const metrics = (data.items || []).map(item => ({
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                containers: (item.containers || []).map(c => ({
                    name: c.name,
                    cpu: c.usage.cpu,
                    memory: c.usage.memory,
                    cpuCores: this.parseCpuToMillicores(c.usage.cpu),
                    memoryBytes: this.parseMemoryToBytes(c.usage.memory)
                })),
                timestamp: item.timestamp
            }));
            this.cache.set(cacheKey, metrics, CACHE_TTL.METRICS);
            return metrics;
        } catch (error) {
            console.error(`Error fetching pod metrics for ${namespace}:`, error.message);
            return [];
        }
    }

    /**
     * Get all pod metrics across managed namespaces
     * @returns {Promise<Array>}
     */
    async getAllPodMetrics() {
        const results = await Promise.all(
            this.namespaces.map(ns => this.getPodMetrics(ns))
        );
        return results.flat();
    }

    // =========================================================================
    // TRAEFIK CRDs
    // =========================================================================

    /**
     * Get Traefik IngressRoutes for a namespace
     * @param {string} namespace
     * @returns {Promise<Array>}
     */
    async getTraefikIngressRoutes(namespace) {
        const cacheKey = `traefik:ingressroutes:${namespace}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch(`/apis/traefik.io/v1alpha1/namespaces/${namespace}/ingressroutes`);
            const routes = (data.items || []).map(item => ({
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                entryPoints: item.spec.entryPoints || [],
                routes: (item.spec.routes || []).map(route => ({
                    match: route.match,
                    kind: route.kind,
                    services: (route.services || []).map(svc => ({
                        name: svc.name,
                        port: svc.port,
                        namespace: svc.namespace || namespace
                    })),
                    middlewares: (route.middlewares || []).map(mw => mw.name)
                })),
                tls: item.spec.tls || null,
                creationTimestamp: item.metadata.creationTimestamp
            }));
            this.cache.set(cacheKey, routes, CACHE_TTL.TRAEFIK);
            return routes;
        } catch (error) {
            console.error(`Error fetching IngressRoutes for ${namespace}:`, error.message);
            return [];
        }
    }

    /**
     * Get Traefik Middlewares for a namespace
     * @param {string} namespace
     * @returns {Promise<Array>}
     */
    async getTraefikMiddlewares(namespace) {
        const cacheKey = `traefik:middlewares:${namespace}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch(`/apis/traefik.io/v1alpha1/namespaces/${namespace}/middlewares`);
            const middlewares = (data.items || []).map(item => ({
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                spec: item.spec,
                creationTimestamp: item.metadata.creationTimestamp
            }));
            this.cache.set(cacheKey, middlewares, CACHE_TTL.TRAEFIK);
            return middlewares;
        } catch (error) {
            console.error(`Error fetching Middlewares for ${namespace}:`, error.message);
            return [];
        }
    }

    /**
     * Get aggregated Traefik status
     * @returns {Promise<Object>}
     */
    async getTraefikStatus() {
        const cacheKey = 'traefik:status';
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const routeResults = await Promise.all(
            this.namespaces.map(ns => this.getTraefikIngressRoutes(ns))
        );
        const middlewareResults = await Promise.all(
            this.namespaces.map(ns => this.getTraefikMiddlewares(ns))
        );

        const result = {
            ingressRoutes: routeResults.flat(),
            middlewares: middlewareResults.flat(),
            totalRoutes: routeResults.flat().length,
            totalMiddlewares: middlewareResults.flat().length,
            timestamp: new Date().toISOString()
        };

        this.cache.set(cacheKey, result, CACHE_TTL.TRAEFIK);
        return result;
    }

    // =========================================================================
    // HELM RELEASES
    // =========================================================================

    /**
     * Get Helm releases for a namespace (via helm.cattle.io CRD)
     * @param {string} namespace
     * @returns {Promise<Array>}
     */
    async getHelmReleases(namespace) {
        const cacheKey = `helm:releases:${namespace}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch(`/apis/helm.cattle.io/v1/namespaces/${namespace}/helmcharts`);
            const releases = (data.items || []).map(item => ({
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                chart: item.spec.chart,
                version: item.spec.version,
                repo: item.spec.repo,
                targetNamespace: item.spec.targetNamespace,
                valuesContent: item.spec.valuesContent,
                status: item.status?.jobName ? 'deployed' : 'pending',
                creationTimestamp: item.metadata.creationTimestamp
            }));
            this.cache.set(cacheKey, releases, CACHE_TTL.HELM);
            return releases;
        } catch (error) {
            // HelmChart CRD might not exist on all clusters
            if (error.message.includes('404')) {
                return [];
            }
            console.error(`Error fetching Helm releases for ${namespace}:`, error.message);
            return [];
        }
    }

    /**
     * Get all Helm releases across namespaces
     * @returns {Promise<Array>}
     */
    async getAllHelmReleases() {
        // Also check kube-system for system helm charts
        const namespaces = [...this.namespaces, 'kube-system'];
        const results = await Promise.all(
            namespaces.map(ns => this.getHelmReleases(ns))
        );
        return results.flat();
    }

    // =========================================================================
    // CORE K8S RESOURCES (replacing @kubernetes/client-node)
    // =========================================================================

    /**
     * Get nodes with status
     * @returns {Promise<Array>}
     */
    async getNodes() {
        const cacheKey = 'nodes';
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch('/api/v1/nodes');
            const nodes = (data.items || []).map(node => {
                const readyCondition = (node.status.conditions || []).find(c => c.type === 'Ready');
                return {
                    name: node.metadata.name,
                    status: readyCondition?.status === 'True' ? 'Ready' : 'NotReady',
                    kubeletVersion: node.status.nodeInfo?.kubeletVersion,
                    osImage: node.status.nodeInfo?.osImage,
                    containerRuntime: node.status.nodeInfo?.containerRuntimeVersion,
                    architecture: node.status.nodeInfo?.architecture,
                    allocatable: node.status.allocatable,
                    capacity: node.status.capacity,
                    conditions: node.status.conditions,
                    labels: node.metadata.labels,
                    creationTimestamp: node.metadata.creationTimestamp
                };
            });
            this.cache.set(cacheKey, nodes, CACHE_TTL.RESOURCES);
            return nodes;
        } catch (error) {
            console.error('Error fetching nodes:', error.message);
            return [];
        }
    }

    /**
     * Get cluster info (nodes + namespaces summary)
     * @returns {Promise<Object>}
     */
    async getClusterInfo() {
        const nodes = await this.getNodes();
        const version = await this.getVersion();

        return {
            nodes: nodes.length,
            nodeInfo: nodes,
            namespaces: this.namespaces,
            version: version.gitVersion || 'unknown'
        };
    }

    /**
     * Get pods for a namespace
     * @param {string} namespace
     * @returns {Promise<Array>}
     */
    async getPodsInNamespace(namespace) {
        const cacheKey = `pods:${namespace}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch(`/api/v1/namespaces/${namespace}/pods`);
            const pods = (data.items || []).map(pod => {
                const containerStatuses = pod.status.containerStatuses || [];
                const readyContainers = containerStatuses.filter(c => c.ready).length;
                const totalContainers = containerStatuses.length;

                let state = 'unknown';
                if (pod.status.phase === 'Running' && readyContainers === totalContainers) {
                    state = 'running';
                } else if (pod.status.phase === 'Running') {
                    state = 'degraded';
                } else if (pod.status.phase === 'Pending') {
                    state = 'pending';
                } else if (pod.status.phase === 'Succeeded') {
                    state = 'completed';
                } else {
                    state = 'stopped';
                }

                const labels = pod.metadata.labels || {};
                const project = labels['app'] || labels['app.kubernetes.io/name'] || 'unknown';

                return {
                    id: (pod.metadata.uid || '').substring(0, 12),
                    name: pod.metadata.name,
                    namespace: namespace,
                    image: containerStatuses[0]?.image || pod.spec.containers?.[0]?.image || 'unknown',
                    state: state,
                    status: `${readyContainers}/${totalContainers} Ready`,
                    phase: pod.status.phase,
                    created: new Date(pod.metadata.creationTimestamp).getTime() / 1000,
                    restarts: containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0),
                    project: project,
                    env: namespace === 'korczewski-infra' ? 'infrastructure' : 'production',
                    labels: labels,
                    nodeName: pod.spec.nodeName
                };
            });
            this.cache.set(cacheKey, pods, CACHE_TTL.RESOURCES);
            return pods;
        } catch (error) {
            console.error(`Error fetching pods for ${namespace}:`, error.message);
            return [];
        }
    }

    /**
     * Get all pods across managed namespaces
     * @returns {Promise<Array>}
     */
    async getPods() {
        const results = await Promise.all(
            this.namespaces.map(ns => this.getPodsInNamespace(ns))
        );
        return results.flat();
    }

    /**
     * Get deployments for a namespace
     * @param {string} namespace
     * @returns {Promise<Object>}
     */
    async getDeploymentsInNamespace(namespace) {
        const cacheKey = `deployments:${namespace}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const data = await this.fetch(`/apis/apps/v1/namespaces/${namespace}/deployments`);
            const deployments = {};

            for (const deployment of data.items || []) {
                const name = deployment.metadata.name;
                const status = deployment.status || {};
                const spec = deployment.spec || {};

                deployments[`${namespace}/${name}`] = {
                    id: `${namespace}-${name}`,
                    name: name,
                    namespace: namespace,
                    replicas: spec.replicas || 0,
                    readyReplicas: status.readyReplicas || 0,
                    availableReplicas: status.availableReplicas || 0,
                    updatedReplicas: status.updatedReplicas || 0,
                    running: (status.readyReplicas || 0) > 0,
                    image: spec.template?.spec?.containers?.[0]?.image || 'unknown',
                    labels: deployment.metadata.labels || {},
                    conditions: (status.conditions || []).map(c => ({
                        type: c.type,
                        status: c.status,
                        reason: c.reason
                    }))
                };
            }

            this.cache.set(cacheKey, deployments, CACHE_TTL.RESOURCES);
            return deployments;
        } catch (error) {
            console.error(`Error fetching deployments for ${namespace}:`, error.message);
            return {};
        }
    }

    /**
     * Get all deployments across managed namespaces
     * @returns {Promise<Object>}
     */
    async getDeployments() {
        const results = await Promise.all(
            this.namespaces.map(ns => this.getDeploymentsInNamespace(ns))
        );
        return Object.assign({}, ...results);
    }

    /**
     * Control a deployment (scale, restart)
     * @param {string} namespace
     * @param {string} deploymentName
     * @param {string} action - start, stop, restart
     * @returns {Promise<Object>}
     */
    async controlDeployment(namespace, deploymentName, action) {
        try {
            if (action === 'restart') {
                // Patch with restart annotation
                const patch = {
                    spec: {
                        template: {
                            metadata: {
                                annotations: {
                                    'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
                                }
                            }
                        }
                    }
                };

                await this.fetch(`/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/strategic-merge-patch+json'
                    },
                    body: JSON.stringify(patch)
                });

                // Clear cache for this deployment
                this.cache.delete(`deployments:${namespace}`);
                return { success: true, message: `Deployment ${deploymentName} restarted` };
            }

            if (action === 'stop') {
                // Scale to 0
                const patch = { spec: { replicas: 0 } };
                await this.fetch(`/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/strategic-merge-patch+json'
                    },
                    body: JSON.stringify(patch)
                });

                this.cache.delete(`deployments:${namespace}`);
                return { success: true, message: `Deployment ${deploymentName} scaled to 0` };
            }

            if (action === 'start') {
                // Scale to 1
                const patch = { spec: { replicas: 1 } };
                await this.fetch(`/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/strategic-merge-patch+json'
                    },
                    body: JSON.stringify(patch)
                });

                this.cache.delete(`deployments:${namespace}`);
                return { success: true, message: `Deployment ${deploymentName} scaled to 1` };
            }

            return { success: false, error: 'Invalid action' };
        } catch (error) {
            console.error(`Error controlling deployment ${deploymentName}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get logs from a pod
     * @param {string} namespace
     * @param {string} podName
     * @param {number} tailLines
     * @returns {Promise<string>}
     */
    async getPodLogs(namespace, podName, tailLines = 120) {
        try {
            const url = `${this.baseUrl}/api/v1/namespaces/${namespace}/pods/${podName}/log?tailLines=${tailLines}`;
            const response = await fetch(url, { timeout: 10000 });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            console.error(`Error fetching logs for ${podName}:`, error.message);
            return `Error: ${error.message}`;
        }
    }

    /**
     * Get logs for a service by finding its pods
     * @param {string} serviceId - Service ID (deployment name)
     * @param {number} tailLines
     * @returns {Promise<string>}
     */
    async getServiceLogs(serviceId, tailLines = 120) {
        // Find pods for this service
        const pods = await this.getPods();
        const matchingPods = pods.filter(pod =>
            pod.project === serviceId ||
            pod.name.startsWith(serviceId) ||
            pod.labels?.app === serviceId
        );

        if (matchingPods.length === 0) {
            return 'No pods found for this service';
        }

        // Get logs from the first matching pod
        const pod = matchingPods[0];
        return await this.getPodLogs(pod.namespace, pod.name, tailLines);
    }

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Parse CPU string (e.g., "250m", "1") to millicores
     * @param {string} cpuString
     * @returns {number} Millicores
     */
    parseCpuToMillicores(cpuString) {
        if (!cpuString) return 0;
        if (cpuString.endsWith('m')) {
            return parseInt(cpuString, 10);
        }
        if (cpuString.endsWith('n')) {
            return parseInt(cpuString, 10) / 1000000;
        }
        // Whole cores
        return parseFloat(cpuString) * 1000;
    }

    /**
     * Parse memory string (e.g., "1Gi", "512Mi", "1024Ki") to bytes
     * @param {string} memString
     * @returns {number} Bytes
     */
    parseMemoryToBytes(memString) {
        if (!memString) return 0;

        const units = {
            'Ki': 1024,
            'Mi': 1024 * 1024,
            'Gi': 1024 * 1024 * 1024,
            'Ti': 1024 * 1024 * 1024 * 1024,
            'K': 1000,
            'M': 1000 * 1000,
            'G': 1000 * 1000 * 1000,
            'T': 1000 * 1000 * 1000 * 1000
        };

        for (const [unit, multiplier] of Object.entries(units)) {
            if (memString.endsWith(unit)) {
                return parseInt(memString, 10) * multiplier;
            }
        }

        // Assume bytes
        return parseInt(memString, 10) || 0;
    }

    /**
     * Format bytes to human readable
     * @param {number} bytes
     * @returns {string}
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format millicores to human readable
     * @param {number} millicores
     * @returns {string}
     */
    formatCpu(millicores) {
        if (millicores >= 1000) {
            return (millicores / 1000).toFixed(2) + ' cores';
        }
        return millicores + 'm';
    }
}

module.exports = { K3sProxyService };
