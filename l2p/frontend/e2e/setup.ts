import { test as setup, expect } from '@playwright/test';
import { TestDataManager } from './utils/test-data-manager';

/**
 * Enhanced setup with comprehensive environment validation and data management
 */
setup('validate test environment', async ({ page, request }) => {
  console.log('🚀 Starting test environment validation...');

  try {
    // Initialize test data manager
    const dataManager = TestDataManager.getInstance();

    // Wait for the application to be ready
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for React app to load
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 30000 });

    // Wait for AuthGuard to finish validation and show either auth form or authenticated content
    await page.waitForFunction(() => {
      // Check if we're past the loading state
      const loadingState = document.querySelector('p');
      if (loadingState && loadingState.textContent?.includes('Validating authentication')) {
        return false;
      }
      
      // Check if we have either auth form or authenticated content
      const authForm = document.querySelector('[data-testid="login-tab"], [data-testid="register-tab"]');
      const authenticatedContent = document.querySelector('[data-testid="welcome-message"], [data-testid="create-lobby-button"]');
      
      return authForm || authenticatedContent;
    }, { timeout: 30000 });

    // Verify the application is responsive
    await expect(page).toHaveTitle(/Learn2Play/);
    
    // Test backend health endpoint
    const healthResponse = await request.get('/api/health');
    expect(healthResponse.ok()).toBeTruthy();
    
    // Verify database connectivity
    try {
      const dbResponse = await request.get('/api/health/database');
      if (dbResponse.ok()) {
        console.log('✅ Database connectivity verified');
      } else {
        console.warn('⚠️ Database health check failed, tests may be unstable');
      }
    } catch (error) {
      console.warn('⚠️ Database health endpoint not available');
    }

    // Verify WebSocket connectivity
    try {
      const wsHealthy = await page.evaluate(() => {
        return new Promise((resolve) => {
          const ws = new WebSocket('ws://localhost:3001');
          ws.onopen = () => {
            ws.close();
            resolve(true);
          };
          ws.onerror = () => resolve(false);
          setTimeout(() => resolve(false), 5000);
        });
      });
      
      if (wsHealthy) {
        console.log('✅ WebSocket connectivity verified');
      } else {
        console.warn('⚠️ WebSocket connectivity failed, real-time features may not work');
      }
    } catch (error) {
      console.warn('⚠️ WebSocket test failed:', error);
    }

    // Initialize test data storage
    await page.evaluate(() => {
      window.testData = {
        users: [],
        lobbies: [],
        files: []
      };
    });

    // Verify browser capabilities
    const browserCapabilities = await page.evaluate(() => {
      return {
        localStorage: typeof localStorage !== 'undefined',
        sessionStorage: typeof sessionStorage !== 'undefined',
        indexedDB: typeof indexedDB !== 'undefined',
        webSocket: typeof WebSocket !== 'undefined',
        fetch: typeof fetch !== 'undefined',
        mediaDevices: navigator.mediaDevices !== undefined
      };
    });

    const missingCapabilities = Object.entries(browserCapabilities)
      .filter(([_, supported]) => !supported)
      .map(([capability]) => capability);

    if (missingCapabilities.length > 0) {
      console.warn('⚠️ Missing browser capabilities:', missingCapabilities.join(', '));
    } else {
      console.log('✅ All browser capabilities verified');
    }

    // Test basic UI elements are present (without navigation)
    const hasAuthForm = await page.locator('[data-testid="login-tab"], [data-testid="register-tab"]').count() > 0;
    const hasAuthenticatedContent = await page.locator('[data-testid="welcome-message"], [data-testid="create-lobby-button"]').count() > 0;
    
    if (!hasAuthForm && !hasAuthenticatedContent) {
      throw new Error('Neither auth form nor authenticated content is visible after setup');
    }
    
    console.log('✅ Test environment validation completed successfully');

  } catch (error) {
    console.error('❌ Test environment validation failed:', error);
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: `setup-error-${Date.now()}.png`,
      fullPage: true 
    });
    
    throw error;
  }
});

setup('prepare test data storage', async ({ page }) => {
  console.log('📁 Preparing test data storage...');

  try {
    // Create test data directories
    const fs = require('fs');
    const path = require('path');
    
    const testDataDir = path.join(__dirname, 'test-data');
    const screenshotsDir = path.join(__dirname, 'screenshots');
    const videosDir = path.join(__dirname, 'videos');
    
    [testDataDir, screenshotsDir, videosDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Initialize browser storage for test data
    await page.evaluate(() => {
      // Clear any existing test data
      localStorage.removeItem('testData');
      sessionStorage.removeItem('testData');
      
      // Set up test data structure
      const testDataStructure = {
        users: [],
        lobbies: [],
        files: [],
        sessions: [],
        metadata: {
          setupTime: new Date().toISOString(),
          testRun: Date.now()
        }
      };
      
      localStorage.setItem('testData', JSON.stringify(testDataStructure));
    });

    console.log('✅ Test data storage prepared');

  } catch (error) {
    console.error('❌ Failed to prepare test data storage:', error);
    throw error;
  }
});

setup('verify accessibility features', async ({ page }) => {
  console.log('♿ Verifying accessibility features...');

  try {
    // Check for basic accessibility features
    const accessibilityFeatures = await page.evaluate(() => {
      const features = {
        hasSkipLinks: !!document.querySelector('a[href="#main"], a[href="#content"]'),
        hasMainLandmark: !!document.querySelector('main, [role="main"]'),
        hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
        hasAriaLabels: document.querySelectorAll('[aria-label], [aria-labelledby]').length > 0,
        hasAltTexts: Array.from(document.querySelectorAll('img')).every(img => img.alt !== undefined),
        hasFocusableElements: document.querySelectorAll('button, input, select, textarea, a[href]').length > 0
      };
      
      return features;
    });

    const missingFeatures = Object.entries(accessibilityFeatures)
      .filter(([_, present]) => !present)
      .map(([feature]) => feature);

    if (missingFeatures.length > 0) {
      console.warn('⚠️ Missing accessibility features:', missingFeatures.join(', '));
    } else {
      console.log('✅ Basic accessibility features verified');
    }

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    
    if (focusedElement) {
      console.log('✅ Keyboard navigation working');
    } else {
      console.warn('⚠️ Keyboard navigation may not be working properly');
    }

  } catch (error) {
    console.warn('⚠️ Accessibility verification failed:', error);
    // Don't fail setup for accessibility issues
  }
}); 