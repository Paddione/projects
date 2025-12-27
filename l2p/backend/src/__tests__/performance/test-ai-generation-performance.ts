import { test, expect, Page, BrowserContext, Browser } from '@playwright/test';
import { performance } from 'perf_hooks';

test.describe('AI Generation and Vector Database Performance Tests', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Login to the application
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to question set management
    await page.click('[data-testid="question-sets-link"]');
  });

  test('AI question generation performance - single request', async ({ page }: { page: Page }) => {
    // Create a question set for testing
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Performance Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Set for performance testing');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="ai-generate-button"]');
    
    // Measure AI generation performance
    const startTime = performance.now();
    
    await page.fill('[data-testid="ai-prompt"]', 'Generate 5 questions about basic chemistry concepts');
    await page.fill('[data-testid="question-count"]', '5');
    await page.selectOption('[data-testid="ai-difficulty"]', 'medium');
    await page.selectOption('[data-testid="ai-category"]', 'Chemistry');
    await page.click('[data-testid="generate-questions-button"]');
    
    // Wait for generation to complete
    await expect(page.locator('[data-testid="generation-complete"]')).toBeVisible({ timeout: 30000 });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Verify performance requirements
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    
    // Verify questions were generated
    await expect(page.locator('[data-testid="generated-question"]')).toHaveCount(5);
    
    console.log(`AI generation took ${duration.toFixed(2)}ms`);
  });

  test('AI question generation performance - multiple concurrent requests', async ({ page, context }: { page: Page; context: BrowserContext }) => {
    // Create multiple browser contexts for concurrent testing
    const contexts = [];
    const pages = [];
    
    for (let i = 0; i < 3; i++) {
      const browser = context.browser();
      if (!browser) throw new Error('Browser not available');
      const newContext = await browser.newContext();
      const newPage = await newContext.newPage();
      
      // Login in each context
      await newPage.goto('/');
      await newPage.click('text=Login');
      await newPage.fill('[data-testid="username-input"]', `testuser${i}`);
      await newPage.fill('[data-testid="password-input"]', 'TestPass123!');
      await newPage.click('[data-testid="login-button"]');
      await newPage.click('[data-testid="question-sets-link"]');
      
      contexts.push(newContext);
      pages.push(newPage);
    }
    
    // Create question sets in each context
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page) throw new Error(`Page ${i} not available`);
      await page.click('[data-testid="create-question-set-button"]');
      await page.fill('[data-testid="question-set-name"]', `Concurrent Test Set ${i}`);
      await page.fill('[data-testid="question-set-description"]', `Set ${i} for concurrent testing`);
      await page.selectOption('[data-testid="question-set-category"]', 'Science');
      await page.click('[data-testid="save-question-set-button"]');
      await page.click('[data-testid="open-question-set-button"]');
      await page.click('[data-testid="ai-generate-button"]');
    }
    
    // Start concurrent AI generation
    const startTime = performance.now();
    
    const generationPromises = pages.map(async (page, i) => {
      await page.fill('[data-testid="ai-prompt"]', `Generate 3 questions about chemistry ${i}`);
      await page.fill('[data-testid="question-count"]', '3');
      await page.selectOption('[data-testid="ai-difficulty"]', 'medium');
      await page.selectOption('[data-testid="ai-category"]', 'Chemistry');
      await page.click('[data-testid="generate-questions-button"]');
      
      return page.waitForSelector('[data-testid="generation-complete"]', { timeout: 30000 });
    });
    
    // Wait for all generations to complete
    await Promise.all(generationPromises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Verify performance requirements for concurrent requests
    expect(duration).toBeLessThan(60000); // Should complete within 60 seconds for 3 concurrent requests
    
    // Verify all generations completed successfully
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page) throw new Error(`Page ${i} not available`);
      await expect(page.locator('[data-testid="generated-question"]')).toHaveCount(3);
    }
    
    console.log(`Concurrent AI generation took ${duration.toFixed(2)}ms`);
    
    // Clean up
    for (const ctx of contexts) {
      await ctx.close();
    }
  });

  test('Vector database query performance', async ({ page }: { page: Page }) => {
    // Navigate to AI generation
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Vector DB Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Set for vector DB testing');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="ai-generate-button"]');
    
    // Test vector database query performance with different prompts
    const testPrompts = [
      'Generate questions about organic chemistry',
      'Generate questions about inorganic chemistry',
      'Generate questions about physical chemistry',
      'Generate questions about biochemistry',
      'Generate questions about analytical chemistry'
    ];
    
    const queryTimes = [];
    
    for (const prompt of testPrompts) {
      const startTime = performance.now();
      
      await page.fill('[data-testid="ai-prompt"]', prompt);
      await page.fill('[data-testid="question-count"]', '2');
      await page.selectOption('[data-testid="ai-difficulty"]', 'medium');
      await page.selectOption('[data-testid="ai-category"]', 'Chemistry');
      await page.click('[data-testid="generate-questions-button"]');
      
      await expect(page.locator('[data-testid="generation-complete"]')).toBeVisible({ timeout: 30000 });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      queryTimes.push(duration);
      
      // Clear for next test
      await page.click('[data-testid="clear-questions-button"]');
    }
    
    // Calculate average query time
    const averageQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    
    // Verify performance requirements
    expect(averageQueryTime).toBeLessThan(15000); // Average should be under 15 seconds
    expect(Math.max(...queryTimes)).toBeLessThan(25000); // No single query should take more than 25 seconds
    
    console.log(`Average vector DB query time: ${averageQueryTime.toFixed(2)}ms`);
    console.log(`Query times: ${queryTimes.map(t => t.toFixed(2)).join(', ')}ms`);
  });

  test('Question set CRUD performance', async ({ page }: { page: Page }) => {
    const startTime = performance.now();
    
    // Test creating multiple question sets
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="create-question-set-button"]');
      await page.fill('[data-testid="question-set-name"]', `Performance Set ${i}`);
      await page.fill('[data-testid="question-set-description"]', `Description ${i}`);
      await page.selectOption('[data-testid="question-set-category"]', 'Science');
      await page.click('[data-testid="save-question-set-button"]');
      
      // Verify creation was successful
      await expect(page.locator(`text=Performance Set ${i}`)).toBeVisible();
    }
    
    const creationTime = performance.now() - startTime;
    
    // Test reading question sets
    const readStartTime = performance.now();
    
    // Navigate to question sets list
    await page.click('[data-testid="question-sets-link"]');
    
    // Verify all sets are visible
    for (let i = 0; i < 10; i++) {
      await expect(page.locator(`text=Performance Set ${i}`)).toBeVisible();
    }
    
    const readTime = performance.now() - readStartTime;
    
    // Test updating question sets
    const updateStartTime = performance.now();
    
    await page.click('[data-testid="edit-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Updated Performance Set');
    await page.click('[data-testid="save-question-set-button"]');
    
    const updateTime = performance.now() - updateStartTime;
    
    // Test deleting question sets
    const deleteStartTime = performance.now();
    
    await page.click('[data-testid="delete-question-set-button"]');
    await page.click('[data-testid="confirm-delete-button"]');
    
    const deleteTime = performance.now() - deleteStartTime;
    
    // Verify performance requirements
    expect(creationTime).toBeLessThan(10000); // Creating 10 sets should take less than 10 seconds
    expect(readTime).toBeLessThan(2000); // Reading should be very fast
    expect(updateTime).toBeLessThan(2000); // Updating should be fast
    expect(deleteTime).toBeLessThan(2000); // Deleting should be fast
    
    console.log(`CRUD Performance Results:`);
    console.log(`  Creation (10 sets): ${creationTime.toFixed(2)}ms`);
    console.log(`  Read (10 sets): ${readTime.toFixed(2)}ms`);
    console.log(`  Update (1 set): ${updateTime.toFixed(2)}ms`);
    console.log(`  Delete (1 set): ${deleteTime.toFixed(2)}ms`);
  });

  test('JSON import performance', async ({ page }: { page: Page }) => {
    // Create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Import Performance Set');
    await page.fill('[data-testid="question-set-description"]', 'Set for import performance testing');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="import-json-button"]');
    
    // Prepare large JSON data (100 questions)
    const largeJsonData = {
      questions: Array.from({ length: 100 }, (_, i) => ({
        question: `Question ${i + 1}?`,
        correctAnswer: `Answer ${i + 1}`,
        incorrectAnswers: [`Wrong1-${i + 1}`, `Wrong2-${i + 1}`, `Wrong3-${i + 1}`],
        explanation: `Explanation for question ${i + 1}`,
        difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
        category: 'Science'
      }))
    };
    
    const startTime = performance.now();
    
    // Import large JSON
    await page.fill('[data-testid="json-input"]', JSON.stringify(largeJsonData, null, 2));
    await page.click('[data-testid="import-button"]');
    
    // Wait for import to complete
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible({ timeout: 30000 });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Verify performance requirements
    expect(duration).toBeLessThan(30000); // Importing 100 questions should take less than 30 seconds
    
    // Verify all questions were imported
    await expect(page.locator('[data-testid="imported-question"]')).toHaveCount(100);
    
    console.log(`JSON import of 100 questions took ${duration.toFixed(2)}ms`);
  });

  test('Memory usage during AI generation', async ({ page }: { page: Page }) => {
    // Monitor memory usage during AI generation
    const initialMemory = process.memoryUsage();
    
    // Create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Memory Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Set for memory testing');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="ai-generate-button"]');
    
    // Generate questions
    await page.fill('[data-testid="ai-prompt"]', 'Generate 10 questions about chemistry');
    await page.fill('[data-testid="question-count"]', '10');
    await page.selectOption('[data-testid="ai-difficulty"]', 'medium');
    await page.selectOption('[data-testid="ai-category"]', 'Chemistry');
    await page.click('[data-testid="generate-questions-button"]');
    
    await expect(page.locator('[data-testid="generation-complete"]')).toBeVisible({ timeout: 30000 });
    
    const finalMemory = process.memoryUsage();
    
    // Calculate memory increase
    const memoryIncrease = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external,
      rss: finalMemory.rss - initialMemory.rss
    };
    
    // Verify memory usage is reasonable
    expect(memoryIncrease.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    expect(memoryIncrease.rss).toBeLessThan(200 * 1024 * 1024); // Less than 200MB RSS increase
    
    console.log(`Memory Usage Increase:`);
    console.log(`  Heap Used: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Heap Total: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  External: ${(memoryIncrease.external / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  RSS: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)}MB`);
  });

  test('Concurrent user load testing', async ({ browser }: { browser: Browser }) => {
    // Simulate multiple concurrent users
    const userCount = 5;
    const contexts = [];
    const pages = [];
    
    // Create multiple browser contexts
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Login each user
      await page.goto('/');
      await page.click('text=Login');
      await page.fill('[data-testid="username-input"]', `loadtestuser${i}`);
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-button"]');
      
      contexts.push(context);
      pages.push(page);
    }
    
    const startTime = performance.now();
    
    // All users create question sets simultaneously
    const creationPromises = pages.map(async (page, i) => {
      await page.click('[data-testid="question-sets-link"]');
      await page.click('[data-testid="create-question-set-button"]');
      await page.fill('[data-testid="question-set-name"]', `Load Test Set ${i}`);
      await page.fill('[data-testid="question-set-description"]', `Load test set ${i}`);
      await page.selectOption('[data-testid="question-set-category"]', 'Science');
      await page.click('[data-testid="save-question-set-button"]');
      
      return page.waitForSelector(`text=Load Test Set ${i}`);
    });
    
    await Promise.all(creationPromises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Verify performance under load
    expect(duration).toBeLessThan(15000); // Should handle 5 concurrent users within 15 seconds
    
    console.log(`Concurrent user load test (${userCount} users) took ${duration.toFixed(2)}ms`);
    
    // Clean up
    for (const context of contexts) {
      await context.close();
    }
  });
}); 