import { spawnSync } from 'child_process';
import { FullConfig } from '@playwright/test';

/**
 * Global setup for K3d E2E tests
 * 
 * Verifies that the k3d cluster is ready before running tests.
 */
async function globalSetup(config: FullConfig) {
  console.log('\n🚀 Starting K3d Cluster Readiness Check...');

  // 1. Check kubectl connectivity
  const clusterInfo = spawnSync('kubectl', ['cluster-info'], { encoding: 'utf-8', timeout: 5000 });
  if (clusterInfo.status !== 0) {
    throw new Error('❌ kubectl not connected to cluster. Is k3d running?');
  }
  console.log('✅ Kubernetes cluster is reachable');

  // 2. Check Traefik (Entrypoint)
  const traefikPods = spawnSync('kubectl', [
    'get', 'pods',
    '-n', 'korczewski-infra',
    '-l', 'app.kubernetes.io/name=traefik',
    '-o', 'jsonpath={.items[*].status.phase}'
  ], { encoding: 'utf-8' });

  if (!traefikPods.stdout.includes('Running')) {
    console.warn('⚠️ Traefik pods might not be fully ready yet.');
  } else {
    console.log('✅ Traefik is running');
  }

  // 3. Check Core Services
  const services = ['auth', 'l2p-backend', 'l2p-frontend', 'payment', 'videovault'];
  const namespace = 'korczewski-services';

  console.log(`\n🔍 Checking services in ${namespace}:`);

  for (const svc of services) {
    const podStatus = spawnSync('kubectl', [
      'get', 'pods',
      '-n', namespace,
      '-l', `app.kubernetes.io/name=${svc}`,
      '-o', 'jsonpath={.items[0].status.phase}'
    ], { encoding: 'utf-8' });

    const phase = podStatus.stdout.trim();
    if (phase === 'Running') {
      console.log(`  ✅ ${svc.padEnd(12)}: Running`);
    } else {
      console.log(`  ❌ ${svc.padEnd(12)}: ${phase || 'Not Found'}`);
    }
  }

  console.log('\n🏁 Global setup complete. Proceeding to tests...\n');
}

export default globalSetup;
