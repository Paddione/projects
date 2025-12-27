const { execSync } = require('child_process');

// Replace this with your actual Discord Webhook URL if you have one
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || null;

const DASHBOARD_URL = 'http://localhost:4242/login.html';

async function notify(message) {
    console.log(`[ALERT] ${message}`);
    if (DISCORD_WEBHOOK_URL) {
        try {
            await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `🚨 **vLLM System alert** 🚨\n${message}` })
            });
        } catch (e) {
            console.error('Failed to send Discord notification:', e.message);
        }
    }
}

async function checkDashboard() {
    try {
        const response = await fetch(DASHBOARD_URL, { signal: AbortSignal.timeout(5000) });
        return response.ok || response.status === 302 || response.status === 200;
    } catch (e) {
        return false;
    }
}

async function runHealthCheck() {
    const isDashboardUp = await checkDashboard();

    if (!isDashboardUp) {
        console.log('Dashboard is down. Attempting restart...');
        try {
            execSync('sudo systemctl restart vram-dashboard');
            await new Promise(r => setTimeout(r, 10000));
            if (!(await checkDashboard())) {
                await notify('Critical Failure: **vRAM Dashboard** is down and failed to recover after restart.');
            }
        } catch (err) {
            await notify(`Critical Failure: Could not restart Dashboard service. Error: ${err.message}`);
        }
    }

    // Checking models (only if they are supposed to be up - we check docker status)
    // Since they are "off by default", we don't auto-restart them here, 
    // but the dashboard itself handles their lifecycle.
    console.log('Health check completed at ' + new Date().toISOString());
}

// Run every 5 minutes
setInterval(runHealthCheck, 5 * 60 * 1000);
runHealthCheck();
