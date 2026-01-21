/**
 * Kubernetes API Routes
 * New endpoints for k3s monitoring via kubectl proxy
 */

const express = require('express');

/**
 * Create K8s routes
 * @param {K3sProxyService} k3sProxy - K3s proxy service instance
 * @returns {express.Router}
 */
function createK8sRoutes(k3sProxy) {
    const router = express.Router();

    // =========================================================================
    // HEALTH ENDPOINTS
    // =========================================================================

    /**
     * GET /api/k8s/health
     * Aggregated health from healthz/livez/readyz
     */
    router.get('/health', async (req, res) => {
        try {
            const health = await k3sProxy.getAggregatedHealth();
            res.json(health);
        } catch (error) {
            console.error('Error fetching health:', error);
            res.status(500).json({ error: 'Failed to fetch health status' });
        }
    });

    /**
     * GET /api/k8s/version
     * Cluster version information
     */
    router.get('/version', async (req, res) => {
        try {
            const version = await k3sProxy.getVersion();
            res.json(version);
        } catch (error) {
            console.error('Error fetching version:', error);
            res.status(500).json({ error: 'Failed to fetch version' });
        }
    });

    // =========================================================================
    // METRICS ENDPOINTS
    // =========================================================================

    /**
     * GET /api/k8s/metrics
     * Node and pod resource metrics
     */
    router.get('/metrics', async (req, res) => {
        try {
            const [nodeMetrics, podMetrics] = await Promise.all([
                k3sProxy.getNodeMetrics(),
                k3sProxy.getAllPodMetrics()
            ]);

            res.json({
                nodes: nodeMetrics,
                pods: podMetrics,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching metrics:', error);
            res.status(500).json({ error: 'Failed to fetch metrics' });
        }
    });

    /**
     * GET /api/k8s/metrics/nodes
     * Node metrics only
     */
    router.get('/metrics/nodes', async (req, res) => {
        try {
            const metrics = await k3sProxy.getNodeMetrics();
            res.json({ nodes: metrics });
        } catch (error) {
            console.error('Error fetching node metrics:', error);
            res.status(500).json({ error: 'Failed to fetch node metrics' });
        }
    });

    /**
     * GET /api/k8s/metrics/pods
     * Pod metrics across all namespaces
     */
    router.get('/metrics/pods', async (req, res) => {
        try {
            const metrics = await k3sProxy.getAllPodMetrics();
            res.json({ pods: metrics });
        } catch (error) {
            console.error('Error fetching pod metrics:', error);
            res.status(500).json({ error: 'Failed to fetch pod metrics' });
        }
    });

    // =========================================================================
    // TRAEFIK ENDPOINTS
    // =========================================================================

    /**
     * GET /api/k8s/traefik
     * Traefik IngressRoutes and Middlewares
     */
    router.get('/traefik', async (req, res) => {
        try {
            const traefikStatus = await k3sProxy.getTraefikStatus();
            res.json(traefikStatus);
        } catch (error) {
            console.error('Error fetching Traefik status:', error);
            res.status(500).json({ error: 'Failed to fetch Traefik status' });
        }
    });

    /**
     * GET /api/k8s/traefik/routes
     * Traefik IngressRoutes only
     */
    router.get('/traefik/routes', async (req, res) => {
        try {
            const status = await k3sProxy.getTraefikStatus();
            res.json({ routes: status.ingressRoutes });
        } catch (error) {
            console.error('Error fetching Traefik routes:', error);
            res.status(500).json({ error: 'Failed to fetch Traefik routes' });
        }
    });

    /**
     * GET /api/k8s/traefik/middlewares
     * Traefik Middlewares only
     */
    router.get('/traefik/middlewares', async (req, res) => {
        try {
            const status = await k3sProxy.getTraefikStatus();
            res.json({ middlewares: status.middlewares });
        } catch (error) {
            console.error('Error fetching Traefik middlewares:', error);
            res.status(500).json({ error: 'Failed to fetch Traefik middlewares' });
        }
    });

    // =========================================================================
    // HELM ENDPOINTS
    // =========================================================================

    /**
     * GET /api/k8s/helm
     * Helm chart releases
     */
    router.get('/helm', async (req, res) => {
        try {
            const releases = await k3sProxy.getAllHelmReleases();
            res.json({
                releases,
                total: releases.length,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching Helm releases:', error);
            res.status(500).json({ error: 'Failed to fetch Helm releases' });
        }
    });

    // =========================================================================
    // CORE K8S RESOURCES
    // =========================================================================

    /**
     * GET /api/k8s/cluster
     * Cluster info (nodes, namespaces, version)
     */
    router.get('/cluster', async (req, res) => {
        try {
            const clusterInfo = await k3sProxy.getClusterInfo();
            res.json({ cluster: clusterInfo });
        } catch (error) {
            console.error('Error fetching cluster info:', error);
            res.status(500).json({ error: 'Failed to fetch cluster info' });
        }
    });

    /**
     * GET /api/k8s/nodes
     * All nodes with status
     */
    router.get('/nodes', async (req, res) => {
        try {
            const nodes = await k3sProxy.getNodes();
            res.json({ nodes });
        } catch (error) {
            console.error('Error fetching nodes:', error);
            res.status(500).json({ error: 'Failed to fetch nodes' });
        }
    });

    /**
     * GET /api/k8s/pods
     * All pods across managed namespaces
     */
    router.get('/pods', async (req, res) => {
        try {
            const pods = await k3sProxy.getPods();
            res.json({ pods });
        } catch (error) {
            console.error('Error fetching pods:', error);
            res.status(500).json({ error: 'Failed to fetch pods' });
        }
    });

    /**
     * GET /api/k8s/deployments
     * All deployments across managed namespaces
     */
    router.get('/deployments', async (req, res) => {
        try {
            const deployments = await k3sProxy.getDeployments();
            res.json({ deployments });
        } catch (error) {
            console.error('Error fetching deployments:', error);
            res.status(500).json({ error: 'Failed to fetch deployments' });
        }
    });

    /**
     * POST /api/k8s/deployments/:namespace/:name/:action
     * Control a deployment (start, stop, restart)
     */
    router.post('/deployments/:namespace/:name/:action', async (req, res) => {
        const { namespace, name, action } = req.params;

        if (!['start', 'stop', 'restart'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        try {
            const result = await k3sProxy.controlDeployment(namespace, name, action);
            res.json(result);
        } catch (error) {
            console.error(`Error ${action}ing deployment ${name}:`, error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * GET /api/k8s/logs/:namespace/:pod
     * Get logs for a specific pod
     */
    router.get('/logs/:namespace/:pod', async (req, res) => {
        const { namespace, pod } = req.params;
        const tailLines = parseInt(req.query.tail || '120', 10);

        try {
            const logs = await k3sProxy.getPodLogs(namespace, pod, tailLines);
            res.json({ logs });
        } catch (error) {
            console.error(`Error fetching logs for ${pod}:`, error);
            res.status(500).json({ error: 'Failed to fetch logs' });
        }
    });

    /**
     * GET /api/k8s/logs/:serviceId
     * Get logs for a service (finds pods by service name)
     */
    router.get('/logs/:serviceId', async (req, res) => {
        const { serviceId } = req.params;
        const tailLines = parseInt(req.query.tail || '120', 10);

        try {
            const logs = await k3sProxy.getServiceLogs(serviceId, tailLines);
            res.json({ logs });
        } catch (error) {
            console.error(`Error fetching logs for ${serviceId}:`, error);
            res.status(500).json({ error: 'Failed to fetch logs' });
        }
    });

    /**
     * GET /api/k8s/proxy/status
     * Check if kubectl proxy is available
     */
    router.get('/proxy/status', async (req, res) => {
        try {
            const available = await k3sProxy.checkProxyAvailable();
            res.json({
                available,
                baseUrl: k3sProxy.baseUrl,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.json({
                available: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    /**
     * GET /api/k8s/summary
     * Combined summary of all k8s resources for dashboard
     */
    router.get('/summary', async (req, res) => {
        try {
            const proxyAvailable = await k3sProxy.checkProxyAvailable();

            if (!proxyAvailable) {
                return res.json({
                    proxyAvailable: false,
                    error: 'kubectl proxy is not available',
                    timestamp: new Date().toISOString()
                });
            }

            const [health, version, nodeMetrics, traefikStatus, helmReleases, clusterInfo, deployments, pods] = await Promise.all([
                k3sProxy.getAggregatedHealth(),
                k3sProxy.getVersion(),
                k3sProxy.getNodeMetrics(),
                k3sProxy.getTraefikStatus(),
                k3sProxy.getAllHelmReleases(),
                k3sProxy.getClusterInfo(),
                k3sProxy.getDeployments(),
                k3sProxy.getPods()
            ]);

            res.json({
                proxyAvailable: true,
                health,
                version,
                nodeMetrics,
                traefikRoutes: traefikStatus.ingressRoutes,
                traefikMiddlewares: traefikStatus.middlewares,
                helmReleases,
                clusterInfo,
                deployments,
                pods,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching k8s summary:', error);
            res.status(500).json({ error: 'Failed to fetch k8s summary' });
        }
    });

    return router;
}

module.exports = { createK8sRoutes };
