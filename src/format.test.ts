import { describe, expect, it } from "vitest";
import {
  formatCost,
  formatCount,
  joinSections,
  truncateStatusbarLine,
} from "./format.js";

describe("formatCount", () => {
  it("formats small counts as raw numbers", () => {
    expect(formatCount(999)).toBe("999");
  });

  it("formats thousands with one decimal", () => {
    expect(formatCount(1200)).toBe("1.2k");
  });
});

describe("formatCost", () => {
  it("formats cost with three decimals", () => {
    expect(formatCost(0.1234)).toBe("$0.123");
  });
});

describe("joinSections", () => {
  it("skips empty sections and places dividers between visible output", () => {
    expect(joinSections(["cwd", undefined, "model", ""], " | ")).toBe(
      "cwd | model",
    );
  });
});

describe("truncateStatusbarLine", () => {
  it("truncates to the available width", () => {
    const result = truncateStatusbarLine("abcdef", 4);
    // truncateToWidth wraps with ANSI reset codes; strip them for assertion
    const stripped = result.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("abc…");
  });
});
