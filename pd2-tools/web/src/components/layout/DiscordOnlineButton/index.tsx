import { useEffect, useState } from "react";
import { Button, Group, rem, Tooltip } from "@mantine/core";
import { DiscordIcon } from "../../icons";

const CACHE_KEY = "pd2tools_discord_online";
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const OnlineDot = ({ animated = false }: { animated?: boolean }) => {
  if (animated) {
    return (
      <>
        <style>
          {`
            @keyframes ping-shadow {
              0% {
                box-shadow: 0 0 0 0 rgba(64, 192, 87, 0.7);
              }
              75%, 100% {
                box-shadow: 0 0 0 4px rgba(64, 192, 87, 0);
              }
            }
          `}
        </style>
        <span
          style={{
            width: rem(8),
            height: rem(8),
            backgroundColor: "#40C057",
            borderRadius: "50%",
            display: "inline-block",
            animation: "ping-shadow 1s cubic-bezier(0, 0, 0.2, 1) infinite",
          }}
        />
      </>
    );
  }

  return (
    <span
      style={{
        width: rem(8),
        height: rem(8),
        backgroundColor: "#40C057",
        borderRadius: "50%",
        display: "inline-block",
      }}
    />
  );
};

function getCachedOnline(): { value: number; timestamp: number } | null {
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

function setCachedOnline(value: number) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ value, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

interface DiscordOnlineButtonProps {
  guildId: string;
  inviteLink: string;
  mobile?: boolean;
  onClick?: () => void;
}

export function DiscordOnlineButton({
  guildId,
  inviteLink,
  mobile = false,
  onClick,
}: DiscordOnlineButtonProps) {
  const cached = getCachedOnline();
  const [onlineCount, setOnlineCount] = useState<number | null>(
    cached?.value ?? null
  );

  useEffect(() => {
    const cached = getCachedOnline();
    const now = Date.now();

    // Use cached value if fresh enough
    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
      setOnlineCount(cached.value);
      return;
    }

    // Fetch fresh data
    fetch(`https://discord.com/api/guilds/${guildId}/widget.json`)
      .then((response) => response.json())
      .then((data) => {
        if (data && typeof data.presence_count === "number") {
          setOnlineCount(data.presence_count);
          setCachedOnline(data.presence_count);
        }
      })
      .catch(console.error);
  }, [guildId]);

  const displayValue =
    onlineCount !== null ? onlineCount.toLocaleString() : "—";

  const tooltipLabel = (
    <Group gap={6} wrap="nowrap">
      <OnlineDot animated />
      <span>{displayValue} members online in the pd2.tools Discord</span>
    </Group>
  );

  if (mobile) {
    return (
      <Button
        component="a"
        href={inviteLink}
        target="_blank"
        rel="noopener noreferrer"
        variant="filled"
        leftSection={<DiscordIcon size={18} />}
        rightSection={
          <Group gap={4} wrap="nowrap">
            <span
              style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
            >
              {displayValue}
            </span>
            <OnlineDot animated />
          </Group>
        }
        style={{
          backgroundColor: "#5865F2",
          color: "white",
          marginTop: rem(10),
        }}
        onClick={onClick}
      >
        Discord
      </Button>
    );
  }

  return (
    <Tooltip label={tooltipLabel} withArrow position="bottom">
      <Button
        component="a"
        href={inviteLink}
        target="_blank"
        rel="noopener noreferrer"
        variant="filled"
        radius="md"
        style={{
          backgroundColor: "#5865F2",
          color: "white",
          height: rem(34),
          paddingLeft: rem(12),
          paddingRight: rem(12),
        }}
      >
        <Group gap={8} wrap="nowrap">
          <DiscordIcon size={18} />
          <span
            style={{
              fontWeight: 600,
              fontSize: rem(14),
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {displayValue}
          </span>
          <OnlineDot animated />
        </Group>
      </Button>
    </Tooltip>
  );
}
