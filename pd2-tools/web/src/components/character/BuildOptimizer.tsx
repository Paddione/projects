import {
  Paper,
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Progress,
  Alert,
  Card,
  Grid,
  Divider,
  List,
  ThemeIcon,
  Accordion,
  Loader,
  Button,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconChevronUp,
  IconFlame,
  IconSnowflake,
  IconBolt,
  IconDroplet,
  IconSword,
  IconWand,
  IconShield,
  IconTrendingUp,
  IconTrendingDown,
  IconTarget,
} from "@tabler/icons-react";
import type {
  BuildOptimization,
  Recommendation,
  ResistanceAnalysis,
} from "../../types";

interface BuildOptimizerProps {
  optimization: BuildOptimization | null;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

export function BuildOptimizer({
  optimization,
  isLoading,
  error,
  onRefresh,
}: BuildOptimizerProps) {
  if (isLoading) {
    return (
      <Paper p="md" withBorder>
        <Group>
          <Loader size="sm" />
          <Text>Analyzing your build...</Text>
        </Group>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert
        color="red"
        title="Analysis Failed"
        icon={<IconAlertCircle size={16} />}
      >
        {error}
        {onRefresh && (
          <Button mt="sm" size="xs" onClick={onRefresh}>
            Try Again
          </Button>
        )}
      </Alert>
    );
  }

  if (!optimization) {
    return null;
  }

  return (
    <Stack>
      {/* Overall Score */}
      <Paper p="lg" withBorder>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Build Optimization Score</Title>
            <Text size="sm" c="dimmed">
              Level {optimization.level} {optimization.className}
            </Text>
          </div>
          <div style={{ textAlign: "right" }}>
            <Text size="3rem" fw={700} c={getScoreColor(optimization.overallScore)}>
              {optimization.overallScore}
            </Text>
            <Text size="sm" c="dimmed">
              / 100
            </Text>
          </div>
        </Group>
        <Progress
          value={optimization.overallScore}
          size="xl"
          color={getScoreColor(optimization.overallScore)}
        />
      </Paper>

      {/* Recommendations */}
      {optimization.recommendations.length > 0 && (
        <Paper p="lg" withBorder>
          <Title order={4} mb="md">
            Recommendations
          </Title>
          <Stack gap="md">
            {optimization.recommendations.map((rec, idx) => (
              <RecommendationCard key={idx} recommendation={rec} />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Strengths and Weaknesses */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder h="100%">
            <Group mb="sm">
              <ThemeIcon color="green" variant="light">
                <IconTrendingUp size={18} />
              </ThemeIcon>
              <Title order={5}>Strengths</Title>
            </Group>
            {optimization.strengths.length > 0 ? (
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon color="green" size={20} radius="xl">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                {optimization.strengths.map((strength, idx) => (
                  <List.Item key={idx}>{strength}</List.Item>
                ))}
              </List>
            ) : (
              <Text size="sm" c="dimmed">
                No notable strengths identified
              </Text>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder h="100%">
            <Group mb="sm">
              <ThemeIcon color="orange" variant="light">
                <IconTrendingDown size={18} />
              </ThemeIcon>
              <Title order={5}>Weaknesses</Title>
            </Group>
            {optimization.weaknesses.length > 0 ? (
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon color="orange" size={20} radius="xl">
                    <IconAlertCircle size={12} />
                  </ThemeIcon>
                }
              >
                {optimization.weaknesses.map((weakness, idx) => (
                  <List.Item key={idx}>{weakness}</List.Item>
                ))}
              </List>
            ) : (
              <Text size="sm" c="dimmed">
                No notable weaknesses identified
              </Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Detailed Analysis Accordion */}
      <Accordion variant="separated">
        {/* Resistances */}
        <Accordion.Item value="resistances">
          <Accordion.Control icon={<IconShield size={20} />}>
            Resistance Analysis
          </Accordion.Control>
          <Accordion.Panel>
            <ResistanceDisplay resistances={optimization.resistances} />
          </Accordion.Panel>
        </Accordion.Item>

        {/* Breakpoints */}
        <Accordion.Item value="breakpoints">
          <Accordion.Control icon={<IconTarget size={20} />}>
            Breakpoint Analysis
          </Accordion.Control>
          <Accordion.Panel>
            <BreakpointDisplay breakpoints={optimization.breakpoints} />
          </Accordion.Panel>
        </Accordion.Item>

        {/* Meta Comparison */}
        {optimization.itemComparison && optimization.itemComparison.length > 0 && (
          <Accordion.Item value="meta">
            <Accordion.Control icon={<IconChevronUp size={20} />}>
              Meta Item Comparison
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed" mb="md">
                Shows how your gear compares to popular meta choices for {optimization.className}
              </Text>
              <Stack gap="xs">
                {optimization.itemComparison
                  .filter((item) => item.metaUsagePercent > 5)
                  .slice(0, 10)
                  .map((item, idx) => (
                    <Group key={idx} justify="space-between">
                      <Text size="sm">
                        {item.itemName} {item.slot && `(${item.slot})`}
                      </Text>
                      <Group gap="xs">
                        <Text size="sm" c="dimmed">
                          {item.metaUsagePercent.toFixed(1)}%
                        </Text>
                        {item.isMetaChoice && (
                          <Badge size="sm" variant="light" color="blue">
                            Meta
                          </Badge>
                        )}
                      </Group>
                    </Group>
                  ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        )}
      </Accordion>
    </Stack>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const priorityColors = {
    critical: "red",
    high: "orange",
    medium: "yellow",
    low: "blue",
  };

  return (
    <Card padding="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Badge color={priorityColors[recommendation.priority]} variant="light">
            {recommendation.priority.toUpperCase()}
          </Badge>
          <Text fw={600}>{recommendation.title}</Text>
        </Group>
      </Group>

      <Text size="sm" mb="sm">
        {recommendation.description}
      </Text>

      {recommendation.specificItems && recommendation.specificItems.length > 0 && (
        <div>
          <Text size="sm" fw={500} mb="xs">
            Recommended items:
          </Text>
          <List size="sm" spacing={4}>
            {recommendation.specificItems.map((item, idx) => (
              <List.Item key={idx}>
                <Text size="sm" c="dimmed">
                  {item}
                </Text>
              </List.Item>
            ))}
          </List>
        </div>
      )}

      <Divider my="xs" />

      <Text size="xs" c="dimmed" fs="italic">
        💡 {recommendation.impact}
      </Text>
    </Card>
  );
}

function ResistanceDisplay({ resistances }: { resistances: ResistanceAnalysis }) {
  const resItems = [
    { key: "fire", label: "Fire", icon: IconFlame, color: "red", data: resistances.fire },
    { key: "cold", label: "Cold", icon: IconSnowflake, color: "blue", data: resistances.cold },
    { key: "lightning", label: "Lightning", icon: IconBolt, color: "yellow", data: resistances.lightning },
    { key: "poison", label: "Poison", icon: IconDroplet, color: "green", data: resistances.poison },
  ];

  return (
    <Stack gap="md">
      {resItems.map((res) => (
        <div key={res.key}>
          <Group justify="space-between" mb={4}>
            <Group gap="xs">
              <ThemeIcon color={res.color} variant="light" size="sm">
                <res.icon size={14} />
              </ThemeIcon>
              <Text size="sm" fw={500}>
                {res.label}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={600} c={res.data.capped ? "green" : "orange"}>
                {res.data.current}% / {res.data.max}%
              </Text>
              {res.data.capped ? (
                <Badge size="xs" color="green">
                  Capped
                </Badge>
              ) : (
                <Badge size="xs" color="orange">
                  -{res.data.deficit}%
                </Badge>
              )}
            </Group>
          </Group>
          <Progress
            value={(res.data.current / 75) * 100}
            color={res.data.capped ? "green" : "orange"}
            size="sm"
          />
        </div>
      ))}

      {!resistances.allCapped && (
        <Alert color="orange" icon={<IconAlertCircle size={16} />} mt="sm">
          Total resistance deficit: {resistances.totalDeficit}%. Uncapped resistances greatly
          increase incoming elemental damage in Hell difficulty.
        </Alert>
      )}
    </Stack>
  );
}

function BreakpointDisplay({ breakpoints }: { breakpoints: any }) {
  const bpItems = [
    { key: "fcr", label: "Faster Cast Rate (FCR)", icon: IconWand, stat: breakpoints.fcr },
    { key: "ias", label: "Increased Attack Speed (IAS)", icon: IconSword, stat: breakpoints.ias },
    { key: "fhr", label: "Faster Hit Recovery (FHR)", icon: IconShield, stat: breakpoints.fhr },
  ];

  return (
    <Stack gap="lg">
      {bpItems.map((bp) => (
        <div key={bp.key}>
          <Group justify="space-between" mb={4}>
            <Group gap="xs">
              <ThemeIcon variant="light" size="sm">
                <bp.icon size={14} />
              </ThemeIcon>
              <Text size="sm" fw={500}>
                {bp.label}
              </Text>
            </Group>
            <Text size="sm" fw={600}>
              {bp.stat.current}% ({bp.stat.tier.frames} frames)
            </Text>
          </Group>

          {bp.stat.next ? (
            <>
              <Progress
                value={bp.stat.progress}
                size="sm"
                color="blue"
                mb={4}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Current: {bp.stat.tier.value}% ({bp.stat.tier.frames} frames)
                </Text>
                <Text size="xs" c="dimmed">
                  Next: {bp.stat.next.value}% ({bp.stat.next.frames} frames)
                </Text>
              </Group>
              <Text size="xs" c="blue" mt={4}>
                +{bp.stat.toNextBreakpoint}% needed for next breakpoint
              </Text>
            </>
          ) : (
            <Badge size="sm" color="green" mt={4}>
              Max breakpoint reached!
            </Badge>
          )}
        </div>
      ))}
    </Stack>
  );
}

function getScoreColor(score: number): string {
  if (score >= 90) return "green";
  if (score >= 75) return "teal";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}
