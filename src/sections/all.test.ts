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

describe("directory", () => {
  const section = builtinSections.find((s) => s.id === "directory")!;

  it("renders an abbreviated path with the final directory readable", () => {
    expect(
      section.render(ctx("/Users/bkreeger/src/kreeger/pi-extensions")),
    ).toBe("\uf07c  ~/s/k/pi-extensions");
  });

  it("keeps short paths readable", () => {
    expect(section.render(ctx("/tmp/project"))).toBe("\uf07c  /t/project");
  });
});