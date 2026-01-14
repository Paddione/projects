import { useState } from "react";
import { Text, Tooltip } from "@mantine/core";

// Scaling factor: 0 = 0%, 1 = 100% of original size
const SCALE_FACTOR = 0.8; // 80% of original size

// Rarity colors
const getRarityColor = (item: any): string | null => {
  if (!item) return null;
  if (item.is_runeword) return "#FACC15";
  switch (item.quality?.name?.toLowerCase()) {
    case "unique":
      return "#c17d3a";
    case "set":
      return "#1eed0e";
    case "rare":
      return "#ffff00";
    case "magic":
      return "#4545ff";
    case "crafted":
      return "#ffa800";
    default:
      return null;
  }
};

// Border color for equipment slots
const getRarityBorderColor = (item: any): string => {
  return getRarityColor(item) || "#374151";
};

// Convert hex to rgba
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Gradient background for tooltips based on rarity
const getRarityGradient = (item: any): string => {
  const color = getRarityColor(item);
  if (!color) return "transparent";
  return `linear-gradient(to bottom, ${hexToRgba(color, 0.25)} 0%, ${hexToRgba(color, 0.08)} 20%, transparent 35%)`;
};

const ItemsWithImages = new Set([
  "Stalker's Cull",
  "Atma's Scarab",
  "Bul-Kathos' Wedding Band",
  "Crescent Moon",
  "Dwarf Star",
  "Highlord's Wrath",
  "Mara's Kaleidoscope",
  "Nature's Peace",
  "Raven Frost",
  "Saracen's Chance",
  "The Cat's Eye",
  "The Rising Sun",
  "Wisp Projector",
  "Templar's Might",
  "Lidless Wall",
  "Arachnid Mesh",
  "Dracul's Grasp",
  "Verdungo's Hearty Cord",
  "Nightwing's Veil",
  "Soul Drainer",
  "Arkaine's Valor",
  "Kira's Guardian",
  "Ormus' Robes",
  "Magefist",
  "Snowclash",
  "String of Ears",
  "Thundergod's Vigor",
  "Merman's Sprocket",
  "Veil of Steel",
  "Trang-Oul's Claws",
  "Tyrael's Might",
  "Griffon's Eye",
  "Harlequin Crest",
  "Mang Song's Lesson",
  "Waterwalk",
  "Silkweave",
  "Gravepalm",
  "Stormshield",
  "Medusa's Gaze",
  "Boneflame",
  "Occultist",
  "Frostburn",
  "Trang-Oul's Scales",
  "The Grandfather",
  "Skin of the Vipermagi",
  "Steelrend",
  "Spirit Ward",
  "Laying of Hands",
  "Crown of Ages",
  "Martyrdom",
  "Ravenlore",
  "Denmother",
  "Plague",
]);

// Base sizes that will be scaled
const BASE_SIZES = {
  STANDARD_SLOT: 96,
  SMALL_SLOT: 38,
  WEAPON_SLOT: 194,
  CHARM_UNIT: 40,
};

// Scale a number by the scale factor
const scale = (size) => Math.round(size * SCALE_FACTOR);

