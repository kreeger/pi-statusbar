import { describe, expect, it } from "vitest";
import { createEmptyGitStatus, parseGitStatus } from "../git/reader.js";
import { gitSection } from "../git/section.js";
import type { GitStatusSnapshot, SectionAccessors } from "../types.js";

function ctx(git = createEmptyGitStatus()): SectionAccessors {
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
    getGit: () => git,
  };
}

describe("parseGitStatus", () => {
  it("parses branch and dirty counts", () => {
    const output = [
      "## main",
      "A  added.ts",
      " M modified.ts",
      " D deleted.ts",
      "?? untracked.ts",
    ].join("\n");

    expect(parseGitStatus(output)).toEqual({
      branch: "main",
      added: 1,
      modified: 1,
      deleted: 1,
      untracked: 1,
      ahead: 0,
      behind: 0,
    });
  });

  it("handles detached or missing branch output", () => {
    expect(parseGitStatus("")).toEqual(createEmptyGitStatus());
  });

  it("parses ahead from branch line", () => {
    const output = "## main...origin/main [ahead 3]\n M modified.ts";
    expect(parseGitStatus(output)).toMatchObject({ ahead: 3, behind: 0 });
  });

  it("parses behind from branch line", () => {
    const output = "## main...origin/main [behind 4]";
    expect(parseGitStatus(output)).toMatchObject({ ahead: 0, behind: 4 });
  });

  it("parses diverged (both ahead and behind)", () => {
    const output = "## main...origin/main [ahead 1 behind 2]";
    expect(parseGitStatus(output)).toMatchObject({ ahead: 1, behind: 2 });
  });
});

describe("gitSection", () => {
  it("hides when there is no branch", () => {
    expect(gitSection.render(ctx())).toBeUndefined();
  });

  it("renders branch only when clean", () => {
    expect(
      gitSection.render(ctx({ ...createEmptyGitStatus(), branch: "main" })),
    ).toBe("\ue0a0 main");
  });

  it("renders compact dirty counts", () => {
    expect(
      gitSection.render(
        ctx({
          branch: "main",
          added: 2,
          modified: 1,
          deleted: 0,
          untracked: 3,
          ahead: 0,
          behind: 0,
        }),
      ),
    ).toBe("\ue0a0 main +2 ~1 ?3");
  });

  it("renders ahead count", () => {
    expect(
      gitSection.render(
        ctx({
          branch: "main",
          added: 0,
          modified: 0,
          deleted: 0,
          untracked: 0,
          ahead: 3,
          behind: 0,
        }),
      ),
    ).toBe("\ue0a0 main \u21913");
  });

  it("renders diverged (both ahead and behind)", () => {
    expect(
      gitSection.render(
        ctx({
          branch: "main",
          added: 0,
          modified: 0,
          deleted: 0,
          untracked: 0,
          ahead: 2,
          behind: 1,
        }),
      ),
    ).toBe("\ue0a0 main \u21912 \u21931");
  });
});