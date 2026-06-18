# Configurable Footer Spacing for pi-statusbar

## Summary

Add a `footerSpacing` config option to insert blank lines beneath the
statusbar, creating visual breathing room between the statusbar and the
terminal's bottom edge.

## Requirements

- User can configure 0-3 blank lines below the statusbar
- Default is 0 (no gap, backward-compatible)
- Out-of-range values are clamped to [0, 3]
- Configured via a new `footerSpacing` field in `~/.pi/agent/statusbar.json`

## Config Surface

```json
{
  "sections": ["directory", "provider", "model", "git", "cost"],
  "footerSpacing": 1
}
```

## Implementation

### Files to change

| File | Change |
|------|--------|
| `src/types.ts` | Add `footerSpacing?: number` to `StatusbarConfig` |
| `src/config.ts` | Parse `footerSpacing`, clamp to `[0, 3]`, default `0` |
| `src/footer.ts` | Append `footerSpacing` empty strings to `render()` return array |
| `src/footer.test.ts` | Test blank line count based on config |
| `src/config.test.ts` | Test parsing and clamping of `footerSpacing` |

### Types

```typescript
export interface StatusbarConfig {
  divider: string;
  sections: string[];
  themePath?: string;
  /** Number of blank lines below the statusbar (0-3). Default: 0. */
  footerSpacing?: number;
}
```

### Config parsing

```typescript
function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const rawSpacing = (input as any).footerSpacing;
const footerSpacing =
  typeof rawSpacing === "number" && Number.isFinite(rawSpacing)
    ? clampToRange(rawSpacing, 0, 3)
    : 0;
```

### Footer rendering

```typescript
export function createStatusbarFooter(...): Component {
  return {
    invalidate() {},
    render(width: number): string[] {
      const accessors = createSectionAccessors(options);
      const line = renderStatusbarLine({ ... });
      const lines = [truncateStatusbarLine(line, width)];
      for (let i = 0; i < (config.footerSpacing ?? 0); i++) {
        lines.push("");
      }
      return lines;
    },
  };
}
```

### Testing plan

**config.test.ts:**
- Missing `footerSpacing` → defaults to 0
- `footerSpacing: 1` → passes through
- `footerSpacing: -1` → clamps to 0
- `footerSpacing: 5` → clamps to 3
- `footerSpacing: "two"` → defaults to 0 (not a number)

**footer.test.ts:**
- Spacing 0 → 1 line returned
- Spacing 2 → 3 lines returned (statusbar + 2 blanks)
- Third line (blank) is empty string

## Rationale

- **Default 0:** No visual change for existing users. Opt-in feature.
- **Clamp not error:** Forgiving DX. If someone types `footerSpacing: 5`,
  they get 3 blank lines — not a broken config. Clamping is the standard
  approach for this kind of numeric config.
- **Footer returns string[]:** The pi TUI footer contract already supports
  multi-line output. Returning empty strings is the natural way to add
  vertical space — no new mechanisms needed.