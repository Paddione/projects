// Avatar Service - Manages avatar display based on user perks and character selection

export interface AvatarDefinition {
  id: string
  emoji: string
  name: string
  description: string
  source: 'character' | 'perk' // Where the avatar comes from
  unlockLevel?: number
}

// Default character avatars (always available)
const defaultCharacterAvatars: Record<string, AvatarDefinition> = {
  student: { id: 'student', emoji: '👨‍🎓', name: 'Student', description: 'Eager learner ready for challenges', source: 'character' },
  professor: { id: 'professor', emoji: '👨‍🏫', name: 'Professor', description: 'Wise and knowledgeable academic', source: 'character' },
  librarian: { id: 'librarian', emoji: '👩‍💼', name: 'Librarian', description: 'Organized keeper of knowledge', source: 'character' },
  researcher: { id: 'researcher', emoji: '👨‍🔬', name: 'Researcher', description: 'Curious explorer of new ideas', source: 'character' },
  dean: { id: 'dean', emoji: '👩‍⚖️', name: 'Dean', description: 'Distinguished academic leader', source: 'character' },
  graduate: { id: 'graduate', emoji: '🎓', name: 'Graduate', description: 'Accomplished scholar', source: 'character' },
  lab_assistant: { id: 'lab_assistant', emoji: '👨‍🔬', name: 'Lab Assistant', description: 'Hands-on experimenter', source: 'character' },
  teaching_assistant: { id: 'teaching_assistant', emoji: '👩‍🏫', name: 'Teaching Assistant', description: 'Supportive mentor and guide', source: 'character' }
}

// Perk-unlocked avatars from comprehensive perks data
const perkAvatars: Record<string, AvatarDefinition> = {
  // Basic Avatar Collection (Level 5)
  scientist: { id: 'scientist', emoji: '🔬', name: 'Scientist', description: 'Methodical researcher', source: 'perk', unlockLevel: 5 },
  explorer: { id: 'explorer', emoji: '🗺️', name: 'Explorer', description: 'Adventure seeker', source: 'perk', unlockLevel: 5 },
  artist: { id: 'artist', emoji: '🎨', name: 'Artist', description: 'Creative thinker', source: 'perk', unlockLevel: 5 },
  
  // Advanced Avatar Collection (Level 12)
  detective: { id: 'detective', emoji: '🕵️', name: 'Detective', description: 'Sharp observer', source: 'perk', unlockLevel: 12 },
  chef: { id: 'chef', emoji: '👨‍🍳', name: 'Chef', description: 'Recipe for success', source: 'perk', unlockLevel: 12 },
  astronaut: { id: 'astronaut', emoji: '👨‍🚀', name: 'Astronaut', description: 'Shoots for the stars', source: 'perk', unlockLevel: 12 },
  
  // Legendary Avatars (Level 25)
  wizard: { id: 'wizard', emoji: '🧙‍♂️', name: 'Wizard', description: 'Master of knowledge', source: 'perk', unlockLevel: 25 },
  ninja: { id: 'ninja', emoji: '🥷', name: 'Ninja', description: 'Silent but deadly accurate', source: 'perk', unlockLevel: 25 },
  dragon: { id: 'dragon', emoji: '🐉', name: 'Dragon', description: 'Mythical quiz beast', source: 'perk', unlockLevel: 25 }
}

class AvatarService {
  private unlockedAvatars: Set<string> = new Set()
  private activeAvatarOverride: string | null = null
  private userCharacter: string = 'student'

