import { test, expect } from '@playwright/test';

test.describe('Question Set Management - End to End', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application and login
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to question set management
    await page.click('[data-testid="question-sets-link"]');
  });

  test('Create new question set', async ({ page }) => {
    // Click create new question set button
    await page.click('[data-testid="create-question-set-button"]');
    
    // Fill question set form
    await page.fill('[data-testid="question-set-name"]', 'Test Question Set');
    await page.fill('[data-testid="question-set-description"]', 'A test question set for E2E testing');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.check('[data-testid="question-set-public"]');
    
    // Submit form
    await page.click('[data-testid="save-question-set-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="question-set-created"]')).toBeVisible();
    await expect(page.locator('text=Question set created successfully')).toBeVisible();
    
    // Verify question set appears in list
    await expect(page.locator('text=Test Question Set')).toBeVisible();
    await expect(page.locator('text=A test question set for E2E testing')).toBeVisible();
  });

  test('Edit existing question set', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Original Name');
    await page.fill('[data-testid="question-set-description"]', 'Original description');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    // Click edit button on the question set
    await page.click('[data-testid="edit-question-set-button"]');
    
    // Update the question set
    await page.fill('[data-testid="question-set-name"]', 'Updated Name');
    await page.fill('[data-testid="question-set-description"]', 'Updated description');
    await page.selectOption('[data-testid="question-set-category"]', 'History');
    await page.uncheck('[data-testid="question-set-public"]');
    
    // Save changes
    await page.click('[data-testid="save-question-set-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="question-set-updated"]')).toBeVisible();
    await expect(page.locator('text=Question set updated successfully')).toBeVisible();
    
    // Verify changes are reflected
    await expect(page.locator('text=Updated Name')).toBeVisible();
    await expect(page.locator('text=Updated description')).toBeVisible();
  });

  test('Delete question set', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'To Delete');
    await page.fill('[data-testid="question-set-description"]', 'This will be deleted');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    // Click delete button
    await page.click('[data-testid="delete-question-set-button"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="question-set-deleted"]')).toBeVisible();
    await expect(page.locator('text=Question set deleted successfully')).toBeVisible();
    
    // Verify question set is removed from list
    await expect(page.locator('text=To Delete')).not.toBeVisible();
  });

  test('Add questions to question set', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Test description');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    // Open the question set
    await page.click('[data-testid="open-question-set-button"]');
    
    // Add a new question
    await page.click('[data-testid="add-question-button"]');
    
    // Fill question form
    await page.fill('[data-testid="question-text"]', 'What is the capital of France?');
    await page.fill('[data-testid="correct-answer"]', 'Paris');
    await page.fill('[data-testid="incorrect-answer-1"]', 'London');
    await page.fill('[data-testid="incorrect-answer-2"]', 'Berlin');
    await page.fill('[data-testid="incorrect-answer-3"]', 'Madrid');
    await page.fill('[data-testid="question-explanation"]', 'Paris is the capital and largest city of France.');
    await page.selectOption('[data-testid="question-difficulty"]', 'easy');
    await page.selectOption('[data-testid="question-category"]', 'Geography');
    
    // Save question
    await page.click('[data-testid="save-question-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="question-added"]')).toBeVisible();
    await expect(page.locator('text=Question added successfully')).toBeVisible();
    
    // Verify question appears in list
    await expect(page.locator('text=What is the capital of France?')).toBeVisible();
  });

  test('Edit question in question set', async ({ page }) => {
    // First create a question set with a question
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Test description');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="add-question-button"]');
    
    await page.fill('[data-testid="question-text"]', 'Original question?');
    await page.fill('[data-testid="correct-answer"]', 'Original answer');
    await page.fill('[data-testid="incorrect-answer-1"]', 'Wrong1');
    await page.fill('[data-testid="incorrect-answer-2"]', 'Wrong2');
    await page.fill('[data-testid="incorrect-answer-3"]', 'Wrong3');
    await page.fill('[data-testid="question-explanation"]', 'Original explanation');
    await page.selectOption('[data-testid="question-difficulty"]', 'easy');
    await page.selectOption('[data-testid="question-category"]', 'Geography');
    await page.click('[data-testid="save-question-button"]');
    
    // Edit the question
    await page.click('[data-testid="edit-question-button"]');
    
    // Update question
    await page.fill('[data-testid="question-text"]', 'Updated question?');
    await page.fill('[data-testid="correct-answer"]', 'Updated answer');
    await page.fill('[data-testid="incorrect-answer-1"]', 'NewWrong1');
    await page.fill('[data-testid="incorrect-answer-2"]', 'NewWrong2');
    await page.fill('[data-testid="incorrect-answer-3"]', 'NewWrong3');
    await page.fill('[data-testid="question-explanation"]', 'Updated explanation');
    await page.selectOption('[data-testid="question-difficulty"]', 'medium');
    await page.selectOption('[data-testid="question-category"]', 'History');
    
    // Save changes
    await page.click('[data-testid="save-question-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="question-updated"]')).toBeVisible();
    await expect(page.locator('text=Question updated successfully')).toBeVisible();
    
    // Verify changes are reflected
    await expect(page.locator('text=Updated question?')).toBeVisible();
  });

  test('Delete question from question set', async ({ page }) => {
    // First create a question set with a question
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Test description');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="add-question-button"]');
    
    await page.fill('[data-testid="question-text"]', 'To delete?');
    await page.fill('[data-testid="correct-answer"]', 'Answer');
    await page.fill('[data-testid="incorrect-answer-1"]', 'Wrong1');
    await page.fill('[data-testid="incorrect-answer-2"]', 'Wrong2');
    await page.fill('[data-testid="incorrect-answer-3"]', 'Wrong3');
    await page.fill('[data-testid="question-explanation"]', 'Explanation');
    await page.selectOption('[data-testid="question-difficulty"]', 'easy');
    await page.selectOption('[data-testid="question-category"]', 'Geography');
    await page.click('[data-testid="save-question-button"]');
    
    // Delete the question
    await page.click('[data-testid="delete-question-button"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-question-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="question-deleted"]')).toBeVisible();
    await expect(page.locator('text=Question deleted successfully')).toBeVisible();
    
    // Verify question is removed
    await expect(page.locator('text=To delete?')).not.toBeVisible();
  });

  test('JSON import functionality', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Import Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Test description');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    
    // Click import button
    await page.click('[data-testid="import-json-button"]');
    
    // Prepare JSON data
    const jsonData = {
      questions: [
        {
          question: 'What is the chemical symbol for gold?',
          correctAnswer: 'Au',
          incorrectAnswers: ['Ag', 'Fe', 'Cu'],
          explanation: 'Au comes from the Latin word for gold, aurum.',
          difficulty: 'medium',
          category: 'Chemistry'
        },
        {
          question: 'What is the largest planet in our solar system?',
          correctAnswer: 'Jupiter',
          incorrectAnswers: ['Saturn', 'Neptune', 'Uranus'],
          explanation: 'Jupiter is the largest planet in our solar system.',
          difficulty: 'easy',
          category: 'Astronomy'
        }
      ]
    };
    
    // Paste JSON data
    await page.fill('[data-testid="json-input"]', JSON.stringify(jsonData, null, 2));
    
    // Import
    await page.click('[data-testid="import-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
    await expect(page.locator('text=2 questions imported successfully')).toBeVisible();
    
    // Verify questions were imported
    await expect(page.locator('text=What is the chemical symbol for gold?')).toBeVisible();
    await expect(page.locator('text=What is the largest planet in our solar system?')).toBeVisible();
  });

  test('JSON import validation - invalid format', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Import Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Test description');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="import-json-button"]');
    
    // Try to import invalid JSON
    await page.fill('[data-testid="json-input"]', '{ invalid json }');
    await page.click('[data-testid="import-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="import-error"]')).toBeVisible();
    await expect(page.locator('text=Invalid JSON format')).toBeVisible();
  });

  test('JSON import validation - missing required fields', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Import Test Set');
    await page.fill('[data-testid="question-set-description"]', 'Test description');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="import-json-button"]');
    
    // Try to import JSON with missing fields
    const invalidData = {
      questions: [
        {
          question: 'What is the capital of France?',
          // Missing correctAnswer and other required fields
          incorrectAnswers: ['London', 'Berlin', 'Madrid']
        }
      ]
    };
    
    await page.fill('[data-testid="json-input"]', JSON.stringify(invalidData));
    await page.click('[data-testid="import-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="import-error"]')).toBeVisible();
    await expect(page.locator('text=missing required field')).toBeVisible();
  });

  test('AI question generation', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'AI Generated Set');
    await page.fill('[data-testid="question-set-description"]', 'Questions generated by AI');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    
    // Click AI generation button
    await page.click('[data-testid="ai-generate-button"]');
    
    // Fill generation form
    await page.fill('[data-testid="ai-prompt"]', 'Generate 3 questions about basic chemistry concepts');
    await page.fill('[data-testid="question-count"]', '3');
    await page.selectOption('[data-testid="ai-difficulty"]', 'medium');
    await page.selectOption('[data-testid="ai-category"]', 'Chemistry');
    
    // Generate questions
    await page.click('[data-testid="generate-questions-button"]');
    
    // Wait for generation to complete
    await expect(page.locator('[data-testid="generation-loading"]')).toBeVisible();
    await expect(page.locator('[data-testid="generation-complete"]')).toBeVisible();
    
    // Verify success message
    await expect(page.locator('[data-testid="generation-success"]')).toBeVisible();
    await expect(page.locator('text=3 questions generated successfully')).toBeVisible();
    
    // Verify questions were generated
    await expect(page.locator('[data-testid="generated-question"]')).toHaveCount(3);
  });

  test('AI generation validation - empty prompt', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'AI Generated Set');
    await page.fill('[data-testid="question-set-description"]', 'Questions generated by AI');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="ai-generate-button"]');
    
    // Try to generate with empty prompt
    await page.fill('[data-testid="ai-prompt"]', '');
    await page.fill('[data-testid="question-count"]', '3');
    await page.selectOption('[data-testid="ai-difficulty"]', 'medium');
    await page.selectOption('[data-testid="ai-category"]', 'Chemistry');
    await page.click('[data-testid="generate-questions-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="generation-error"]')).toBeVisible();
    await expect(page.locator('text=Prompt is required')).toBeVisible();
  });

  test('AI generation validation - invalid question count', async ({ page }) => {
    // First create a question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'AI Generated Set');
    await page.fill('[data-testid="question-set-description"]', 'Questions generated by AI');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    await page.click('[data-testid="ai-generate-button"]');
    
    // Try to generate with invalid count
    await page.fill('[data-testid="ai-prompt"]', 'Generate questions about chemistry');
    await page.fill('[data-testid="question-count"]', '0');
    await page.selectOption('[data-testid="ai-difficulty"]', 'medium');
    await page.selectOption('[data-testid="ai-category"]', 'Chemistry');
    await page.click('[data-testid="generate-questions-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="generation-error"]')).toBeVisible();
    await expect(page.locator('text=Question count must be between 1 and 10')).toBeVisible();
  });

  test('Question set filtering and search', async ({ page }) => {
    // Create multiple question sets
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Science Questions');
    await page.fill('[data-testid="question-set-description"]', 'Science questions');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'History Questions');
    await page.fill('[data-testid="question-set-description"]', 'History questions');
    await page.selectOption('[data-testid="question-set-category"]', 'History');
    await page.click('[data-testid="save-question-set-button"]');
    
    // Test search functionality
    await page.fill('[data-testid="search-question-sets"]', 'Science');
    await page.keyboard.press('Enter');
    
    // Verify only science questions are shown
    await expect(page.locator('text=Science Questions')).toBeVisible();
    await expect(page.locator('text=History Questions')).not.toBeVisible();
    
    // Test category filter
    await page.fill('[data-testid="search-question-sets"]', '');
    await page.selectOption('[data-testid="category-filter"]', 'History');
    
    // Verify only history questions are shown
    await expect(page.locator('text=History Questions')).toBeVisible();
    await expect(page.locator('text=Science Questions')).not.toBeVisible();
  });

  test('Question set sharing and permissions', async ({ page }) => {
    // Create a private question set
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Private Set');
    await page.fill('[data-testid="question-set-description"]', 'Private question set');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.uncheck('[data-testid="question-set-public"]');
    await page.click('[data-testid="save-question-set-button"]');
    
    // Verify it's marked as private
    await expect(page.locator('[data-testid="private-badge"]')).toBeVisible();
    
    // Make it public
    await page.click('[data-testid="edit-question-set-button"]');
    await page.check('[data-testid="question-set-public"]');
    await page.click('[data-testid="save-question-set-button"]');
    
    // Verify it's now marked as public
    await expect(page.locator('[data-testid="public-badge"]')).toBeVisible();
  });

  test('Question set statistics and analytics', async ({ page }) => {
    // Create a question set with questions
    await page.click('[data-testid="create-question-set-button"]');
    await page.fill('[data-testid="question-set-name"]', 'Analytics Set');
    await page.fill('[data-testid="question-set-description"]', 'Set for analytics testing');
    await page.selectOption('[data-testid="question-set-category"]', 'Science');
    await page.click('[data-testid="save-question-set-button"]');
    
    await page.click('[data-testid="open-question-set-button"]');
    
    // Add multiple questions
    for (let i = 1; i <= 3; i++) {
      await page.click('[data-testid="add-question-button"]');
      await page.fill('[data-testid="question-text"]', `Question ${i}?`);
      await page.fill('[data-testid="correct-answer"]', `Answer ${i}`);
      await page.fill('[data-testid="incorrect-answer-1"]', `Wrong1-${i}`);
      await page.fill('[data-testid="incorrect-answer-2"]', `Wrong2-${i}`);
      await page.fill('[data-testid="incorrect-answer-3"]', `Wrong3-${i}`);
      await page.fill('[data-testid="question-explanation"]', `Explanation ${i}`);
      await page.selectOption('[data-testid="question-difficulty"]', i === 1 ? 'easy' : i === 2 ? 'medium' : 'hard');
      await page.selectOption('[data-testid="question-category"]', 'Science');
      await page.click('[data-testid="save-question-button"]');
    }
    
    // Check statistics
    await expect(page.locator('[data-testid="total-questions"]')).toContainText('3');
    await expect(page.locator('[data-testid="easy-questions"]')).toContainText('1');
    await expect(page.locator('[data-testid="medium-questions"]')).toContainText('1');
    await expect(page.locator('[data-testid="hard-questions"]')).toContainText('1');
  });
}); 