import { useState, useEffect } from "react";
import { statisticsAPI, charactersAPI } from "../api";
import type { NavbarStats } from "../types";

const CACHE_KEY = "pd2tools_navbar_stats";
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CachedNavbarStats {
  players: number | null;
  characters: number | null;
  timestamp: number;
}

function getCachedStats(): CachedNavbarStats | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function setCachedStats(players: number | null, characters: number | null) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ players, characters, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

export function useNavbarStats() {
  const cached = getCachedStats();
  const [stats, setStats] = useState<NavbarStats>({
    players: cached?.players ?? null,
    // If we have cached data, assume server is online initially to avoid grey flicker
    serverOnline: cached ? true : null,
    characters: cached?.characters ?? null,
  });

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      const cached = getCachedStats();
      const now = Date.now();

      // Use cached values if fresh enough (but still fetch server status)
      const useCache = cached && now - cached.timestamp < CACHE_DURATION_MS;

      try {
        // Always fetch server status (it's quick and should be real-time)
        // Only fetch players/characters if cache is stale
        const fetchPromises: Promise<any>[] = [statisticsAPI.healthCheck()];

        if (!useCache) {
          fetchPromises.push(
            statisticsAPI.getOnlinePlayersLast(),
            charactersAPI.getCharacterCounts()
          );
        }

        const results = await Promise.allSettled(fetchPromises);

        if (!mounted) return;

        const serverData = results[0];
        const serverOnline =
          serverData.status === "fulfilled" && serverData.value.status === "ok";

        if (useCache) {
          // Use cached values for players/characters
          setStats({
            players: cached.players,
            serverOnline,
            characters: cached.characters,
          });
        } else {
          // Parse fresh data
          const playersData = results[1];
          const charData = results[2];

          let players: number | null = null;
          if (playersData?.status === "fulfilled") {
            const data = playersData.value;
            if (
              Array.isArray(data) &&
              data.length > 0 &&
              typeof data[0].num_online_players === "number"
            ) {
              players = data[0].num_online_players;
            } else if (
              typeof data === "object" &&
              data !== null &&
              "num_online_players" in data &&
              typeof data.num_online_players === "number"
            ) {
              players = data.num_online_players;
            }
          }

          let characters: number | null = null;
          if (charData?.status === "fulfilled") {
            const counts = charData.value;
            if (
              typeof counts.hardcore === "number" &&
              typeof counts.softcore === "number"
            ) {
              characters = counts.hardcore + counts.softcore;
            }
          }

          // Cache the new values
          setCachedStats(players, characters);

          setStats({ players, serverOnline, characters });
        }
      } catch (error) {
        console.error("Failed to fetch navbar stats:", error);
        if (mounted) {
          setStats((prev) => ({ ...prev, serverOnline: false }));
        }
      }
    }

    fetchStats();

    return () => {
      mounted = false;
    };
  }, []);

  return stats;
}
