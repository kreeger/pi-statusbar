# Footer Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable blank lines beneath the pi-statusbar, controlled
by a `footerSpacing` field in `statusbar.json`.

**Architecture:** The `StatusbarConfig` interface gains a `footerSpacing`
field. `config.ts` parses and clamps it (0-3, default 0). `footer.ts`
appends that many empty strings to the `render()` return array. The pi TUI
already supports multi-line footer output — empty strings become blank
lines.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Add `footerSpacing` to StatusbarConfig

**Files:**
- Modify: `src/types.ts` (add field)
- Test: (tested implicitly in Task 1 steps + Task 2)

- [ ] **Step 1: Add field to interface**

Edit `src/types.ts` — add `footerSpacing` to `StatusbarConfig`:

```typescript
export interface StatusbarConfig {
  divider: string;
  sections: string[];
  /** Absolute path to a custom theme JSON file */
  themePath?: string;
  /** Number of blank lines below the statusbar (0-3). Default: 0. */
  footerSpacing?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add footerSpacing field to StatusbarConfig"
```

---

### Task 2: Parse and clamp footerSpacing in config

**Files:**
- Modify: `src/config.ts` (parse + clamp)
- Modify: `src/config.test.ts` (test parsing)

- [ ] **Step 1: Write the failing tests for footerSpacing parsing**

Edit `src/config.test.ts` — add these test cases inside
`describe("parseStatusbarConfig")`:

```typescript
it("parses footerSpacing as-is within range", () => {
  expect(
    parseStatusbarConfig({ divider: " | ", sections: [], footerSpacing: 2 }),
  ).toMatchObject({ footerSpacing: 2 });
});

it("defaults footerSpacing to 0 when missing", () => {
  const result = parseStatusbarConfig({
    divider: " | ",
    sections: [],
  });
  expect(result.footerSpacing).toBe(0);
});

it("clamps negative footerSpacing to 0", () => {
  expect(
    parseStatusbarConfig({ divider: " | ", sections: [], footerSpacing: -1 }),
  ).toMatchObject({ footerSpacing: 0 });
});

it("clamps footerSpacing above 3 to 3", () => {
  expect(
    parseStatusbarConfig({ divider: " | ", sections: [], footerSpacing: 5 }),
  ).toMatchObject({ footerSpacing: 3 });
});

it("defaults non-numeric footerSpacing to 0", () => {
  expect(
    parseStatusbarConfig({
      divider: " | ",
      sections: [],
      footerSpacing: "two",
    }),
  ).toMatchObject({ footerSpacing: 0 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/config.test.ts`

Expected: the new tests fail (footerSpacing is still undefined or not
parsed).

- [ ] **Step 3: Implement footerSpacing parsing in parseStatusbarConfig**

Edit `src/config.ts` — add parsing inside `parseStatusbarConfig` after the
`themePath` extraction:

```typescript
function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

This helper goes at the top level of the module (e.g., after the
`DEFAULT_STATUSBAR_CONFIG`).

Then, inside `parseStatusbarConfig`, after the `themePath` assignment:

```typescript
const rawSpacing = (input as Record<string, unknown>).footerSpacing;
const footerSpacing =
  typeof rawSpacing === "number" && Number.isFinite(rawSpacing)
    ? clampToRange(rawSpacing, 0, 3)
    : 0;
```

And include `footerSpacing` in the return value:

```typescript
return { divider, sections, themePath, footerSpacing };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/config.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "feat: parse and clamp footerSpacing in config"
```

---

### Task 3: Append blank lines in footer render

**Files:**
- Modify: `src/footer.ts` (append blank lines)
- Modify: `src/footer.test.ts` (test blank line output)

- [ ] **Step 1: Write the failing tests for footer spacing**

Edit `src/footer.test.ts` — add to `describe("renderStatusbarLine")`:

```typescript
import { createStatusbarFooter } from "./footer.js";

// ... existing tests ...

describe("createStatusbarFooter", () => {
  it("returns 1 line when footerSpacing is 0", () => {
    const styler = new PlainStyler();
    const reg = new SectionRegistry();
    reg.registerAll([{ id: "a", render: () => "A" }]);

    const footer = createStatusbarFooter({
      config: {
        divider: " | ",
        sections: ["a"],
        footerSpacing: 0,
      },
      cwd: "/repo",
      getModel: () => undefined,
      getThinkingLevel: () => "off",
      getContextUsage: () => undefined,
      getBranchEntries: () => [],
      getGitStatus: () => ({
        branch: null,
        added: 0,
        modified: 0,
        deleted: 0,
        untracked: 0,
        ahead: 0,
        behind: 0,
      }),
      registry: reg,
      styler,
    });

    const lines = footer.render(80);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBeTruthy();
  });

  it("returns 3 lines (statusbar + 2 blanks) when footerSpacing is 2", () => {
    const styler = new PlainStyler();
    const reg = new SectionRegistry();
    reg.registerAll([{ id: "a", render: () => "A" }]);

    const footer = createStatusbarFooter({
      config: {
        divider: " | ",
        sections: ["a"],
        footerSpacing: 2,
      },
      cwd: "/repo",
      getModel: () => undefined,
      getThinkingLevel: () => "off",
      getContextUsage: () => undefined,
      getBranchEntries: () => [],
      getGitStatus: () => ({
        branch: null,
        added: 0,
        modified: 0,
        deleted: 0,
        untracked: 0,
        ahead: 0,
        behind: 0,
      }),
      registry: reg,
      styler,
    });

    const lines = footer.render(80);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/footer.test.ts`

Expected: the new `createStatusbarFooter` tests fail (no such function or
missing blank lines).

- [ ] **Step 3: Implement blank line appending in createStatusbarFooter**

Edit `src/footer.ts` — in the `createStatusbarFooter` return object, update
the `render()` method to append blank lines:

```typescript
export function createStatusbarFooter(
  options: CreateStatusbarFooterOptions,
): Component {
  const { registry, config, styler } = options;

  return {
    invalidate() {},
    render(width: number): string[] {
      const accessors = createSectionAccessors(options);
      const line = renderStatusbarLine({
        config,
        ctx: accessors,
        registry,
        styler,
      });
      const lines = [truncateStatusbarLine(line, width)];
      for (let i = 0; i < (config.footerSpacing ?? 0); i++) {
        lines.push("");
      }
      return lines;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/footer.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/footer.ts src/footer.test.ts
git commit -m "feat: append blank lines in footer render per footerSpacing"
```