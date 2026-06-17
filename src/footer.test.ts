import { describe, expect, it } from "vitest";
import { collectUsage, renderStatusbarLine } from "./footer.js";
import { SectionRegistry } from "./registry.js";
import type { Styler } from "./styler.js";
import type { SectionAccessors } from "./types.js";

/** A plain-text styler that does no ANSI wrapping — enables testing layout
 * structure without escape codes. */
class PlainStyler implements Styler {
  renderSection(text: string, _sectionId: string): string {
    return text;
  }
  renderDivider(prevId: string, _nextId: string): string {
    return prevId === "model" || prevId === "git" ? "\u{e0b4}" : "\u{e0b0}";
  }
  renderCap(_sectionId: string, position: "start" | "end"): string {
    return position === "start" ? "\u{e0b6}" : "\u{e0b4} ";
  }
  getTheme(): any {
    return { sections: {} };
  }
}

function makeAccessors(): SectionAccessors {
  return {
    getCwd: () => "/repo",
    getModel: () => undefined,
    getThinkingLevel: () => "off",
    getUsage: () => ({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: 0,
    }),
    getContextUsage: () => undefined,
    getGit: () => ({
      branch: null,
      added: 0,
      modified: 0,
      deleted: 0,
      untracked: 0,
      ahead: 0,
      behind: 0,
    }),
  };
}

describe("renderStatusbarLine", () => {
  it("renders configured sections in order with powerline brackets", () => {
    const styler = new PlainStyler();
    const reg = new SectionRegistry();
    reg.registerAll([
      { id: "a", render: () => "A" },
      { id: "b", render: () => "B" },
    ]);

    const result = renderStatusbarLine({
      config: { divider: " | ", sections: ["b", "a"] },
      ctx: makeAccessors(),
      registry: reg,
      styler,
    });
    expect(result).toBe("\u{e0b6}B\u{e0b0}A\u{e0b4} ");
  });

  it("skips unknown and empty sections", () => {
    const styler = new PlainStyler();
    const reg = new SectionRegistry();
    reg.registerAll([
      { id: "a", render: () => "A" },
      { id: "empty", render: () => undefined },
      { id: "b", render: () => "B" },
    ]);

    const result = renderStatusbarLine({
      config: { divider: " / ", sections: ["missing", "a", "empty", "b"] },
      ctx: makeAccessors(),
      registry: reg,
      styler,
    });
    expect(result).toBe("\u{e0b6}A\u{e0b0}B\u{e0b4} ");
  });

  it("uses  divider after model and git sections", () => {
    const styler = new PlainStyler();
    const reg = new SectionRegistry();
    reg.registerAll([
      { id: "model", render: () => "M" },
      { id: "thinking", render: () => "T" },
      { id: "git", render: () => "G" },
      { id: "cost", render: () => "C" },
    ]);

    const result = renderStatusbarLine({
      config: { divider: " | ", sections: ["model", "thinking", "git", "cost"] },
      ctx: makeAccessors(),
      registry: reg,
      styler,
    });
    expect(result).toBe("\u{e0b6}M\u{e0b4}T\u{e0b0}G\u{e0b4}C\u{e0b4} ");
  });
});

describe("collectUsage", () => {
  it("sums assistant message usage", () => {
    const entries = [
      {
        type: "message",
        message: {
          role: "assistant",
          usage: {
            input: 10, output: 3, cacheRead: 2, cacheWrite: 1,
            totalTokens: 16, cost: { total: 0.01 },
          },
        },
      },
    ];

    expect(collectUsage(entries)).toEqual({
      input: 10, output: 3, cacheRead: 2, cacheWrite: 1,
      totalTokens: 16, cost: 0.01,
    });
  });
});