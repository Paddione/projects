// Theme Service - Handles dynamic theme switching based on user perks
export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  name: string
  gradient?: boolean
  stars?: boolean
  texture?: boolean
}

export interface ThemeDefinition {
  id: string
  name: string
  colors: ThemeColors
  effects?: {
    gradient?: boolean
    stars?: boolean
    texture?: boolean
  }
}

// Default themes available to all users
const defaultThemes: Record<string, ThemeDefinition> = {
  default: {
    id: 'default',
    name: 'Default',
    colors: {
      primary: '#2563eb',
      secondary: '#64748b', 
      accent: '#3b82f6',
      name: 'Default Blue'
    }
  },
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    colors: {
      primary: '#1f2937',
      secondary: '#4b5563',
      accent: '#6b7280',
      name: 'Dark Gray'
    }
  }
}

// Perk-unlocked themes from comprehensive perks data
const perkThemes: Record<string, ThemeDefinition> = {
  // Basic themes (Level 10)
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      primary: '#0ea5e9',
      secondary: '#0284c7',
      accent: '#38bdf8',
      name: 'Ocean Blue'
    }
  },
  forest: {
    id: 'forest',
    name: 'Forest Green',
    colors: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#34d399',
      name: 'Forest Green'
    }
  },
  sunset: {
    id: 'sunset',
    name: 'Golden Sunset',
    colors: {
      primary: '#f59e0b',
      secondary: '#d97706',
      accent: '#fbbf24',
      name: 'Golden Sunset'
    }
  },
  
  // Advanced themes (Level 18)
  neon: {
    id: 'neon',
    name: 'Neon Purple',
    colors: {
      primary: '#a855f7',
      secondary: '#9333ea',
      accent: '#c084fc',
      name: 'Neon Purple',
      gradient: true
    },
    effects: { gradient: true }
  },
  galaxy: {
    id: 'galaxy',
    name: 'Galaxy Dark',
    colors: {
      primary: '#1e1b4b',
      secondary: '#312e81',
      accent: '#6366f1',
      name: 'Galaxy Dark',
      stars: true
    },
    effects: { stars: true }
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage Brown',
    colors: {
      primary: '#92400e',
      secondary: '#78350f',
      accent: '#d97706',
      name: 'Vintage Brown',
      texture: true
    },
    effects: { texture: true }
  }
}

class ThemeService {
  private currentTheme: string = 'default'
  private unlockedThemes: Set<string> = new Set(['default', 'dark'])

  /**
   * Initialize theme service with user's unlocked themes
   */
  initialize(userPerks: any[] = []): void {
    // Add default themes
    this.unlockedThemes.add('default')
    this.unlockedThemes.add('dark')

    // Check for unlocked theme perks
    userPerks.forEach(userPerk => {
      if (userPerk.perk?.type === 'theme' && userPerk.is_unlocked) {
        const perkName = userPerk.perk.name
        if (perkName === 'ui_themes_basic') {
          // Unlock basic themes
          this.unlockedThemes.add('ocean')
          this.unlockedThemes.add('forest')
          this.unlockedThemes.add('sunset')
        } else if (perkName === 'ui_themes_advanced') {
          // Unlock advanced themes
          this.unlockedThemes.add('neon')
          this.unlockedThemes.add('galaxy')
          this.unlockedThemes.add('vintage')
        }
      }
    })

    // Set active theme from user's configuration or perks
    const activeThemeUserPerk = userPerks.find(up => 
      up.perk?.type === 'theme' && up.is_active && up.configuration?.theme_name
    )
    
    if (activeThemeUserPerk) {
      this.setTheme(activeThemeUserPerk.configuration.theme_name)
    } else {
      // Check localStorage for saved theme
      const savedTheme = localStorage.getItem('l2p-theme')
      if (savedTheme && this.isThemeUnlocked(savedTheme)) {
        this.setTheme(savedTheme)
      }
    }
  }

