import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for lobby management workflows
 */
export class LobbyPage {
  readonly page: Page;
  
  // Locators
  readonly createLobbyButton: Locator;
  readonly joinLobbyButton: Locator;
  readonly lobbyCodeInput: Locator;
  readonly joinLobbyConfirm: Locator;
  readonly questionCountSelect: Locator;
  readonly questionSetSelect: Locator;
  readonly privateLobbyCheckbox: Locator;
  readonly confirmCreateLobby: Locator;
  readonly lobbyCode: Locator;
  readonly lobbyPlayers: Locator;
  readonly startGameButton: Locator;
  readonly leaveLobbyButton: Locator;
  readonly lobbySettings: Locator;
  readonly playerList: Locator;
  readonly hostIndicator: Locator;
  readonly lobbyError: Locator;
  readonly lobbySuccess: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.createLobbyButton = page.locator('[data-testid="create-lobby-button"]');
    this.joinLobbyButton = page.locator('[data-testid="join-lobby-button"]');
    this.lobbyCodeInput = page.locator('[data-testid="lobby-code-input"]');
    this.joinLobbyConfirm = page.locator('[data-testid="join-lobby-confirm"]');
    this.questionCountSelect = page.locator('[data-testid="question-count-select"]');
    this.questionSetSelect = page.locator('[data-testid="question-set-select"]');
    this.privateLobbyCheckbox = page.locator('[data-testid="private-lobby-checkbox"]');
    this.confirmCreateLobby = page.locator('[data-testid="confirm-create-lobby"]');
    this.lobbyCode = page.locator('[data-testid="lobby-code"]');
    this.lobbyPlayers = page.locator('[data-testid="lobby-players"]');
    this.startGameButton = page.locator('[data-testid="start-game-button"]');
    this.leaveLobbyButton = page.locator('[data-testid="leave-lobby-button"]');
    this.lobbySettings = page.locator('[data-testid="lobby-settings"]');
    this.playerList = page.locator('[data-testid="player-list"]');
    this.hostIndicator = page.locator('[data-testid="host-indicator"]');
    this.lobbyError = page.locator('[data-testid="lobby-error"]');
    this.lobbySuccess = page.locator('[data-testid="lobby-success"]');
  }

  /**
   * Navigate to lobby page
   */
  async goto(): Promise<void> {
    await this.page.goto('/lobby');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new lobby with specified settings
   */
  async createLobby(options: {
    questionCount?: number;
    questionSet?: string;
    isPrivate?: boolean;
    maxPlayers?: number;
  } = {}): Promise<string> {
    const {
      questionCount = 5,
      questionSet = 'general',
      isPrivate = false
    } = options;

    await this.createLobbyButton.click();
    
    // Configure lobby settings
    await this.questionCountSelect.selectOption(questionCount.toString());
    await this.questionSetSelect.selectOption(questionSet);
    
    if (isPrivate) {
      await this.privateLobbyCheckbox.check();
    }
    
    // Confirm creation
    await this.confirmCreateLobby.click();
    
    // Wait for lobby to be created and get code
    await expect(this.lobbyCode).toBeVisible({ timeout: 10000 });
    const lobbyCodeText = await this.lobbyCode.textContent();
    
    if (!lobbyCodeText) {
      throw new Error('Failed to get lobby code');
    }
    
    return lobbyCodeText.trim();
  }

  /**
   * Join an existing lobby
   */
  async joinLobby(code: string): Promise<void> {
    await this.joinLobbyButton.click();
    await this.lobbyCodeInput.fill(code);
    await this.joinLobbyConfirm.click();
    
    // Wait for successful join
    await expect(this.lobbyPlayers).toBeVisible({ timeout: 10000 });
  }

  /**
   * Start the game (host only)
   */
  async startGame(): Promise<void> {
    await this.startGameButton.click();
    
    // Wait for game to start
    await expect(this.page.locator('[data-testid="question-container"]')).toBeVisible({ timeout: 15000 });
  }

  /**
   * Leave the current lobby
   */
  async leaveLobby(): Promise<void> {
    await this.leaveLobbyButton.click();
    
    // Verify we're back to lobby selection
    await expect(this.createLobbyButton).toBeVisible();
  }

  /**
   * Get current lobby code
   */
  async getLobbyCode(): Promise<string | null> {
    if (await this.lobbyCode.isVisible()) {
      return await this.lobbyCode.textContent();
    }
    return null;
  }

  /**
   * Get list of players in lobby
   */
  async getPlayerList(): Promise<string[]> {
    const players: string[] = [];
    
    if (await this.playerList.isVisible()) {
      const playerElements = await this.playerList.locator('[data-testid^="player-"]').all();
      
      for (const element of playerElements) {
        const playerName = await element.textContent();
        if (playerName) {
          players.push(playerName.trim());
        }
      }
    }
    
    return players;
  }

  /**
   * Get player count
   */
  async getPlayerCount(): Promise<number> {
    const players = await this.getPlayerList();
    return players.length;
  }

  /**
   * Check if current user is host
   */
  async isHost(): Promise<boolean> {
    return await this.hostIndicator.isVisible();
  }

  /**
   * Check if game can be started
   */
  async canStartGame(): Promise<boolean> {
    return await this.startGameButton.isEnabled();
  }

  /**
   * Get lobby settings
   */
  async getLobbySettings(): Promise<{
    questionCount: number;
    questionSet: string;
    isPrivate: boolean;
    maxPlayers: number;
  }> {
    const settings = {
      questionCount: 5,
      questionSet: 'general',
      isPrivate: false,
      maxPlayers: 4
    };

    try {
      if (await this.lobbySettings.isVisible()) {
        const questionCountText = await this.page.locator('[data-testid="setting-question-count"]').textContent();
        const questionSetText = await this.page.locator('[data-testid="setting-question-set"]').textContent();
        const isPrivateText = await this.page.locator('[data-testid="setting-private"]').textContent();
        const maxPlayersText = await this.page.locator('[data-testid="setting-max-players"]').textContent();

        if (questionCountText) settings.questionCount = parseInt(questionCountText);
        if (questionSetText) settings.questionSet = questionSetText.trim();
        if (isPrivateText) settings.isPrivate = isPrivateText.toLowerCase() === 'true';
        if (maxPlayersText) settings.maxPlayers = parseInt(maxPlayersText);
      }
    } catch (error) {
      console.warn('Failed to get lobby settings:', error);
    }

    return settings;
  }

  /**
   * Wait for player to join
   */
  async waitForPlayerJoin(expectedCount: number, timeout: number = 30000): Promise<void> {
    await this.page.waitForFunction(
      (count) => {
        const playerElements = document.querySelectorAll('[data-testid^="player-"]');
        return playerElements.length >= count;
      },
      expectedCount,
      { timeout }
    );
  }

  /**
   * Wait for player to leave
   */
  async waitForPlayerLeave(expectedCount: number, timeout: number = 30000): Promise<void> {
    await this.page.waitForFunction(
      (count) => {
        const playerElements = document.querySelectorAll('[data-testid^="player-"]');
        return playerElements.length <= count;
      },
      expectedCount,
      { timeout }
    );
  }

  /**
   * Verify lobby creation success
   */
  async verifyLobbyCreated(): Promise<void> {
    await expect(this.lobbyCode).toBeVisible();
    await expect(this.lobbyPlayers).toBeVisible();
    await expect(this.hostIndicator).toBeVisible();
  }

  /**
   * Verify lobby join success
   */
  async verifyLobbyJoined(): Promise<void> {
    await expect(this.lobbyPlayers).toBeVisible();
    await expect(this.leaveLobbyButton).toBeVisible();
  }

  /**
   * Verify lobby error
   */
  async verifyLobbyError(expectedMessage?: string): Promise<void> {
    await expect(this.lobbyError).toBeVisible();
    if (expectedMessage) {
      await expect(this.lobbyError).toContainText(expectedMessage);
    }
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.lobbyError.isVisible()) {
      return await this.lobbyError.textContent();
    }
    return null;
  }

  /**
   * Check if lobby is full
   */
  async isLobbyFull(): Promise<boolean> {
    const settings = await this.getLobbySettings();
    const playerCount = await this.getPlayerCount();
    return playerCount >= settings.maxPlayers;
  }

  /**
   * Update lobby settings (host only)
   */
  async updateLobbySettings(settings: {
    questionCount?: number;
    questionSet?: string;
    isPrivate?: boolean;
  }): Promise<void> {
    const settingsButton = this.page.locator('[data-testid="edit-lobby-settings"]');
    await settingsButton.click();

    if (settings.questionCount) {
      await this.questionCountSelect.selectOption(settings.questionCount.toString());
    }

    if (settings.questionSet) {
      await this.questionSetSelect.selectOption(settings.questionSet);
    }

    if (settings.isPrivate !== undefined) {
      if (settings.isPrivate) {
        await this.privateLobbyCheckbox.check();
      } else {
        await this.privateLobbyCheckbox.uncheck();
      }
    }

    await this.page.locator('[data-testid="save-lobby-settings"]').click();
    await expect(this.lobbySuccess).toBeVisible();
  }

  /**
   * Kick player from lobby (host only)
   */
  async kickPlayer(playerName: string): Promise<void> {
    const playerElement = this.page.locator(`[data-testid="player-${playerName}"]`);
    const kickButton = playerElement.locator('[data-testid="kick-player"]');
    
    await kickButton.click();
    
    // Confirm kick
    await this.page.locator('[data-testid="confirm-kick"]').click();
    
    // Wait for player to be removed
    await expect(playerElement).not.toBeVisible();
  }

  /**
   * Send chat message in lobby
   */
  async sendChatMessage(message: string): Promise<void> {
    const chatInput = this.page.locator('[data-testid="chat-input"]');
    const sendButton = this.page.locator('[data-testid="send-chat"]');
    
    await chatInput.fill(message);
    await sendButton.click();
    
    // Verify message appears in chat
    const chatMessage = this.page.locator(`[data-testid="chat-message"]:has-text("${message}")`);
    await expect(chatMessage).toBeVisible();
  }

  /**
   * Get chat messages
   */
  async getChatMessages(): Promise<string[]> {
    const messages: string[] = [];
    const chatMessages = await this.page.locator('[data-testid="chat-message"]').all();
    
    for (const message of chatMessages) {
      const text = await message.textContent();
      if (text) {
        messages.push(text.trim());
      }
    }
    
    return messages;
  }

  /**
   * Toggle ready status
   */
  async toggleReady(): Promise<void> {
    const readyButton = this.page.locator('[data-testid="ready-toggle"]');
    await readyButton.click();
  }

  /**
   * Check if player is ready
   */
  async isPlayerReady(playerName?: string): Promise<boolean> {
    if (playerName) {
      const playerElement = this.page.locator(`[data-testid="player-${playerName}"]`);
      const readyIndicator = playerElement.locator('[data-testid="ready-indicator"]');
      return await readyIndicator.isVisible();
    } else {
      // Check current user's ready status
      const readyButton = this.page.locator('[data-testid="ready-toggle"]');
      const isReady = await readyButton.getAttribute('data-ready');
      return isReady === 'true';
    }
  }

  /**
   * Wait for all players to be ready
   */
  async waitForAllPlayersReady(timeout: number = 60000): Promise<void> {
    await this.page.waitForFunction(() => {
      const playerElements = document.querySelectorAll('[data-testid^="player-"]');
      const readyElements = document.querySelectorAll('[data-testid="ready-indicator"]');
      return playerElements.length > 0 && playerElements.length === readyElements.length;
    }, { timeout });
  }
}