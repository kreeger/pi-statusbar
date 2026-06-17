import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StatusbarConfig } from "./types.js";

export const DEFAULT_STATUSBAR_CONFIG: StatusbarConfig = {
  divider: " | ",
  sections: ["directory", "provider", "model", "thinking", "git", "cost", "context", "token-flow", "cache"],
};

export function getDefaultConfigPath(): string {
  return join(homedir(), ".pi", "agent", "statusbar.json");
}

export function parseStatusbarConfig(raw: unknown): StatusbarConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATUSBAR_CONFIG };

  const input = raw as { divider?: unknown; sections?: unknown; themePath?: unknown };
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

  return { divider, sections, themePath };
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
