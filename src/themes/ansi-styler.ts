import type { Styler } from "../styler.js";
import type { SectionTheme, ThemeConfig } from "./types.js";

const RESET = "\x1b[0m";

/**
 * Convert a background SGR escape to the equivalent foreground SGR so a
 * section's accent colour can be used as the glyph colour of a divider.
 */
function bgSgrToFgSgr(bg: string): string {
  return bg.replace("\x1b[48", "\x1b[38");
}

/**
 * AnsiStyler implements the Styler interface using ANSI SGR escape codes
 * and powerline segments matching the original theme.ts behavior exactly.
 *
 * Dividers render with padding spaces that inherit the adjacent section's
 * background colour — creating a seamless colour transition between segments.
 */
export class AnsiStyler implements Styler {
  constructor(private theme: ThemeConfig) {}

  getTheme(): ThemeConfig {
    return this.theme;
  }

  private themeFor(sectionId: string): SectionTheme {
    return this.theme.sections[sectionId] ?? this.theme.defaultSection ?? { fg: "", bg: "" };
  }

  /** Background colour of a section (empty string if none). */
  private sectionBg(sectionId: string): string {
    return this.themeFor(sectionId).bg;
  }

  renderSection(text: string, sectionId: string): string {
    const t = this.themeFor(sectionId);
    if (!t.bg && !t.fg) return text;
    // Order: bg first, then fg, then text, then reset
    return `${t.bg}${t.fg}${text}${RESET}`;
  }

  private dividerGlyph(prevId: string, nextId: string): string {
    //  (rounded cap) after model and git sections,  (chevron) otherwise
    if (prevId === "model" || prevId === "git") return "\u{e0b4}";
    return "\u{e0b0}";
  }

  renderDivider(prevId: string, nextId: string): string {
    const char = this.dividerGlyph(prevId, nextId);
    const prevBg = this.sectionBg(prevId);
    const nextBg = this.sectionBg(nextId);

    if (char === "\u{e0b0}") {
      //  — between regular sections — with padding spaces in adjacent bg colours
      let result = "";
      if (prevBg) result += `${prevBg} ${RESET}`;
      result += nextBg
        ? `${bgSgrToFgSgr(prevBg)}${nextBg}${char}${RESET}`
        : `${bgSgrToFgSgr(prevBg)}${char}${RESET}`;
      if (nextBg) result += `${nextBg} ${RESET}`;
      return result;
    }

    //  — cap divider (after model/git or at end) — no preceding padding,
    // trailing space colored in next section's bg for seamless transition
    const glyph = nextBg
      ? `${bgSgrToFgSgr(prevBg)}${nextBg}${char}${RESET}`
      : `${bgSgrToFgSgr(prevBg)}${char}${RESET}`;
    return nextBg ? `${glyph}${nextBg} ${RESET}` : `${glyph} `;
  }

  renderCap(sectionId: string, position: "start" | "end"): string {
    const bg = this.sectionBg(sectionId);

    if (position === "start") {
      //  — opening cap, fg = first section's bg, no bg
      return bg ? `${bgSgrToFgSgr(bg)}\u{e0b6}${RESET}` : "\u{e0b6}";
    }

    //  — closing cap, no leading padding, trailing space
    const glyph = `${bgSgrToFgSgr(bg)}\u{e0b4}${RESET}`;
    return bg ? `${glyph}${bg} ${RESET}` : `${glyph} `;
  }
}