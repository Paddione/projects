export type Language = 'en' | 'de'

export interface Translations {
  [key: string]: string
}

export interface LocalizationConfig {
  defaultLanguage: Language
  fallbackLanguage: Language
  supportedLanguages: Language[]
}

const config: LocalizationConfig = {
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  supportedLanguages: ['en', 'de']
}

// English translations
const enTranslations: Translations = {
  // Navigation
  'nav.home': 'Home',
  'nav.play': 'Play',
  'nav.leaderboard': 'Leaderboard',
  'nav.settings': 'Settings',
  'nav.help': 'Help',
  
  // Game interface
  'game.create': 'Create Game',
  'game.join': 'Join Game',
  'game.lobby': 'Lobby',
  'game.start': 'Start Game',
  'game.ready': 'Ready',
  'game.notReady': 'Not Ready',
  'game.waiting': 'Waiting for players...',
  'game.players': 'Players',
  'game.score': 'Score',
  'game.multiplier': 'Multiplier',
  'game.time': 'Time',
  'game.question': 'Question',
  'game.answer': 'Answer',
  'game.correct': 'Correct!',
  'game.incorrect': 'Incorrect!',
  'game.gameOver': 'Game Over',
  'game.playAgain': 'Play Again',
  'game.quit': 'Quit',
  
  // Lobby
  'lobby.code': 'Game Code',
  'lobby.copy': 'Copy Code',
  'lobby.copied': 'Copied!',
  'lobby.enterCode': 'Enter Game Code',
  'lobby.join': 'Join Game',
  'lobby.leave': 'Leave Game',
  'lobby.host': 'Host',
  'lobby.players': 'Players',
  'lobby.maxPlayers': 'Max 8 Players',
  'lobby.waitingForHost': 'Waiting for host to start...',
  'lobby.allReady': 'All players ready!',
  'lobby.someNotReady': 'Some players not ready',
  
  // Settings
  'settings.title': 'Settings',
  'settings.audio': 'Audio',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.dark': 'Dark',
  'settings.light': 'Light',
  'settings.auto': 'Auto',
  'settings.musicVolume': 'Music Volume',
  'settings.soundVolume': 'Sound Volume',
  'settings.masterVolume': 'Master Volume',
  'settings.mute': 'Mute',
  'settings.unmute': 'Unmute',
  'settings.save': 'Save',
  'settings.cancel': 'Cancel',
  'settings.reset': 'Reset to Defaults',
  
  // Leaderboard
  'leaderboard.title': 'Hall of Fame',
  'leaderboard.topScores': 'Top Scores',
  'leaderboard.yourScore': 'Your Score',
  'leaderboard.accuracy': 'Accuracy',
  'leaderboard.maxMultiplier': 'Max Multiplier',
  'leaderboard.submit': 'Submit Score',
  'leaderboard.submitted': 'Score Submitted!',
  'leaderboard.noScore': 'No score to submit',
  'leaderboard.loading': 'Loading scores...',
  'leaderboard.error': 'Error loading scores',
  
  // Help
  'help.title': 'Help',
  'help.howToPlay': 'How to Play',
  'help.scoring': 'Scoring System',
  'help.multipliers': 'Multipliers',
  'help.audio': 'Audio Settings',
  'help.language': 'Language Settings',
  'help.contact': 'Contact Support',
  
  // Messages
  'message.loading': 'Loading...',
  'message.error': 'An error occurred',
  'message.success': 'Success!',
  'message.warning': 'Warning',
  'message.info': 'Information',
  'message.confirm': 'Are you sure?',
  'message.yes': 'Yes',
  'message.no': 'No',
  'message.ok': 'OK',
  'message.cancel': 'Cancel',
  
  // Audio
  'audio.test': 'Test Audio',
  'audio.music': 'Music',
  'audio.sounds': 'Sound Effects',
  'audio.notifications': 'Notifications',
  'audio.volume': 'Volume',
  'audio.muted': 'Muted',
  'audio.unmuted': 'Unmuted',
  
  // Language
  'language.english': 'English',
  'language.german': 'German',
  'language.select': 'Select Language',
  'language.current': 'Current Language',
  
  // Theme
  'theme.dark': 'Dark Theme',
  'theme.light': 'Light Theme',
  'theme.auto': 'Auto Theme',
  'theme.select': 'Select Theme',
  
  // Game states
  'state.connecting': 'Connecting...',
  'state.connected': 'Connected',
  'state.disconnected': 'Disconnected',
  'state.reconnecting': 'Reconnecting...',
  'state.error': 'Connection Error',
  
  // Timer
  'timer.timeLeft': 'Time Left',
  'timer.warning': 'Time is running out!',
  'timer.urgent': 'Hurry up!',
  'timer.expired': 'Time\'s up!',
  
  // Multiplier
  'multiplier.x1': '1x',
  'multiplier.x2': '2x',
  'multiplier.x3': '3x',
  'multiplier.x4': '4x',
  'multiplier.x5': '5x',
  'multiplier.streak': 'Streak',
  'multiplier.reset': 'Multiplier Reset',
  
  // Score
  'score.points': 'Points',
  'score.bonus': 'Bonus',
  'score.total': 'Total',
  'score.accuracy': 'Accuracy',
  'score.questions': 'Questions',
  'score.correct': 'Correct',
  'score.incorrect': 'Incorrect',
  
  // Buttons
  'button.create': 'Create',
  'button.join': 'Join',
  'button.start': 'Start',
  'button.ready': 'Ready',
  'button.cancel': 'Cancel',
  'button.back': 'Back',
  'button.next': 'Next',
  'button.submit': 'Submit',
  'button.save': 'Save',
  'button.reset': 'Reset',
  'button.close': 'Close',
  'button.help': 'Help',
  'button.settings': 'Settings',
  'button.leaderboard': 'Leaderboard',
  'button.playAgain': 'Play Again',
  'button.quit': 'Quit',
  
  // Placeholders
  'placeholder.enterCode': 'Enter game code...',
  'placeholder.username': 'Enter username...',
  'placeholder.search': 'Search...',
  
  // Errors
  'error.invalidCode': 'Invalid game code',
  'error.gameFull': 'Game is full',
  'error.gameNotFound': 'Game not found',
  'error.connectionFailed': 'Connection failed',
  'error.serverError': 'Server error',
  'error.networkError': 'Network error',
  'error.unknown': 'Unknown error',
  
  // Success
  'success.gameCreated': 'Game created successfully!',
  'success.gameJoined': 'Joined game successfully!',
  'success.scoreSubmitted': 'Score submitted successfully!',
  'success.settingsSaved': 'Settings saved successfully!',
  
  // Info
  'info.minPlayers': 'Minimum 2 players required',
  'info.maxPlayers': 'Maximum 8 players allowed',
  'info.gameCode': 'Share this code with friends',
  'info.readyToStart': 'Ready to start when all players are ready',
  'info.audioNotSupported': 'Audio not supported in this browser',
  'info.languageChanged': 'Language changed successfully',
  'info.themeChanged': 'Theme changed successfully'
}

