type VoiceCache = { [lang: string]: SpeechSynthesisVoice | null }

class TtsService {
  private voiceCache: VoiceCache = {}

  constructor() {
    if (this.isSupported()) {
      speechSynthesis.addEventListener?.('voiceschanged', () => {
        this.voiceCache = {}
      })
    }
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  private getBestVoice(lang: string): SpeechSynthesisVoice | null {
    if (this.voiceCache[lang] !== undefined) {
      return this.voiceCache[lang]
    }

    const voices = speechSynthesis.getVoices()
    if (voices.length === 0) {
      return null
    }

    const preferredLocale: Record<string, string> = {
      en: 'en-US',
      de: 'de-DE',
    }
    const locale = preferredLocale[lang] || lang

    let best = voices.find(v => v.lang === locale && v.localService) || null
    if (!best) best = voices.find(v => v.lang === locale) || null
    if (!best) best = voices.find(v => v.lang.startsWith(lang) && v.localService) || null
    if (!best) best = voices.find(v => v.lang.startsWith(lang)) || null

    this.voiceCache[lang] = best
    return best
  }

  speak(text: string, lang: string = 'de', onStart?: () => void, onEnd?: () => void): void {
    if (!this.isSupported() || !text) return

    this.stop()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'de' ? 'de-DE' : 'en-US'

    const voice = this.getBestVoice(lang)
    if (voice) {
      utterance.voice = voice
    }

    if (onStart) utterance.onstart = onStart
    if (onEnd) {
      utterance.onend = onEnd
      utterance.onerror = onEnd
    }

    speechSynthesis.speak(utterance)
  }

  stop(): void {
    if (this.isSupported()) {
      speechSynthesis.cancel()
    }
  }

  isSpeaking(): boolean {
    return this.isSupported() && speechSynthesis.speaking
  }
}

export const ttsService = new TtsService()
