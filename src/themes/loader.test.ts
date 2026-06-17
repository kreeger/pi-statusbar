import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadTheme } from "./loader.js";
import { CATPPUCCIN_THEME } from "./catppuccin.js";

let tempDir: string | undefined;

function tempFile(content: string): string {
  tempDir = mkdtempSync(join(tmpdir(), "pi-statusbar-theme-"));
  const path = join(tempDir, "theme.json");
  writeFileSync(path, content, "utf8");
  return path;
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("loadTheme", () => {
  it("returns Catppuccin default when themePath is undefined", () => {
    expect(loadTheme(undefined).sections.directory).toEqual(CATPPUCCIN_THEME.sections.directory);
  });

  it("returns Catppuccin default when themePath is empty", () => {
    expect(loadTheme("").sections.directory).toEqual(CATPPUCCIN_THEME.sections.directory);
  });

  it("returns Catppuccin default when file is missing", () => {
    expect(loadTheme("/definitely/missing/theme.json").sections.directory)
      .toEqual(CATPPUCCIN_THEME.sections.directory);
  });

  it("returns Catppuccin default when JSON is invalid", () => {
    expect(loadTheme(tempFile("not json")).sections.directory)
      .toEqual(CATPPUCCIN_THEME.sections.directory);
  });

  it("merges user overrides on top of Catppuccin", () => {
    const path = tempFile(
      JSON.stringify({
        sections: {
          directory: { fg: "\x1b[31m", bg: "\x1b[41m" },
        },
      }),
    );
    const theme = loadTheme(path);
    // Overridden section
    expect(theme.sections.directory).toEqual({
      fg: "\x1b[31m",
      bg: "\x1b[41m",
    });
    // Non-overridden sections preserved
    expect(theme.sections.provider).toEqual(
      CATPPUCCIN_THEME.sections.provider,
    );
  });

  it("merges defaultSection override", () => {
    const path = tempFile(
      JSON.stringify({
        defaultSection: { fg: "\x1b[32m", bg: "" },
      }),
    );
    const theme = loadTheme(path);
    expect(theme.defaultSection).toEqual({ fg: "\x1b[32m", bg: "" });
  });
});