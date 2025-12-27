import { UserRepository, User } from '../repositories/UserRepository.js';
import { PerksManager, UserPerk } from './PerksManager.js';

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

  // University-themed characters
  private readonly characters: Character[] = [
    { 
      id: 'professor', 
      name: 'Professor', 
      emoji: '👨‍🏫',
      description: 'Wise and knowledgeable academic',
      unlockLevel: 10
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
      unlockLevel: 20
    },
    { 
      id: 'researcher', 
      name: 'Researcher', 
      emoji: '👨‍🔬',
      description: 'Curious explorer of new ideas',
      unlockLevel: 30
    },
    { 
      id: 'dean', 
      name: 'Dean', 
      emoji: '👩‍⚖️',
      description: 'Distinguished academic leader',
      unlockLevel: 40
    },
    { 
      id: 'graduate', 
      name: 'Graduate', 
      emoji: '🎓',
      description: 'Accomplished scholar',
      unlockLevel: 50
    },
    { 
      id: 'lab_assistant', 
      name: 'Lab Assistant', 
      emoji: '👨‍🔬',
      description: 'Hands-on experimenter',
      unlockLevel: 60
    },
    { 
      id: 'teaching_assistant', 
      name: 'Teaching Assistant', 
      emoji: '👩‍🏫',
      description: 'Supportive mentor and guide',
      unlockLevel: 70
    }
  ];

  constructor() {
    this.userRepository = new UserRepository();
    this.perksManager = PerksManager.getInstance();
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
   */
  async updateCharacter(userId: number, characterId: string): Promise<User | null> {
    // Validate character exists
    const character = this.getCharacterById(characterId);
    if (!character) {
      throw new Error('Invalid character ID');
    }

    // Get user to check their level
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if character is unlocked for user's level
    if (character.unlockLevel > user.character_level) {
      throw new Error(`Character requires level ${character.unlockLevel} to unlock`);
    }

    // Update user's selected character
    return await this.userRepository.updateUser(userId, {
      selected_character: characterId
    });
  }

  /**
   * Award experience points to a user
   */
  async awardExperience(userId: number, experiencePoints: number): Promise<{ 
    user: User; 
    levelUp: boolean; 
    newLevel: number; 
    oldLevel: number;
    progress: { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number };
    newlyUnlockedPerks: UserPerk[];
  }> {
    // Get current user data
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

    // Check for newly unlocked perks if user leveled up
    let newlyUnlockedPerks: UserPerk[] = [];
    if (levelUp) {
      try {
        newlyUnlockedPerks = await this.perksManager.checkAndUnlockPerksForLevel(userId, newLevel);
      } catch (error) {
        console.warn('Failed to unlock perks for user level up:', error);
        newlyUnlockedPerks = [];
      }
    }

    return {
      user: updatedUser,
      levelUp,
      newLevel,
      oldLevel,
      progress,
      newlyUnlockedPerks
    };
  }

  /**
   * Get user's character information including level and progress
   */
  async getUserCharacterInfo(userId: number): Promise<{
    character: Character;
    level: number;
    experience: number;
    progress: { currentLevel: number; progress: number; expInLevel: number; expForNextLevel: number };
    availableCharacters: Character[];
  } | null> {
    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      return null;
    }

    const character = this.getCharacterById(user.selected_character);
    if (!character) {
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

  /**
   * Validate character ID
   */
  isValidCharacter(characterId: string): boolean {
    return this.characters.some(char => char.id === characterId);
  }
} 
