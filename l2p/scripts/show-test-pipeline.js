#!/usr/bin/env node
// Prints the exact scripts to run for a complete test pipeline

const steps = [
  { section: 'Setup', items: [
    { cmd: 'npm run test:config:init', why: 'Initialize test config and defaults' },
    { cmd: 'npm run test:config:validate', why: 'Validate test configuration' },
    { cmd: 'npm run test:env:validate', why: 'Sanity-check local/Docker test environment (non-blocking in pipeline)' },
    { cmd: 'npm run test:browsers:install:all', why: 'Install Playwright browsers (first run or when updated)' },
  ]},
  { section: 'Tests', items: [
    { cmd: 'npm run typecheck', why: 'Strict TypeScript checks' },
    { cmd: 'npm run test:unit', why: 'Run unit tests (frontend + backend)' },
    { cmd: 'npm run test:integration', why: 'Run integration tests (frontend + backend)' },
    { cmd: 'npm run test:e2e:guarded', why: 'Run E2E (guarded; skipped if env not ready)' },
  ]},
  { section: 'Coverage', items: [
    { cmd: 'npm run coverage:all', why: 'Aggregate repo-wide coverage without failing thresholds' },
  ]},
  { section: 'One-liner', items: [
    { cmd: 'npm run pipeline:complete', why: 'Do all of the above in sequence' },
  ]},
];

function print() {
  console.log('\nComplete Test Pipeline — Commands\n');
  let n = 1;
  for (const group of steps) {
    console.log(`${group.section}:`);
    for (const item of group.items) {
      console.log(`  ${String(n).padStart(2, ' ')}. ${item.cmd}`);
      console.log(`      ↳ ${item.why}`);
      n++;
    }
    console.log('');
  }
  console.log('Notes:');
  console.log('- E2E is guarded by scripts/check-e2e-env.js to reduce flakiness.');
  console.log('- Use "npm run typecheck:loose" if you need to bypass strict checks locally.');
  console.log('');
}

print();

