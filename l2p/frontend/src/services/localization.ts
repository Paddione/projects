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
  'nav.profile': 'Profile',
  'nav.questionSets': 'Question Sets',
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
  'help.leveling.cap': 'Maximum level is 30 for gameplay perks. Cosmetics unlock throughout.',
  'help.perks': 'Perk System',
  'help.perks.draft': 'New gameplay perks unlock automatically as you level up.',
  'help.perks.dump': 'Every 5 levels introduces more powerful tier 2 and tier 3 perks.',
  'help.perks.reset': 'All unlocked perks are active in gameplay — no manual selection needed.',
  'help.perks.categories': 'Perk categories: Time, Information, Scoring, Recovery, XP.',
  'help.perks.balance': 'All perks are balanced - no single perk dominates.',
  'help.profile': 'Profile & Customization',
  'help.profile.character': 'Customize your character with body type, hairstyle, outfit, and pose.',
  'help.profile.cosmetics': 'Unlock new cosmetic options as you level up.',
  'help.profile.avatar': 'Your avatar is visible to other players in lobbies and games.',
  'help.profile.skilltree': 'View your perks to see all unlocked and available perks.',
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
  'info.themeChanged': 'Theme changed successfully',

  // Perk Categories
  'perk.category.time': 'Time',
  'perk.category.info': 'Information',
  'perk.category.scoring': 'Scoring',
  'perk.category.recovery': 'Recovery',
  'perk.category.xp': 'XP',

  // GamePage
  'game.loadingGame': 'Loading game...',
  'game.getReady': 'Get Ready!',
  'game.startingSoon': 'Game is starting soon...',
  'game.playersInGame': 'Players in Game',
  'game.endedRedirecting': 'The game has ended. Redirecting to results...',
  'game.notStarted': 'Game Not Started',
  'game.waitingForGameStart': 'Waiting for game to start...',
  'game.backToLobby': 'Back to Lobby',
  'game.practiceMode': 'Practice',
  'game.leave': 'Leave',
  'game.showMore': 'Show more',
  'game.showLess': 'Show less',
  'game.showHint': 'Show Hint',
  'game.hint': 'Hint',
  'game.answerOptions': 'Answer options',
  'game.enterAnswer': 'Enter answer...',
  'game.submitFreeText': 'Submit',
  'game.correctAnswerLabel': 'Correct Answer',
  'game.answerSent': 'Answer sent! Waiting for other players...',
  'game.playerOverview': 'Player overview',
  'game.questionLoading': 'Loading question...',
  'game.noLobbyId': 'No lobby ID provided',
  'game.progressLabel': 'Progress',

  // Lobby
  'lobby.lobbyCode': 'Lobby Code',
  'lobby.clickToCopy': 'Click to copy',
  'lobby.challengers': 'Challengers',
  'lobby.masterOfCeremony': 'Master of Ceremony',
  'lobby.getReady': 'Get Ready',
  'lobby.iAmReady': 'I am Ready',
  'lobby.startAnyway': 'Start Anyway',
  'lobby.launchGame': 'Launch Game',
  'lobby.waitingForReady': 'Waiting for everyone to be ready...',
  'lobby.gameConfiguration': 'Game Configuration',
  'lobby.manageSets': 'Manage Sets',
  'lobby.gameMode': 'Game Mode',
  'lobby.arcade': 'Arcade',
  'lobby.arcadeDesc': 'Timer, Points, XP',
  'lobby.practiceMode': 'Practice',
  'lobby.practiceDesc': 'No Timer, Hints, Learning',

  // Home / GameInterface
  'home.subtitle': 'Battle your friends online or tackle solo challenges',
  'home.fastPlay': 'Fast Play',
  'home.createLobby': 'Create Lobby',
  'home.createDescription': 'Host a new game and invite friends with a code. Configure everything inside!',
  'home.creating': 'Creating...',
  'home.launchNewLobby': 'Launch New Lobby',
  'home.multiplayer': 'Multiplayer',
  'home.joinGame': 'Join Game',
  'home.joinDescription': 'Enter a 6-character code to jump into an existing lobby',
  'home.joinNow': 'Join Now',
  'home.enterCode': 'Enter Code',
  'home.loginRequired': 'You must be logged in to create a lobby',
  'home.loginRequiredJoin': 'You must be logged in to join a lobby',
  'home.invalidCode': 'Please enter a valid 6-character lobby code',
  'home.codeRequired': 'Lobby code is required',

  // Perks Manager
  'perk.slot.avatar': 'Avatar',
  'perk.slot.theme': 'Theme',
  'perk.slot.badge': 'Badge',
  'perk.slot.helper': 'Helper',
  'perk.slot.display': 'Interface',
  'perk.slot.emote': 'Social',
  'perk.slot.sound': 'Audio',
  'perk.slot.multiplier': 'Booster',
  'perk.slot.title': 'Title',
  'perk.filter.all': 'All Perks',
  'perk.filter.unlocked': 'Unlocked',
  'perk.filter.active': 'Active',
  'perk.filter.cosmetic': 'Cosmetic',
  'perk.filter.locked': 'Locked',
  'perk.header': 'Perks & Customization',
  'perk.headerDesc': 'Unlock and customize your gaming experience!',
  'perk.loadoutSlots': 'Your Loadout Slots',
  'perk.slotsSubtitle': 'Tap a slot to view and change its active perk',
  'perk.currentLoadout': 'Current Loadout',
  'perk.badgeSelection': 'Badge Selection',
  'perk.activePerksOverview': 'Active Perks Overview',
  'perk.status.locked': 'Locked',
  'perk.status.canUnlock': 'Can Unlock',
  'perk.status.available': 'Available',
  'perk.status.active': 'Active',
  'perk.slotState.picked': 'Picked',
  'perk.slotState.active': 'Active',
  'perk.slotState.empty': 'Empty',
  'perk.noneSelected': 'None selected',
  'perk.loading': 'Loading your perks...',
  'perk.unableToLoad': 'Unable to Load Perks',
  'perk.retrying': 'Retrying automatically...',
  'perk.retryExhausted': 'Automatic retries exhausted. Please try again manually.',
  'perk.retryNow': 'Retry Now',
  'perk.retryingNow': 'Retrying...',
  'perk.noData': 'No perks data available',
  'perk.noPerksForFilter': 'No perks available for this filter.',
  'perk.tryDifferentTab': 'Try selecting a different tab.',
  'perk.noBadgesUnlocked': 'No badges unlocked',
  'perk.noBadge': 'No Badge',
  'perk.emptyOverview': 'Pick a perk from the slots to see it listed here.',
  'perk.selectAvatar': 'Select Avatar:',
  'perk.selectTheme': 'Select Theme:',
  'perk.selectBadgeColor': 'Select Badge Color:',
  'perk.selectHighlightStyle': 'Select Highlight Style:',
  'perk.selectHintDetail': 'Select Hint Detail:',
  'perk.selectDashboardPosition': 'Select Dashboard Position:',
  'perk.selectTimerStyle': 'Select Timer Style:',
  'perk.selectFocusMode': 'Select Focus Mode:',
  'perk.selectEmoteSet': 'Select Emote Set:',
  'perk.selectEmoteSize': 'Select Emote Size:',
  'perk.selectReactionLevel': 'Select Reaction Level:',
  'perk.selectSoundPack': 'Select Sound Pack:',
  'perk.selectBoostDuration': 'Select Boost Duration:',
  'perk.selectActivationMode': 'Select Activation Mode:',
  'perk.selectExtraTime': 'Select Extra Time:',
  'perk.selectDisplayStyle': 'Select Display Style:',
  'perk.auraEffect': 'Aura Effect:',
  'perk.vipLobbyAccess': 'VIP Lobby Access:',
  'perk.noConfigNeeded': 'This perk does not require extra configuration.',
  'perk.activateToEnhance': 'Activate it to enhance your current loadout.',
  'perk.typeLabel': 'Type',
  'perk.categoryLabel': 'Category',
  'perk.requiredLevel': 'Required Level',
  'perk.descriptionLabel': 'Description',
  'perk.deactivate': 'Deactivate',
  'perk.activate': 'Activate Perk',
  'perk.activating': 'Activating...',
  'perk.working': 'Working...',
  'perk.notSet': 'Not set',
  'perk.level': 'Level',
  'perk.filterBySlot': 'Filtering by Slot:',
  'perk.viewAll': 'View All',
  'perk.perks': 'perks',
  'perk.loadoutHeader': 'Your Loadout',
  'perk.loadoutHeaderDesc': 'Equip and configure perks for each slot.',
  'perk.slotLocked': 'Unlock at Level {level}',
  'perk.clearSlot': '— Clear slot —',
  'perk.choosePerk': '— Choose a perk —',
  'perk.equipping': 'Equipping...',
  'perk.equipped': 'Equipped',
  'perk.slotsActive': '{count}/{total} slots active',

  // Question Set Manager
  'questionSets.title': 'Question Set Manager',
  'questionSets.importSet': 'Import Set',
  'questionSets.disableCompact': 'Disable Compact',
  'questionSets.enableCompact': 'Enable Compact',
  'questionSets.questionSets': 'Question Sets',
  'questionSets.noSetsFound': 'No question sets found. Create a new one to get started.',
  'questionSets.noDescription': 'No description available',
  'questionSets.active': 'Active',
  'questionSets.inactive': 'Inactive',
  'questionSets.selectSet': 'Select a Question Set',
  'questionSets.selectSetDesc': 'Choose a question set from the sidebar to view its details and manage questions.',
  'questionSets.statistics': 'Statistics',
  'questionSets.show': 'Show',
  'questionSets.hide': 'Hide',
  'questionSets.totalQuestions': 'Total Questions',
  'questionSets.avgDifficulty': 'Average Difficulty',
  'questionSets.difficultyRange': 'Difficulty Range',
  'questionSets.details': 'Question Set Details',
  'questionSets.public': 'Public',
  'questionSets.featured': 'Featured',
  'questionSets.tags': 'Tags',
  'questionSets.created': 'Created',
  'questionSets.lastUpdated': 'Last Updated',
  'questionSets.additionalInfo': 'Additional Info',
  'questionSets.questions': 'Questions',
  'questionSets.editSet': 'Edit Question Set',
  'questionSets.name': 'Name',
  'questionSets.descriptionLabel': 'Description',
  'questionSets.categoryLabel': 'Category',
  'questionSets.difficultyLabel': 'Difficulty',
  'questionSets.easy': 'Easy',
  'questionSets.medium': 'Medium',
  'questionSets.hard': 'Hard',
  'questionSets.update': 'Update',
  'questionSets.importing': 'Importing...',
  'questionSets.import': 'Import',
  'questionSets.cancel': 'Cancel',
  'questionSets.deleteConfirm': 'Are you sure you want to delete this question set? This action cannot be undone.',
  'questionSets.loading': 'Loading...',

  // Question Set Selector
  'selector.selectedQuestions': 'Selected Questions',
  'selector.noSetsSelected': 'No question sets selected',
  'selector.playingWith': 'Playing with',
  'selector.questions': 'questions',
  'selector.management': 'Question Set Management',
  'selector.setsSelected': 'sets selected',
  'selector.totalQs': 'total Qs',
  'selector.searchSets': 'Search sets...',
  'selector.allCategories': 'All Categories',
  'selector.allDifficulties': 'All Difficulties',
  'selector.easy': 'Easy',
  'selector.medium': 'Medium',
  'selector.hard': 'Hard',
  'selector.fetchingSets': 'Fetching sets...',
  'selector.noResults': 'No matching question sets found',
  'selector.gameSettings': 'Game Settings',
  'selector.questionsCount': 'Questions',
  'selector.max': 'max',
  'selector.needMoreQuestions': 'Need at least 5 questions total. Add more sets!',

  // HomePage
  'home.welcomeBack': 'Welcome back, {name}!',

  // LobbiesList
  'lobbies.title': 'Active Lobbies',
  'lobbies.loading': 'Loading lobbies...',
  'lobbies.refresh': 'Refresh',
  'lobbies.noLobbies': 'No active lobbies found',
  'lobbies.noLobbiesHint': 'Create a new lobby or wait for others to join',
  'lobbies.playerCount': '{count} player',
  'lobbies.playerCountPlural': '{count} players',
  'lobbies.host': '(Host)',
  'lobbies.more': '+{count} more',
  'lobbies.questionCount': '{count} questions',
  'lobbies.joinLobby': 'Join Lobby',
  'lobbies.failedToLoad': 'Failed to load lobbies',
  'lobbies.loginRequired': 'You must be logged in to join a lobby',
  'lobbies.failedToJoin': 'Failed to join lobby',

  // LobbyPage
  'lobbyPage.noId': 'No lobby ID provided',
  'lobbyPage.notFound': 'Lobby not found',
  'lobbyPage.failedToLoad': 'Failed to load lobby',
  'lobbyPage.loading': 'Loading lobby...',
  'lobbyPage.title': 'Game Lobby',
  'lobbyPage.code': 'Code:',
  'lobbyPage.leave': 'Leave Lobby',

  // Header
  'header.admin': 'Admin',
  'header.mute': 'Mute',
  'header.unmute': 'Unmute',
  'header.logout': 'Logout',
  'header.openMenu': 'Open menu',
  'header.closeMenu': 'Close menu',
  'header.masterVolume': 'Master volume',

  // ResultsPage
  'results.title': 'Game Results',
  'results.subtitle': 'Final scores, rankings, and experience gained',
  'results.winner': 'Winner: {name}!',
  'results.levelInfo': 'Level {level} {character}',
  'results.correctOf': '{correct}/{total} correct',
  'results.score': 'Score',
  'results.experience': 'Experience',
  'results.levelUp': 'LEVEL UP!',
  'results.levelChange': 'Level {old} → {new}',
  'results.finalRankings': 'Final Rankings & Experience',
  'results.pts': 'pts',
  'results.experienceSummary': 'Experience Summary',
  'results.accuracy': 'Accuracy',
  'results.rank': 'Rank',
  'results.nextLevel': 'Next Level',
  'results.playAgain': 'Play Again',
  'results.backToHome': 'Back to Home',

  // ProfilePage
  'profile.title': 'Your Profile',
  'profile.subtitle': 'Manage your character and track your progress',
  'profile.loadingProfile': 'Loading your profile...',
  'profile.failedToLoad': 'Failed to load profile',
  'profile.failedToUpdate': 'Failed to update character',
  'profile.noData': 'No profile data available',
  'profile.retry': 'Retry',
  'profile.changePassword': 'Change Password',
  'profile.closeChangePassword': 'Close Change Password',
  'profile.perks': 'Perks',
  'profile.closePerks': 'Close Perks',
  'profile.admin': 'Admin',
  'profile.perksManager': 'Perks Manager',
  'profile.currentCharacter': 'Current Character',
  'profile.updating': 'Updating...',
  'profile.levelProgress': 'Level Progress',
  'profile.totalXp': 'total experience points',
  'profile.levelProgressLabel': 'Level {level} Progress',
  'profile.complete': '% complete',
  'profile.neededForLevel': 'needed for level {level}',
  'profile.availableCharacters': 'Available Characters',
  'profile.unlockByLevel': 'Unlock new characters by reaching higher levels',
  'profile.unlocked': 'Unlocked',
  'profile.current': 'Current',
  'profile.selecting': 'Selecting...',
  'profile.select': 'Select',
  'profile.unlockAtLevel': 'Unlock at level {level}',
  'profile.legendaryScholar': 'Legendary Scholar',
  'profile.distinguishedProfessor': 'Distinguished Professor',
  'profile.experiencedStudent': 'Experienced Student',
  'profile.noviceLearner': 'Novice Learner',

  // ConnectionStatus
  'connection.connected': 'Connected',
  'connection.connecting': 'Connecting...',
  'connection.disconnected': 'Disconnected',
  'connection.unknown': 'Unknown',
  'connection.failed': 'Connection failed. Retrying...',

  // ErrorBoundary
  'error.oops': 'Oops! Something went wrong',
  'error.unexpectedMessage': 'We\'re sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.',
  'error.detailsSummary': 'Error Details (Development Only)',
  'error.errorLabel': 'Error:',
  'error.componentStack': 'Component Stack:',
  'error.tryAgain': 'Try Again',
  'error.reloadPage': 'Reload Page',
  'error.errorId': 'Error ID:',
  'error.heading': 'Error',
  'error.retry': 'Retry',
  'error.dismiss': 'Dismiss',

  // ThemeSelector
  'theme.lightLabel': 'Light',
  'theme.darkLabel': 'Dark',
  'theme.autoLabel': 'Auto',
  'theme.title': 'Theme / Design',
  'theme.currentMode': 'Current: {mode} Mode',

  // PlayerGrid
  'player.unknownCharacter': 'Unknown character',
  'player.empty': 'Empty',

  // GameInterface (test mode panel)
  'gameInterface.legacySettings': 'Legacy Lobby Settings',
  'gameInterface.questionCount': 'Question Count',
  'gameInterface.questionSet': 'Question Set',
  'gameInterface.selectSet': 'Select a set',
  'gameInterface.general': 'General',
  'gameInterface.science': 'Science',
  'gameInterface.history': 'History',
  'gameInterface.privateLobby': 'Private lobby',
  'gameInterface.createLobby': 'Create Lobby',
  'gameInterface.questionCountError': 'Question count must be between 1 and 100',
  'gameInterface.questionSetRequired': 'Question set is required',
  'gameInterface.failedToCreate': 'Failed to create lobby',
  'gameInterface.failedToJoin': 'Failed to join lobby',

  // CharacterSelector
  'character.loading': 'Loading characters...',
  'character.chooseTitle': 'Choose Your Character',
  'character.chooseDescription': 'Select a university-themed character to represent you in the game',
  'character.updating': 'Updating character...',

  // LevelUpNotification
  'notification.levelUp': 'Level Up!',
  'notification.level': 'Level {level}',
  'notification.xpGained': '+{xp} XP gained!',

  // PerkUnlockNotification
  'notification.perksUnlocked': 'New Perks Unlocked!',
  'notification.unknownPerk': 'Unknown Perk',
  'notification.cosmetic': 'Cosmetic',
  'notification.visitPerks': 'Visit the Perks Manager to activate your new perks!',

  // AudioSettings
  'audio.settingsTitle': 'Audio Settings',
  'audio.notSupportedMessage': 'Audio is not supported in this browser',
  'audio.masterControls': 'Master Controls',
  'audio.muteAll': 'Mute All Audio',
  'audio.masterVolumeLabel': 'Master Volume:',
  'audio.volumeControls': 'Volume Controls',
  'audio.musicVolumeLabel': 'Music Volume:',
  'audio.soundVolumeLabel': 'Sound Effects Volume:',
  'audio.testing': 'Audio Testing',
  'audio.testButton': 'Test Button Click',
  'audio.testMusic': 'Test Background Music',
  'audio.testStreak': 'Test Streak Sounds',
  'audio.testWrong': 'Test Wrong Answer',
  'audio.testNotification': 'Test Notification',
  'audio.testSuccess': 'Test Success',
  'audio.testError': 'Test Error',
  'audio.statusTitle': 'Audio Status',
  'audio.supportedLabel': 'Audio Supported:',
  'audio.mutedLabel': 'Audio Muted:',
  'audio.yes': 'Yes',
  'audio.no': 'No',

  // ChangePasswordForm
  'password.title': 'Change Password',
  'password.subtitle': 'Update your password to keep your account secure',
  'password.currentLabel': 'Current Password',
  'password.currentPlaceholder': 'Enter your current password',
  'password.newLabel': 'New Password',
  'password.newPlaceholder': 'Enter your new password',
  'password.confirmLabel': 'Confirm New Password',
  'password.confirmPlaceholder': 'Re-enter your new password',
  'password.mustContain': 'Password must contain:',
  'password.minLength': 'At least 8 characters',
  'password.lowercase': 'At least one lowercase letter',
  'password.uppercase': 'At least one uppercase letter',
  'password.number': 'At least one number',
  'password.special': 'At least one special character (@$!%*?&)',
  'password.saving': 'Saving...',
  'password.save': 'Save Password',
  'password.cancel': 'Cancel',
  'password.requirementsError': 'Please ensure your new password meets all requirements',
  'password.mismatchError': 'New password and confirmation do not match',
  'password.success': 'Password changed successfully',
  'password.failed': 'Failed to change password',

  // GameStateManager
  'game.leaveWarning': 'Are you sure you want to leave? This will remove you from the lobby.'
}

