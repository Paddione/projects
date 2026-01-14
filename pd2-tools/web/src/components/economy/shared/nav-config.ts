import type { NavigationSection } from "./Navigation";

export const NAV_ITEMS: NavigationSection[] = [
  {
    header: "General",
    items: [
      {
        label: "Currency",
        value: "currency",
        path: "/economy/currency",
        iconUrl: "/economy_icons/Lilith's_Mirror.png",
      },
      {
        label: "Runes",
        value: "runes",
        path: "/economy/runes",
        iconUrl: "/economy_icons/Zod_Rune.png",
      },
      {
        label: "Ubers",
        value: "ubers",
        path: "/economy/ubers",
        iconUrl: "/economy_icons/vision.png",
      },
      {
        label: "Maps",
        value: "maps",
        path: "/economy/maps",
        iconUrl: "/economy_icons/gravemap.png",
      },
    ],
  },
];

export const DEFAULT_CATEGORY = NAV_ITEMS[0].items[0].value;
