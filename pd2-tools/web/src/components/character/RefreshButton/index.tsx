import { ActionIcon, Tooltip } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { charactersAPI, APIError } from "../../../api";

export default function RefreshButton({
  characterName,
}: {
  characterName: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function handleRefresh() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await charactersAPI.refreshCharacter(characterName);
      await queryClient.invalidateQueries({
        queryKey: ["character", characterName],
      });
    } catch (error) {
      if (error instanceof APIError && error.status === 429) {
        setErrorMessage(
          "This character was refreshed too recently. Please try again later."
        );
      } else {
        setErrorMessage("Failed to refresh character");
        console.error("Failed to refresh character:", error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const button = (
    <ActionIcon
      variant="subtle"
      onClick={handleRefresh}
      size={14}
      loading={isLoading}
      disabled={isLoading}
      color="gray"
      style={{
        width: "14px",
        height: "14px",
        minWidth: "14px",
        minHeight: "14px",
        top: "2px",
      }}
    >
      <IconRefresh size={10} />
    </ActionIcon>
  );

  const tooltipLabel = errorMessage || "Refresh character data";

  return (
    <Tooltip
      label={tooltipLabel}
      position="left"
      color={errorMessage ? "red" : "dark"}
    >
      {button}
    </Tooltip>
  );
}
