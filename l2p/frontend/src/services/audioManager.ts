export interface AudioFile {
  name: string
  path: string
  type: 'music' | 'sound' | 'ui' | 'streak'
}

export class AudioManager {
  private audioContext: AudioContext | null = null
  private audioBuffers: Map<string, AudioBuffer> = new Map()
  private gainNodes: Map<string, GainNode> = new Map()
  private isInitialized = false
  private audioFiles: AudioFile[] = [
    // Streak-based correct answer sounds
    { name: 'correct1', path: '/audio/correct1.mp3', type: 'streak' },
    { name: 'correct2', path: '/audio/correct2.mp3', type: 'streak' },
    { name: 'correct3', path: '/audio/correct3.mp3', type: 'streak' },
    { name: 'correct4', path: '/audio/correct4.mp3', type: 'streak' },
    { name: 'correct5', path: '/audio/correct5.mp3', type: 'streak' },

    // Wrong answer sound
    { name: 'wrong', path: '/audio/wrong.mp3', type: 'sound' },

    // UI interaction sounds
    { name: 'button-click', path: '/audio/button-click.mp3', type: 'ui' },
    { name: 'button-hover', path: '/audio/button-hover.mp3', type: 'ui' },
    { name: 'modal-open', path: '/audio/modal-open.mp3', type: 'ui' },
    { name: 'modal-close', path: '/audio/modal-close.mp3', type: 'ui' },

    // Player notification sounds
    { name: 'player-join', path: '/audio/player-join.mp3', type: 'sound' },
    { name: 'player-leave', path: '/audio/player-leave.mp3', type: 'sound' },

    // Timer warning sounds
    { name: 'timer-warning', path: '/audio/timer-warning.mp3', type: 'sound' },
    { name: 'timer-urgent', path: '/audio/timer-urgent.mp3', type: 'sound' },

    // Achievement sounds
    { name: 'applause', path: '/audio/applause.mp3', type: 'sound' },
    { name: 'high-score', path: '/audio/high-score.mp3', type: 'sound' },
    { name: 'perfect-score', path: '/audio/perfect-score.mp3', type: 'sound' },

    // Game state sounds
    { name: 'game-start', path: '/audio/game-start.mp3', type: 'sound' },
    { name: 'game-end', path: '/audio/game-end.mp3', type: 'sound' },
    { name: 'question-start', path: '/audio/question-start.mp3', type: 'sound' },
    { name: 'lobby-created', path: '/audio/lobby-created.mp3', type: 'sound' },
    { name: 'lobby-joined', path: '/audio/lobby-joined.mp3', type: 'sound' },

    // Background music
    { name: 'lobby-music', path: '/audio/lobby-music.mp3', type: 'music' },

    // Additional UI sounds
    { name: 'notification', path: '/audio/notification.mp3', type: 'ui' },
    { name: 'success', path: '/audio/success.mp3', type: 'ui' },
    { name: 'error', path: '/audio/error.mp3', type: 'ui' },
    { name: 'tick', path: '/audio/tick.mp3', type: 'ui' },
    { name: 'countdown', path: '/audio/countdown.mp3', type: 'ui' },

    // Multiplier sounds
    { name: 'multiplier-up', path: '/audio/multiplier-up.mp3', type: 'sound' },
    { name: 'multiplier-reset', path: '/audio/multiplier-reset.mp3', type: 'sound' },

    // Score sounds
    { name: 'score-points', path: '/audio/score-points.mp3', type: 'sound' },
    { name: 'score-bonus', path: '/audio/score-bonus.mp3', type: 'sound' },

    // Menu sounds
    { name: 'menu-select', path: '/audio/menu-select.mp3', type: 'ui' },
    { name: 'menu-confirm', path: '/audio/menu-confirm.mp3', type: 'ui' },
    { name: 'menu-cancel', path: '/audio/menu-cancel.mp3', type: 'ui' },

    // Settings sounds
    { name: 'volume-change', path: '/audio/volume-change.mp3', type: 'ui' },
    { name: 'theme-change', path: '/audio/theme-change.mp3', type: 'ui' },
    { name: 'language-change', path: '/audio/language-change.mp3', type: 'ui' }
  ]

  // Centralized volume/mute settings applied via type-level gain nodes
  private masterVolume = 1.0
  private musicVolume = 0.7
  private soundVolume = 0.8
  private isMuted = false

  // Global kill switch for the sound module to handle missing assets gracefully
  private readonly DISABLED = false

  constructor() {
    // Defer initialization until first use to allow environment/test setup
  }

