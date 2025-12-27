import { test, expect } from '@playwright/test';

test.describe('Input Validation Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should validate registration form inputs', async ({ page }) => {
    await page.click('text=Register');

    // Test empty fields
    await page.click('[data-testid="register-button"]');
    await expect(page.locator('[data-testid="username-error"]')).toContainText(/required/i);
    await expect(page.locator('[data-testid="email-error"]')).toContainText(/required/i);
    await expect(page.locator('[data-testid="password-error"]')).toContainText(/required/i);

    // Test invalid username formats
    const invalidUsernames = [
      'a', // too short
      'a'.repeat(51), // too long
      'user name', // spaces
      'user@name', // special chars
      '123user', // starts with number
      'USER', // all caps (if not allowed)
    ];

    for (const username of invalidUsernames) {
      await page.fill('[data-testid="username-input"]', username);
      await page.fill('[data-testid="email-input"]', 'valid@example.com');
      await page.fill('[data-testid="password-input"]', 'ValidPass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'ValidPass123!');
      await page.click('[data-testid="register-button"]');
      
      await expect(page.locator('[data-testid="username-error"]')).toBeVisible();
      await page.fill('[data-testid="username-input"]', ''); // Clear for next test
    }

    // Test invalid email formats
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user@.com',
      'user..name@example.com',
      'user@example',
      'user name@example.com',
    ];

    for (const email of invalidEmails) {
      await page.fill('[data-testid="username-input"]', 'validuser');
      await page.fill('[data-testid="email-input"]', email);
      await page.fill('[data-testid="password-input"]', 'ValidPass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'ValidPass123!');
      await page.click('[data-testid="register-button"]');
      
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await page.fill('[data-testid="email-input"]', ''); // Clear for next test
    }

    // Test invalid passwords
    const invalidPasswords = [
      'short', // too short
      'nouppercase123!', // no uppercase
      'NOLOWERCASE123!', // no lowercase
      'NoNumbers!', // no numbers
      'NoSpecialChars123', // no special characters
      'a'.repeat(129), // too long
    ];

    for (const password of invalidPasswords) {
      await page.fill('[data-testid="username-input"]', 'validuser');
      await page.fill('[data-testid="email-input"]', 'valid@example.com');
      await page.fill('[data-testid="password-input"]', password);
      await page.fill('[data-testid="confirm-password-input"]', password);
      await page.click('[data-testid="register-button"]');
      
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
      await page.fill('[data-testid="password-input"]', ''); // Clear for next test
      await page.fill('[data-testid="confirm-password-input"]', ''); // Clear for next test
    }

    // Test password confirmation mismatch
    await page.fill('[data-testid="username-input"]', 'validuser');
    await page.fill('[data-testid="email-input"]', 'valid@example.com');
    await page.fill('[data-testid="password-input"]', 'ValidPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'DifferentPass123!');
    await page.click('[data-testid="register-button"]');
    
    await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText(/match/i);
  });

  test('should validate login form inputs', async ({ page }) => {
    await page.click('text=Login');

    // Test empty fields
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="username-error"]')).toContainText(/required/i);
    await expect(page.locator('[data-testid="password-error"]')).toContainText(/required/i);

    // Test whitespace-only inputs
    await page.fill('[data-testid="username-input"]', '   ');
    await page.fill('[data-testid="password-input"]', '   ');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="username-error"]')).toContainText(/required/i);
    await expect(page.locator('[data-testid="password-error"]')).toContainText(/required/i);
  });

  test('should validate lobby creation inputs', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `validateuser${timestamp}`;
    const email = `validateuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Test lobby creation validation
    await page.click('[data-testid="create-lobby-button"]');

    // Test invalid question counts
    const invalidQuestionCounts = ['0', '-1', '101', 'abc', '1.5'];
    
    for (const count of invalidQuestionCounts) {
      // Manually set value if it's not in dropdown
      await page.evaluate((count) => {
        const select = document.querySelector('[data-testid="question-count-select"]') as HTMLSelectElement;
        if (select) {
          select.value = count;
        }
      }, count);
      
      await page.click('[data-testid="confirm-create-lobby"]');
      await expect(page.locator('[data-testid="question-count-error"]')).toBeVisible();
    }

    // Test missing question set selection
    await page.selectOption('[data-testid="question-count-select"]', '5');
    // Don't select a question set
    await page.click('[data-testid="confirm-create-lobby"]');
    await expect(page.locator('[data-testid="question-set-error"]')).toContainText(/required/i);
  });

  test('should validate lobby join inputs', async ({ page }) => {
    // Register user
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `joinuser${timestamp}`;
    const email = `joinuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="join-lobby-button"]');

    // Test empty lobby code
    await page.click('[data-testid="join-lobby-confirm"]');
    await expect(page.locator('[data-testid="lobby-code-error"]')).toContainText(/required/i);

    // Test invalid lobby code formats
    const invalidCodes = [
      'abc', // too short
      'abcdefg', // too long
      'abc123', // mixed case/numbers
      '12345a', // invalid characters
      'ABC12$', // special characters
      '   AAA   ', // with spaces
    ];

    for (const code of invalidCodes) {
      await page.fill('[data-testid="lobby-code-input"]', code);
      await page.click('[data-testid="join-lobby-confirm"]');
      await expect(page.locator('[data-testid="lobby-code-error"]')).toBeVisible();
      await page.fill('[data-testid="lobby-code-input"]', ''); // Clear for next test
    }
  });

  test('should validate settings form inputs', async ({ page }) => {
    // Register user to access settings
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `settingsuser${timestamp}`;
    const email = `settingsuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Open settings modal
    await page.click('[data-testid="settings-button"]');

    // Test audio volume validation
    await page.evaluate(() => {
      const volumeSlider = document.querySelector('[data-testid="music-volume-slider"]') as HTMLInputElement;
      if (volumeSlider) {
        volumeSlider.value = '-1'; // Invalid value
        volumeSlider.dispatchEvent(new Event('change'));
      }
    });

    await expect(page.locator('[data-testid="volume-error"]')).toBeVisible();

    // Test volume out of range
    await page.evaluate(() => {
      const volumeSlider = document.querySelector('[data-testid="music-volume-slider"]') as HTMLInputElement;
      if (volumeSlider) {
        volumeSlider.value = '101'; // Invalid value
        volumeSlider.dispatchEvent(new Event('change'));
      }
    });

    await expect(page.locator('[data-testid="volume-error"]')).toBeVisible();
  });

  test('should handle XSS attempts in inputs', async ({ page }) => {
    await page.click('text=Register');

    // Test XSS attempts in various fields
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '"><script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src=x onerror=alert("xss")>',
      '${alert("xss")}',
      '<svg onload=alert("xss")>',
    ];

    for (const payload of xssPayloads) {
      // Test in username field
      await page.fill('[data-testid="username-input"]', payload);
      await page.fill('[data-testid="email-input"]', 'valid@example.com');
      await page.fill('[data-testid="password-input"]', 'ValidPass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'ValidPass123!');
      await page.click('[data-testid="register-button"]');

      // Should not execute script - either show validation error or sanitize
      await expect(page.locator('[data-testid="username-error"]')).toBeVisible();
      
      // Verify no alert was triggered
      const alertHandled = await page.evaluate(() => {
        return new Promise(resolve => {
          const originalAlert = window.alert;
          window.alert = () => {
            resolve(true);
            return true;
          };
          setTimeout(() => resolve(false), 100);
        });
      });
      expect(alertHandled).toBeFalsy();

      await page.fill('[data-testid="username-input"]', ''); // Clear for next test
    }
  });

  test('should handle SQL injection attempts', async ({ page }) => {
    await page.click('text=Login');

    // Common SQL injection payloads
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' OR 1=1 --",
      "admin' --",
      "' UNION SELECT * FROM users --",
      "1'; SELECT * FROM users WHERE 't'='t",
    ];

    for (const payload of sqlPayloads) {
      await page.fill('[data-testid="username-input"]', payload);
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');

      // Should show invalid credentials error, not succeed
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid.*credentials/i);
      
      // Should not redirect to dashboard
      await expect(page).not.toHaveURL(/.*dashboard/);

      // Clear fields for next test
      await page.fill('[data-testid="username-input"]', '');
      await page.fill('[data-testid="password-input"]', '');
    }
  });

  test('should validate file upload inputs (if applicable)', async ({ page }) => {
    // If your app has file upload functionality (e.g., avatar upload)
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `fileuser${timestamp}`;
    const email = `fileuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // If there's a profile/avatar upload feature
    if (await page.locator('[data-testid="avatar-upload"]').isVisible()) {
      // Test invalid file types
      const invalidFile = Buffer.from('invalid file content');
      await page.setInputFiles('[data-testid="avatar-upload"]', {
        name: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        buffer: invalidFile,
      });

      await expect(page.locator('[data-testid="file-error"]')).toContainText(/invalid.*file.*type/i);

      // Test oversized file
      const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB
      await page.setInputFiles('[data-testid="avatar-upload"]', {
        name: 'large.jpg',
        mimeType: 'image/jpeg',
        buffer: largeFile,
      });

      await expect(page.locator('[data-testid="file-error"]')).toContainText(/file.*too.*large/i);
    }
  });

  test('should handle unicode and emoji inputs', async ({ page }) => {
    await page.click('text=Register');

    // Test unicode characters
    const unicodeInputs = [
      '测试用户', // Chinese characters
      'тестовый', // Cyrillic
      'テストユーザー', // Japanese
      '🎮🎯🎲', // Emojis
      'user\u0000null', // Null byte
      'user\u200B', // Zero-width space
    ];

    for (const input of unicodeInputs) {
      await page.fill('[data-testid="username-input"]', input);
      await page.fill('[data-testid="email-input"]', 'valid@example.com');
      await page.fill('[data-testid="password-input"]', 'ValidPass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'ValidPass123!');
      await page.click('[data-testid="register-button"]');

      // Should either accept valid unicode or show appropriate error
      const hasError = await page.locator('[data-testid="username-error"]').isVisible();
      if (hasError) {
        await expect(page.locator('[data-testid="username-error"]')).toContainText(/invalid.*characters|not.*allowed/i);
      } else {
        // If accepted, verify it's properly handled
        await expect(page).toHaveURL(/.*dashboard/);
        await page.click('[data-testid="logout-button"]');
        await page.goto('/');
        await page.click('text=Register');
      }

      await page.fill('[data-testid="username-input"]', ''); // Clear for next test
    }
  });

  test('should validate maximum input lengths', async ({ page }) => {
    await page.click('text=Register');

    // Test maximum length constraints
    const longString = 'a'.repeat(1000);
    
    await page.fill('[data-testid="username-input"]', longString);
    await page.fill('[data-testid="email-input"]', `${longString}@example.com`);
    await page.fill('[data-testid="password-input"]', longString);
    await page.fill('[data-testid="confirm-password-input"]', longString);
    await page.click('[data-testid="register-button"]');

    // Should show length validation errors
    await expect(page.locator('[data-testid="username-error"]')).toContainText(/too.*long|maximum.*length/i);
    await expect(page.locator('[data-testid="email-error"]')).toContainText(/too.*long|maximum.*length/i);
    await expect(page.locator('[data-testid="password-error"]')).toContainText(/too.*long|maximum.*length/i);
  });
}); 