const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', 'browser_control_registry.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

async function runTasks(groupId) {
    const group = registry.groups[groupId];
    if (!group) {
        console.error(JSON.stringify({ error: `Group ${groupId} not found` }));
        process.exit(1);
    }

    const browser = await chromium.launch({
        headless: registry.configurations.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        viewport: registry.configurations.viewport
    });
    const page = await context.newPage();

    const results = [];

    try {
        for (const task of group.tasks) {
            console.log(JSON.stringify({ type: 'task_start', name: task.name }));

            try {
                await page.goto(task.url, { timeout: registry.configurations.timeout });

                if (task.steps) {
                    for (const step of task.steps) {
                        if (step.includes('type email')) {
                            await page.fill('input[type="email"], input[name="email"], input#email', registry.test_credentials.email);
                        } else if (step.includes('type password')) {
                            await page.fill('input[type="password"], input[name="password"], input#password', registry.test_credentials.password);
                        } else if (step.includes('click submit') || step.includes('click login')) {
                            await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
                        } else if (step.includes('exists in localStorage')) {
                            const key = step.match(/'(.+)'/)[1];
                            const value = await page.evaluate((k) => localStorage.getItem(k), key);
                            if (!value) throw new Error(`LocalStorage key ${key} not found`);
                        }
                    }
                }

                if (task.expected) {
                    if (task.expected.includes('h1:contains')) {
                        const text = task.expected.match(/'(.+)'/)[1];
                        await page.waitForSelector(`h1:has-text("${text}")`, { timeout: 5000 });
                    } else if (task.expected.includes('title:contains')) {
                        const text = task.expected.match(/'(.+)'/)[1];
                        const title = await page.title();
                        if (!title.includes(text)) throw new Error(`Title mismatch: expected ${text}, got ${title}`);
                    } else if (task.expected.includes('button:contains')) {
                        const text = task.expected.match(/'(.+)'/)[1];
                        await page.waitForSelector(`button:has-text("${text}")`, { timeout: 5000 });
                    } else if (task.expected.includes('text:contains')) {
                        const text = task.expected.match(/'(.+)'/)[1];
                        await page.waitForSelector(`text="${text}"`, { timeout: 5000 });
                    } else if (task.expected.includes('div.service-card')) {
                        await page.waitForSelector('.service-card', { timeout: 5000 });
                    }
                }

                console.log(JSON.stringify({ type: 'task_success', name: task.name, detail: `Successfully verified ${task.url}` }));
            } catch (err) {
                console.log(JSON.stringify({ type: 'task_error', name: task.name, error: err.message }));
            }
        }
    } finally {
        await browser.close();
    }
}

const groupId = process.argv[2];
if (!groupId) {
    console.error('Usage: node runner.js <groupId>');
    process.exit(1);
}

runTasks(groupId).catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
});