  private async init(): Promise<void> {
    if (this.DISABLED) {
      console.log('AudioManager is disabled')
      return
    }

    try {
      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()

      // Load all audio files first (does not depend on gain nodes)
      await this.loadAllAudioFiles()

      // Create gain nodes for different audio types
      const musicGain = this.audioContext.createGain()
      const soundGain = this.audioContext.createGain()
      const uiGain = this.audioContext.createGain()
      const streakGain = this.audioContext.createGain()

      this.gainNodes.set('music', musicGain)
      this.gainNodes.set('sound', soundGain)
      this.gainNodes.set('ui', uiGain)
      this.gainNodes.set('streak', streakGain)

      // Connect gain nodes to destination
      musicGain.connect(this.audioContext.destination)
      soundGain.connect(this.audioContext.destination)
      uiGain.connect(this.audioContext.destination)
      streakGain.connect(this.audioContext.destination)

      // Apply initial volumes/mute
      this.applyVolumeSettings()

      this.isInitialized = true
      console.log('AudioManager initialized successfully')
    } catch (error) {
      // Ensure the manager remains marked uninitialized and propagate the error
      this.isInitialized = false
      console.error('Failed to initialize AudioManager:', error)
      throw error
    }
  }

  // Public helpers for safe external initialization without exposing internals
  public async ensureInitialized(): Promise<void> {
    if (this.DISABLED) return
    if (!this.isInitialized) {
      await this.init()
    }
  }

  public isReady(): boolean {
    return this.DISABLED || this.isInitialized
  }

  private async loadAllAudioFiles(): Promise<void> {
    // Limit concurrency to avoid overwhelming the server/CDN and triggering rate limits
    const concurrencyLimit = 6
    let currentIndex = 0

    const worker = async () => {
      while (currentIndex < this.audioFiles.length) {
        const nextIndex = currentIndex++
        const file = this.audioFiles[nextIndex]
        if (!file) continue
        await this.loadAudioFile(file)
      }
    }

    const workers = Array.from({ length: concurrencyLimit }, worker)
    await Promise.all(workers)
  }