const ItemTooltip = ({ item }) => {
  const getQualityColor = () => {
    return getRarityColor(item) || "#ffffff";
  };

  if (!item) return null;

  return (
    <div
      style={{
        fontSize: "15px",
        background: getRarityGradient(item),
        margin: "-12px",
        padding: "12px",
        borderRadius: "4px",
      }}
    >
      <div
        style={{
          color: getQualityColor(),
          fontWeight: "bold",
        }}
      >
        {item.name}
        {item.is_ethereal && " (Ethereal)"}
      </div>
      <div style={{ color: "#a0a0a0" }}>{item.base.name}</div>
      {item.defense?.total && (
        <>
          <div style={{ color: "#ffffff" }}>Defense: {item.defense.total}</div>
          <div
            style={{
              borderBottom: "1px solid #666",
              margin: `${scale(4)}px 0`,
            }}
          ></div>
        </>
      )}
      {item.damage?.one_handed && (
        <>
          <div style={{ color: "#ffffff" }}>
            One-Hand Damage: {item.damage.one_handed.minimum}-
            {item.damage.one_handed.maximum}
          </div>
          <div
            style={{
              borderBottom: "1px solid #666",
              margin: `${scale(4)}px 0`,
            }}
          ></div>
        </>
      )}
      {item.modifiers?.map((mod, idx) => (
        <div
          key={idx}
          style={{
            color:
              mod.label === "Mirrored"
                ? "#89019e"
                : mod.label === "Desecrated" || mod?.desecrated
                  ? "#9c6f1b"
                  : mod.label === "Corrupted" || mod?.corrupted
                    ? "#ff0000"
                    : "#ffffff",
          }}
        >
          {mod.label === "Corrupt" ? "" : mod.label}{" "}
          {mod?.max ? (
            <span style={{ color: "#6B7280" }}>
              [{mod.min} - {mod.max}]
            </span>
          ) : (
            ""
          )}
        </div>
      ))}
      {item.socketed && !item?.is_runeword && item.socketed.length > 0 && (
        <>
          <div
            style={{
              borderBottom: "1px solid #666",
              margin: `${scale(4)}px 0`,
            }}
          ></div>
          <div
            style={{
              color:
                item?.corruptions?.[0] === "item_numsockets"
                  ? "#ff0000"
                  : "#a0a0a0",
            }}
          >
            Socketed ({item.socketed.length}):
          </div>
          {item.socketed.map((socket, idx) => (
            <div
              key={idx}
              style={{
                color: "#ffffff",
                paddingLeft: `${scale(8)}px`,
                fontSize: "14px",
              }}
            >
              {socket.name}
              {socket.modifiers.map((modifier) => (
                <div style={{ color: "#6B7280", fontSize: "14px" }}>
                  {modifier.label}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      <div style={{ marginTop: `${scale(8)}px`, color: "#a0a0a0" }}>
        Required Level: {item.requirements.level}
        {item.requirements.strength > 0 && (
          <div>Required Strength: {item.requirements.strength}</div>
        )}
        {item.requirements.dexterity > 0 && (
          <div>Required Dexterity: {item.requirements.dexterity}</div>
        )}
      </div>
    </div>
  );
};

const EquipmentSlot = ({
  item,
  height,
  width = `${scale(BASE_SIZES.STANDARD_SLOT)}px`,
  style = {},
}) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleMouseEnter = () => {
    if (item && !isClicked) {
      setTooltipOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isClicked) {
      setTooltipOpen(false);
    }
  };

  const handleClick = () => {
    if (item) {
      setIsClicked(!isClicked);
      setTooltipOpen(!tooltipOpen);
    }
  };

  return (
    <Tooltip
      label={item && <ItemTooltip item={item} />}
      multiline
      opened={tooltipOpen}
      position="right"
      styles={{
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.95)",
          border: `1px solid ${getRarityBorderColor(item)}`,
          padding: `${scale(12)}px`,
          maxWidth: `${scale(400 + 200)}px`,
          width: "max-content",
        },
      }}
    >
      <div
        style={{
          width,
          height,
          border: `0.5px solid ${getRarityBorderColor(item)}`,
          cursor: item ? "pointer" : "default",
          background:
            item && getRarityColor(item)
              ? `linear-gradient(to top, ${hexToRgba(getRarityColor(item), 0.15)} 0%, ${hexToRgba(getRarityColor(item), 0.08)} 35%, transparent 70%)`
              : "transparent",
          ...style,
        }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {item && item?.base.type_code && (
          <img
            src={
              item.name === "Annihilus"
                ? "/equipment_icons/anni.png"
                : item.name === "Hellfire Torch"
                  ? "/equipment_icons/torch.png"
                  : item.name.includes("Charm")
                    ? `/equipment_icons/${item.base.type_code}.png`
                    : item.name.includes("Gheed")
                      ? `/equipment_icons/lcha.png`
                      : item.name.includes("Arrows")
                        ? `/equipment_icons/arrows.png`
                        : item.name.includes("Bolts")
                          ? `/equipment_icons/bolts.png`
                          : ItemsWithImages.has(item.name)
                            ? `/equipment_icons/${item.name.replaceAll(" ", "_")}.png`
                            : `https://projectdiablo2.com/image/items/inv${item?.base?.codes.normal || item?.base?.id + (item?.graphic_id < 1 ? 1 : item?.graphic_id)}.png`
            }
            alt={item.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "scale-down",
              opacity: item?.is_ethereal ? "0.375" : undefined,
            }}
          />
        )}
      </div>
    </Tooltip>
  );
};

const CharacterEquipment = ({
  items = [],
  isMerc = false,
  mercType = "???",
}) => {
  const [activeTab, setActiveTab] = useState("I");

  if (activeTab !== "I" && isMerc) setActiveTab("I");

  const getItemBySlot = (slot, weaponSet) => {
    if (!items) return null;

    if (slot === "Right Hand" || slot === "Left Hand") {
      const switchSuffix = weaponSet === "II" ? " Switch" : "";
      return items.find(
        (item) =>
          item.location.equipment === `${slot}${switchSuffix}` &&
          item.location.zone === "Equipped"
      );
    }

    return items.find(
      (item) =>
        item.location.equipment === slot && item.location.zone === "Equipped"
    );
  };

  const getCharms = () => {
    if (!items) return [];
    return items.filter(
      (item) =>
        item.base.type_code.includes("cha") &&
        item.location.storage === "Inventory"
    );
  };

  const renderTab = () => (
    <div style={{ display: "flex", marginBottom: `${scale(4)}px` }}>
      {!isMerc ? (
        <>
          <button
            style={{
              width: `${scale(32)}px`,
              height: `${scale(24) + 10}px`,
              border: "1px solid #374151",
              backgroundColor: activeTab === "I" ? "#374151" : "transparent",
              color: "#fff",
            }}
            onClick={() => setActiveTab("I")}
          >
            I
          </button>
          <button
            style={{
              width: `${scale(32)}px`,
              height: `${scale(24) + 10}px`,
              border: "1px solid #374151",
              backgroundColor: activeTab === "II" ? "#374151" : "transparent",
              color: "#fff",
            }}
            onClick={() => setActiveTab("II")}
          >
            II
          </button>
        </>
      ) : (
        ""
      )}
    </div>
  );

  const charms = getCharms();

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: `${scale(64)}px` }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {renderTab("left")}
            <div style={{ marginBottom: `${scale(8)}px` }}>
              <EquipmentSlot
                item={getItemBySlot("Right Hand", activeTab)}
                height={`${scale(BASE_SIZES.WEAPON_SLOT)}px`}
              />
            </div>
            <EquipmentSlot
              item={getItemBySlot("Gloves")}
              height={`${scale(BASE_SIZES.STANDARD_SLOT)}px`}
            />
          </div>

          {/* Center Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div style={{ marginBottom: `${scale(8)}px` }}>
              <EquipmentSlot
                item={getItemBySlot("Helm")}
                height={`${scale(BASE_SIZES.STANDARD_SLOT)}px`}
              />
            </div>
            <div style={{ marginBottom: `${scale(8)}px`, alignSelf: "center" }}>
              {!isMerc ? (
                <EquipmentSlot
                  item={getItemBySlot("Amulet")}
                  height={`${scale(BASE_SIZES.SMALL_SLOT)}px`}
                  width={`${scale(BASE_SIZES.SMALL_SLOT)}px`}
                />
              ) : (
                ""
              )}
            </div>
            <div style={{ marginBottom: `${scale(8)}px` }}>
              <EquipmentSlot
                item={getItemBySlot("Armor")}
                height={`${scale(144)}px`}
              />
            </div>
            <EquipmentSlot
              item={getItemBySlot("Belt")}
              height={`${scale(BASE_SIZES.SMALL_SLOT)}px`}
            />

            {/* Rings */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: `-${scale(52)}px`,
              }}
            >
              {!isMerc ? (
                <EquipmentSlot
                  item={getItemBySlot("Right Ring")}
                  height={`${scale(BASE_SIZES.SMALL_SLOT)}px`}
                  width={`${scale(BASE_SIZES.SMALL_SLOT)}px`}
                />
              ) : (
                ""
              )}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: `-${scale(52)}px`,
              }}
            >
              {!isMerc ? (
                <EquipmentSlot
                  item={getItemBySlot("Left Ring")}
                  height={`${scale(BASE_SIZES.SMALL_SLOT)}px`}
                  width={`${scale(BASE_SIZES.SMALL_SLOT)}px`}
                />
              ) : (
                ""
              )}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {renderTab("right")}
            <div style={{ marginBottom: `${scale(8)}px` }}>
              <EquipmentSlot
                item={getItemBySlot("Left Hand", activeTab)}
                height={`${scale(BASE_SIZES.WEAPON_SLOT)}px`}
              />
            </div>
            <EquipmentSlot
              item={getItemBySlot("Boots")}
              height={`${scale(BASE_SIZES.STANDARD_SLOT)}px`}
            />
          </div>
        </div>

        {/* Inventory Grid */}
        <div
          style={{
            marginTop: `${scale(16)}px`,
            display: "grid",
            gap: `${scale(2)}px`,
          }}
        >
          {charms.map((charm) => (
            <EquipmentSlot
              key={charm.id}
              item={charm}
              height={`${scale(charm.base.size.height * BASE_SIZES.CHARM_UNIT)}px`}
              width={`${scale(BASE_SIZES.CHARM_UNIT)}px`}
              style={{
                gridColumn: `${charm.position.column + 1}`,
                gridRow: `${charm.position.row + 1} / span ${charm.base.size.height}`,
              }}
            />
          ))}
        </div>
        {isMerc ? (
          <Text style={{ alignSelf: "flex-start" }} size="sm">
            Type: {mercType}
          </Text>
        ) : (
          ""
        )}
      </div>
    </div>
  );
};

export default CharacterEquipment;
