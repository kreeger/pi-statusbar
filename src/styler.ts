import type { ThemeConfig } from "./themes/types.js";

/**
 * Styler abstracts all terminal ANSI rendering and glyph decisions.
 * Layout code in footer.ts never chooses characters or escape codes — it
 * delegates everything to this interface.
 *
 * Each method receives section IDs and resolves theme data internally.
 * The caller provides only section identities and content text.
 */
export interface Styler {
  /** Wrap a rendered section's text with its background/foreground styling. */
  renderSection(text: string, sectionId: string): string;

  /**
   * Render a visual divider between two adjacent sections.
   * The styler decides the glyph (powerline  /  or plain), the colours,
   * and any padding. Caller provides only the section identities.
   */
  renderDivider(prevId: string, nextId: string): string;

  /**
   * Render a cap at the start or end of the statusbar.
   * The styler decides the glyph (e.g. powerline  / ) and any padding.
   */
  renderCap(sectionId: string, position: "start" | "end"): string;

  /** Access the raw theme config (for testing/inspection). */
  getTheme(): ThemeConfig;
}