// German translations
const deTranslations: Translations = {
  // Navigation
  'nav.home': 'Startseite',
  'nav.play': 'Spielen',
  'nav.leaderboard': 'Bestenliste',
  'nav.settings': 'Einstellungen',
  'nav.help': 'Hilfe',
  
  // Game interface
  'game.create': 'Spiel erstellen',
  'game.join': 'Spiel beitreten',
  'game.lobby': 'Lobby',
  'game.start': 'Spiel starten',
  'game.ready': 'Bereit',
  'game.notReady': 'Nicht bereit',
  'game.waiting': 'Warte auf Spieler...',
  'game.players': 'Spieler',
  'game.score': 'Punkte',
  'game.multiplier': 'Multiplikator',
  'game.time': 'Zeit',
  'game.question': 'Frage',
  'game.answer': 'Antwort',
  'game.correct': 'Richtig!',
  'game.incorrect': 'Falsch!',
  'game.gameOver': 'Spiel beendet',
  'game.playAgain': 'Nochmal spielen',
  'game.quit': 'Beenden',
  
  // Lobby
  'lobby.code': 'Spielcode',
  'lobby.copy': 'Code kopieren',
  'lobby.copied': 'Kopiert!',
  'lobby.enterCode': 'Spielcode eingeben',
  'lobby.join': 'Spiel beitreten',
  'lobby.leave': 'Spiel verlassen',
  'lobby.host': 'Host',
  'lobby.players': 'Spieler',
  'lobby.maxPlayers': 'Max 8 Spieler',
  'lobby.waitingForHost': 'Warte auf Host zum Starten...',
  'lobby.allReady': 'Alle Spieler bereit!',
  'lobby.someNotReady': 'Einige Spieler nicht bereit',
  
  // Settings
  'settings.title': 'Einstellungen',
  'settings.audio': 'Audio',
  'settings.language': 'Sprache',
  'settings.theme': 'Design',
  'settings.dark': 'Dunkel',
  'settings.light': 'Hell',
  'settings.auto': 'Auto',
  'settings.musicVolume': 'Musik Lautstärke',
  'settings.soundVolume': 'Sound Lautstärke',
  'settings.masterVolume': 'Master Lautstärke',
  'settings.mute': 'Stummschalten',
  'settings.unmute': 'Stummschaltung aufheben',
  'settings.save': 'Speichern',
  'settings.cancel': 'Abbrechen',
  'settings.reset': 'Auf Standard zurücksetzen',
  
  // Leaderboard
  'leaderboard.title': 'Halle der Berühmtheit',
  'leaderboard.topScores': 'Beste Punktzahlen',
  'leaderboard.yourScore': 'Deine Punktzahl',
  'leaderboard.accuracy': 'Genauigkeit',
  'leaderboard.maxMultiplier': 'Max Multiplikator',
  'leaderboard.submit': 'Punktzahl einreichen',
  'leaderboard.submitted': 'Punktzahl eingereicht!',
  'leaderboard.noScore': 'Keine Punktzahl zum Einreichen',
  'leaderboard.loading': 'Lade Punktzahlen...',
  'leaderboard.error': 'Fehler beim Laden der Punktzahlen',
  
  // Help
  'help.title': 'Hilfe',
  'help.howToPlay': 'Wie man spielt',
  'help.scoring': 'Punktesystem',
  'help.multipliers': 'Multiplikatoren',
  'help.audio': 'Audio-Einstellungen',
  'help.language': 'Spracheinstellungen',
  'help.contact': 'Support kontaktieren',
  
  // Messages
  'message.loading': 'Lädt...',
  'message.error': 'Ein Fehler ist aufgetreten',
  'message.success': 'Erfolg!',
  'message.warning': 'Warnung',
  'message.info': 'Information',
  'message.confirm': 'Bist du sicher?',
  'message.yes': 'Ja',
  'message.no': 'Nein',
  'message.ok': 'OK',
  'message.cancel': 'Abbrechen',
  
  // Audio
  'audio.test': 'Audio testen',
  'audio.music': 'Musik',
  'audio.sounds': 'Soundeffekte',
  'audio.notifications': 'Benachrichtigungen',
  'audio.volume': 'Lautstärke',
  'audio.muted': 'Stumm',
  'audio.unmuted': 'Nicht stumm',
  
  // Language
  'language.english': 'Englisch',
  'language.german': 'Deutsch',
  'language.select': 'Sprache auswählen',
  'language.current': 'Aktuelle Sprache',
  
  // Theme
  'theme.dark': 'Dunkles Design',
  'theme.light': 'Helles Design',
  'theme.auto': 'Auto Design',
  'theme.select': 'Design auswählen',
  
  // Game states
  'state.connecting': 'Verbinde...',
  'state.connected': 'Verbunden',
  'state.disconnected': 'Getrennt',
  'state.reconnecting': 'Verbinde neu...',
  'state.error': 'Verbindungsfehler',
  
  // Timer
  'timer.timeLeft': 'Verbleibende Zeit',
  'timer.warning': 'Die Zeit läuft ab!',
  'timer.urgent': 'Beeil dich!',
  'timer.expired': 'Zeit ist um!',
  
  // Multiplier
  'multiplier.x1': '1x',
  'multiplier.x2': '2x',
  'multiplier.x3': '3x',
  'multiplier.x4': '4x',
  'multiplier.x5': '5x',
  'multiplier.streak': 'Serie',
  'multiplier.reset': 'Multiplikator zurückgesetzt',
  
  // Score
  'score.points': 'Punkte',
  'score.bonus': 'Bonus',
  'score.total': 'Gesamt',
  'score.accuracy': 'Genauigkeit',
  'score.questions': 'Fragen',
  'score.correct': 'Richtig',
  'score.incorrect': 'Falsch',
  
  // Buttons
  'button.create': 'Erstellen',
  'button.join': 'Beitreten',
  'button.start': 'Starten',
  'button.ready': 'Bereit',
  'button.cancel': 'Abbrechen',
  'button.back': 'Zurück',
  'button.next': 'Weiter',
  'button.submit': 'Einreichen',
  'button.save': 'Speichern',
  'button.reset': 'Zurücksetzen',
  'button.close': 'Schließen',
  'button.help': 'Hilfe',
  'button.settings': 'Einstellungen',
  'button.leaderboard': 'Bestenliste',
  'button.playAgain': 'Nochmal spielen',
  'button.quit': 'Beenden',
  
  // Placeholders
  'placeholder.enterCode': 'Spielcode eingeben...',
  'placeholder.username': 'Benutzername eingeben...',
  'placeholder.search': 'Suchen...',
  
  // Errors
  'error.invalidCode': 'Ungültiger Spielcode',
  'error.gameFull': 'Spiel ist voll',
  'error.gameNotFound': 'Spiel nicht gefunden',
  'error.connectionFailed': 'Verbindung fehlgeschlagen',
  'error.serverError': 'Serverfehler',
  'error.networkError': 'Netzwerkfehler',
  'error.unknown': 'Unbekannter Fehler',
  
  // Success
  'success.gameCreated': 'Spiel erfolgreich erstellt!',
  'success.gameJoined': 'Erfolgreich dem Spiel beigetreten!',
  'success.scoreSubmitted': 'Punktzahl erfolgreich eingereicht!',
  'success.settingsSaved': 'Einstellungen erfolgreich gespeichert!',
  
  // Info
  'info.minPlayers': 'Mindestens 2 Spieler erforderlich',
  'info.maxPlayers': 'Maximal 8 Spieler erlaubt',
  'info.gameCode': 'Teile diesen Code mit Freunden',
  'info.readyToStart': 'Bereit zum Starten wenn alle Spieler bereit sind',
  'info.audioNotSupported': 'Audio wird in diesem Browser nicht unterstützt',
  'info.languageChanged': 'Sprache erfolgreich geändert',
  'info.themeChanged': 'Design erfolgreich geändert'
}

