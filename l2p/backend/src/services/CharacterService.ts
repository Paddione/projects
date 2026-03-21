import { UserRepository, User } from '../repositories/UserRepository.js';
import { PerksManager, UserPerk } from './PerksManager.js';
import { GameProfileService, GameProfile } from './GameProfileService.js';
import { DatabaseService } from './DatabaseService.js';
import { PerkQueryService } from './PerkQueryService.js';
import { authFetch, authFetchInternal, fetchUserProfile } from '../config/authClient.js';

export interface Character {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlockLevel: number;
}

export interface ExperienceLevel {
  level: number;
  experienceRequired: number;
  experienceTotal: number;
}

export interface CharacterUpdateData {
  selectedCharacter: string;
}

export interface ExperienceAwardData {
  userId: number;
  experiencePoints: number;
}

export class CharacterService {
  private userRepository: UserRepository;
  private perksManager: PerksManager;
  private gameProfileService: GameProfileService;
  private db: DatabaseService;

  // University-themed characters
  private readonly characters: Character[] = [
    {
      id: 'professor',
      name: 'Professor',
      emoji: '👨‍🏫',
      description: 'Wise and knowledgeable academic',
      unlockLevel: 1
    },
    {
      id: 'student',
      name: 'Student',
      emoji: '👨‍🎓',
      description: 'Eager learner ready for challenges',
      unlockLevel: 1
    },
    {
      id: 'librarian',
      name: 'Librarian',
      emoji: '👩‍💼',
      description: 'Organized keeper of knowledge',
      unlockLevel: 1
    },
    {
      id: 'researcher',
      name: 'Researcher',
      emoji: '👨‍🔬',
      description: 'Curious explorer of new ideas',
      unlockLevel: 1
    },
    {
      id: 'dean',
      name: 'Dean',
      emoji: '👩‍⚖️',
      description: 'Distinguished academic leader',
      unlockLevel: 1
    },
    {
      id: 'graduate',
      name: 'Graduate',
      emoji: '🎓',
      description: 'Accomplished scholar',
      unlockLevel: 1
    },
    {
      id: 'lab_assistant',
      name: 'Lab Assistant',
      emoji: '👨‍🔬',
      description: 'Hands-on experimenter',
      unlockLevel: 1
    },
    {
      id: 'teaching_assistant',
      name: 'Teaching Assistant',
      emoji: '👩‍🏫',
      description: 'Supportive mentor and guide',
      unlockLevel: 1
    }
  ];

  constructor() {
    this.userRepository = new UserRepository();
    this.perksManager = PerksManager.getInstance();
    this.gameProfileService = new GameProfileService();
    this.db = DatabaseService.getInstance();
  }

  /**
   * Get all available characters
   */
  getAllCharacters(): Character[] {
    return this.characters;
  }

  /**
   * Get character by ID
   */
  getCharacterById(characterId: string): Character | null {
    return this.characters.find(char => char.id === characterId) || null;
  }

  /**
   * Get available characters for a user based on their level
   */
  getAvailableCharacters(userLevel: number): Character[] {
    return this.characters.filter(char => char.unlockLevel <= userLevel);
  }

  /**
   * Get all characters annotated with ownership state.
   * Student is always owned. Others require inventory entry.
   */
  getCharactersWithOwnership(ownedCharacterIds: string[] = []): (Character & { owned: boolean; respectCost: number })[] {
    return this.characters.map(char => ({
      ...char,
      owned: char.id === 'student' || ownedCharacterIds.includes(char.id),
      respectCost: char.id === 'student' ? 0 : 500,
    }));
  }

  /**
   * Calculate experience required for a specific level
   */
  calculateLevelExperience(level: number): number {
    // Progressive scaling: early levels easier, later levels harder
    const baseExperience = 500;
    const scalingFactor = 1.8;
    return Math.floor(baseExperience * Math.pow(level, scalingFactor));
  }

