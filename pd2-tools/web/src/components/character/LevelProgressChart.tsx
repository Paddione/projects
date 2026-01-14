import { Card, Text, Box, useMantineTheme } from "@mantine/core";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
} from "recharts";
import type { CharacterSnapshotListItem } from "../../types";
import {
  calculatePercentToNextLevel,
  formatExperience,
} from "../../utils/experience";

interface LevelProgressChartProps {
  snapshots: CharacterSnapshotListItem[];
  currentLevel: number;
  currentExperience: number;
  lastUpdated?: number;
}

export function LevelProgressChart({
  snapshots,
  currentLevel,
  currentExperience,
  lastUpdated,
}: LevelProgressChartProps) {
  const theme = useMantineTheme();
  // Prepare chart data: combine snapshots with current data
  const chartData = [
    // Historical snapshots (oldest to newest)
    ...snapshots
      .slice()
      .reverse() // Reverse to get oldest first
      .map((snapshot) => ({
        date: new Date(snapshot.snapshot_timestamp).toLocaleDateString(),
        timestamp: snapshot.snapshot_timestamp,
        fullTimestamp: new Date(snapshot.snapshot_timestamp).toLocaleString(),
        Level: snapshot.level,
        experience: snapshot.experience,
      })),
    // Add current level as the latest data point
    ...(lastUpdated
      ? [
          {
            date: new Date(lastUpdated).toLocaleDateString(),
            timestamp: lastUpdated,
            fullTimestamp: new Date(lastUpdated).toLocaleString(),
            Level: currentLevel,
            experience: currentExperience,
          },
        ]
      : []),
  ];

  // Remove duplicate dates (keep the latest level for each date)
  const uniqueData = chartData.reduce(
    (acc, curr) => {
      const existingIndex = acc.findIndex((item) => item.date === curr.date);
      if (existingIndex !== -1) {
        // Keep the one with higher timestamp (more recent)
        if (curr.timestamp > acc[existingIndex].timestamp) {
          acc[existingIndex] = curr;
        }
      } else {
        acc.push(curr);
      }
      return acc;
    },
    [] as typeof chartData
  );

  // If only one data point, show a message instead of a chart
  if (uniqueData.length === 1) {
    return (
      <Card radius="md" shadow="md" padding="md">
        <Card.Section
          style={{
            backgroundColor: "rgb(44, 45, 50)",
            borderBottom: "1.75px solid rgb(55, 58, 64)",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          <Text fw={500}>Level History</Text>
        </Card.Section>
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No historical data yet. Level progression will appear here as this
          character is updated over time.
        </Text>
      </Card>
    );
  }

  return (
    <Card radius="md" shadow="md" padding="md">
      <Card.Section
        style={{
          backgroundColor: "rgb(44, 45, 50)",
          borderBottom: "1.75px solid rgb(55, 58, 64)",
          padding: "8px 12px",
          marginBottom: "12px",
        }}
      >
        <Text fw={500}>Level History</Text>
      </Card.Section>

      <Box
        h={300}
        style={{
          minWidth: 0,
          overflowX: "auto",
          overflowY: "hidden",
          width: "100%",
        }}
      >
        <div style={{ minWidth: 400 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={uniqueData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 25,
              }}
              isAnimationActive={false}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme.colors.dark[4]}
              />
              <XAxis
                dataKey="date"
                stroke={theme.colors.gray[6]}
                textAnchor="middle"
              />
              <YAxis
                stroke={theme.colors.gray[6]}
                domain={[
                  Math.max(1, Math.min(...uniqueData.map((d) => d.Level)) - 5),
                  Math.min(99, Math.max(...uniqueData.map((d) => d.Level)) + 2),
                ]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.colors.dark[7],
                  border: `1px solid ${theme.colors.dark[4]}`,
                }}
                labelStyle={{ color: theme.colors.gray[5] }}
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  const percent = calculatePercentToNextLevel(
                    data.Level,
                    data.experience
                  );

                  return (
                    <div
                      style={{
                        backgroundColor: theme.colors.dark[7],
                        border: `1px solid ${theme.colors.dark[4]}`,
                        borderRadius: "4px",
                        padding: "12px",
                      }}
                    >
                      <Text size="sm" fw={500} c="white">
                        {data.fullTimestamp}
                      </Text>
                      <Text size="sm" c="blue" mt={4}>
                        Level: {data.Level}
                        {data.Level === 99 && " (Max)"}
                      </Text>
                      {data.experience >= 0 && (
                        <Text size="sm">
                          Experience: {formatExperience(data.experience)}
                        </Text>
                      )}
                      {percent !== null && data.experience >= 0 && (
                        <Text size="sm">
                          Progress to {data.Level + 1}: {percent.toFixed(1)}%
                        </Text>
                      )}
                    </div>
                  );
                }}
                animationDuration={0}
              />
              <Line
                type="monotone"
                dataKey="Level"
                stroke={theme.colors.blue[5]}
                strokeWidth={2}
                dot={false}
                name="Level"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Box>
    </Card>
  );
}
