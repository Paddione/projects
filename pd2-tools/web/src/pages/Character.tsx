import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Container, Skeleton, Grid } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
import { Helmet } from "react-helmet";
import { charactersAPI } from "../api";
import {
  CharacterHeader,
  EquipmentSection,
  SkillsSection,
  StatsSection,
  LevelProgressChart,
  BuildOptimizer,
} from "../components/character";
import type { PlayerToggle, SkillsView } from "../types";

interface NavContext {
  list: string[];
  currentIndex: number;
}

export default function Character() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const characterName = name;
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [playerToggle, setPlayerToggle] = useState<PlayerToggle>("player");
  const [skillsView, setSkillsView] = useState<SkillsView>("text");
  const [didError, setDidError] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(""); // empty string = current/live data

  // Get nav ID from URL params
  const navId = searchParams.get("nav");

  // Get prev/next characters from navigation context (keyed by navId)
  const { prevCharacter, nextCharacter } = useMemo(() => {
    try {
      if (!navId) return { prevCharacter: null, nextCharacter: null };

      const ctx = sessionStorage.getItem(`characterNavContext_${navId}`);
      if (!ctx) return { prevCharacter: null, nextCharacter: null };

      const parsed: NavContext = JSON.parse(ctx);
      const currentIndex = parsed.list.indexOf(characterName || "");

      // If character not in list, try using stored index
      const idx = currentIndex !== -1 ? currentIndex : parsed.currentIndex;

      return {
        prevCharacter: idx > 0 ? parsed.list[idx - 1] : null,
        nextCharacter:
          idx < parsed.list.length - 1 ? parsed.list[idx + 1] : null,
      };
    } catch {
      return { prevCharacter: null, nextCharacter: null };
    }
  }, [characterName, navId]);

  const charQuery = useQuery({
    queryKey: ["character", characterName],
    queryFn: async () => {
      try {
        const data = await charactersAPI.getCharacter(
          characterName || "",
          "softcore"
        );
        if (!data) {
          setDidError(true);
        }
        return data;
      } catch (error) {
        setDidError(true);
        throw error;
      }
    },
    retry: false,
    enabled: !!characterName,
  });

  // Fetch snapshot list for dropdown
  const snapshotsListQuery = useQuery({
    queryKey: ["character-snapshots", characterName],
    queryFn: async () => {
      try {
        return await charactersAPI.getCharacterSnapshots(
          characterName || "",
          "softcore"
        );
      } catch {
        // No snapshots yet, return empty array
        return { snapshots: [], total: 0 };
      }
    },
    retry: false,
    enabled: !!characterName,
  });

  // Fetch specific snapshot when selected
  const snapshotDataQuery = useQuery({
    queryKey: ["character-snapshot", characterName, selectedSnapshot],
    queryFn: async () => {
      if (!selectedSnapshot) return null;
      return await charactersAPI.getCharacterSnapshot(
        characterName || "",
        parseInt(selectedSnapshot, 10)
      );
    },
    retry: false,
    enabled: !!selectedSnapshot,
  });

  // Fetch build optimization analysis
  const optimizationQuery = useQuery({
    queryKey: ["character-optimization", characterName],
    queryFn: async () => {
      try {
        return await charactersAPI.analyzeCharacter(
          characterName || "",
          "softcore"
        );
      } catch (error) {
        console.error("Failed to analyze character:", error);
        return null;
      }
    },
    retry: false,
    enabled: !!characterName && !!charQuery.data, // Only run after main character data loads
  });

  // Determine which data to show (current or snapshot)
  const displayData = selectedSnapshot
    ? snapshotDataQuery.data
    : charQuery.data;

  return (
    <>
      <Helmet>
        <title>Builds - {characterName} - pd2.tools</title>
        <meta
          name="description"
          content={`View the build and complete stats of ${characterName} on Project Diablo 2`}
        />
      </Helmet>

      <Container my="md">
        {charQuery.isPending ||
        snapshotsListQuery.isPending ||
        didError ||
        !displayData ? (
          <Skeleton height="100vh">a</Skeleton>
        ) : (
          <Grid>
            <Grid.Col span={12}>
              <CharacterHeader
                characterName={displayData.character.name}
                className={displayData.character.class.name}
                level={displayData.character.level}
                lastUpdated={charQuery.data?.lastUpdated}
                isMobile={isMobile}
                prevCharacter={prevCharacter}
                nextCharacter={nextCharacter}
                accountName={charQuery.data?.accountName}
                isHardcore={charQuery.data?.character?.status?.is_hardcore}
                season={charQuery.data?.character?.season}
                snapshots={snapshotsListQuery.data?.snapshots}
                selectedSnapshot={selectedSnapshot}
                onSnapshotChange={setSelectedSnapshot}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 8 }}>
              <EquipmentSection
                playerItems={displayData?.items}
                mercenary={displayData?.mercenary}
                playerToggle={playerToggle}
                onPlayerToggleChange={setPlayerToggle}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4 }}>
              <SkillsSection
                skills={displayData.realSkills}
                hasCta={displayData.hasCta}
                skillsView={skillsView}
                onSkillsViewChange={setSkillsView}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 12 }}>
              <StatsSection
                attributes={displayData.character.attributes}
                stats={displayData.character}
                realStats={displayData.realStats}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 12 }}>
              <LevelProgressChart
                snapshots={snapshotsListQuery.data?.snapshots || []}
                currentLevel={charQuery.data?.character?.level || 0}
                currentExperience={charQuery.data?.character?.experience || 0}
                lastUpdated={charQuery.data?.lastUpdated}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 12 }}>
              <BuildOptimizer
                optimization={optimizationQuery.data}
                isLoading={optimizationQuery.isPending}
                error={
                  optimizationQuery.isError
                    ? "Failed to analyze character build"
                    : null
                }
                onRefresh={() => optimizationQuery.refetch()}
              />
            </Grid.Col>
          </Grid>
        )}
      </Container>
    </>
  );
}
