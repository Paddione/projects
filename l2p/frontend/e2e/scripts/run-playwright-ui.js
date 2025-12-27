const { spawn, spawnSync } = require('child_process');
const os = require('os');

function hasDisplayServer() {
  if (os.platform() !== 'linux') return true;
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

function hasXvfbRun() {
  if (os.platform() !== 'linux') return false;
  const which = spawnSync('bash', ['-lc', 'command -v xvfb-run'], { encoding: 'utf8' });
  return which.status === 0 && which.stdout.trim().length > 0;
}

function runCommand(cmd, args) {
  console.log(`[e2e] Running: ${cmd} ${args.join(' ')}`);
  const child = spawn(cmd, args, { stdio: 'inherit', env: process.env });
  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[e2e] Exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 1);
  });
}

function run() {
  const additionalArgs = process.argv.slice(2);
  const baseArgs = ['--yes', 'playwright', 'test'];

  if (os.platform() === 'linux' && !hasDisplayServer()) {
    if (hasXvfbRun()) {
      runCommand('xvfb-run', [
        '-a',
        '-s', "-screen 0 1280x1024x24",
        'npx',
        ...baseArgs,
        '--ui',
        ...additionalArgs,
      ]);
      return;
    }
    console.warn('[e2e] No DISPLAY detected and xvfb-run not found. Falling back to non-UI test runner.');
    console.warn('[e2e] Install xvfb: sudo apt-get update && sudo apt-get install -y xvfb');
    runCommand('npx', [...baseArgs, ...additionalArgs]);
    return;
  }

  // Has a display (Linux with DISPLAY/Wayland, macOS, Windows)
  runCommand('npx', [...baseArgs, '--ui', ...additionalArgs]);
}

run();