  private async loadAudioFile(audioFile: AudioFile): Promise<void> {
    try {
      const response = await this.fetchWithRetry(audioFile.path, 3, 200)
      if (!response.ok) {
        console.warn(`Failed to load audio file: ${audioFile.path} (status ${response.status})`)
        return
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
      this.audioBuffers.set(audioFile.name, audioBuffer)
    } catch (error) {
      // Silently handle audio decoding errors - some MP3 files may have encoding issues
      // This is non-critical for gameplay functionality
      if (error instanceof Error && error.name === 'EncodingError') {
        console.debug(`Audio file ${audioFile.path} has encoding issues, skipping`)
      } else {
        console.warn(`Error loading audio file ${audioFile.path}:`, error)
      }
    }
  }

  private async fetchWithRetry(url: string, retries: number = 2, delayMs: number = 150): Promise<Response> {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url)
        if (res.ok || attempt === retries) {
          return res
        }
        // If non-OK and we still have retries, wait and try again
      } catch (err) {
        lastError = err
        if (attempt === retries) break
      }
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)))
    }
    if (lastError) {
      throw lastError
    }
    // Fallback fetch if last attempt failed with non-OK but no exception
    return fetch(url)
  }

  // Update type-level gain nodes with current volume settings
  private applyVolumeSettings(): void {
    if (!this.audioContext) return

    const effectiveMaster = this.isMuted ? 0 : this.masterVolume
    const musicGain = this.gainNodes.get('music')
    const soundGain = this.gainNodes.get('sound')
    const uiGain = this.gainNodes.get('ui')
    const streakGain = this.gainNodes.get('streak')

    if (musicGain) musicGain.gain.value = effectiveMaster * this.musicVolume
    if (soundGain) soundGain.gain.value = effectiveMaster * this.soundVolume
    // Keep UI slightly quieter than sound by default for UX
    if (uiGain) uiGain.gain.value = effectiveMaster * this.soundVolume * 0.7
    if (streakGain) streakGain.gain.value = effectiveMaster * this.soundVolume
  }

  // Public API to update master/music/sound volumes
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    this.applyVolumeSettings()
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    this.applyVolumeSettings()
  }

  public setSoundVolume(volume: number): void {
    this.soundVolume = Math.max(0, Math.min(1, volume))
    this.applyVolumeSettings()
  }

  public setMuted(muted: boolean): void {
    this.isMuted = !!muted
    this.applyVolumeSettings()
  }

  public async playSound(soundName: string, options: {
    volume?: number
    loop?: boolean
    fadeIn?: boolean
    fadeOut?: boolean
  } = {}): Promise<void> {
    if (this.DISABLED) return Promise.resolve()

    // Auto-initialize on first use
    if (!this.isReady()) {
      try {
        await this.ensureInitialized()
      } catch {
        console.warn('AudioManager not initialized')
        return Promise.resolve()
      }
    }

    if (!this.isInitialized || !this.audioContext) {
      console.warn('AudioManager not initialized')
      return Promise.resolve()
    }

    const audioFile = this.audioFiles.find(file => file.name === soundName)
    if (!audioFile) {
      console.warn(`Audio file not found: ${soundName}`)
      return Promise.resolve()
    }

    const buffer = this.audioBuffers.get(soundName)
    if (!buffer) {
      console.warn(`Audio buffer not loaded: ${soundName}`)
      return Promise.resolve()
    }

    const source = this.audioContext.createBufferSource()
    const gainNode = this.audioContext.createGain()

    source.buffer = buffer
    source.loop = options.loop || false

    // Connect source to gain node, then to appropriate type gain node
    source.connect(gainNode)
    const typeGainNode = this.gainNodes.get(audioFile.type)
    if (typeGainNode) {
      gainNode.connect(typeGainNode)
    }

    // Apply per-sound volume (type/master handled by type gain nodes)
    const perSoundVolume = typeof options.volume === 'number' ? options.volume : 1
    gainNode.gain.value = perSoundVolume

    // Apply fade in if requested
    if (options.fadeIn) {
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(perSoundVolume, this.audioContext.currentTime + 0.1)
    }

    // Apply fade out if requested
    if (options.fadeOut) {
      const duration = buffer.duration
      gainNode.gain.setValueAtTime(perSoundVolume, this.audioContext.currentTime + duration - 0.5)
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration)
    }

    source.start()

    // Clean up after playback
    source.onended = () => {
      source.disconnect()
      gainNode.disconnect()
    }
    return Promise.resolve()
  }

  private getVolumeForType(type: string): number {
    // Retained for backward compatibility; now computed from settings
    const effectiveMaster = this.isMuted ? 0 : this.masterVolume
    switch (type) {
      case 'music':
        return effectiveMaster * this.musicVolume
      case 'sound':
      case 'streak':
        return effectiveMaster * this.soundVolume
      case 'ui':
        return effectiveMaster * this.soundVolume * 0.7
      default:
        return effectiveMaster * this.soundVolume
    }
  }

  public playCorrectAnswer(streak: number): void {
    // Ensure streak is between 1-5 (correct1.mp3 to correct5.mp3)
    const streakSound = Math.max(1, Math.min(streak, 5))
    this.playSound(`correct${streakSound}`)
  }

  public playWrongAnswer(): void {
    this.playSound('wrong')
  }

  public playButtonClick(): void {
    this.playSound('button-click')
  }

  public playButtonHover(): void {
    this.playSound('button-hover')
  }

  public playPlayerJoin(): void {
    this.playSound('player-join')
  }

  public playPlayerLeave(): void {
    this.playSound('player-leave')
  }

  public playTimerWarning(): void {
    this.playSound('timer-warning')
  }

  public playTimerUrgent(): void {
    this.playSound('timer-urgent')
  }

  public playGameStart(): void {
    this.playSound('game-start')
  }

  public playGameEnd(): void {
    this.playSound('game-end')
  }

  public playQuestionStart(): void {
    this.playSound('question-start')
  }

  public playLobbyCreated(): void {
    this.playSound('lobby-created')
  }

  public playLobbyJoined(): void {
    this.playSound('lobby-joined')
  }

  public playApplause(): void {
    this.playSound('applause')
  }

  public playHighScore(): void {
    this.playSound('high-score')
  }

  public playPerfectScore(): void {
    this.playSound('perfect-score')
  }

  public playMultiplierUp(): void {
    this.playSound('multiplier-up')
  }

  public playMultiplierReset(): void {
    this.playSound('multiplier-reset')
  }

  public playScorePoints(): void {
    this.playSound('score-points')
  }

  public playScoreBonus(): void {
    this.playSound('score-bonus')
  }

  public playLobbyMusic(loop: boolean = true): void {
    this.playSound('lobby-music', { loop, fadeIn: true })
  }

  public playNotification(): void {
    this.playSound('notification')
  }

  public playSuccess(): void {
    this.playSound('success')
  }

  public playError(): void {
    this.playSound('error')
  }

  public playTick(): void {
    this.playSound('tick')
  }

  public playCountdown(): void {
    this.playSound('countdown')
  }

  public playMenuSelect(): void {
    this.playSound('menu-select')
  }

  public playMenuConfirm(): void {
    this.playSound('menu-confirm')
  }

  public playMenuCancel(): void {
    this.playSound('menu-cancel')
  }

  public playVolumeChange(): void {
    this.playSound('volume-change')
  }

  public playLanguageChange(): void {
    this.playSound('language-change')
  }

  public playThemeChange(): void {
    this.playSound('theme-change')
  }

  public stopAllSounds(): void {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
      // Recreate gain nodes and reapply settings after context reset
      const musicGain = this.audioContext.createGain()
      const soundGain = this.audioContext.createGain()
      const uiGain = this.audioContext.createGain()
      const streakGain = this.audioContext.createGain()
      this.gainNodes.set('music', musicGain)
      this.gainNodes.set('sound', soundGain)
      this.gainNodes.set('ui', uiGain)
      this.gainNodes.set('streak', streakGain)
      musicGain.connect(this.audioContext.destination)
      soundGain.connect(this.audioContext.destination)
      uiGain.connect(this.audioContext.destination)
      streakGain.connect(this.audioContext.destination)
      this.applyVolumeSettings()
    }
  }

  public resumeAudioContext(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  public isAudioSupported(): boolean {
    if (this.DISABLED) return false
    return !!(window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  }
}

// Create singleton instance
export const audioManager = new AudioManager()
