import cron from "node-cron";
import { characterDB } from "../database";
import { logger as mainLogger } from "../config";

const logger = mainLogger.createNamedLogger("Leaderboard Updater");

const CONFIG = {
  CRON_SCHEDULE: "0 */12 * * *", // Every 12 hours
  TOP_N_ACCOUNTS: 10, // Keep top 10 accounts for level 99
  TOP_N_MIRRORED: 10, // Keep top 10 mirrored items
  BATCH_SIZE: 5000, // Process characters in batches to avoid OOM
} as const;

interface AccountLevel99Entry {
  accountName: string;
  count: number;
  gameMode: string;
  season: number;
}

interface MirroredItemEntry {
  itemName: string;
  itemBaseName: string;
  count: number;
  propertiesSignature: string;
  exampleItemJson: any;
  exampleCharacterName: string;
  gameMode: string;
  season: number;
}

/**
 * Check if item has "Mirrored" property
 */
function isMirrored(item: any): boolean {
  const properties = item.properties || [];
  return properties.some(
    (prop: string) => prop && prop.toLowerCase().includes("mirrored")
  );
}

/**
 * Check if item is equipped (not in stash/inventory/switch)
 */
function isEquippedItem(item: any): boolean {
  const equipment = item.location?.equipment;
  if (!equipment) return false;

  const excluded = ["Switch", "Inventory", "Stash"];
  return !excluded.some((e) => equipment.includes(e));
}

/**
 * Create signature for mirrored item based on properties array only
 * Mirrored items should have identical properties - that's the whole point
 */
function createMirroredSignature(item: any): string {
  // Only use the properties array (sorted) to identify identical mirrored items
  const properties = (item.properties || []).filter((p: any) => p !== null);
  const sortedProperties = properties.slice().sort();
  return JSON.stringify(sortedProperties);
}

/**
 * Update level 99 account leaderboards for all seasons and game modes
 */
async function updateLevel99Leaderboards(): Promise<void> {
  logger.info("Starting level 99 account leaderboard update");

  try {
    // Get all unique season/gamemode combinations for level 99 characters
    const combinations = await characterDB.getSeasonGameModeCombinations(99);

    for (const { season, game_mode_id } of combinations) {
      await updateLevel99LeaderboardForSeasonMode(season, game_mode_id);
    }

    logger.info("Completed level 99 account leaderboard update");
  } catch (error) {
    logger.error("Error updating level 99 leaderboards", { error });
  }
}

/**
 * Update level 99 account leaderboard for a specific season and game mode
 */
async function updateLevel99LeaderboardForSeasonMode(
  season: number,
  gameModeId: number
): Promise<void> {
  // Get game mode name
  const gameMode = await characterDB.getGameModeName(gameModeId);

  logger.info(`Processing level 99 accounts for season ${season}, ${gameMode}`);

  // Query to count level 99 characters per account
  const accountCounts = await characterDB.getLevel99AccountCounts(
    season,
    gameModeId,
    CONFIG.TOP_N_ACCOUNTS
  );

  const accounts: AccountLevel99Entry[] = accountCounts.map((row) => ({
    accountName: row.account_name,
    count: row.count,
    gameMode,
    season,
  }));

  logger.info(
    `Found ${accounts.length} accounts with level 99 characters for season ${season}, ${gameMode}`
  );

  // Delete old entries for this season/gamemode
  await characterDB.deleteLevel99LeaderboardEntries(season, gameMode);

  // Insert new entries
  if (accounts.length > 0) {
    const now = Date.now();
    await characterDB.insertLevel99LeaderboardEntries(accounts, now);

    logger.info(
      `Inserted ${accounts.length} accounts for season ${season}, ${gameMode}`
    );
  }
}

/**
 * Update mirrored item leaderboards for all seasons and game modes
 */
async function updateMirroredItemLeaderboards(): Promise<void> {
  logger.info("Starting mirrored item leaderboard update");

  try {
    // Get all unique season/gamemode combinations (no level filter)
    const combinations = await characterDB.getSeasonGameModeCombinations(1);

    for (const { season, game_mode_id } of combinations) {
      await updateMirroredItemLeaderboardForSeasonMode(season, game_mode_id);
    }

    logger.info("Completed mirrored item leaderboard update");
  } catch (error) {
    logger.error("Error updating mirrored item leaderboards", { error });
  }
}

