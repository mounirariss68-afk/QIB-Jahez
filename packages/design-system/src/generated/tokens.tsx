/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#F7F9FB",
      "foreground": "#00111A",
      "border": "#D9E1E8",
      "card": "#FFFFFF",
      "cardForeground": "#00111A",
      "popover": "#EEF3F7",
      "popoverForeground": "#00111A",
      "primary": "#0075B0",
      "primaryForeground": "#FFFFFF",
      "secondary": "#002E5E",
      "secondaryForeground": "#FFFFFF",
      "muted": "#EEF3F7",
      "mutedForeground": "#4A5A68",
      "accent": "#A84E12",
      "accentForeground": "#FFFFFF",
      "destructive": "#B91C1C",
      "destructiveForeground": "#FFFFFF",
      "input": "#D9E1E8",
      "ring": "#0075B0",
      "chart1": "#2F86C4",
      "chart2": "#B2541A",
      "chart3": "#2E8B57",
      "chart4": "#6E267B",
      "chart5": "#831A4B",
      "sidebar": "#FFFFFF",
      "sidebarForeground": "#00111A",
      "sidebarBorder": "#D9E1E8",
      "sidebarPrimary": "#0075B0",
      "sidebarPrimaryForeground": "#FFFFFF",
      "sidebarAccent": "#EEF3F7",
      "sidebarAccentForeground": "#00111A",
      "sidebarRing": "#0075B0"
    },
    "dark": {
      "background": "#0F1A24",
      "foreground": "#E6EDF3",
      "border": "#243240",
      "card": "#16232F",
      "cardForeground": "#E6EDF3",
      "popover": "#1C2A38",
      "popoverForeground": "#E6EDF3",
      "primary": "#4CBDE8",
      "primaryForeground": "#0F1A24",
      "secondary": "#0075B0",
      "secondaryForeground": "#FFFFFF",
      "muted": "#1C2A38",
      "mutedForeground": "#9FB0BF",
      "accent": "#E59533",
      "accentForeground": "#1A0F05",
      "destructive": "#F87171",
      "destructiveForeground": "#0F1A24",
      "input": "#243240",
      "ring": "#4CBDE8",
      "chart1": "#5AA9E6",
      "chart2": "#E59533",
      "chart3": "#4CC38A",
      "chart4": "#A66BB8",
      "chart5": "#D96B8F",
      "sidebar": "#16232F",
      "sidebarForeground": "#E6EDF3",
      "sidebarBorder": "#243240",
      "sidebarPrimary": "#4CBDE8",
      "sidebarPrimaryForeground": "#0F1A24",
      "sidebarAccent": "#1C2A38",
      "sidebarAccentForeground": "#E6EDF3",
      "sidebarRing": "#4CBDE8"
    }
  },
  "fontFamily": {
    "sans": [
      "Inter",
      "Almarai",
      "system-ui",
      "-apple-system",
      "sans-serif"
    ],
    "serif": [
      "Open Sans",
      "Almarai",
      "Inter",
      "system-ui",
      "sans-serif"
    ],
    "mono": [
      "ui-monospace",
      "SFMono-Regular",
      "Menlo",
      "monospace"
    ],
    "wordmark": [
      "Open Sans",
      "Almarai",
      "system-ui",
      "sans-serif"
    ]
  },
  "radius": "0.625rem",
  "spacing": "0.25rem",
  "brand": {
    "gradient": [
      "#002E5E",
      "#0075B0",
      "#00A1DE",
      "#DF7A00"
    ],
    "status": {
      "light": {
        "success": "#15803D",
        "warn": "#B45309",
        "danger": "#B91C1C"
      },
      "dark": {
        "success": "#4ADE80",
        "warn": "#FBBF24",
        "danger": "#F87171"
      }
    },
    "backdrop": {
      "light": {
        "deep": "#E9EEF3",
        "mid": "#F7F9FB",
        "hi": "#FFFFFF"
      },
      "dark": {
        "deep": "#0B131B",
        "mid": "#0F1A24",
        "hi": "#16232F"
      }
    },
    "hero": {
      "background": "#002E5E",
      "foreground": "#EAF2F8",
      "card": "#0B3F75",
      "cardForeground": "#EAF2F8",
      "border": "#1F5A94",
      "mutedForeground": "#A9C3DA",
      "primary": "#F0923A",
      "primaryForeground": "#002E5E"
    }
  }
} as const;

export type Tokens = typeof tokens;
export default tokens;