  /**
   * Calculate total experience needed for a specific level
   */
  getTotalExperienceForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i <= level; i++) {
      total += this.calculateLevelExperience(i);
    }
    return total;
  }

  /**
   * Calculate current level based on experience points
   */
  calculateLevel(experiencePoints: number): number {
    let level = 1;
    let totalExpForLevel = 0;
    
    while (level <= 100) { // Max level 100
      const expForNextLevel = this.calculateLevelExperience(level);
      if (totalExpForLevel + expForNextLevel > experiencePoints) {
        break;
      }
      totalExpForLevel += expForNextLevel;
      level++;
    }
    
    return Math.min(level, 100);
  }

  /**
   * Calculate experience progress within current level
   */
  calculateLevelProgress(experiencePoints: number): { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number } {
    const currentLevel = this.calculateLevel(experiencePoints);
    const totalExpForCurrentLevel = this.getTotalExperienceForLevel(currentLevel - 1);
    const expInLevel = experiencePoints - totalExpForCurrentLevel;
    const expForNextLevel = this.calculateLevelExperience(currentLevel);
    const progress = Math.min((expInLevel / expForNextLevel) * 100, 100);

    return {
      currentLevel,
      progress,
      expInLevel,
      expForNextLevel
    };
  }

  /**
   * Update user's selected character
   * Supports both OAuth users (game profiles) and legacy users
   */
  async updateCharacter(userId: number, characterId: string, authToken?: string): Promise<User | GameProfile | null> {
    // Validate character exists
    const character = this.getCharacterById(characterId);
    if (!character) {
      throw new Error('Invalid character ID');
    }

    // Try auth service first if token is available
    if (authToken) {
      try {
        const res = await authFetch('/api/profile/character', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ character: characterId, gender: 'male' }),
        });
        if (res.ok) {
          const profile = await res.json();
          const selectedChar = profile.selectedCharacter || profile.selected_character || characterId;
          const level = profile.level || profile.character_level || 1;
          const xp = profile.xpTotal || profile.experience_points || 0;
          // Return in GameProfile shape so callers handle it uniformly
          return {
            authUserId: userId,
            selectedCharacter: selectedChar,
            characterLevel: level,
            experiencePoints: xp,
            preferences: profile.preferences || {},
            createdAt: profile.createdAt || new Date(),
            updatedAt: profile.updatedAt || new Date(),
          } as GameProfile;
        }
      } catch (error) {
        console.warn('[CharacterService] Auth service unreachable for character update, falling back to local DB');
      }
    }

    // Try to update game profile first (OAuth users)
    try {
      const profile = await this.gameProfileService.getOrCreateProfile(userId);

      // Auth service is unreachable — only student is safe to select
      if (characterId !== 'student') {
        throw new Error('Cannot verify character ownership');
      }

      // Update profile with new character
      const updateQuery = `
        UPDATE user_game_profiles
        SET selected_character = $1, updated_at = CURRENT_TIMESTAMP
        WHERE auth_user_id = $2
        RETURNING *
      `;
      const result = await this.db.query(updateQuery, [characterId, userId]);

      if (!result.rows[0]) {
        throw new Error('Failed to update character');
      }

      return {
        authUserId: result.rows[0]['auth_user_id'],
        selectedCharacter: result.rows[0]['selected_character'],
        characterLevel: result.rows[0]['character_level'],
        experiencePoints: result.rows[0]['experience_points'],
        preferences: result.rows[0]['preferences'],
        createdAt: result.rows[0]['created_at'],
        updatedAt: result.rows[0]['updated_at']
      };
    } catch (error) {
      // Fall back to legacy user repository
      const user = await this.userRepository.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Auth service is unreachable — only student is safe to select
      if (characterId !== 'student') {
        throw new Error('Cannot verify character ownership');
      }

      // Update user's selected character
      return await this.userRepository.updateUser(userId, {
        selected_character: characterId
      });
    }
  }

  /**
   * Award experience points to a user
   * Supports both OAuth users (game profiles) and legacy users
   */
  async awardExperience(userId: number, experiencePoints: number, useInternalApi: boolean = false): Promise<{
    user: User | GameProfile;
    levelUp: boolean;
    newLevel: number;
    oldLevel: number;
    progress: { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number };
    newlyUnlockedPerks: any[];
    pendingDrafts: any[];
  }> {
    // Try auth service internal endpoint first (server-side calls)
    if (useInternalApi) {
      try {
        const res = await authFetchInternal('/api/internal/xp/award', {
          method: 'POST',
          body: JSON.stringify({ userId, amount: experiencePoints }),
        });
        if (res.ok) {
          const profile = await res.json();
          const oldLevel = profile.oldLevel || profile.old_level || 1;
          const newLevel = profile.level || profile.character_level || profile.newLevel || 1;
          const xp = profile.xpTotal || profile.experience_points || 0;
          const levelUp = newLevel > oldLevel;
          const progress = this.calculateLevelProgress(xp);

          let newlyUnlockedPerks: any[] = [];
          const pendingDrafts: any[] = [];
          if (levelUp) {
            try {
              const perkQueryService = PerkQueryService.getInstance();
              newlyUnlockedPerks = await perkQueryService.getNewlyUnlockedPerks(oldLevel, newLevel);
            } catch (error) {
              console.warn('[CharacterService] Failed to get newly unlocked perks after auth XP award:', error);
            }
          }

          return {
            user: {
              authUserId: userId,
              selectedCharacter: profile.selectedCharacter || profile.selected_character || 'student',
              characterLevel: newLevel,
              experiencePoints: xp,
              preferences: profile.preferences || {},
              createdAt: profile.createdAt || new Date(),
              updatedAt: profile.updatedAt || new Date(),
            } as GameProfile,
            levelUp,
            newLevel,
            oldLevel,
            progress,
            newlyUnlockedPerks,
            pendingDrafts,
          };
        }
      } catch (error) {
        console.warn('[CharacterService] Auth service unreachable for XP award, falling back to local DB');
      }
    }

    // Try to update game profile first (OAuth users)
    try {
      const profile = await this.gameProfileService.getOrCreateProfile(userId);

      const oldLevel = profile.characterLevel;
      const newExperiencePoints = profile.experiencePoints + experiencePoints;
      const newLevel = this.calculateLevel(newExperiencePoints);
      const levelUp = newLevel > oldLevel;

      // Update profile
      const updateQuery = `
        UPDATE user_game_profiles
        SET experience_points = $1, character_level = $2, updated_at = CURRENT_TIMESTAMP
        WHERE auth_user_id = $3
        RETURNING *
      `;
      const result = await this.db.query(updateQuery, [newExperiencePoints, newLevel, userId]);

      // Sync users table so admin panel shows correct values
      try {
        await this.db.query(
          'UPDATE users SET experience_points = $1, character_level = $2 WHERE id = $3',
          [newExperiencePoints, newLevel, userId]
        );
      } catch (syncError) {
        console.warn('[CharacterService] Failed to sync users table:', syncError);
      }

      if (!result.rows[0]) {
        throw new Error('Failed to update experience');
      }

      const updatedProfile: GameProfile = {
        authUserId: result.rows[0]['auth_user_id'],
        selectedCharacter: result.rows[0]['selected_character'],
        characterLevel: result.rows[0]['character_level'],
        experiencePoints: result.rows[0]['experience_points'],
        preferences: result.rows[0]['preferences'],
        createdAt: result.rows[0]['created_at'],
        updatedAt: result.rows[0]['updated_at']
      };

      const progress = this.calculateLevelProgress(newExperiencePoints);

      // Return newly unlocked gameplay perks (level-based, no drafts)
      let newlyUnlockedPerks: any[] = [];
      let pendingDrafts: any[] = []; // Keep empty array for backward compat
      if (levelUp) {
        try {
          const perkQueryService = PerkQueryService.getInstance();
          newlyUnlockedPerks = await perkQueryService.getNewlyUnlockedPerks(oldLevel, newLevel);
        } catch (error) {
          console.warn('Failed to get newly unlocked perks:', error);
        }
      }

      return {
        user: updatedProfile,
        levelUp,
        newLevel,
        oldLevel,
        progress,
        newlyUnlockedPerks,
        pendingDrafts,
      };
    } catch (error) {
      // Fall back to legacy user repository
      const user = await this.userRepository.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldLevel = user.character_level;
      const newExperiencePoints = user.experience_points + experiencePoints;
      const newLevel = this.calculateLevel(newExperiencePoints);
      const levelUp = newLevel > oldLevel;

      // Update user's experience points and level
      const updatedUser = await this.userRepository.updateUser(userId, {
        experience_points: newExperiencePoints,
        character_level: newLevel
      });

      if (!updatedUser) {
        throw new Error('Failed to update user experience');
      }

      const progress = this.calculateLevelProgress(newExperiencePoints);

      // Return newly unlocked gameplay perks (level-based, no drafts)
      let newlyUnlockedPerks: any[] = [];
      let pendingDrafts: any[] = []; // Keep empty array for backward compat
      if (levelUp) {
        try {
          const perkQueryService = PerkQueryService.getInstance();
          newlyUnlockedPerks = await perkQueryService.getNewlyUnlockedPerks(oldLevel, newLevel);
        } catch (error) {
          console.warn('Failed to get newly unlocked perks:', error);
        }
      }

      return {
        user: updatedUser,
        levelUp,
        newLevel,
        oldLevel,
        progress,
        newlyUnlockedPerks,
        pendingDrafts,
      };
    }
  }

  /**
   * Get user's character information including level and progress
   * Supports both OAuth users (game profiles) and legacy users
   */
  async getUserCharacterInfo(userId: number, authToken?: string): Promise<{
    character: Character;
    level: number;
    experience: number;
    progress: { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number };
    availableCharacters: Character[];
  } | null> {
    console.log('[CharacterService] getUserCharacterInfo called for userId:', userId);

    // Try auth service first if token is available
    if (authToken) {
      try {
        const profile = await fetchUserProfile(authToken);
        if (profile) {
          const level = profile.level || profile.character_level || 1;
          const xp = profile.xpTotal || profile.experience_points || 0;
          const selectedChar = profile.selectedCharacter || profile.selected_character || 'student';
          const character = this.getCharacterById(selectedChar);

          if (character) {
            const progress = this.calculateLevelProgress(xp);
            const availableCharacters = this.getAvailableCharacters(level);

            console.log('[CharacterService] Resolved character info from auth service for userId:', userId);
            return {
              character,
              level,
              experience: xp,
              progress,
              availableCharacters,
            };
          }
        }
      } catch (error) {
        console.warn('[CharacterService] Auth service unreachable for profile fetch, falling back to local DB');
      }
    }

    // Try to get game profile first (OAuth users)
    try {
      console.log('[CharacterService] Attempting to get game profile for userId:', userId);
      const profile = await this.gameProfileService.getOrCreateProfile(userId);
      console.log('[CharacterService] Game profile retrieved:', { authUserId: profile.authUserId, selectedCharacter: profile.selectedCharacter });

      const character = this.getCharacterById(profile.selectedCharacter);
      if (!character) {
        console.error('[CharacterService] Character not found for ID:', profile.selectedCharacter);
        return null;
      }

      const progress = this.calculateLevelProgress(profile.experiencePoints);
      const availableCharacters = this.getAvailableCharacters(profile.characterLevel);

      return {
        character,
        level: profile.characterLevel,
        experience: profile.experiencePoints,
        progress,
        availableCharacters
      };
    } catch (error) {
      console.error('[CharacterService] Error getting game profile, falling back to legacy user:', error);

      // Fall back to legacy user repository
      const user = await this.userRepository.findUserById(userId);
      console.log('[CharacterService] Legacy user lookup result:', user ? `found userId ${user.id}` : 'not found');

      if (!user) {
        return null;
      }

      const character = this.getCharacterById(user.selected_character);
      if (!character) {
        console.error('[CharacterService] Character not found for legacy user:', user.selected_character);
        return null;
      }

      const progress = this.calculateLevelProgress(user.experience_points);
      const availableCharacters = this.getAvailableCharacters(user.character_level);

      return {
        character,
        level: user.character_level,
        experience: user.experience_points,
        progress,
        availableCharacters
      };
    }
  }

  /**
   * Validate character ID
   */
  isValidCharacter(characterId: string): boolean {
    return this.characters.some(char => char.id === characterId);
  }
} 
