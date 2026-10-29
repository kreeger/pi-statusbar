import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { builtinSections } from "./all.js";
import type { SectionAccessors } from "../types.js";

function ctx(cwd: string): SectionAccessors {
  return {
    getCwd: () => cwd,
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
    getCodexQuota: () => undefined,
    getClaudeQuota: () => undefined,
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

describe("codex-quota", () => {
  const section = builtinSections.find((s) => s.id === "codex-quota")!;
  it("renders only for OpenAI/Codex with cached percent", () => {
    const base = ctx("/tmp/project");
    const quota = { ...base, getModel: () => ({ provider: "openai", id: "gpt" }), getCodexQuota: () => 42 };
    expect(section.render(quota)).toBe("\uf200  42%");
    expect(section.render({ ...quota, getModel: () => ({ provider: "openai-codex", id: "gpt-5.6" }) })).toBe("\uf200  42%");
    expect(section.render({ ...quota, getModel: () => ({ provider: "anthropic", id: "x" }) })).toBeUndefined();
  });
});

describe("claude-quota", () => {
  const section = builtinSections.find((s) => s.id === "claude-quota")!;
  it("renders only for Anthropic with cached percent", () => {
    const base = ctx("/tmp/project");
    const quota = { ...base, getModel: () => ({ provider: "anthropic", id: "claude" }), getClaudeQuota: () => 42 };
    expect(section.render(quota)).toBe("\uf200  42%");
    expect(section.render({ ...quota, getModel: () => ({ provider: "openai", id: "gpt" }) })).toBeUndefined();
  });
});

describe("token-flow", () => {
  const section = builtinSections.find((s) => s.id === "token-flow")!;
  const usage = { input: 617900, output: 3300, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 };

  it("shows the last turn's sent tokens for configured providers, with output still cumulative", () => {
    const base = { ...ctx("/tmp/project"), getUsage: () => usage, getPerTurnSentProviders: () => ["orm"] };
    const orm = { ...base, getLastTurn: () => ({ provider: "orm", input: 45473 }) };
    expect(section.render(orm)).toBe("\uf0a9  \u219145.5k \u21933.3k");
  });

  it("keeps cumulative sent for providers not in the list", () => {
    const base = { ...ctx("/tmp/project"), getUsage: () => usage, getPerTurnSentProviders: () => ["orm"] };
    const codex = { ...base, getLastTurn: () => ({ provider: "openai-codex", input: 45473 }) };
    expect(section.render(codex)).toBe("\uf0a9  \u2191617.9k \u21933.3k");
    expect(section.render(base)).toBe("\uf0a9  \u2191617.9k \u21933.3k");
  });

  it("stays cumulative when no providers are configured", () => {
    const base = { ...ctx("/tmp/project"), getUsage: () => usage, getLastTurn: () => ({ provider: "orm", input: 45473 }) };
    expect(section.render(base)).toBe("\uf0a9  \u2191617.9k \u21933.3k");
  });
});

describe("directory", () => {
  const section = builtinSections.find((s) => s.id === "directory")!;

  it("renders an abbreviated path with the final directory readable", () => {
    expect(
      section.render(ctx(join(homedir(), "src/kreeger/pi-extensions"))),
    ).toBe("\uf07c  ~/s/k/pi-extensions");
  });

  it("keeps short paths readable", () => {
    expect(section.render(ctx("/tmp/project"))).toBe("\uf07c  /t/project");
  });
});