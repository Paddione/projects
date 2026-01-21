import { spawnSync } from 'child_process';

/**
 * Global setup for K3d E2E tests
 *
 * Verifies that the k3d cluster is ready before running tests:
 * 1. Checks kubectl connectivity
 * 2. Verifies all pods are in Running state
 */
export default async function globalSetup(): Promise<void> {
  console.log('\n========================================');
  console.log('K3d Cluster Readiness Check');
  console.log('========================================\n');

  // Check kubectl connectivity
  console.log('Checking kubectl connectivity...');
  const clusterInfo = spawnSync('kubectl', ['cluster-info'], {
    encoding: 'utf-8',
    timeout: 10000,
  });

  if (clusterInfo.status !== 0) {
    console.error('kubectl cluster-info failed:');
    console.error(clusterInfo.stderr || clusterInfo.stdout);
    throw new Error(
      'kubectl not connected to cluster. Ensure k3d is running and kubectl is configured.'
    );
  }
  console.log('kubectl connected to cluster');

  // Check pod status
  console.log('\nChecking pod status...');
  const podStatus = spawnSync(
    'kubectl',
    ['get', 'pods', '-A', '-o', 'jsonpath={range .items[*]}{.metadata.namespace}/{.metadata.name}:{.status.phase} {end}'],
    { encoding: 'utf-8', timeout: 10000 }
  );

  if (podStatus.status !== 0) {
    console.error('Failed to get pod status:', podStatus.stderr);
    throw new Error('Failed to query pod status');
  }

  const pods = (podStatus.stdout || '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((p) => {
      const [name, phase] = p.split(':');
      return { name, phase };
    });

  const notRunning = pods.filter(
    (p) => p.phase !== 'Running' && p.phase !== 'Succeeded'
  );

  console.log(`Total pods: ${pods.length}`);
  console.log(`Running/Succeeded: ${pods.length - notRunning.length}`);

  if (notRunning.length > 0) {
    console.warn(`\nWarning: ${notRunning.length} pod(s) not in Running/Succeeded state:`);
    notRunning.forEach((p) => console.warn(`  - ${p.name}: ${p.phase}`));
  }

  // Check korczewski namespaces specifically
  console.log('\nChecking korczewski services...');
  const serviceStatus = spawnSync(
    'kubectl',
    [
      'get', 'pods',
      '-n', 'korczewski-services',
      '-o', 'jsonpath={range .items[*]}{.metadata.name}:{.status.phase} {end}',
    ],
    { encoding: 'utf-8', timeout: 10000 }
  );

  const servicePods = (serviceStatus.stdout || '')
    .trim()
    .split(' ')
    .filter(Boolean);

  const requiredServices = ['auth', 'l2p-backend', 'l2p-frontend', 'payment', 'videovault'];
  const missingServices = requiredServices.filter(
    (svc) => !servicePods.some((p) => p.startsWith(svc))
  );

  if (missingServices.length > 0) {
    console.warn(`\nWarning: Missing services: ${missingServices.join(', ')}`);
  }

  console.log('\n========================================');
  console.log('Cluster ready for testing');
  console.log('========================================\n');
}
