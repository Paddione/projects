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
  'help.fullHelp': 'Full Help Guide',
  'help.howToPlay': 'How to Play',
  'help.howToPlay.1': '1. Create or join a game using a lobby code',
  'help.howToPlay.2': '2. Wait for all players to be ready',
  'help.howToPlay.3': '3. The host starts the game when at least one player is ready',
  'help.howToPlay.4': '4. Answer questions within the time limit',
  'help.howToPlay.5': '5. Build up your streak multiplier with consecutive correct answers',
  'help.howToPlay.6': '6. Your score is added to the Hall of Fame after the game',
  'help.scoring': 'Scoring System',
  'help.scoring.formula': 'Points = (60 - seconds elapsed) x multiplier',
  'help.scoring.fast': 'Answer faster for more points',
  'help.scoring.streak': 'Build streaks of correct answers to increase your multiplier',
  'help.scoring.wrong': 'Wrong answers reset your multiplier to 1x',
  'help.multipliers': 'Multipliers',
  'help.multipliers.desc': 'Your multiplier increases with each consecutive correct answer:',
  'help.multipliers.1x': '1x: Starting multiplier',
  'help.multipliers.2x': '2x: After 1 correct answer in a row',
  'help.multipliers.3x': '3x: After 2 correct answers in a row',
  'help.multipliers.4x': '4x: After 3 correct answers in a row',
  'help.multipliers.5x': '5x: After 4 correct answers in a row (maximum)',
  'help.lobbies': 'Lobbies & Multiplayer',
  'help.lobbies.create': 'Create a lobby from the home screen. You become the host.',
  'help.lobbies.code': 'Share the lobby code with friends so they can join.',
  'help.lobbies.ready': 'All players must mark themselves as ready.',
  'help.lobbies.host': 'The host can choose question sets and start the game.',
  'help.lobbies.max': 'Up to 8 players per lobby.',
  'help.questionSets': 'Question Sets',
  'help.questionSets.browse': 'Browse available question sets from the Question Sets page.',
  'help.questionSets.create': 'Create your own custom question sets with multiple-choice questions.',
  'help.questionSets.import': 'Import question sets from JSON or CSV files.',
  'help.questionSets.select': 'The host selects which sets to use before starting a game.',
  'help.leveling': 'Leveling & Experience',
  'help.leveling.xp': 'Earn XP equal to your game score at the end of each game.',
  'help.leveling.levelup': 'Level up by accumulating enough XP. Higher levels need more XP.',
  'help.leveling.perks': 'Unlock perks and cosmetics as you level up.',
  'help.leveling.cap': 'Maximum level is 30 for the perk tree. Cosmetics unlock throughout.',
  'help.perks': 'Perk System',
  'help.perks.draft': 'On each level up, choose 1 of 3 random perks offered to you.',
  'help.perks.dump': 'Don\'t like the options? Dump all 3 to remove them permanently.',
  'help.perks.reset': 'Full reset available: return all perks to the pool and re-draft.',
  'help.perks.categories': 'Perk categories: Time, Information, Scoring, Recovery, XP.',
  'help.perks.balance': 'All perks are balanced - no single perk dominates.',
  'help.profile': 'Profile & Customization',
  'help.profile.character': 'Customize your character with body type, hairstyle, outfit, and pose.',
  'help.profile.cosmetics': 'Unlock new cosmetic options as you level up.',
  'help.profile.avatar': 'Your avatar is visible to other players in lobbies and games.',
  'help.profile.skilltree': 'View your skill tree to see all unlocked and available perks.',
  'help.hallOfFame': 'Hall of Fame',
  'help.hallOfFame.desc': 'The Hall of Fame tracks the best scores across all games.',
  'help.hallOfFame.submit': 'Your score is automatically submitted after each game.',
  'help.hallOfFame.leaderboard': 'Compete with other players for the top spots.',
  'help.audio': 'Audio Settings',
  'help.audio.master': 'Control master volume from the header bar.',
  'help.audio.settings': 'Fine-tune individual sound effects in Settings > Audio.',
  'help.audio.mute': 'Quick-mute with the speaker icon in the header.',
  'help.language': 'Language Settings',
  'help.language.switch': 'Switch between English and German in Settings > Language.',
  'help.language.auto': 'All UI elements update instantly when you switch.',
  'help.themes': 'Themes',
  'help.themes.desc': 'Choose from multiple color themes in Settings > Theme.',
  'help.themes.unlock': 'Additional themes unlock as you level up.',
  'help.admin': 'Admin Panel',
  'help.admin.desc': 'Admin users can manage players, question sets, and system settings.',
  'help.admin.access': 'Access via the Admin link in the navigation (admin accounts only).',
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
  'help.fullHelp': 'Komplette Hilfe',
  'help.howToPlay': 'So wird gespielt',
  'help.howToPlay.1': '1. Erstelle oder tritt einem Spiel mit einem Lobby-Code bei',
  'help.howToPlay.2': '2. Warte bis alle Spieler bereit sind',
  'help.howToPlay.3': '3. Der Host startet das Spiel wenn mindestens ein Spieler bereit ist',
  'help.howToPlay.4': '4. Beantworte Fragen innerhalb des Zeitlimits',
  'help.howToPlay.5': '5. Baue deinen Serien-Multiplikator mit aufeinanderfolgenden richtigen Antworten auf',
  'help.howToPlay.6': '6. Deine Punktzahl wird nach dem Spiel in die Bestenliste eingetragen',
  'help.scoring': 'Punktesystem',
  'help.scoring.formula': 'Punkte = (60 - vergangene Sekunden) x Multiplikator',
  'help.scoring.fast': 'Antworte schneller fuer mehr Punkte',
  'help.scoring.streak': 'Baue Serien mit richtigen Antworten auf um deinen Multiplikator zu erhoehen',
  'help.scoring.wrong': 'Falsche Antworten setzen den Multiplikator auf 1x zurueck',
  'help.multipliers': 'Multiplikatoren',
  'help.multipliers.desc': 'Dein Multiplikator steigt mit jeder richtigen Antwort in Folge:',
  'help.multipliers.1x': '1x: Start-Multiplikator',
  'help.multipliers.2x': '2x: Nach 1 richtigen Antwort in Folge',
  'help.multipliers.3x': '3x: Nach 2 richtigen Antworten in Folge',
  'help.multipliers.4x': '4x: Nach 3 richtigen Antworten in Folge',
  'help.multipliers.5x': '5x: Nach 4 richtigen Antworten in Folge (Maximum)',
  'help.lobbies': 'Lobbys & Mehrspieler',
  'help.lobbies.create': 'Erstelle eine Lobby vom Startbildschirm. Du wirst zum Host.',
  'help.lobbies.code': 'Teile den Lobby-Code mit Freunden damit sie beitreten koennen.',
  'help.lobbies.ready': 'Alle Spieler muessen sich als bereit markieren.',
  'help.lobbies.host': 'Der Host kann Fragensets auswaehlen und das Spiel starten.',
  'help.lobbies.max': 'Bis zu 8 Spieler pro Lobby.',
  'help.questionSets': 'Fragensets',
  'help.questionSets.browse': 'Durchsuche verfuegbare Fragensets auf der Fragensets-Seite.',
  'help.questionSets.create': 'Erstelle eigene Fragensets mit Multiple-Choice-Fragen.',
  'help.questionSets.import': 'Importiere Fragensets aus JSON- oder CSV-Dateien.',
  'help.questionSets.select': 'Der Host waehlt vor dem Spielstart welche Sets verwendet werden.',
  'help.leveling': 'Level & Erfahrung',
  'help.leveling.xp': 'Verdiene XP entsprechend deiner Spielpunktzahl am Ende jedes Spiels.',
  'help.leveling.levelup': 'Steige auf indem du genug XP sammelst. Hoehere Level brauchen mehr XP.',
  'help.leveling.perks': 'Schalte Perks und Kosmetika frei wenn du aufsteigst.',
  'help.leveling.cap': 'Maximallevel fuer den Perk-Baum ist 30. Kosmetika gibt es durchgehend.',
  'help.perks': 'Perk-System',
  'help.perks.draft': 'Bei jedem Levelaufstieg waehlst du 1 von 3 zufaelligen Perks.',
  'help.perks.dump': 'Gefallen dir die Optionen nicht? Lehne alle 3 ab um sie dauerhaft zu entfernen.',
  'help.perks.reset': 'Voller Reset moeglich: Alle Perks zurueck in den Pool und neu waehlen.',
  'help.perks.categories': 'Perk-Kategorien: Zeit, Information, Punkte, Erholung, XP.',
  'help.perks.balance': 'Alle Perks sind ausbalanciert - kein einzelner Perk dominiert.',
  'help.profile': 'Profil & Anpassung',
  'help.profile.character': 'Passe deinen Charakter mit Koerpertyp, Frisur, Outfit und Pose an.',
  'help.profile.cosmetics': 'Schalte neue kosmetische Optionen frei wenn du aufsteigst.',
  'help.profile.avatar': 'Dein Avatar ist fuer andere Spieler in Lobbys und Spielen sichtbar.',
  'help.profile.skilltree': 'Sieh dir deinen Skill-Baum an um alle freigeschalteten Perks zu sehen.',
  'help.hallOfFame': 'Ruhmeshalle',
  'help.hallOfFame.desc': 'Die Ruhmeshalle zeigt die besten Punktzahlen aller Spiele.',
  'help.hallOfFame.submit': 'Deine Punktzahl wird nach jedem Spiel automatisch eingetragen.',
  'help.hallOfFame.leaderboard': 'Konkurriere mit anderen Spielern um die Spitzenplaetze.',
  'help.audio': 'Audio-Einstellungen',
  'help.audio.master': 'Steuere die Master-Lautstaerke ueber die Kopfleiste.',
  'help.audio.settings': 'Passe einzelne Soundeffekte unter Einstellungen > Audio an.',
  'help.audio.mute': 'Schnell stumm schalten mit dem Lautsprecher-Symbol in der Kopfleiste.',
  'help.language': 'Spracheinstellungen',
  'help.language.switch': 'Wechsle zwischen Englisch und Deutsch unter Einstellungen > Sprache.',
  'help.language.auto': 'Alle UI-Elemente aktualisieren sich sofort beim Wechsel.',
  'help.themes': 'Designs',
  'help.themes.desc': 'Waehle aus mehreren Farbdesigns unter Einstellungen > Design.',
  'help.themes.unlock': 'Zusaetzliche Designs werden beim Aufsteigen freigeschaltet.',
  'help.admin': 'Admin-Bereich',
  'help.admin.desc': 'Admin-Benutzer koennen Spieler, Fragensets und Systemeinstellungen verwalten.',
  'help.admin.access': 'Zugang ueber den Admin-Link in der Navigation (nur Admin-Konten).',
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