// German translations
const deTranslations: Translations = {
  // Navigation
  'nav.home': 'Startseite',
  'nav.profile': 'Profil',
  'nav.questionSets': 'Fragensets',
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
  'help.leveling.cap': 'Maximallevel fuer Gameplay-Perks ist 30. Kosmetika gibt es durchgehend.',
  'help.perks': 'Perk-System',
  'help.perks.draft': 'Neue Gameplay-Perks werden automatisch beim Levelaufstieg freigeschaltet.',
  'help.perks.dump': 'Alle 5 Level werden mächtigere Tier-2- und Tier-3-Perks eingeführt.',
  'help.perks.reset': 'Alle freigeschalteten Perks sind im Spiel aktiv — keine manuelle Auswahl nötig.',
  'help.perks.categories': 'Perk-Kategorien: Zeit, Information, Punkte, Erholung, XP.',
  'help.perks.balance': 'Alle Perks sind ausbalanciert - kein einzelner Perk dominiert.',
  'help.profile': 'Profil & Anpassung',
  'help.profile.character': 'Passe deinen Charakter mit Koerpertyp, Frisur, Outfit und Pose an.',
  'help.profile.cosmetics': 'Schalte neue kosmetische Optionen frei wenn du aufsteigst.',
  'help.profile.avatar': 'Dein Avatar ist fuer andere Spieler in Lobbys und Spielen sichtbar.',
  'help.profile.skilltree': 'Sieh dir deine Perks an um alle freigeschalteten Perks zu sehen.',
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
  'info.themeChanged': 'Design erfolgreich geändert',

  // Perk Categories
  'perk.category.time': 'Zeit',
  'perk.category.info': 'Information',
  'perk.category.scoring': 'Punkte',
  'perk.category.recovery': 'Erholung',
  'perk.category.xp': 'XP',

  // GamePage
  'game.loadingGame': 'Spiel wird geladen...',
  'game.getReady': 'Mach dich bereit!',
  'game.startingSoon': 'Das Spiel startet in Kürze...',
  'game.playersInGame': 'Spieler im Spiel',
  'game.endedRedirecting': 'Das Spiel ist beendet. Weiterleitung zu den Ergebnissen...',
  'game.notStarted': 'Spiel nicht gestartet',
  'game.waitingForGameStart': 'Warte auf Spielstart...',
  'game.backToLobby': 'Zurück zur Lobby',
  'game.practiceMode': 'Übung',
  'game.leave': 'Verlassen',
  'game.showMore': 'Mehr anzeigen',
  'game.showLess': 'Weniger anzeigen',
  'game.showHint': 'Hinweis anzeigen',
  'game.hint': 'Hinweis',
  'game.answerOptions': 'Antwortmöglichkeiten',
  'game.enterAnswer': 'Antwort eingeben...',
  'game.submitFreeText': 'Antworten',
  'game.correctAnswerLabel': 'Richtige Antwort',
  'game.answerSent': 'Antwort gesendet! Warte auf andere Spieler...',
  'game.playerOverview': 'Spielerübersicht',
  'game.questionLoading': 'Frage wird geladen...',
  'game.noLobbyId': 'Keine Lobby-ID angegeben',
  'game.progressLabel': 'Fortschritt',

  // Lobby
  'lobby.lobbyCode': 'Lobby-Code',
  'lobby.clickToCopy': 'Klicken zum Kopieren',
  'lobby.challengers': 'Herausforderer',
  'lobby.masterOfCeremony': 'Spielleiter',
  'lobby.getReady': 'Bereit machen',
  'lobby.iAmReady': 'Ich bin bereit',
  'lobby.startAnyway': 'Trotzdem starten',
  'lobby.launchGame': 'Spiel starten',
  'lobby.waitingForReady': 'Warte bis alle bereit sind...',
  'lobby.gameConfiguration': 'Spielkonfiguration',
  'lobby.manageSets': 'Sets verwalten',
  'lobby.gameMode': 'Spielmodus',
  'lobby.arcade': 'Arcade',
  'lobby.arcadeDesc': 'Timer, Punkte, XP',
  'lobby.practiceMode': 'Übung',
  'lobby.practiceDesc': 'Kein Timer, Hinweise, Lernen',

  // Home / GameInterface
  'home.subtitle': 'Fordere deine Freunde heraus oder stelle dich Solo-Aufgaben',
  'home.fastPlay': 'Schnellstart',
  'home.createLobby': 'Lobby erstellen',
  'home.createDescription': 'Erstelle ein neues Spiel und lade Freunde mit einem Code ein. Alles Weitere in der Lobby!',
  'home.creating': 'Erstelle...',
  'home.launchNewLobby': 'Neue Lobby starten',
  'home.multiplayer': 'Mehrspieler',
  'home.joinGame': 'Spiel beitreten',
  'home.joinDescription': 'Gib einen 6-stelligen Code ein, um einer bestehenden Lobby beizutreten',
  'home.joinNow': 'Jetzt beitreten',
  'home.enterCode': 'Code eingeben',
  'home.loginRequired': 'Du musst angemeldet sein, um eine Lobby zu erstellen',
  'home.loginRequiredJoin': 'Du musst angemeldet sein, um einer Lobby beizutreten',
  'home.invalidCode': 'Bitte gib einen gültigen 6-stelligen Lobby-Code ein',
  'home.codeRequired': 'Lobby-Code ist erforderlich',

  // Perks Manager
  'perk.slot.avatar': 'Avatar',
  'perk.slot.theme': 'Design',
  'perk.slot.badge': 'Abzeichen',
  'perk.slot.helper': 'Helfer',
  'perk.slot.display': 'Anzeige',
  'perk.slot.emote': 'Sozial',
  'perk.slot.sound': 'Audio',
  'perk.slot.multiplier': 'Booster',
  'perk.slot.title': 'Titel',
  'perk.filter.all': 'Alle Perks',
  'perk.filter.unlocked': 'Freigeschaltet',
  'perk.filter.active': 'Aktiv',
  'perk.filter.cosmetic': 'Kosmetisch',
  'perk.filter.locked': 'Gesperrt',
  'perk.header': 'Perks & Anpassung',
  'perk.headerDesc': 'Schalte Perks frei und passe dein Spielerlebnis an!',
  'perk.loadoutSlots': 'Deine Loadout-Slots',
  'perk.slotsSubtitle': 'Tippe auf einen Slot, um den aktiven Perk zu ändern',
  'perk.currentLoadout': 'Aktuelles Loadout',
  'perk.badgeSelection': 'Abzeichen-Auswahl',
  'perk.activePerksOverview': 'Aktive Perks Übersicht',
  'perk.status.locked': 'Gesperrt',
  'perk.status.canUnlock': 'Freischaltbar',
  'perk.status.available': 'Verfügbar',
  'perk.status.active': 'Aktiv',
  'perk.slotState.picked': 'Gewählt',
  'perk.slotState.active': 'Aktiv',
  'perk.slotState.empty': 'Leer',
  'perk.noneSelected': 'Nichts ausgewählt',
  'perk.loading': 'Perks werden geladen...',
  'perk.unableToLoad': 'Perks konnten nicht geladen werden',
  'perk.retrying': 'Automatischer Neuversuch...',
  'perk.retryExhausted': 'Automatische Versuche erschöpft. Bitte manuell erneut versuchen.',
  'perk.retryNow': 'Jetzt erneut versuchen',
  'perk.retryingNow': 'Versuche erneut...',
  'perk.noData': 'Keine Perk-Daten verfügbar',
  'perk.noPerksForFilter': 'Keine Perks für diesen Filter verfügbar.',
  'perk.tryDifferentTab': 'Versuche einen anderen Tab.',
  'perk.noBadgesUnlocked': 'Keine Abzeichen freigeschaltet',
  'perk.noBadge': 'Kein Abzeichen',
  'perk.emptyOverview': 'Wähle einen Perk aus den Slots, um ihn hier zu sehen.',
  'perk.selectAvatar': 'Avatar auswählen:',
  'perk.selectTheme': 'Design auswählen:',
  'perk.selectBadgeColor': 'Abzeichenfarbe auswählen:',
  'perk.selectHighlightStyle': 'Hervorhebungsstil auswählen:',
  'perk.selectHintDetail': 'Hinweis-Detail auswählen:',
  'perk.selectDashboardPosition': 'Dashboard-Position auswählen:',
  'perk.selectTimerStyle': 'Timer-Stil auswählen:',
  'perk.selectFocusMode': 'Fokus-Modus auswählen:',
  'perk.selectEmoteSet': 'Emote-Set auswählen:',
  'perk.selectEmoteSize': 'Emote-Größe auswählen:',
  'perk.selectReactionLevel': 'Reaktionslevel auswählen:',
  'perk.selectSoundPack': 'Soundpaket auswählen:',
  'perk.selectBoostDuration': 'Boost-Dauer auswählen:',
  'perk.selectActivationMode': 'Aktivierungsmodus auswählen:',
  'perk.selectExtraTime': 'Zusatzzeit auswählen:',
  'perk.selectDisplayStyle': 'Anzeigestil auswählen:',
  'perk.auraEffect': 'Aura-Effekt:',
  'perk.vipLobbyAccess': 'VIP-Lobby-Zugang:',
  'perk.noConfigNeeded': 'Dieser Perk benötigt keine weitere Konfiguration.',
  'perk.activateToEnhance': 'Aktiviere ihn, um dein Loadout zu verbessern.',
  'perk.typeLabel': 'Typ',
  'perk.categoryLabel': 'Kategorie',
  'perk.requiredLevel': 'Benötigtes Level',
  'perk.descriptionLabel': 'Beschreibung',
  'perk.deactivate': 'Deaktivieren',
  'perk.activate': 'Perk aktivieren',
  'perk.activating': 'Aktiviere...',
  'perk.working': 'Arbeite...',
  'perk.notSet': 'Nicht gesetzt',
  'perk.level': 'Level',
  'perk.filterBySlot': 'Filter nach Slot:',
  'perk.viewAll': 'Alle anzeigen',
  'perk.perks': 'Perks',
  'perk.loadoutHeader': 'Dein Loadout',
  'perk.loadoutHeaderDesc': 'Rüste Perks für jeden Slot aus und konfiguriere sie.',
  'perk.slotLocked': 'Freischaltbar ab Level {level}',
  'perk.clearSlot': '— Slot leeren —',
  'perk.choosePerk': '— Perk auswählen —',
  'perk.equipping': 'Wird ausgerüstet...',
  'perk.equipped': 'Ausgerüstet',
  'perk.slotsActive': '{count}/{total} Slots aktiv',

  // Question Set Manager
  'questionSets.title': 'Fragenset-Verwaltung',
  'questionSets.importSet': 'Set importieren',
  'questionSets.disableCompact': 'Kompakt deaktivieren',
  'questionSets.enableCompact': 'Kompakt aktivieren',
  'questionSets.questionSets': 'Fragensets',
  'questionSets.noSetsFound': 'Keine Fragensets gefunden. Erstelle ein neues, um loszulegen.',
  'questionSets.noDescription': 'Keine Beschreibung verfügbar',
  'questionSets.active': 'Aktiv',
  'questionSets.inactive': 'Inaktiv',
  'questionSets.selectSet': 'Fragenset auswählen',
  'questionSets.selectSetDesc': 'Wähle ein Fragenset aus der Seitenleiste, um Details anzuzeigen und Fragen zu verwalten.',
  'questionSets.statistics': 'Statistiken',
  'questionSets.show': 'Anzeigen',
  'questionSets.hide': 'Ausblenden',
  'questionSets.totalQuestions': 'Fragen gesamt',
  'questionSets.avgDifficulty': 'Durchschnittliche Schwierigkeit',
  'questionSets.difficultyRange': 'Schwierigkeitsbereich',
  'questionSets.details': 'Fragenset-Details',
  'questionSets.public': 'Öffentlich',
  'questionSets.featured': 'Empfohlen',
  'questionSets.tags': 'Tags',
  'questionSets.created': 'Erstellt',
  'questionSets.lastUpdated': 'Zuletzt aktualisiert',
  'questionSets.additionalInfo': 'Zusätzliche Informationen',
  'questionSets.questions': 'Fragen',
  'questionSets.editSet': 'Fragenset bearbeiten',
  'questionSets.name': 'Name',
  'questionSets.descriptionLabel': 'Beschreibung',
  'questionSets.categoryLabel': 'Kategorie',
  'questionSets.difficultyLabel': 'Schwierigkeit',
  'questionSets.easy': 'Leicht',
  'questionSets.medium': 'Mittel',
  'questionSets.hard': 'Schwer',
  'questionSets.update': 'Aktualisieren',
  'questionSets.importing': 'Importiere...',
  'questionSets.import': 'Importieren',
  'questionSets.cancel': 'Abbrechen',
  'questionSets.deleteConfirm': 'Bist du sicher, dass du dieses Fragenset löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.',
  'questionSets.loading': 'Laden...',

  // Question Set Selector
  'selector.selectedQuestions': 'Ausgewählte Fragen',
  'selector.noSetsSelected': 'Keine Fragensets ausgewählt',
  'selector.playingWith': 'Spielen mit',
  'selector.questions': 'Fragen',
  'selector.management': 'Fragenset-Verwaltung',
  'selector.setsSelected': 'Sets ausgewählt',
  'selector.totalQs': 'Fragen gesamt',
  'selector.searchSets': 'Sets durchsuchen...',
  'selector.allCategories': 'Alle Kategorien',
  'selector.allDifficulties': 'Alle Schwierigkeiten',
  'selector.easy': 'Leicht',
  'selector.medium': 'Mittel',
  'selector.hard': 'Schwer',
  'selector.fetchingSets': 'Lade Sets...',
  'selector.noResults': 'Keine passenden Fragensets gefunden',
  'selector.gameSettings': 'Spieleinstellungen',
  'selector.questionsCount': 'Fragen',
  'selector.max': 'max',
  'selector.needMoreQuestions': 'Mindestens 5 Fragen nötig. Füge weitere Sets hinzu!',

  // HomePage
  'home.welcomeBack': 'Willkommen zurück, {name}!',

  // LobbiesList
  'lobbies.title': 'Aktive Lobbys',
  'lobbies.loading': 'Lobbys werden geladen...',
  'lobbies.refresh': 'Aktualisieren',
  'lobbies.noLobbies': 'Keine aktiven Lobbys gefunden',
  'lobbies.noLobbiesHint': 'Erstelle eine neue Lobby oder warte auf andere Spieler',
  'lobbies.playerCount': '{count} Spieler',
  'lobbies.playerCountPlural': '{count} Spieler',
  'lobbies.host': '(Host)',
  'lobbies.more': '+{count} weitere',
  'lobbies.questionCount': '{count} Fragen',
  'lobbies.joinLobby': 'Lobby beitreten',
  'lobbies.failedToLoad': 'Lobbys konnten nicht geladen werden',
  'lobbies.loginRequired': 'Du musst angemeldet sein, um einer Lobby beizutreten',
  'lobbies.failedToJoin': 'Lobby beitreten fehlgeschlagen',

  // LobbyPage
  'lobbyPage.noId': 'Keine Lobby-ID angegeben',
  'lobbyPage.notFound': 'Lobby nicht gefunden',
  'lobbyPage.failedToLoad': 'Lobby konnte nicht geladen werden',
  'lobbyPage.loading': 'Lobby wird geladen...',
  'lobbyPage.title': 'Spiel-Lobby',
  'lobbyPage.code': 'Code:',
  'lobbyPage.leave': 'Lobby verlassen',

  // Header
  'header.admin': 'Admin',
  'header.mute': 'Stummschalten',
  'header.unmute': 'Stummschaltung aufheben',
  'header.logout': 'Abmelden',
  'header.openMenu': 'Menü öffnen',
  'header.closeMenu': 'Menü schließen',
  'header.masterVolume': 'Master-Lautstärke',

  // ResultsPage
  'results.title': 'Spielergebnisse',
  'results.subtitle': 'Endpunktzahlen, Rangliste und gewonnene Erfahrung',
  'results.winner': 'Gewinner: {name}!',
  'results.levelInfo': 'Level {level} {character}',
  'results.correctOf': '{correct}/{total} richtig',
  'results.score': 'Punkte',
  'results.experience': 'Erfahrung',
  'results.levelUp': 'LEVEL UP!',
  'results.levelChange': 'Level {old} → {new}',
  'results.finalRankings': 'Endrangliste & Erfahrung',
  'results.pts': 'Pkt.',
  'results.experienceSummary': 'Erfahrungsübersicht',
  'results.accuracy': 'Genauigkeit',
  'results.rank': 'Rang',
  'results.nextLevel': 'Nächstes Level',
  'results.playAgain': 'Nochmal spielen',
  'results.backToHome': 'Zurück zur Startseite',

  // ProfilePage
  'profile.title': 'Dein Profil',
  'profile.subtitle': 'Verwalte deinen Charakter und verfolge deinen Fortschritt',
  'profile.loadingProfile': 'Profil wird geladen...',
  'profile.failedToLoad': 'Profil konnte nicht geladen werden',
  'profile.failedToUpdate': 'Charakter konnte nicht aktualisiert werden',
  'profile.noData': 'Keine Profildaten verfügbar',
  'profile.retry': 'Erneut versuchen',
  'profile.changePassword': 'Passwort ändern',
  'profile.closeChangePassword': 'Passwort ändern schließen',
  'profile.perks': 'Perks',
  'profile.closePerks': 'Perks schließen',
  'profile.admin': 'Admin',
  'profile.perksManager': 'Perks-Verwaltung',
  'profile.currentCharacter': 'Aktueller Charakter',
  'profile.updating': 'Aktualisiere...',
  'profile.levelProgress': 'Level-Fortschritt',
  'profile.totalXp': 'Erfahrungspunkte gesamt',
  'profile.levelProgressLabel': 'Level {level} Fortschritt',
  'profile.complete': '% abgeschlossen',
  'profile.neededForLevel': 'benötigt für Level {level}',
  'profile.availableCharacters': 'Verfügbare Charaktere',
  'profile.unlockByLevel': 'Schalte neue Charaktere frei, indem du höhere Level erreichst',
  'profile.unlocked': 'Freigeschaltet',
  'profile.current': 'Aktuell',
  'profile.selecting': 'Auswählen...',
  'profile.select': 'Auswählen',
  'profile.unlockAtLevel': 'Freischaltbar ab Level {level}',
  'profile.legendaryScholar': 'Legendärer Gelehrter',
  'profile.distinguishedProfessor': 'Angesehener Professor',
  'profile.experiencedStudent': 'Erfahrener Student',
  'profile.noviceLearner': 'Neuling',

  // ConnectionStatus
  'connection.connected': 'Verbunden',
  'connection.connecting': 'Verbinde...',
  'connection.disconnected': 'Getrennt',
  'connection.unknown': 'Unbekannt',
  'connection.failed': 'Verbindung fehlgeschlagen. Erneuter Versuch...',

  // ErrorBoundary
  'error.oops': 'Hoppla! Etwas ist schiefgelaufen',
  'error.unexpectedMessage': 'Es tut uns leid, aber es ist etwas Unerwartetes passiert. Bitte versuche die Seite neu zu laden oder kontaktiere den Support, wenn das Problem weiterhin besteht.',
  'error.detailsSummary': 'Fehlerdetails (nur Entwicklung)',
  'error.errorLabel': 'Fehler:',
  'error.componentStack': 'Komponentenstapel:',
  'error.tryAgain': 'Erneut versuchen',
  'error.reloadPage': 'Seite neu laden',
  'error.errorId': 'Fehler-ID:',
  'error.heading': 'Fehler',
  'error.retry': 'Erneut versuchen',
  'error.dismiss': 'Schließen',

  // ThemeSelector
  'theme.lightLabel': 'Hell',
  'theme.darkLabel': 'Dunkel',
  'theme.autoLabel': 'Auto',
  'theme.title': 'Design',
  'theme.currentMode': 'Aktuell: {mode}-Modus',

  // PlayerGrid
  'player.unknownCharacter': 'Unbekannter Charakter',
  'player.empty': 'Leer',

  // GameInterface (test mode panel)
  'gameInterface.legacySettings': 'Legacy Lobby-Einstellungen',
  'gameInterface.questionCount': 'Fragenanzahl',
  'gameInterface.questionSet': 'Fragenset',
  'gameInterface.selectSet': 'Set auswählen',
  'gameInterface.general': 'Allgemein',
  'gameInterface.science': 'Naturwissenschaft',
  'gameInterface.history': 'Geschichte',
  'gameInterface.privateLobby': 'Private Lobby',
  'gameInterface.createLobby': 'Lobby erstellen',
  'gameInterface.questionCountError': 'Fragenanzahl muss zwischen 1 und 100 liegen',
  'gameInterface.questionSetRequired': 'Fragenset ist erforderlich',
  'gameInterface.failedToCreate': 'Lobby konnte nicht erstellt werden',
  'gameInterface.failedToJoin': 'Lobby beitreten fehlgeschlagen',

  // CharacterSelector
  'character.loading': 'Charaktere werden geladen...',
  'character.chooseTitle': 'Wähle deinen Charakter',
  'character.chooseDescription': 'Wähle einen Uni-Charakter, der dich im Spiel repräsentiert',
  'character.updating': 'Charakter wird aktualisiert...',

  // LevelUpNotification
  'notification.levelUp': 'Level Up!',
  'notification.level': 'Level {level}',
  'notification.xpGained': '+{xp} XP erhalten!',

  // PerkUnlockNotification
  'notification.perksUnlocked': 'Neue Perks freigeschaltet!',
  'notification.unknownPerk': 'Unbekannter Perk',
  'notification.cosmetic': 'Kosmetisch',
  'notification.visitPerks': 'Besuche den Perks-Manager, um deine neuen Perks zu aktivieren!',

  // AudioSettings
  'audio.settingsTitle': 'Audio-Einstellungen',
  'audio.notSupportedMessage': 'Audio wird in diesem Browser nicht unterstützt',
  'audio.masterControls': 'Master-Steuerung',
  'audio.muteAll': 'Alles stummschalten',
  'audio.masterVolumeLabel': 'Master-Lautstärke:',
  'audio.volumeControls': 'Lautstärke-Einstellungen',
  'audio.musicVolumeLabel': 'Musik-Lautstärke:',
  'audio.soundVolumeLabel': 'Soundeffekt-Lautstärke:',
  'audio.testing': 'Audio testen',
  'audio.testButton': 'Button-Klick testen',
  'audio.testMusic': 'Hintergrundmusik testen',
  'audio.testStreak': 'Serie-Sounds testen',
  'audio.testWrong': 'Falsche Antwort testen',
  'audio.testNotification': 'Benachrichtigung testen',
  'audio.testSuccess': 'Erfolg testen',
  'audio.testError': 'Fehler testen',
  'audio.statusTitle': 'Audio-Status',
  'audio.supportedLabel': 'Audio unterstützt:',
  'audio.mutedLabel': 'Audio stumm:',
  'audio.yes': 'Ja',
  'audio.no': 'Nein',

  // ChangePasswordForm
  'password.title': 'Passwort ändern',
  'password.subtitle': 'Aktualisiere dein Passwort, um dein Konto zu schützen',
  'password.currentLabel': 'Aktuelles Passwort',
  'password.currentPlaceholder': 'Aktuelles Passwort eingeben',
  'password.newLabel': 'Neues Passwort',
  'password.newPlaceholder': 'Neues Passwort eingeben',
  'password.confirmLabel': 'Neues Passwort bestätigen',
  'password.confirmPlaceholder': 'Neues Passwort erneut eingeben',
  'password.mustContain': 'Passwort muss enthalten:',
  'password.minLength': 'Mindestens 8 Zeichen',
  'password.lowercase': 'Mindestens einen Kleinbuchstaben',
  'password.uppercase': 'Mindestens einen Großbuchstaben',
  'password.number': 'Mindestens eine Zahl',
  'password.special': 'Mindestens ein Sonderzeichen (@$!%*?&)',
  'password.saving': 'Speichern...',
  'password.save': 'Passwort speichern',
  'password.cancel': 'Abbrechen',
  'password.requirementsError': 'Bitte stelle sicher, dass dein neues Passwort alle Anforderungen erfüllt',
  'password.mismatchError': 'Neues Passwort und Bestätigung stimmen nicht überein',
  'password.success': 'Passwort erfolgreich geändert',
  'password.failed': 'Passwort konnte nicht geändert werden',

  // GameStateManager
  'game.leaveWarning': 'Bist du sicher, dass du gehen willst? Du wirst aus der Lobby entfernt.'
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

  /**
   * Translate a key with optional interpolation params or fallback string.
   * Usage:
   *   t('key')                          — simple lookup
   *   t('key', 'fallback')              — with fallback string (backward-compatible)
   *   t('key', { name: 'Alice' })       — with interpolation: "Hello, {name}!" → "Hello, Alice!"
   *   t('key', { name: 'Alice' }, 'fb') — with both params and fallback
   */
  public t(key: string, paramsOrFallback?: Record<string, string | number> | string, fallback?: string): string {
    const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : undefined
    const fb = typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback
    let result = this.translate(key, fb)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return result
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