/**
 * Update mirrored item leaderboard for a specific season and game mode
 */
async function updateMirroredItemLeaderboardForSeasonMode(
  season: number,
  gameModeId: number
): Promise<void> {
  const gameMode = await characterDB.getGameModeName(gameModeId);

  logger.info(`Processing mirrored items for season ${season}, ${gameMode}`);

  // Get total count (no level filter for mirrored items)
  const totalCharacters = await characterDB.getCharacterCountForLeaderboard(
    season,
    gameModeId,
    1
  );

  logger.info(`Total characters to process: ${totalCharacters}`);

  // Track mirrored items by signature
  const mirroredItems = new Map<
    string,
    {
      count: number;
      itemName: string;
      itemBaseName: string;
      exampleItemJson: any;
      exampleCharacterName: string;
    }
  >();

  let processedCount = 0;

  for (let offset = 0; offset < totalCharacters; offset += CONFIG.BATCH_SIZE) {
    const characters = await characterDB.getCharactersForLeaderboard(
      season,
      gameModeId,
      1,
      CONFIG.BATCH_SIZE,
      offset
    );

    // Process this batch
    for (const char of characters) {
      const items = char.full_response_json?.items || [];

      for (const item of items) {
        // Only process equipped items
        if (!isEquippedItem(item)) {
          continue;
        }

        // Only process mirrored items
        if (!isMirrored(item)) {
          continue;
        }

        // Create signature
        const signature = createMirroredSignature(item);

        if (!mirroredItems.has(signature)) {
          mirroredItems.set(signature, {
            count: 0,
            itemName: item.name || "Unknown",
            itemBaseName: item.base?.name || item.name || "Unknown",
            exampleItemJson: item,
            exampleCharacterName: char.api_character_name,
          });
        }

        const entry = mirroredItems.get(signature)!;
        entry.count++;
      }
    }

    processedCount += characters.length;
    logger.info(
      `Processed ${processedCount}/${totalCharacters} characters (${Math.round((processedCount / totalCharacters) * 100)}%)`
    );

    // Help GC
    characters.length = 0;
  }

  // Sort by count and take top N
  const sortedEntries = Array.from(mirroredItems.entries())
    .map(([signature, data]) => ({
      signature,
      ...data,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, CONFIG.TOP_N_MIRRORED);

  logger.info(
    `Found ${mirroredItems.size} unique mirrored items, keeping top ${sortedEntries.length}`
  );

  // Delete old entries
  await characterDB.deleteMirroredLeaderboardEntries(season, gameMode);

  // Insert new entries
  if (sortedEntries.length > 0) {
    const entries: MirroredItemEntry[] = sortedEntries.map((entry) => ({
      itemName: entry.itemName,
      itemBaseName: entry.itemBaseName,
      count: entry.count,
      propertiesSignature: entry.signature,
      exampleItemJson: entry.exampleItemJson,
      exampleCharacterName: entry.exampleCharacterName,
      gameMode,
      season,
    }));

    const now = Date.now();
    await characterDB.insertMirroredLeaderboardEntries(entries, now);

    logger.info(
      `Inserted ${entries.length} mirrored items for season ${season}, ${gameMode}`
    );
  }
}

/**
 * Run all leaderboard updates
 */
async function updateAllLeaderboards(): Promise<void> {
  logger.info("Starting leaderboard update job");
  const startTime = Date.now();

  try {
    await updateLevel99Leaderboards();
    await updateMirroredItemLeaderboards();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Leaderboard update completed in ${duration}s`);
  } catch (error) {
    logger.error("Error in leaderboard update job", { error });
  }
}

/**
 * Start the leaderboard updater cron job
 */
export async function startLeaderboardUpdater(): Promise<void> {
  logger.info("Initializing leaderboard updater");

  updateAllLeaderboards();

  cron.schedule(CONFIG.CRON_SCHEDULE, () => {
    updateAllLeaderboards();
  });

  logger.info(`Leaderboard updater scheduled (${CONFIG.CRON_SCHEDULE})`);
}