  /**
   * Initialize avatar service with user's character and unlocked avatar perks
   */
  initialize(userCharacter: string, userPerks: any[] = []): void {
    this.userCharacter = userCharacter
    
    // Always unlock default character avatars
    Object.keys(defaultCharacterAvatars).forEach(id => {
      this.unlockedAvatars.add(id)
    })

    // Check for unlocked avatar perks
    userPerks.forEach(userPerk => {
      if (userPerk.perk?.type === 'avatar' && userPerk.is_unlocked) {
        const perkName = userPerk.perk.name
        if (perkName === 'custom_avatars_basic') {
          // Unlock basic avatars
          this.unlockedAvatars.add('scientist')
          this.unlockedAvatars.add('explorer')
          this.unlockedAvatars.add('artist')
        } else if (perkName === 'custom_avatars_advanced') {
          // Unlock advanced avatars
          this.unlockedAvatars.add('detective')
          this.unlockedAvatars.add('chef')
          this.unlockedAvatars.add('astronaut')
        } else if (perkName === 'legendary_avatars') {
          // Unlock legendary avatars
          this.unlockedAvatars.add('wizard')
          this.unlockedAvatars.add('ninja')
          this.unlockedAvatars.add('dragon')
        }

        // Check if this perk is active and has a selected avatar
        if (userPerk.is_active && userPerk.configuration?.selected_avatar) {
          this.activeAvatarOverride = userPerk.configuration.selected_avatar
        }
      }
    })
  }

  /**
   * Get the avatar emoji to display for a user
   * Priority: Active avatar perk > User's character > Default
   */
  getAvatarEmoji(userCharacter?: string): string {
    // Use override if active avatar perk is set
    if (this.activeAvatarOverride) {
      const override = this.getAvatarDefinition(this.activeAvatarOverride)
      if (override) {
        return override.emoji
      }
    }

    // Use provided character or fallback to stored character
    const characterId = userCharacter || this.userCharacter
    const character = this.getAvatarDefinition(characterId)
    
    return character?.emoji ?? defaultCharacterAvatars['student']?.emoji ?? '🎓'
  }

  /**
   * Get avatar definition by ID
   */
  getAvatarDefinition(avatarId: string): AvatarDefinition | null {
    return defaultCharacterAvatars[avatarId] || perkAvatars[avatarId] || null
  }

  /**
   * Get all available avatar definitions
   */
  getAvailableAvatars(): AvatarDefinition[] {
    const avatars: AvatarDefinition[] = []
    
    // Add unlocked avatars
    for (const avatarId of this.unlockedAvatars) {
      const avatar = this.getAvatarDefinition(avatarId)
      if (avatar) {
        avatars.push(avatar)
      }
    }

    return avatars.sort((a, b) => {
      // Sort by unlock level, then by name
      const aLevel = a.unlockLevel || 0
      const bLevel = b.unlockLevel || 0
      if (aLevel !== bLevel) {
        return aLevel - bLevel
      }
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Get unlocked avatar IDs
   */
  getUnlockedAvatars(): string[] {
    return Array.from(this.unlockedAvatars)
  }

  /**
   * Check if an avatar is unlocked
   */
  isAvatarUnlocked(avatarId: string): boolean {
    return this.unlockedAvatars.has(avatarId)
  }

  /**
   * Get currently active avatar ID
   */
  getActiveAvatar(): string {
    return this.activeAvatarOverride || this.userCharacter
  }

  /**
   * Set active avatar override (when avatar perk is activated)
   */
  setActiveAvatarOverride(avatarId: string | null): void {
    this.activeAvatarOverride = avatarId
  }

  /**
   * Get avatar options for a specific perk
   */
  getAvatarOptionsForPerk(perkName: string): AvatarDefinition[] {
    const options: AvatarDefinition[] = []
    
    switch (perkName) {
      case 'custom_avatars_basic':
        options.push(
          ...['scientist', 'explorer', 'artist']
            .map(id => perkAvatars[id])
            .filter((v): v is AvatarDefinition => Boolean(v))
        )
        break
      case 'custom_avatars_advanced':
        options.push(
          ...['detective', 'chef', 'astronaut']
            .map(id => perkAvatars[id])
            .filter((v): v is AvatarDefinition => Boolean(v))
        )
        break
      case 'legendary_avatars':
        options.push(
          ...['wizard', 'ninja', 'dragon']
            .map(id => perkAvatars[id])
            .filter((v): v is AvatarDefinition => Boolean(v))
        )
        break
    }
    
    return options
  }

  /**
   * Update user's base character
   */
  updateUserCharacter(characterId: string): void {
    this.userCharacter = characterId
  }
}

// Export singleton instance
export const avatarService = new AvatarService()

// Types are already exported via interface above
