import type { VideoCategories } from '@/types/video';
import { CORRUPT_PERFORMERS } from '@shared/corrupt-performers';

const CORRUPT_PERFORMERS_SET = new Set(CORRUPT_PERFORMERS.map((p) => p.toLowerCase()));

export class CategoryExtractor {
  static readonly CATEGORY_PATTERNS = {
    age: ['teen', '18yo', '19yo', 'young', 'mature', 'milf', 'cougar', 'older'],
    physical: [
      'blonde',
      'brunette',
      'redhead',
      'petite',
      'busty',
      'big_tits',
      'small_tits',
      'skinny',
      'curvy',
      'thick',
      'slim',
      'tall',
      'short',
      'athletic',
      'chubby',
    ],
    ethnicity: [
      'asian',
      'russian',
      'italian',
      'british',
      'japanese',
      'chinese',
      'korean',
      'indian',
      'latina',
      'ebony',
      'white',
      'european',
      'american',
    ],
    relationship: [
      'step',
      'stepsis',
      'stepmom',
      'stepdad',
      'stepson',
      'stepdaughter',
      'mom',
      'dad',
      'sister',
      'brother',
      'gf',
      'girlfriend',
      'wife',
      'husband',
    ],
    acts: [
      'anal',
      'oral',
      'creampie',
      'facial',
      'dp',
      'gangbang',
      'threesome',
      'solo',
      'masturbation',
      'fingering',
      'squirting',
      'orgasm',
    ],
    setting: [
      'hotel',
      'bedroom',
      'bathroom',
      'kitchen',
      'office',
      'outdoor',
      'car',
      'public',
      'beach',
      'pool',
      'shower',
      'amateur',
      'homemade',
    ],
    quality: ['4k', 'hd', '1080p', '720p', '480p', 'uhd', 'fhd'],
    performer: [], // Will be populated dynamically from performer names
  };

  static extractCategories(filename: string): VideoCategories {
    const normalizedFilename = filename
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const categories: VideoCategories = {
      age: [],
      physical: [],
      ethnicity: [],
      relationship: [],
      acts: [],
      setting: [],
      quality: [],
      performer: [],
    };

    // Extract categories using pattern matching
    Object.entries(this.CATEGORY_PATTERNS).forEach(([type, patterns]) => {
      patterns.forEach((pattern) => {
        if (normalizedFilename.includes(pattern)) {
          const categoryArray = categories[type as keyof VideoCategories];
          if (categoryArray && !categoryArray.includes(pattern)) {
            categoryArray.push(pattern);
          }
        }
      });
    });

    // Extract potential performer names (capitalized words that might be names)
    const words = filename.split(/[^a-zA-Z]/).filter((word) => word.length > 2);
    words.forEach((word) => {
      if (
        word[0] === word[0].toUpperCase() &&
        !this.isCommonWord(word.toLowerCase()) &&
        word.length >= 3
      ) {
        const performerName = word.toLowerCase();
        if (
          !categories.performer.includes(performerName) &&
          !CORRUPT_PERFORMERS_SET.has(performerName)
        ) {
          categories.performer.push(performerName);
        }
      }
    });

    return categories;
  }

  private static isCommonWord(word: string): boolean {
    const commonWords = [
      'the',
      'and',
      'for',
      'with',
      'her',
      'his',
      'she',
      'him',
      'best',
      'hot',
      'sex',
      'fuck',
      'porn',
      'xxx',
      'video',
      'clip',
      'scene',
      'new',
      'old',
    ];
    return commonWords.includes(word);
  }

  static categorizeByType(categories: VideoCategories): { [type: string]: string[] } {
    return {
      age: categories.age,
      physical: categories.physical,
      ethnicity: categories.ethnicity,
      relationship: categories.relationship,
      acts: categories.acts,
      setting: categories.setting,
      quality: categories.quality,
      performer: categories.performer,
    };
  }
}
