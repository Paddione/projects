/**
 * Server-side category extraction from filenames and directory names.
 * Mirrors the client-side CategoryExtractor patterns.
 */

export interface ExtractedCategories {
  age: string[];
  physical: string[];
  ethnicity: string[];
  relationship: string[];
  acts: string[];
  setting: string[];
  quality: string[];
  performer: string[];
}

const CATEGORY_PATTERNS: Record<string, string[]> = {
  age: [
    'teen', 'teenager', '18yo', '19yo', 'young', 'mature', 'milf', 'cougar', 'older',
    'granny', 'college', 'middle aged', 'babe', 'old young', 'innocent',
  ],
  physical: [
    'blonde', 'blond', 'brunette', 'redhead', 'petite', 'busty', 'big tits',
    'small tits', 'skinny', 'curvy', 'thick', 'slim', 'tall', 'short',
    'athletic', 'chubby', 'natural', 'fake', 'pierced', 'tattooed',
    'hairy', 'shaved', 'bald', 'muscular', 'fit', 'big ass', 'small ass',
    'long hair', 'short hair', 'tiny', 'beautiful', 'beauty', 'cute',
    'sexy', 'huge', 'tight', 'glasses', 'braces', 'stockings',
    'lingerie', 'latex', 'leather', 'nylon', 'pantyhose',
    'gorgeous', 'hottie', 'big cock', 'big dick',
  ],
  ethnicity: [
    'asian', 'russian', 'italian', 'british', 'japanese', 'chinese',
    'korean', 'indian', 'latina', 'ebony', 'white', 'european', 'american',
    'thai', 'vietnamese', 'filipina', 'brazilian', 'colombian', 'mexican',
    'german', 'french', 'spanish', 'czech', 'hungarian', 'african',
    'middle eastern', 'mixed', 'deutsches',
    'polish', 'swedish', 'dutch', 'turkish', 'persian', 'arab',
    'moroccan', 'puerto rican', 'australian', 'canadian',
    'ukrainian', 'romanian', 'portuguese', 'greek',
  ],
  relationship: [
    'step', 'stepsis', 'stepmom', 'stepdad', 'stepson', 'stepdaughter',
    'step-mom', 'step-dad', 'step-sister', 'step-brother', 'stepsister',
    'stepfather',
    'mom', 'dad', 'sister', 'brother', 'gf', 'girlfriend', 'wife',
    'husband', 'stranger', 'neighbor', 'boss', 'teacher', 'student',
    'babysitter', 'roommate', 'ex', 'friend', 'coworker', 'landlord',
    'couple', 'daughter', 'daddy',
    'maid', 'secretary', 'model', 'pornstar', 'nurse', 'doctor',
    'nanny', 'tutor', 'intern', 'escort', 'masseuse',
  ],
  acts: [
    'anal', 'oral', 'creampie', 'creampied', 'facial', 'dp', 'gangbang', 'threesome',
    'solo', 'masturbation', 'fingering', 'squirting', 'orgasm',
    'blowjob', 'handjob', 'footjob', 'deepthroat', 'rimming', 'bdsm',
    'bondage', 'roleplay', 'pov', 'missionary', 'doggy', 'cowgirl',
    'reverse cowgirl', 'rough', 'gentle', 'romantic', 'massage',
    'casting', 'interview', 'fuck', 'fucking', 'penetration',
    'lesbian', 'cuckold', 'orgy', 'interracial', 'bbc', 'bisexual',
    'double penetration', 'swallow', 'cum swap', 'hardcore',
    'submissive', 'compilation', 'striptease', 'strip', 'cosplay',
    'bukkake', 'bukakke',
    'riding', 'sucking', 'licking', 'choking', 'gagging', 'spanking',
    'pegging', 'fisting', 'titfuck', 'cumshot', 'piss',
    'seduce', 'cheating', 'taboo', 'caught', 'sharing', 'swap', 'bang',
  ],
  setting: [
    'hotel', 'motel', 'bedroom', 'bathroom', 'kitchen', 'office', 'outdoor',
    'car', 'public', 'beach', 'pool', 'shower', 'amateur', 'homemade',
    'studio', 'gym', 'garden', 'balcony', 'sauna', 'jacuzzi',
    'classroom', 'hospital', 'dungeon', 'yacht', 'camping', 'van',
    'dressing room', 'indoor', 'morning', 'webcam', 'cam',
    'behind the scenes',
    'school', 'party', 'couch', 'stairs', 'laundry', 'garage',
    'forest', 'park', 'spa', 'resort', 'bus', 'taxi', 'prison',
    'locker room',
  ],
  quality: ['4k', 'hd', '1080p', '720p', '480p', 'uhd', 'fhd', '8k', '2k', '60fps', 'vr', 'hdr'],
};