export class LocalizationService {
  private currentLanguage: Language = config.defaultLanguage
  private translations: Map<Language, Translations> = new Map()

  constructor() {
    this.translations.set('en', enTranslations)
    this.translations.set('de', deTranslations)
    this.loadLanguagePreference()
  }

  private loadLanguagePreference(): void {
    try {
      const savedLanguage = window.localStorage.getItem('language') as Language
      if (savedLanguage && config.supportedLanguages.includes(savedLanguage)) {
        this.currentLanguage = savedLanguage
      }
    } catch {
      // ignore storage errors
    }
  }

  public getCurrentLanguage(): Language {
    // Always check localStorage for the most current value
    try {
      const savedLanguage = window.localStorage.getItem('language') as Language
      if (savedLanguage && config.supportedLanguages.includes(savedLanguage)) {
        this.currentLanguage = savedLanguage
      }
    } catch {
      // ignore storage errors
    }
    return this.currentLanguage
  }

  public setLanguage(language: Language): void {
    if (config.supportedLanguages.includes(language)) {
      this.currentLanguage = language
      try {
        window.localStorage.setItem('language', language)
      } catch {
        // ignore storage errors
      }
    }
  }

  public translate(key: string, fallback?: string): string {
    const currentTranslations = this.translations.get(this.currentLanguage)
    const fallbackTranslations = this.translations.get(config.fallbackLanguage)
    
    if (currentTranslations && currentTranslations[key]) {
      return currentTranslations[key]
    }
    
    if (fallbackTranslations && fallbackTranslations[key]) {
      return fallbackTranslations[key]
    }
    
    // If fallback is explicitly provided (even if empty), return it
    if (fallback !== undefined) {
      return fallback
    }
    
    return key
  }

  public t(key: string, fallback?: string): string {
    return this.translate(key, fallback)
  }

  public getSupportedLanguages(): Language[] {
    return [...config.supportedLanguages]
  }

  public getLanguageName(language: Language): string {
    const names: Record<Language, string> = {
      en: 'English',
      de: 'Deutsch'
    }
    return names[language] || language
  }

  public getLanguageFlag(language: Language): string {
    const flags: Record<Language, string> = {
      en: '🇺🇸',
      de: '🇩🇪'
    }
    return flags[language] || ''
  }
}

export const localizationService = new LocalizationService() 