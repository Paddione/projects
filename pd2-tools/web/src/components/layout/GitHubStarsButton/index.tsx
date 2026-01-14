import { useEffect, useState } from "react";
import { Button, Group, rem, Tooltip } from "@mantine/core";
import { IconStar } from "@tabler/icons-react";
import { GitHubIcon } from "../../icons";

const CACHE_KEY = "pd2tools_github_stars";
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function getCachedStars(): { value: number; timestamp: number } | null {
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

function setCachedStars(value: number) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ value, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

interface GitHubStarsButtonProps {
  username: string;
  repo: string;
  mobile?: boolean;
  onClick?: () => void;
}

export function GitHubStarsButton({
  username,
  repo,
  mobile = false,
  onClick,
}: GitHubStarsButtonProps) {
  const cached = getCachedStars();
  const [stars, setStars] = useState<number | null>(cached?.value ?? null);

  useEffect(() => {
    const cached = getCachedStars();
    const now = Date.now();

    // Use cached value if fresh enough
    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
      setStars(cached.value);
      return;
    }

    // Fetch fresh data
    fetch(`https://api.github.com/repos/${username}/${repo}`)
      .then((response) => response.json())
      .then((data) => {
        if (data && typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count);
          setCachedStars(data.stargazers_count);
        }
      })
      .catch(console.error);
  }, [username, repo]);

  const displayValue = stars !== null ? stars.toLocaleString() : "—";

  if (mobile) {
    return (
      <Button
        component="a"
        href={`https://github.com/${username}/${repo}`}
        target="_blank"
        rel="noopener noreferrer"
        variant="default"
        leftSection={<GitHubIcon size={18} />}
        rightSection={
          <Group gap={4} wrap="nowrap">
            <span
              style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
            >
              {displayValue}
            </span>
            <IconStar size={14} fill="#eab308" color="#eab308" />
          </Group>
        }
        style={{
          backgroundColor: "#fff",
          color: "#24292f",
          borderColor: "#d0d7de",
          fontWeight: 600,
          marginTop: rem(10),
        }}
        onClick={onClick}
      >
        GitHub
      </Button>
    );
  }

  return (
    <Tooltip label="View on GitHub" withArrow position="bottom">
      <Button
        component="a"
        href={`https://github.com/${username}/${repo}`}
        target="_blank"
        rel="noopener noreferrer"
        variant="default"
        radius="md"
        style={{
          backgroundColor: "#fff",
          color: "#24292f",
          borderColor: "#d0d7de",
          height: rem(34),
          paddingLeft: rem(12),
          paddingRight: rem(12),
        }}
      >
        <Group gap={8} wrap="nowrap">
          <GitHubIcon size={18} />
          <span
            style={{
              fontWeight: 600,
              fontSize: rem(14),
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {displayValue}
          </span>
          <IconStar size={16} fill="#eab308" color="#eab308" />
        </Group>
      </Button>
    </Tooltip>
  );
}
