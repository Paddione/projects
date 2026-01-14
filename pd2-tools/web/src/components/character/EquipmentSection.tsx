import { Card, SegmentedControl, Text } from "@mantine/core";
import CharacterEquipment from "./Equipment";
import type { EquipmentSectionProps } from "../../types";

export function EquipmentSection({
  playerItems,
  mercenary,
  playerToggle,
  onPlayerToggleChange,
}: EquipmentSectionProps) {
  return (
    <Card h="520px" radius="md" shadow="md" style={{ overflowX: "auto" }}>
      <Card.Section style={{ marginBottom: "10px" }}>
        <Card
          radius="0"
          style={{
            backgroundColor: "rgb(44, 45, 50)",
            borderBottomColor: "rgb(55, 58, 64)",
            borderBottomWidth: "1.75px",
            borderBottomStyle: "solid",
          }}
        >
          <Card.Section>
            <Text fw={500} style={{ marginLeft: "10px", marginTop: "4.15px" }}>
              Equipment
              <div
                style={{ float: "right", marginRight: "8px", marginTop: "2px" }}
              >
                <SegmentedControl
                  value={playerToggle}
                  size="xs"
                  onChange={(e) =>
                    e !== playerToggle
                      ? onPlayerToggleChange(e as "player" | "merc")
                      : null
                  }
                  withItemsBorders={false}
                  styles={{
                    root: {
                      minHeight: "unset",
                      position: "relative",
                      top: "-2px",
                    },
                    label: {
                      fontSize: "12px",
                      lineHeight: "14px",
                    },
                  }}
                  data={[
                    { label: "Player", value: "player" },
                    { label: "Mercenary", value: "merc" },
                  ]}
                />
              </div>
            </Text>
          </Card.Section>
        </Card>
      </Card.Section>

      <div style={{ minWidth: "535px", height: "100%" }}>
        <CharacterEquipment
          items={playerToggle === "player" ? playerItems : mercenary?.items}
          isMerc={playerToggle === "merc"}
          mercType={playerToggle === "merc" ? mercenary?.description : ""}
        />
      </div>
    </Card>
  );
}
