import type { ThemeConfig } from "./types.js";

// ---- ANSI SGR helpers ----
function sgr(params: number[]): string {
  return `\x1b[${params.join(";")}m`;
}
function fg(r: number, g: number, b: number): string {
  return sgr([38, 2, r, g, b]);
}
function bg(r: number, g: number, b: number): string {
  return sgr([48, 2, r, g, b]);
}

// ---- Catppuccin Mocha palette ----
const mocha = {
  base:     [30, 30, 46] as const,   // #1e1e2e
  surface0: [46, 46, 64] as const,   // #2e2e40
  surface1: [55, 55, 75] as const,   // #37374b
  surface2: [66, 66, 90] as const,   // #42425a

  overlay2: [147, 153, 178] as const, // #9399b2

  green:    [166, 227, 161] as const,  // #a6e3a1
  yellow:   [249, 226, 175] as const,  // #f9e1af
  teal:     [148, 226, 213] as const,  // #94e2d5
  mauve:    [203, 166, 247] as const,  // #cba6f7
  lavender: [180, 190, 254] as const,  // #b4befe
  sky:      [137, 220, 235] as const,  // #89dceb
  peach:    [250, 179, 135] as const,  // #fab387
} as const;

/**
 * Catppuccin Mocha-inspired statusbar theme.
 *
 * Matches the original theme.ts palette exactly — foregrounds use surface
 * colors for readability against accent backgrounds.
 *
 * "Openers" (directory, provider, model) get light accent backgrounds.
 * "Closers" (thinking, git, cost, context, cache, token-flow) get darker
 * or muted backgrounds.
 */
export const CATPPUCCIN_THEME: ThemeConfig = {
  sections: {
    directory:    { fg: fg(...mocha.surface1), bg: bg(...mocha.yellow) },
    provider:     { fg: fg(...mocha.surface1), bg: bg(...mocha.teal) },
    model:        { fg: fg(...mocha.surface1), bg: bg(...mocha.mauve) },
    thinking:     { fg: fg(...mocha.lavender), bg: bg(...mocha.surface0) },
    git:          { fg: fg(...mocha.peach),    bg: bg(...mocha.surface1) },
    cost:         { fg: fg(...mocha.mauve),    bg: bg(...mocha.base) },
    context:      { fg: fg(...mocha.sky),      bg: bg(...mocha.surface0) },
    "token-flow": { fg: fg(...mocha.lavender), bg: bg(...mocha.surface1) },
    cache:        { fg: fg(...mocha.overlay2), bg: bg(...mocha.surface2) },
  },
  defaultSection: { fg: fg(...mocha.overlay2), bg: "" },
};