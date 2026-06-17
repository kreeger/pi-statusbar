import { existsSync, readFileSync } from "node:fs";
import { CATPPUCCIN_THEME } from "./catppuccin.js";
import type { ThemeConfig } from "./types.js";

/**
 * Load a theme from the given JSON file path, merging over the Catppuccin
 * default. Missing, empty, invalid, or non-existent paths fall back to pure
 * Catppuccin. Theme overrides are shallow — a user-provided section replaces
 * the entire SectionTheme for that section key.
 */
export function loadTheme(themePath: string | undefined): ThemeConfig {
  if (!themePath) return CATPPUCCIN_THEME;
  if (!existsSync(themePath)) return CATPPUCCIN_THEME;

  try {
    const raw = JSON.parse(readFileSync(themePath, "utf8"));
    if (!raw || typeof raw !== "object") return CATPPUCCIN_THEME;

    const userTheme = raw as {
      sections?: Record<string, unknown>;
      defaultSection?: unknown;
    };

    const merged: ThemeConfig = {
      sections: { ...CATPPUCCIN_THEME.sections },
      defaultSection: CATPPUCCIN_THEME.defaultSection,
    };

    if (
      userTheme.defaultSection &&
      typeof userTheme.defaultSection === "object"
    ) {
      const ds = userTheme.defaultSection as { fg?: string; bg?: string };
      merged.defaultSection = {
        fg: typeof ds.fg === "string" ? ds.fg : merged.defaultSection?.fg ?? "",
        bg: typeof ds.bg === "string" ? ds.bg : merged.defaultSection?.bg ?? "",
      };
    }

    if (userTheme.sections && typeof userTheme.sections === "object") {
      for (const [key, value] of Object.entries(userTheme.sections)) {
        if (value && typeof value === "object") {
          const s = value as { fg?: string; bg?: string };
          merged.sections[key] = {
            fg:
              typeof s.fg === "string"
                ? s.fg
                : merged.sections[key]?.fg ?? "",
            bg:
              typeof s.bg === "string"
                ? s.bg
                : merged.sections[key]?.bg ?? "",
          };
        }
      }
    }

    return merged;
  } catch {
    return CATPPUCCIN_THEME;
  }
}