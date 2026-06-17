import { describe, expect, it } from "vitest";
import { SectionRegistry } from "./registry.js";
import type { SectionAccessors, StatusbarSection } from "./types.js";

const ctx = {} as SectionAccessors;

const sectionA: StatusbarSection = { id: "a", render: () => "A" };
const sectionB: StatusbarSection = { id: "b", render: () => "B" };
const sectionEmpty: StatusbarSection = { id: "empty", render: () => undefined };
const sections = [sectionA, sectionB, sectionEmpty];

describe("SectionRegistry", () => {
  it("registerAll makes sections available by ID", () => {
    const r = new SectionRegistry();
    r.registerAll(sections);
    expect(r.get("a")).toBe(sectionA);
    expect(r.get("b")).toBe(sectionB);
    expect(r.get("missing")).toBeUndefined();
  });

  it("register adds a single section", () => {
    const r = new SectionRegistry();
    r.register(sectionA);
    expect(r.get("a")).toBe(sectionA);
  });

  it("register overrides an existing section with the same ID", () => {
    const r = new SectionRegistry();
    r.register(sectionA);
    const replacement: StatusbarSection = { id: "a", render: () => "Z" };
    r.register(replacement);
    expect(r.get("a")).toBe(replacement);
  });

  it("renderAll returns rendered sections in order, skipping empty", () => {
    const r = new SectionRegistry();
    r.registerAll(sections);
    const result = r.renderAll(["a", "empty", "b"], ctx);
    expect(result).toEqual([
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ]);
  });

  it("renderAll skips unknown section IDs", () => {
    const r = new SectionRegistry();
    r.registerAll(sections);
    const result = r.renderAll(["a", "missing", "b"], ctx);
    expect(result).toEqual([
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ]);
  });

  it("renderAll returns empty array for empty input", () => {
    const r = new SectionRegistry();
    const result = r.renderAll([], ctx);
    expect(result).toEqual([]);
  });
});