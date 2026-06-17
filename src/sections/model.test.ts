import { describe, expect, it } from "vitest";
import { builtinSections } from "./all.js";

const modelSection = builtinSections.find((s) => s.id === "model")!;
const thinkingSection = builtinSections.find((s) => s.id === "thinking")!;
import type { SectionAccessors, StatusbarModel } from "../types.js";

function ctx(model: StatusbarModel | undefined): SectionAccessors {
  return {
    getCwd: () => "/repo",
    getModel: () => model,
    getThinkingLevel: () => "high",
    getUsage: () => ({
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0,
    }),
    getContextUsage: () => undefined,
    getGit: () => ({
      branch: null, added: 0, modified: 0, deleted: 0, untracked: 0, ahead: 0, behind: 0,
    }),
  };
}

describe("modelSection", () => {
  it("hides without a model", () => {
    expect(modelSection.render(ctx(undefined))).toBeUndefined();
  });

  it("renders model id only", () => {
    expect(
      modelSection.render(ctx({ provider: "anthropic", id: "claude" })),
    ).toBe("\uf121  claude");
  });
});

describe("thinkingSection", () => {
  it("renders thinking level separately", () => {
    expect(thinkingSection.render(ctx(undefined))).toBe("\uf013  high");
  });
});