const COMMON_WORDS = new Set([
  'the', 'and', 'for', 'with', 'her', 'his', 'she', 'him',
  'best', 'hot', 'sex', 'fuck', 'porn', 'xxx', 'video', 'clip',
  'scene', 'new', 'old', 'performers', 'videos', 'clips',
  'xvideos', 'from', 'gets', 'got', 'this', 'that', 'was', 'not',
  'but', 'are', 'all', 'can', 'has', 'had', 'have', 'been',
  'will', 'more', 'when', 'who', 'make', 'like', 'just', 'over',
  'such', 'take', 'very', 'first', 'also', 'after', 'back',
]);

/**
 * Extract categories from a filename by matching against known patterns.
 */
export function extractCategoriesFromFilename(filename: string): ExtractedCategories {
  const normalized = filename
    .toLowerCase()
    .replace(/\.[^.]+$/, '') // remove extension
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const categories: ExtractedCategories = {
    age: [], physical: [], ethnicity: [], relationship: [],
    acts: [], setting: [], quality: [], performer: [],
  };

  for (const [type, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        const arr = categories[type as keyof ExtractedCategories];
        if (!arr.includes(pattern)) {
          arr.push(pattern);
        }
      }
    }
  }

  // Map "deutsches" → "german" for consistency
  if (categories.ethnicity.includes('deutsches')) {
    categories.ethnicity = categories.ethnicity.filter(e => e !== 'deutsches');
    if (!categories.ethnicity.includes('german')) categories.ethnicity.push('german');
  }

  // Map "old young" → "old/young" for display
  if (categories.age.includes('old young')) {
    categories.age = categories.age.filter(e => e !== 'old young');
    if (!categories.age.includes('old/young')) categories.age.push('old/young');
  }

  // Normalize variants to canonical form
  const VARIANT_MAP: Record<string, { type: keyof ExtractedCategories; canonical: string }> = {
    'blond': { type: 'physical', canonical: 'blonde' },
    'creampied': { type: 'acts', canonical: 'creampie' },
    'bukakke': { type: 'acts', canonical: 'bukkake' },
    'teenager': { type: 'age', canonical: 'teen' },
  };
  for (const [variant, { type, canonical }] of Object.entries(VARIANT_MAP)) {
    if (categories[type].includes(variant)) {
      categories[type] = categories[type].filter(e => e !== variant);
      if (!categories[type].includes(canonical)) categories[type].push(canonical);
    }
  }

  return categories;
}

/**
 * Extract categories from both the filename and directory name,
 * merging results and deduplicating.
 */
export function extractCategoriesFromPath(filename: string, dirName?: string): ExtractedCategories {
  const fromFile = extractCategoriesFromFilename(filename);

  if (!dirName) return fromFile;

  const fromDir = extractCategoriesFromFilename(dirName);

  // Merge
  const merged: ExtractedCategories = {
    age: [], physical: [], ethnicity: [], relationship: [],
    acts: [], setting: [], quality: [], performer: [],
  };

  for (const type of Object.keys(merged) as (keyof ExtractedCategories)[]) {
    merged[type] = [...new Set([...(fromFile[type] || []), ...(fromDir[type] || [])])];
  }

  return merged;
}

/**
 * Merge extracted categories with existing categories (e.g., from sidecar),
 * without overwriting existing values.
 */
export function mergeCategories(
  existing: Record<string, string[]> | ExtractedCategories,
  extracted: Record<string, string[]> | ExtractedCategories,
): ExtractedCategories {
  const result: ExtractedCategories = {
    age: [], physical: [], ethnicity: [], relationship: [],
    acts: [], setting: [], quality: [], performer: [],
  };

  for (const type of Object.keys(result) as (keyof ExtractedCategories)[]) {
    result[type] = [...new Set([
      ...(existing[type] || []),
      ...(extracted[type] || []),
    ])];
  }

  return result;
}
