import type { SectionAccessors, StatusbarSection } from "./types.js";

/**
 * SectionRegistry manages the set of available statusbar sections.
 * Built-in sections register via registerAll(). External plugins can call
 * register() at a later lifecycle hook to add custom sections.
 *
 * register() with an existing ID silently replaces the old entry — this
 * allows plugins to override built-in sections.
 */
export class SectionRegistry {
  private sections = new Map<string, StatusbarSection>();

  register(section: StatusbarSection): void {
    this.sections.set(section.id, section);
  }

  registerAll(sections: StatusbarSection[]): void {
    for (const section of sections) {
      this.sections.set(section.id, section);
    }
  }

  get(id: string): StatusbarSection | undefined {
    return this.sections.get(id);
  }

  /** Render configuration section IDs in order, filtering out empty/unknown
   * sections. Returns ordered array of {id, text} for styling in footer.ts */
  renderAll(
    ids: string[],
    ctx: SectionAccessors,
  ): Array<{ id: string; text: string }> {
    const result: Array<{ id: string; text: string }> = [];
    for (const id of ids) {
      const section = this.sections.get(id);
      if (!section) continue;
      const text = section.render(ctx);
      if (text === undefined || text === "") continue;
      result.push({ id, text });
    }
    return result;
  }
}