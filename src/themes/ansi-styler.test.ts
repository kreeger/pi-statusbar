import { describe, expect, it } from "vitest";
import { AnsiStyler } from "./ansi-styler.js";
import { CATPPUCCIN_THEME } from "./catppuccin.js";

const RESET = "\x1b[0m";

function strip(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("AnsiStyler", () => {
  it("renderSection wraps text with bg/fg/reset", () => {
    const styler = new AnsiStyler(CATPPUCCIN_THEME);
    const result = styler.renderSection("hello", "directory");
    expect(result).toContain("hello");
    expect(result).toContain(RESET);
    expect(result.indexOf("\x1b[48")).toBeLessThan(result.indexOf("hello"));
  });

  it("renderSection uses defaultSection for unknown section IDs", () => {
    const styler = new AnsiStyler({
      sections: {},
      defaultSection: { fg: "\x1b[31m", bg: "" },
    });
    expect(styler.renderSection("x", "unknown")).toBe("\x1b[31mx\x1b[0m");
  });

  it("renderCap creates  for start position", () => {
    const styler = new AnsiStyler(CATPPUCCIN_THEME);
    const result = styler.renderCap("directory", "start");
    expect(strip(result)).toBe("\u{e0b6}");
    expect(result).toContain("\x1b[38;2;"); // fg from bg
  });

  it("renderCap creates  for end position", () => {
    const styler = new AnsiStyler(CATPPUCCIN_THEME);
    const result = styler.renderCap("cache", "end");
    expect(strip(result)).toBe("\u{e0b4}");
    expect(result).toContain("\x1b[38;2;");
  });

  it("renderDivider between directory→provider uses ", () => {
    const styler = new AnsiStyler(CATPPUCCIN_THEME);
    const result = styler.renderDivider("directory", "provider");
    expect(strip(result)).toContain("\u{e0b0}");
    expect(result).toContain(RESET);
  });

  it("renderDivider after model uses  (cap)", () => {
    const styler = new AnsiStyler(CATPPUCCIN_THEME);
    const result = styler.renderDivider("model", "thinking");
    const stripped = strip(result);
    expect(stripped.startsWith("\u{e0b4}")).toBe(true);
  });

  it("getTheme returns theme data", () => {
    const styler = new AnsiStyler(CATPPUCCIN_THEME);
    expect(styler.getTheme().sections.directory).toBeDefined();
  });
});