  /**
   * Get all available theme definitions
   */
  getAvailableThemes(): ThemeDefinition[] {
    const themes: ThemeDefinition[] = []
    
    // Add default themes
    Object.values(defaultThemes).forEach(theme => {
      themes.push(theme)
    })

    // Add unlocked perk themes
    Object.values(perkThemes).forEach(theme => {
      if (this.unlockedThemes.has(theme.id)) {
        themes.push(theme)
      }
    })

    return themes.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Get unlocked theme IDs
   */
  getUnlockedThemes(): string[] {
    return Array.from(this.unlockedThemes)
  }

  /**
   * Check if a theme is unlocked
   */
  isThemeUnlocked(themeId: string): boolean {
    return this.unlockedThemes.has(themeId)
  }

  /**
   * Get current active theme
   */
  getCurrentTheme(): string {
    return this.currentTheme
  }

  /**
   * Set active theme
   */
  setTheme(themeId: string): boolean {
    if (!this.isThemeUnlocked(themeId)) {
      console.warn(`Theme ${themeId} is not unlocked`)
      return false
    }

    const theme = this.getThemeDefinition(themeId)
    if (!theme) {
      console.error(`Theme ${themeId} not found`)
      return false
    }

    this.currentTheme = themeId
    this.applyTheme(theme)
    
    // Save to localStorage
    localStorage.setItem('l2p-theme', themeId)
    
    return true
  }

  /**
   * Get theme definition by ID
   */
  getThemeDefinition(themeId: string): ThemeDefinition | null {
    return defaultThemes[themeId] || perkThemes[themeId] || null
  }

  /**
   * Apply theme to document CSS variables
   */
  private applyTheme(theme: ThemeDefinition): void {
    const root = document.documentElement
    
    // Apply color variables
    root.style.setProperty('--primary-color', theme.colors.primary)
    root.style.setProperty('--primary-hover', this.darkenColor(theme.colors.primary, 10))
    root.style.setProperty('--secondary-color', theme.colors.secondary)
    root.style.setProperty('--color-primary', theme.colors.primary)
    root.style.setProperty('--color-accent', theme.colors.accent)
    
    // Apply compatibility aliases
    root.style.setProperty('--color-primary-dark', this.darkenColor(theme.colors.primary, 10))
    root.style.setProperty('--color-primary-light', this.lightenColor(theme.colors.primary, 90))

    // Apply special effects
    this.applyThemeEffects(theme)
    
    // Dispatch theme change event
    window.dispatchEvent(new CustomEvent('theme-changed', { 
      detail: { themeId: theme.id, theme } 
    }))
  }

  /**
   * Apply special theme effects
   */
  private applyThemeEffects(theme: ThemeDefinition): void {
    const body = document.body
    
    // Remove existing theme effect classes
    body.classList.remove('theme-gradient', 'theme-stars', 'theme-texture')
    
    // Add new effect classes based on theme
    if (theme.effects?.gradient) {
      body.classList.add('theme-gradient')
    }
    if (theme.effects?.stars) {
      body.classList.add('theme-stars')
    }
    if (theme.effects?.texture) {
      body.classList.add('theme-texture')
    }
  }

  /**
   * Darken a hex color by a percentage
   */
  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) - amt
    const G = (num >> 8 & 0x00FF) - amt
    const B = (num & 0x0000FF) - amt
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
  }

  /**
   * Lighten a hex color by a percentage (for light variants)
   */
  private lightenColor(hex: string, percent: number): string {
    const color = hex.replace('#', '')
    const num = parseInt(color, 16)
    const r = (num >> 16) + Math.round((255 - (num >> 16)) * percent / 100)
    const g = ((num >> 8) & 0x00FF) + Math.round((255 - ((num >> 8) & 0x00FF)) * percent / 100)
    const b = (num & 0x0000FF) + Math.round((255 - (num & 0x0000FF)) * percent / 100)
    
    const alpha = percent / 100
    return `rgba(${Math.min(r, 255)}, ${Math.min(g, 255)}, ${Math.min(b, 255)}, ${alpha})`
  }

  /**
   * Reset to default theme
   */
  resetToDefault(): void {
    this.setTheme('default')
  }
}

// Export singleton instance
export const themeService = new ThemeService()

// Types are already exported via interface above
