import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_STATUSBAR_CONFIG,
  loadStatusbarConfig,
  parseStatusbarConfig,
} from "./config.js";

let tempDir: string | undefined;

function tempFile(content: string): string {
  tempDir = mkdtempSync(join(tmpdir(), "pi-statusbar-"));
  const path = join(tempDir, "statusbar.json");
  writeFileSync(path, content, "utf8");
  return path;
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("parseStatusbarConfig", () => {
  it("uses defaults for non-object input", () => {
    expect(parseStatusbarConfig(null)).toEqual({
      divider: " | ",
      sections: ["directory", "provider", "model", "thinking", "git", "cost", "context", "token-flow", "cache"],
    });
  });

  it("accepts divider and sections overrides", () => {
    expect(
      parseStatusbarConfig({ divider: " • ", sections: ["model"] }),
    ).toEqual({
      divider: " • ",
      sections: ["model"],
    });
  });

  it("extracts themePath when present", () => {
    expect(
      parseStatusbarConfig({
        divider: " | ",
        sections: ["directory"],
        themePath: "/custom/theme.json",
      }),
    ).toEqual({
      divider: " | ",
      sections: ["directory"],
      themePath: "/custom/theme.json",
    });
  });

  it("ignores non-string themePath", () => {
    const result = parseStatusbarConfig({
      divider: " | ",
      sections: ["directory"],
      themePath: 123,
    });
    expect(result.themePath).toBeUndefined();
  });

  it("falls back per invalid field", () => {
    expect(parseStatusbarConfig({ divider: 3, sections: ["git", 1] })).toEqual({
      divider: " | ",
      sections: ["git"],
    });
  });
});

describe("loadStatusbarConfig", () => {
  it("uses defaults when file is missing", () => {
    expect(loadStatusbarConfig("/definitely/missing/statusbar.json")).toEqual(
      DEFAULT_STATUSBAR_CONFIG,
    );
  });

  it("uses defaults when JSON is invalid", () => {
    expect(loadStatusbarConfig(tempFile("{"))).toEqual(
      DEFAULT_STATUSBAR_CONFIG,
    );
  });

  it("loads valid JSON", () => {
    expect(loadStatusbarConfig(tempFile('{"sections":["tokens"]}'))).toEqual({
      divider: " | ",
      sections: ["tokens"],
    });
  });
});