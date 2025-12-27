import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for game interaction workflows
 */
export class GamePage {
  readonly page: Page;
  
  // Locators
  readonly questionContainer: Locator;
  readonly questionText: Locator;
  readonly questionNumber: Locator;
  readonly totalQuestions: Locator;
  readonly timer: Locator;
  readonly answerOptions: Locator;
  readonly answerFeedback: Locator;
  readonly currentScore: Locator;
  readonly playerScores: Locator;
  readonly gameResults: Locator;
  readonly gameWinner: Locator;
  readonly nextQuestionButton: Locator;
  readonly pauseGameButton: Locator;
  readonly quitGameButton: Locator;
  readonly gameProgress: Locator;
  readonly multiplierIndicator: Locator;
  readonly streakIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.questionContainer = page.locator('[data-testid="question-container"]');
    this.questionText = page.locator('[data-testid="question-text"]');
    this.questionNumber = page.locator('[data-testid="question-number"]');
    this.totalQuestions = page.locator('[data-testid="total-questions"]');
    this.timer = page.locator('[data-testid="timer"]');
    this.answerOptions = page.locator('[data-testid^="answer-option-"]');
    this.answerFeedback = page.locator('[data-testid="answer-feedback"]');
    this.currentScore = page.locator('[data-testid="current-score"]');
    this.playerScores = page.locator('[data-testid="player-scores"]');
    this.gameResults = page.locator('[data-testid="game-results"]');
    this.gameWinner = page.locator('[data-testid="game-winner"]');
    this.nextQuestionButton = page.locator('[data-testid="next-question"]');
    this.pauseGameButton = page.locator('[data-testid="pause-game"]');
    this.quitGameButton = page.locator('[data-testid="quit-game"]');
    this.gameProgress = page.locator('[data-testid="game-progress"]');
    this.multiplierIndicator = page.locator('[data-testid="multiplier"]');
    this.streakIndicator = page.locator('[data-testid="streak"]');
  }

  /**
   * Wait for game to start
   */
  async waitForGameStart(timeout: number = 15000): Promise<void> {
    await expect(this.questionContainer).toBeVisible({ timeout });
  }

  /**
   * Get current question text
   */
  async getQuestionText(): Promise<string> {
    await expect(this.questionText).toBeVisible();
    const text = await this.questionText.textContent();
    return text?.trim() || '';
  }

  /**
   * Get current question number
   */
  async getQuestionNumber(): Promise<number> {
    const text = await this.questionNumber.textContent();
    return parseInt(text || '1');
  }

  /**
   * Get total number of questions
   */
  async getTotalQuestions(): Promise<number> {
    const text = await this.totalQuestions.textContent();
    return parseInt(text || '5');
  }

  /**
   * Get remaining time
   */
  async getRemainingTime(): Promise<number> {
    const text = await this.timer.textContent();
    return parseInt(text || '30');
  }

  /**
   * Get answer options
   */
  async getAnswerOptions(): Promise<string[]> {
    const options: string[] = [];
    const optionElements = await this.answerOptions.all();
    
    for (const element of optionElements) {
      const text = await element.textContent();
      if (text) {
        options.push(text.trim());
      }
    }
    
    return options;
  }

  /**
   * Answer question by option index
   */
  async answerQuestion(optionIndex: number): Promise<{ correct: boolean; score: number }> {
    const currentScore = await this.getCurrentScore();
    
    // Click the answer option
    const optionSelector = `[data-testid="answer-option-${optionIndex}"]`;
    await this.page.locator(optionSelector).click();
    
    // Wait for feedback
    await expect(this.answerFeedback).toBeVisible({ timeout: 5000 });
    
    // Check if answer was correct
    const feedbackText = await this.answerFeedback.textContent();
    const correct = feedbackText?.toLowerCase().includes('correct') || false;
    
    // Get new score
    const newScore = await this.getCurrentScore();
    const scoreGained = newScore - currentScore;
    
    return { correct, score: scoreGained };
  }

  /**
   * Answer question by option text
   */
  async answerQuestionByText(optionText: string): Promise<{ correct: boolean; score: number }> {
    const options = await this.getAnswerOptions();
    const optionIndex = options.findIndex(option => option.includes(optionText));
    
    if (optionIndex === -1) {
      throw new Error(`Option with text "${optionText}" not found`);
    }
    
    return await this.answerQuestion(optionIndex);
  }

  /**
   * Get current player score
   */
  async getCurrentScore(): Promise<number> {
    try {
      const scoreText = await this.currentScore.textContent();
      return parseInt(scoreText || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get all player scores
   */
  async getAllPlayerScores(): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};
    
    try {
      const scoreElements = await this.page.locator('[data-testid^="player-score-"]').all();
      
      for (const element of scoreElements) {
        const testId = await element.getAttribute('data-testid');
        const playerName = testId?.replace('player-score-', '');
        const scoreText = await element.textContent();
        
        if (playerName && scoreText) {
          scores[playerName] = parseInt(scoreText);
        }
      }
    } catch (error) {
      console.warn('Failed to get player scores:', error);
    }
    
    return scores;
  }

  /**
   * Wait for next question or game end
   */
  async waitForNextQuestion(timeout: number = 15000): Promise<boolean> {
    try {
      await this.page.waitForFunction(() => {
        const nextQuestion = document.querySelector('[data-testid="question-container"]');
        const gameEnd = document.querySelector('[data-testid="game-results"]');
        return nextQuestion || gameEnd;
      }, { timeout });
      
      // Return true if there's a next question, false if game ended
      return await this.questionContainer.isVisible();
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if game has ended
   */
  async isGameEnded(): Promise<boolean> {
    return await this.gameResults.isVisible();
  }

  /**
   * Get game results
   */
  async getGameResults(): Promise<{
    winner: string;
    finalScores: Record<string, number>;
    totalQuestions: number;
    gameTime: number;
  }> {
    await expect(this.gameResults).toBeVisible({ timeout: 10000 });
    
    const winner = await this.gameWinner.textContent() || '';
    const finalScores = await this.getFinalScores();
    const totalQuestions = await this.getTotalQuestions();
    const gameTime = await this.getGameTime();
    
    return {
      winner: winner.trim(),
      finalScores,
      totalQuestions,
      gameTime
    };
  }

  /**
   * Get final scores from results screen
   */
  async getFinalScores(): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};
    
    try {
      const scoreElements = await this.page.locator('[data-testid^="final-score-"]').all();
      
      for (const element of scoreElements) {
        const testId = await element.getAttribute('data-testid');
        const playerName = testId?.replace('final-score-', '');
        const scoreText = await element.textContent();
        
        if (playerName && scoreText) {
          scores[playerName] = parseInt(scoreText);
        }
      }
    } catch (error) {
      console.warn('Failed to get final scores:', error);
    }
    
    return scores;
  }

  /**
   * Get total game time
   */
  async getGameTime(): Promise<number> {
    try {
      const timeElement = this.page.locator('[data-testid="game-time"]');
      const timeText = await timeElement.textContent();
      return parseInt(timeText || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get current multiplier
   */
  async getCurrentMultiplier(): Promise<number> {
    try {
      const multiplierText = await this.multiplierIndicator.textContent();
      return parseFloat(multiplierText?.replace('x', '') || '1');
    } catch (error) {
      return 1;
    }
  }

  /**
   * Get current streak
   */
  async getCurrentStreak(): Promise<number> {
    try {
      const streakText = await this.streakIndicator.textContent();
      return parseInt(streakText || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get game progress percentage
   */
  async getGameProgress(): Promise<number> {
    try {
      const progressElement = this.gameProgress;
      const progressValue = await progressElement.getAttribute('value');
      return parseInt(progressValue || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Pause the game
   */
  async pauseGame(): Promise<void> {
    await this.pauseGameButton.click();
    
    // Verify game is paused
    const pauseIndicator = this.page.locator('[data-testid="game-paused"]');
    await expect(pauseIndicator).toBeVisible();
  }

  /**
   * Resume the game
   */
  async resumeGame(): Promise<void> {
    const resumeButton = this.page.locator('[data-testid="resume-game"]');
    await resumeButton.click();
    
    // Verify game is resumed
    await expect(this.questionContainer).toBeVisible();
  }

  /**
   * Quit the game
   */
  async quitGame(): Promise<void> {
    await this.quitGameButton.click();
    
    // Confirm quit
    const confirmButton = this.page.locator('[data-testid="confirm-quit"]');
    await confirmButton.click();
    
    // Verify we're back to lobby or home
    const lobbyButton = this.page.locator('[data-testid="create-lobby-button"]');
    await expect(lobbyButton).toBeVisible({ timeout: 10000 });
  }

  /**
   * Wait for timer to reach specific time
   */
  async waitForTimer(targetTime: number, timeout: number = 30000): Promise<void> {
    await this.page.waitForFunction(
      (target) => {
        const timerElement = document.querySelector('[data-testid="timer"]');
        const currentTime = parseInt(timerElement?.textContent || '30');
        return currentTime <= target;
      },
      targetTime,
      { timeout }
    );
  }

  /**
   * Check if answer options are disabled
   */
  async areAnswerOptionsDisabled(): Promise<boolean> {
    const optionElements = await this.answerOptions.all();
    
    for (const element of optionElements) {
      const isDisabled = await element.isDisabled();
      if (!isDisabled) {
        return false;
      }
    }
    
    return optionElements.length > 0;
  }

  /**
   * Get answer feedback message
   */
  async getAnswerFeedback(): Promise<string> {
    await expect(this.answerFeedback).toBeVisible();
    const text = await this.answerFeedback.textContent();
    return text?.trim() || '';
  }

  /**
   * Check if question has explanation
   */
  async hasExplanation(): Promise<boolean> {
    const explanationElement = this.page.locator('[data-testid="question-explanation"]');
    return await explanationElement.isVisible();
  }

  /**
   * Get question explanation
   */
  async getQuestionExplanation(): Promise<string> {
    const explanationElement = this.page.locator('[data-testid="question-explanation"]');
    await expect(explanationElement).toBeVisible();
    const text = await explanationElement.textContent();
    return text?.trim() || '';
  }

  /**
   * Play complete game automatically
   */
  async playCompleteGame(strategy: 'random' | 'first' | 'correct' = 'random'): Promise<{
    totalQuestions: number;
    correctAnswers: number;
    finalScore: number;
    gameTime: number;
  }> {
    let totalQuestions = 0;
    let correctAnswers = 0;
    const startTime = Date.now();
    
    while (await this.questionContainer.isVisible()) {
      totalQuestions++;
      
      let optionIndex = 0;
      
      switch (strategy) {
        case 'random':
          const options = await this.getAnswerOptions();
          optionIndex = Math.floor(Math.random() * options.length);
          break;
        case 'first':
          optionIndex = 0;
          break;
        case 'correct':
          // This would require knowing the correct answer
          // For now, just use first option
          optionIndex = 0;
          break;
      }
      
      const result = await this.answerQuestion(optionIndex);
      if (result.correct) {
        correctAnswers++;
      }
      
      // Wait for next question or game end
      const hasNextQuestion = await this.waitForNextQuestion();
      if (!hasNextQuestion) {
        break;
      }
    }
    
    const gameTime = Date.now() - startTime;
    const finalScore = await this.getCurrentScore();
    
    return {
      totalQuestions,
      correctAnswers,
      finalScore,
      gameTime
    };
  }

  /**
   * Verify game state
   */
  async verifyGameState(expectedState: {
    questionNumber?: number;
    totalQuestions?: number;
    minTimeRemaining?: number;
    maxTimeRemaining?: number;
  }): Promise<void> {
    if (expectedState.questionNumber) {
      const currentQuestion = await this.getQuestionNumber();
      expect(currentQuestion).toBe(expectedState.questionNumber);
    }
    
    if (expectedState.totalQuestions) {
      const total = await this.getTotalQuestions();
      expect(total).toBe(expectedState.totalQuestions);
    }
    
    if (expectedState.minTimeRemaining || expectedState.maxTimeRemaining) {
      const timeRemaining = await this.getRemainingTime();
      
      if (expectedState.minTimeRemaining) {
        expect(timeRemaining).toBeGreaterThanOrEqual(expectedState.minTimeRemaining);
      }
      
      if (expectedState.maxTimeRemaining) {
        expect(timeRemaining).toBeLessThanOrEqual(expectedState.maxTimeRemaining);
      }
    }
  }
}