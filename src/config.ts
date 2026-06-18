import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StatusbarConfig } from "./types.js";

export const DEFAULT_STATUSBAR_CONFIG: StatusbarConfig = {
  divider: " | ",
  sections: ["directory", "provider", "model", "thinking", "git", "cost", "context", "token-flow", "cache"],
  footerSpacing: 1,
};

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getDefaultConfigPath(): string {
  return join(homedir(), ".pi", "agent", "statusbar.json");
}

export function parseStatusbarConfig(raw: unknown): StatusbarConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATUSBAR_CONFIG };

  const input = raw as { divider?: unknown; sections?: unknown; themePath?: unknown; footerSpacing?: unknown };
  const divider =
    typeof input.divider === "string"
      ? input.divider
      : DEFAULT_STATUSBAR_CONFIG.divider;
  const sections = Array.isArray(input.sections)
    ? input.sections.filter(
        (section): section is string => typeof section === "string",
      )
    : DEFAULT_STATUSBAR_CONFIG.sections;
  const themePath =
    typeof input.themePath === "string" ? input.themePath : undefined;

  const rawSpacing = (input as Record<string, unknown>).footerSpacing;
  const footerSpacing =
    typeof rawSpacing === "number" && Number.isFinite(rawSpacing)
      ? clampToRange(rawSpacing, 0, 3)
      : 1;

  return { divider, sections, themePath, footerSpacing };
}

export function loadStatusbarConfig(
  path: string = getDefaultConfigPath(),
): StatusbarConfig {
  if (!existsSync(path)) return { ...DEFAULT_STATUSBAR_CONFIG };

  try {
    return parseStatusbarConfig(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return { ...DEFAULT_STATUSBAR_CONFIG };
  }
}
