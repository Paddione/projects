import { test, expect } from '@playwright/test';

test.describe('File Upload Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should handle invalid file types', async ({ page }) => {
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

    // Navigate to file upload section (if exists)
    await page.click('[data-testid="file-upload-link"]');

    // Test various invalid file types
    const invalidFiles = [
      { name: 'malicious.exe', mimeType: 'application/x-msdownload', content: 'executable content' },
      { name: 'script.bat', mimeType: 'application/x-bat', content: '@echo off' },
      { name: 'virus.vbs', mimeType: 'application/x-vbs', content: 'WScript.Echo "Hello"' },
      { name: 'shell.sh', mimeType: 'application/x-sh', content: '#!/bin/bash' },
      { name: 'document.ps1', mimeType: 'application/x-powershell', content: 'Write-Host "PowerShell"' },
    ];

    for (const file of invalidFiles) {
      const fileBuffer = Buffer.from(file.content);
      await page.setInputFiles('[data-testid="file-upload-input"]', {
        name: file.name,
        mimeType: file.mimeType,
        buffer: fileBuffer,
      });

      await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-error"]')).toContainText(/invalid.*file.*type|not.*allowed/i);
    }
  });

  test('should handle oversized files', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `sizeuser${timestamp}`;
    const email = `sizeuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="file-upload-link"]');

    // Test files that exceed size limits
    const oversizedFiles = [
      { name: 'large-document.pdf', size: 50 * 1024 * 1024 }, // 50MB
      { name: 'huge-image.jpg', size: 100 * 1024 * 1024 }, // 100MB
      { name: 'massive-video.mp4', size: 500 * 1024 * 1024 }, // 500MB
    ];

    for (const file of oversizedFiles) {
      const largeBuffer = Buffer.alloc(file.size);
      await page.setInputFiles('[data-testid="file-upload-input"]', {
        name: file.name,
        mimeType: 'application/octet-stream',
        buffer: largeBuffer,
      });

      await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-error"]')).toContainText(/file.*too.*large|size.*limit/i);
    }
  });

  test('should handle corrupted files', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `corruptuser${timestamp}`;
    const email = `corruptuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="file-upload-link"]');

    // Test corrupted file formats
    const corruptedFiles = [
      { name: 'corrupted.pdf', content: 'This is not a valid PDF file' },
      { name: 'broken.jpg', content: 'Not a valid JPEG image' },
      { name: 'invalid.docx', content: 'This is not a valid Word document' },
      { name: 'damaged.png', content: 'Invalid PNG header' },
    ];

    for (const file of corruptedFiles) {
      const fileBuffer = Buffer.from(file.content);
      await page.setInputFiles('[data-testid="file-upload-input"]', {
        name: file.name,
        mimeType: 'application/octet-stream',
        buffer: fileBuffer,
      });

      // Should show processing error
      await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-error"]')).toContainText(/corrupted|invalid.*format|processing.*error/i);
    }
  });

  test('should handle virus scanning failures', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `virususer${timestamp}`;
    const email = `virususer${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="file-upload-link"]');

    // Mock virus scanning service failure
    await page.route('**/api/scan-virus', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Virus scanning service unavailable',
          code: 'VIRUS_SCAN_UNAVAILABLE'
        })
      });
    });

    // Upload a file that triggers virus scanning
    const fileBuffer = Buffer.from('Test document content');
    await page.setInputFiles('[data-testid="file-upload-input"]', {
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });

    // Should show virus scanning error
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText(/virus.*scan|security.*check/i);
  });

  test('should handle storage failures', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `storageuser${timestamp}`;
    const email = `storageuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="file-upload-link"]');

    // Mock storage service failure
    await page.route('**/api/upload', route => {
      route.fulfill({
        status: 507,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Storage quota exceeded',
          code: 'STORAGE_QUOTA_EXCEEDED'
        })
      });
    });

    // Try to upload file
    const fileBuffer = Buffer.from('Test document content');
    await page.setInputFiles('[data-testid="file-upload-input"]', {
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });

    // Should show storage error
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText(/storage.*quota|disk.*space|storage.*full/i);
  });

  test('should handle network failures during upload', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `networkuser${timestamp}`;
    const email = `networkuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="file-upload-link"]');

    // Mock network failure during upload
    await page.route('**/api/upload', route => {
      route.abort('failed');
    });

    // Try to upload file
    const fileBuffer = Buffer.from('Test document content');
    await page.setInputFiles('[data-testid="file-upload-input"]', {
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });

    // Should show network error
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText(/network.*error|connection.*failed|upload.*failed/i);
  });

  test('should handle file processing timeouts', async ({ page }) => {
    // Register user first
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

    await page.click('[data-testid="file-upload-link"]');

    // Mock processing timeout
    await page.route('**/api/process-file', route => {
      // Simulate slow processing that times out
      setTimeout(() => {
        route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'File processing timeout',
            code: 'PROCESSING_TIMEOUT'
          })
        });
      }, 30000); // 30 second delay
    });

    // Try to upload file
    const fileBuffer = Buffer.from('Test document content');
    await page.setInputFiles('[data-testid="file-upload-input"]', {
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });

    // Should show timeout error
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText(/timeout|processing.*timeout/i);
  });

  test('should handle duplicate file uploads', async ({ page }) => {
    // Register user first
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

    await page.click('[data-testid="file-upload-link"]');

    // Upload same file twice
    const fileBuffer = Buffer.from('Test document content');
    const fileName = 'duplicate-test.pdf';

    // First upload
    await page.setInputFiles('[data-testid="file-upload-input"]', {
      name: fileName,
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });

    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();

    // Second upload of same file
    await page.setInputFiles('[data-testid="file-upload-input"]', {
      name: fileName,
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });

    // Should show duplicate file error
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText(/duplicate|already.*exists/i);
  });

  test('should handle file cleanup after failed uploads', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `cleanupuser${timestamp}`;
    const email = `cleanupuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="file-upload-link"]');

    // Mock upload failure that requires cleanup
    await page.route('**/api/upload', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Upload failed, cleanup required',
          code: 'UPLOAD_FAILED_CLEANUP'
        })
      });
    });

    // Try to upload file
    const fileBuffer = Buffer.from('Test document content');
    await page.setInputFiles('[data-testid="file-upload-input"]', {
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });

    // Should show error and cleanup message
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText(/upload.*failed|cleanup.*required/i);
  });

  test('should handle file metadata extraction failures', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `metadatauser${timestamp}`;
    const email = `metadatauser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="file-upload-link"]');

    // Mock metadata extraction failure
    await page.route('**/api/extract-metadata', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Metadata extraction failed',
          code: 'METADATA_EXTRACTION_FAILED'
        })
      });
    });

    // Try to upload file that requires metadata extraction
    const fileBuffer = Buffer.from('Test document content');
    await page.setInputFiles('[data-testid="file-upload-input"]', {
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: fileBuffer,
    });

    // Should show metadata extraction error
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText(/metadata.*extraction|file.*analysis/i);
  });
}); 