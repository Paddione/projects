import {
  Card,
  Stack,
  Title,
  Text,
  Group,
  Checkbox,
  Button,
  Divider,
  ScrollArea,
  Badge,
  Switch,
  TextInput,
  Anchor,
  Tooltip,
} from "@mantine/core";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Helmet } from "react-helmet";
import { useInterval } from "usehooks-ts";
import { DiscordIcon } from "../components/icons";
import TerrorZoneCalculator from "../components/layout/NavBar/TerrorZoneCalculator";
import {
  zoneImmunities,
  IMMUNITY_COLORS,
  type ImmunityType,
} from "../data/zoneImmunities";

const calculator = new TerrorZoneCalculator();

function ImmunityTooltip({ zoneName }: { zoneName: string }) {
  const immunityData = zoneImmunities[zoneName];

  if (!immunityData || immunityData.length === 0) {
    return (
      <Stack gap={4}>
        <Text size="sm" fw={700} style={{ marginBottom: 4, color: "#fff" }}>
          Immunities
        </Text>
        <Text size="sm" style={{ color: "#aaa" }}>
          No immunity data available
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={4}>
      <Text size="sm" fw={700} style={{ marginBottom: 4, color: "#fff" }}>
        Immunities
      </Text>
      {immunityData.map((zone, index) => (
        <div
          key={index}
          style={{ marginBottom: index < immunityData.length - 1 ? 6 : 0 }}
        >
          <Text size="sm" component="span" fw={600} style={{ color: "#fff" }}>
            {zone.subZone}:{" "}
          </Text>
          {zone.immunities.length > 0 ? (
            zone.immunities.map((immunity, immIndex) => (
              <Text
                key={immIndex}
                size="sm"
                component="span"
                style={{ color: IMMUNITY_COLORS[immunity as ImmunityType] }}
              >
                {immunity}
                {immIndex < zone.immunities.length - 1 ? ", " : ""}
              </Text>
            ))
          ) : (
            <Text size="sm" component="span" style={{ color: "#aaa" }}>
              None
            </Text>
          )}
        </div>
      ))}
    </Stack>
  );
}

function useIsSmallScreen(threshold = 800) {
  const [isSmall, setIsSmall] = useState(() => window.innerWidth < threshold);
  useEffect(() => {
    function handleResize() {
      setIsSmall(window.innerWidth < threshold);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [threshold]);
  return isSmall;
}

export default function CorruptedZoneTracker() {
  const isSmallScreen = useIsSmallScreen();
  const [current, setCurrent] = useState(() => calculator.getCurrentZone());
  const [nextZones, setNextZones] = useState(() =>
    calculator.getNextXZones(10)
  );
  const [tracked, setTracked] = useState<string[]>(() => {
    const saved = localStorage.getItem("trackedZones");
    return saved ? JSON.parse(saved) : [];
  });
  const [notified, setNotified] = useState<{ [zone: string]: number }>({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem("notificationsEnabled");
    return saved === null ? true : saved === "true";
  });
  const [search, setSearch] = useState("");
  const upcomingRef = useRef<HTMLDivElement>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState<number>(220);

  const allZones = useMemo(() => {
    //@ts-expect-error - zones is private but we need to access it
    return [...(calculator.zones as string[])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, []);

  const filteredZones = useMemo(() => {
    if (!search) return allZones;
    return allZones.filter((zone) =>
      zone.toLowerCase().includes(search.toLowerCase())
    );
  }, [allZones, search]);

  useInterval(() => {
    setCurrent(calculator.getCurrentZone());
    setNextZones(calculator.getNextXZones(10));
  }, 1000);

  useEffect(() => {
    localStorage.setItem("trackedZones", JSON.stringify(tracked));
  }, [tracked]);

  useEffect(() => {
    localStorage.setItem(
      "notificationsEnabled",
      notificationsEnabled ? "true" : "false"
    );
  }, [notificationsEnabled]);

  const requestPermission = useCallback(() => {
    if (window.Notification && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (
      !window.Notification ||
      Notification.permission !== "granted" ||
      !notificationsEnabled
    )
      return;
    if (!current || typeof current.zone !== "string") return;

    tracked.forEach((zone) => {
      // Use localStorage to persist notification state across reloads
      const notifiedKey = `cz_notified_${zone}`;
      const alreadyNotified =
        notified[zone] || localStorage.getItem(notifiedKey);

      if (current.zone === zone && !alreadyNotified) {
        new Notification("Corrupted Zone Active", {
          body: `${zone} is now active!`,
        });
        setNotified((prev) => ({ ...prev, [zone]: Date.now() }));
        localStorage.setItem(notifiedKey, "1");
      }
      if (
        current.zone !== zone &&
        (notified[zone] || localStorage.getItem(notifiedKey))
      ) {
        setNotified((prev) => {
          if (!prev) return {};
          const copy = { ...prev };
          delete copy[zone];
          return copy;
        });
        localStorage.removeItem(notifiedKey);
      }
    });
  }, [current, tracked, notified, notificationsEnabled]);

  useEffect(() => {
    if (upcomingRef.current) {
      setScrollAreaHeight(upcomingRef.current.offsetHeight);
    }
  }, [nextZones]);

  const getZoneNextTime = useCallback((zone: string) => {
    const result = calculator.getSecondsUntilNextSpecificZone(zone);
    if (!result) return null;
    const min = Math.floor(result.secondsUntilActive / 60);
    const sec = result.secondsUntilActive % 60;
    return { min, sec, seconds: result.secondsUntilActive };
  }, []);

  if (isSmallScreen) {
    return (
      <>
        <Helmet>
          <title>Corrupted Zone Tracker - pd2.tools</title>
          <meta
            name="description"
            content="Track upcoming corrupted zones and get notifications for your favorite zones in Project Diablo 2."
          />
        </Helmet>
        <div
          style={{
            minHeight: "calc(100vh - 56px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Card
            shadow="md"
            padding="lg"
            radius="md"
            style={{ maxWidth: 400, margin: "auto" }}
          >
            <Stack gap="md" align="center">
              <Title order={3}>Corrupted Zone Tracker</Title>
              <Text ta="center" c="dimmed">
                Sorry, the Corrupted Zone Tracker is not available on mobile.
              </Text>
            </Stack>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Corrupted Zone Tracker - pd2.tools</title>
        <meta
          name="description"
          content="Track upcoming corrupted zones and get notifications for your favorite zones in Project Diablo 2."
        />
      </Helmet>
      <div
        style={{
          minHeight: "calc(100vh - 56px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: 16,
            paddingBottom: 24,
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{
              width: 1100,
              maxWidth: "100%",
              backgroundColor: "#5865F2",
              marginBottom: 16,
            }}
          >
            <Group gap="sm" align="center">
              <DiscordIcon size={20} />
              <Text c="white" size="sm">
                There is also a corrupted zone tracker with notifications in
                Discord:{" "}
                <Anchor
                  href="https://discord.com/invite/TVTExqWRhK"
                  target="_blank"
                  c="white"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 600, textDecoration: "underline" }}
                >
                  Join our Discord
                </Anchor>
              </Text>
            </Group>
          </Card>
          <Card
            shadow="md"
            padding="lg"
            radius="md"
            style={{ width: 1100, maxWidth: "100%" }}
          >
            <Stack gap="md" style={{ height: "100%" }}>
              <Group justify="space-between">
                <Title order={2}>Corrupted Zone Tracker</Title>
                <Group gap="xs">
                  <Switch
                    size="md"
                    checked={notificationsEnabled}
                    onChange={(e) =>
                      setNotificationsEnabled(e.currentTarget.checked)
                    }
                    color="blue"
                    label={
                      notificationsEnabled
                        ? "Notifications On"
                        : "Notifications Off"
                    }
                  />
                  <Button
                    size="xs"
                    variant="light"
                    onClick={requestPermission}
                    disabled={Notification.permission === "granted"}
                  >
                    {Notification.permission === "granted"
                      ? "Notifications Allowed"
                      : "Enable Notifications"}
                  </Button>
                </Group>
              </Group>
              <Divider />
              <Stack gap={2}>
                <Text size="md">Current Zone:</Text>
                <Group justify="space-between">
                  <Tooltip
                    label={<ImmunityTooltip zoneName={current.zone} />}
                    multiline
                    position="bottom"
                    withArrow
                    transitionProps={{ transition: "pop", duration: 200 }}
                    styles={{
                      tooltip: {
                        backgroundColor: "rgba(0, 0, 0, 0.95)",
                        border: "1px solid #444",
                        padding: 12,
                        maxWidth: 400,
                      },
                    }}
                  >
                    <Text
                      fw={700}
                      style={{ color: "#AE3EC9", cursor: "pointer" }}
                    >
                      {current.zone}
                    </Text>
                  </Tooltip>
                  <Badge color="violet" size="lg" tt="none">
                    {current.secondsUntilNext}
                    {"s"}
                  </Badge>
                </Group>
              </Stack>
              <Divider />
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 24,
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Stack gap={2}>
                    <Text size="md" fw={700}>
                      Upcoming Zones:
                    </Text>
                    <div ref={upcomingRef}>
                      <Stack gap={4}>
                        {nextZones.map((z) => (
                          <Group key={z.zone + z.ts} justify="space-between">
                            <Tooltip
                              label={<ImmunityTooltip zoneName={z.zone} />}
                              multiline
                              position="right"
                              withArrow
                              transitionProps={{
                                transition: "pop",
                                duration: 200,
                              }}
                              styles={{
                                tooltip: {
                                  backgroundColor: "rgba(0, 0, 0, 0.95)",
                                  border: "1px solid #444",
                                  padding: 12,
                                  maxWidth: 400,
                                },
                              }}
                            >
                              <Text style={{ cursor: "pointer" }}>
                                {z.zone}
                              </Text>
                            </Tooltip>
                            <Badge color="gray" tt="none">
                              {Math.floor(z.secondsUntilActive / 60)}m{" "}
                              {z.secondsUntilActive % 60}s
                            </Badge>
                          </Group>
                        ))}
                      </Stack>
                    </div>
                  </Stack>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Stack gap={2}>
                    <Text size="md" fw={700}>
                      Track Zones for Notification:
                    </Text>
                    <TextInput
                      placeholder="Search zones..."
                      value={search}
                      onChange={(e) => setSearch(e.currentTarget.value)}
                      mb={4}
                      size="sm"
                    />
                    <ScrollArea
                      h={scrollAreaHeight}
                      type="auto"
                      scrollbarSize={6}
                      offsetScrollbars
                    >
                      <Stack gap={0}>
                        {filteredZones.map((zone) => {
                          const next = getZoneNextTime(zone);
                          return (
                            <Group
                              key={zone}
                              justify="space-between"
                              align="center"
                              style={{ width: "100%" }}
                            >
                              <Tooltip
                                label={<ImmunityTooltip zoneName={zone} />}
                                multiline
                                position="right"
                                withArrow
                                transitionProps={{
                                  transition: "pop",
                                  duration: 200,
                                }}
                                styles={{
                                  tooltip: {
                                    backgroundColor: "rgba(0, 0, 0, 0.95)",
                                    border: "1px solid #444",
                                    padding: 12,
                                    maxWidth: 400,
                                  },
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <Checkbox
                                    label={
                                      <Text style={{ cursor: "pointer" }}>
                                        {zone}
                                      </Text>
                                    }
                                    checked={tracked.includes(zone)}
                                    onChange={(e) => {
                                      setTracked((prev) =>
                                        e.currentTarget.checked
                                          ? [...prev, zone]
                                          : prev.filter((z) => z !== zone)
                                      );
                                    }}
                                    size="sm"
                                    style={{ marginBottom: 2 }}
                                  />
                                </div>
                              </Tooltip>
                              {next && (
                                <Badge
                                  color="gray"
                                  tt="none"
                                  style={{
                                    marginLeft: 8,
                                    minWidth: 60,
                                    justifyContent: "center",
                                  }}
                                >
                                  {next.min}m {next.sec}s
                                </Badge>
                              )}
                            </Group>
                          );
                        })}
                      </Stack>
                    </ScrollArea>
                  </Stack>
                </div>
              </div>
            </Stack>
          </Card>
          <Card
            shadow="sm"
            padding="lg"
            radius="md"
            style={{ width: 1100, maxWidth: "100%", marginTop: 24 }}
          >
            <Title order={4} mb={8} style={{ fontWeight: 700 }}>
              How to use the Corrupted Zone Tracker
            </Title>
            <ul
              style={{
                margin: 0,
                paddingLeft: 22,
                fontSize: "1.05em",
                color: "#bfc9d1",
                lineHeight: 1.7,
              }}
            >
              <li>
                <b>Current Zone:</b> Shows the currently active corrupted zone
                and the time until the next one.
              </li>
              <li>
                <b>Upcoming Zones:</b> Lists the next several corrupted zones
                and when they will become active.
              </li>
              <li>
                <b>Track Zones for Notification:</b> Use the checkboxes to
                select which zones you want to be notified about. You can search
                for zones by name.
              </li>
              <li>
                <b>Enable Notifications:</b> Turn on browser notifications using
                the switch and allow notifications when prompted. You will
                receive a notification when a tracked zone is about to become
                active.
              </li>
              <li>
                <b>Note:</b> Notifications will only work while this page is
                open and active in your browser.
              </li>
            </ul>
          </Card>
          <div style={{ width: "100%", textAlign: "center", marginTop: 16 }}>
            <Text size="xs" c="dimmed">
              Inspired by{" "}
              <Anchor
                href="https://exiledagain.github.io/past-dinosaurs/"
                target="_blank"
                rel="noopener noreferrer"
              >
                exiledagain's corrupted zone tracker
              </Anchor>
              .
            </Text>
          </div>
        </div>
      </div>
    </>
  );
}
