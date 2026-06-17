import { describe, expect, it } from "vitest";
import {
  createEmptyGitStatus,
  parseGitStatus,
} from "./reader.js";

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

  it("parses ahead/behind from bracket notation", () => {
    const output = [
      "## feature...origin/feature [ahead 3, behind 1]",
    ].join("\n");

    expect(parseGitStatus(output)).toEqual({
      branch: "feature",
      added: 0,
      modified: 0,
      deleted: 0,
      untracked: 0,
      ahead: 3,
      behind: 1,
    });
  });

  it("parses ahead-only", () => {
    const output = ["## main [ahead 2]"].join("\n");
    const status = parseGitStatus(output);
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(0);
  });

  it("handles empty output", () => {
    expect(parseGitStatus("")).toEqual(createEmptyGitStatus());
  });
});