import CharacterDB_Postgres from "./postgres/index";
import { EconomyDB } from "./postgres/economy";

// Export database instances
export const characterDB = new CharacterDB_Postgres();
export const economyDB = new EconomyDB();

// Export types
export * from "./postgres/index";
export * from "./postgres/economy";

// Graceful shutdown
export async function closeAllDatabases(): Promise<void> {
  await Promise.all([characterDB.close(), economyDB.close()]);
}
