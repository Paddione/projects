import { test, expect } from '@playwright/test';

test.describe('Database Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should handle database connection failures', async ({ page }) => {
    // Mock database connection failure
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Database connection failed',
          code: 'DB_CONNECTION_ERROR'
        })
      });
    });

    // Try to register user
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `dbconnuser${timestamp}`;
    const email = `dbconnuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show database connection error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/database.*connection|server.*unavailable/i);
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle connection pool exhaustion', async ({ page, browser }) => {
    // Create multiple concurrent requests to exhaust connection pool
    const contexts = [];
    const pages = [];
    const requestCount = 20;

    for (let i = 0; i < requestCount; i++) {
      const context = await browser.newContext();
      const newPage = await context.newPage();
      contexts.push(context);
      pages.push(newPage);
    }

    try {
      // Mock connection pool exhaustion
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Connection pool exhausted',
            code: 'DB_POOL_EXHAUSTED'
          })
        });
      });

      // Concurrent registration attempts
      const registrationPromises = pages.map(async (page, index) => {
        await page.goto('/');
        await page.click('text=Register');
        
        const username = `pooluser${Date.now()}_${index}`;
        const email = `pooluser${Date.now()}_${index}@example.com`;
        const password = 'TestPassword123!';

        await page.fill('[data-testid="username-input"]', username);
        await page.fill('[data-testid="email-input"]', email);
        await page.fill('[data-testid="password-input"]', password);
        await page.fill('[data-testid="confirm-password-input"]', password);
        
        await page.click('[data-testid="register-button"]');
        
        try {
          await expect(page.locator('[data-testid="error-message"]')).toContainText(/connection.*pool|try.*later/i, { timeout: 5000 });
          return { success: false, error: 'pool_exhausted' };
        } catch {
          return { success: true };
        }
      });

      const results = await Promise.all(registrationPromises);
      const poolExhaustedCount = results.filter(r => !r.success).length;
      
      // Should handle pool exhaustion gracefully
      expect(poolExhaustedCount).toBeGreaterThan(0);
      
    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('should handle query timeouts', async ({ page }) => {
    // Mock query timeout
    await page.route('**/api/**', route => {
      // Simulate slow response that times out
      setTimeout(() => {
        route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Database query timeout',
            code: 'DB_QUERY_TIMEOUT'
          })
        });
      }, 10000); // 10 second delay
    });

    // Try to create lobby (which involves database queries)
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `timeoutuser${timestamp}`;
    const email = `timeoutuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show timeout error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/timeout|request.*timed.*out/i, { timeout: 15000 });
  });

  test('should handle database deadlocks', async ({ page, context }) => {
    // Mock deadlock error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Database deadlock detected',
          code: 'DB_DEADLOCK'
        })
      });
    });

    // Try to perform concurrent operations that might cause deadlocks
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `deadlockuser${timestamp}`;
    const email = `deadlockuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show deadlock error and retry option
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/deadlock|conflict/i);
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle transaction rollbacks', async ({ page }) => {
    // Mock transaction rollback error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Transaction rollback required',
          code: 'DB_TRANSACTION_ROLLBACK'
        })
      });
    });

    // Try to create lobby (which involves transactions)
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `rollbackuser${timestamp}`;
    const email = `rollbackuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show transaction error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/transaction|rollback/i);
  });

  test('should handle data consistency errors', async ({ page }) => {
    // Mock data consistency error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Data consistency violation',
          code: 'DB_CONSISTENCY_ERROR'
        })
      });
    });

    // Try to join a lobby that might have consistency issues
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `consistencyuser${timestamp}`;
    const email = `consistencyuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="join-lobby-button"]');
    await page.fill('[data-testid="lobby-code-input"]', 'TEST12');
    await page.click('[data-testid="join-lobby-confirm"]');

    // Should show consistency error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/consistency|data.*error/i);
  });

  test('should handle database constraint violations', async ({ page }) => {
    // Mock constraint violation error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Unique constraint violation',
          code: 'DB_CONSTRAINT_VIOLATION',
          details: 'Username already exists'
        })
      });
    });

    // Try to register with duplicate username
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `duplicateuser${timestamp}`;
    const email = `duplicateuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show constraint violation error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/already.*exists|constraint.*violation/i);
  });

  test('should handle database recovery procedures', async ({ page }) => {
    // Mock database recovery scenario
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Database is recovering',
          code: 'DB_RECOVERY',
          retryAfter: 30
        })
      });
    });

    // Try to access application during recovery
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `recoveryuser${timestamp}`;
    const email = `recoveryuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show recovery message with retry information
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/recovering|maintenance/i);
    await expect(page.locator('[data-testid="retry-after"]')).toContainText('30');
  });

  test('should handle database backup and restore scenarios', async ({ page }) => {
    // Mock database backup/restore scenario
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Database backup in progress',
          code: 'DB_BACKUP_IN_PROGRESS',
          estimatedCompletion: '5 minutes'
        })
      });
    });

    // Try to access application during backup
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `backupuser${timestamp}`;
    const email = `backupuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show backup message
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/backup|maintenance/i);
    await expect(page.locator('[data-testid="estimated-completion"]')).toContainText('5 minutes');
  });

  test('should handle database schema migration errors', async ({ page }) => {
    // Mock schema migration error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Database schema migration failed',
          code: 'DB_SCHEMA_MIGRATION_ERROR',
          details: 'Table structure mismatch'
        })
      });
    });

    // Try to access application during schema issues
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `migrationuser${timestamp}`;
    const email = `migrationuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show migration error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/migration|schema.*error/i);
  });
}); 