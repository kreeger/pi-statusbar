import type { Component } from "@earendil-works/pi-tui";
import { truncateStatusbarLine } from "./format.js";
import type { Styler } from "./styler.js";
import type { SectionRegistry } from "./registry.js";
import type {
  GitStatusSnapshot,
  SectionAccessors,
  StatusbarConfig,
  StatusbarContextUsage,
  StatusbarModel,
  StatusbarUsage,
} from "./types.js";

export function collectUsage(entries: unknown[]): StatusbarUsage {
  const usage: StatusbarUsage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: 0,
  };

  for (const entry of entries) {
    const message = (entry as { type?: unknown; message?: any }).message;
    if ((entry as { type?: unknown }).type !== "message") continue;
    if (message?.role !== "assistant" || !message.usage) continue;

    usage.input += message.usage.input ?? 0;
    usage.output += message.usage.output ?? 0;
    usage.cacheRead += message.usage.cacheRead ?? 0;
    usage.cacheWrite += message.usage.cacheWrite ?? 0;
    usage.totalTokens += message.usage.totalTokens ?? 0;
    usage.cost += message.usage.cost?.total ?? 0;
  }

  return usage;
}

export function createSectionAccessors(opts: {
  cwd: string;
  getModel: () => StatusbarModel | undefined;
  getThinkingLevel: () => string;
  getBranchEntries: () => unknown[];
  getContextUsage: () => StatusbarContextUsage | undefined;
  getGitStatus: () => GitStatusSnapshot;
}): SectionAccessors {
  let cachedUsage: StatusbarUsage | undefined;

  return {
    getCwd: () => opts.cwd,
    getModel: () => opts.getModel(),
    getThinkingLevel: () => opts.getThinkingLevel(),
    getUsage: () => {
      if (!cachedUsage) cachedUsage = collectUsage(opts.getBranchEntries());
      return cachedUsage;
    },
    getContextUsage: () => opts.getContextUsage(),
    getGit: () => opts.getGitStatus(),
  };
}

interface RenderStatusbarLineOptions {
  config: StatusbarConfig;
  ctx: SectionAccessors;
  registry: SectionRegistry;
  styler: Styler;
}

/**
 * Core layout function: resolves sections via registry, styles via styler,
 * and assembles the final line. The layout layer only provides section
 * identities — the Styler owns all glyph and escape-code decisions.
 */
export function renderStatusbarLine(
  opts: RenderStatusbarLineOptions,
): string {
  const { config, ctx, registry, styler } = opts;
  const rendered = registry.renderAll(config.sections, ctx);
  if (rendered.length === 0) return "";

  const parts: string[] = [];

  // Start cap, then section content interleaved with dividers, then end cap
  parts.push(styler.renderCap(rendered[0].id, "start"));

  for (let i = 0; i < rendered.length; i++) {
    parts.push(styler.renderSection(rendered[i].text, rendered[i].id));

    if (i < rendered.length - 1) {
      parts.push(styler.renderDivider(rendered[i].id, rendered[i + 1].id));
    }
  }

  parts.push(styler.renderCap(rendered[rendered.length - 1].id, "end"));

  return parts.join("");
}

interface CreateStatusbarFooterOptions {
  config: StatusbarConfig;
  cwd: string;
  getModel: () => StatusbarModel | undefined;
  getThinkingLevel: () => string;
  getContextUsage: () => StatusbarContextUsage | undefined;
  getBranchEntries: () => unknown[];
  getGitStatus: () => GitStatusSnapshot;
  registry: SectionRegistry;
  styler: Styler;
}

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
      for (let i = 0; i < (config.footerSpacing ?? 1); i++) {
        lines.push(" ");
      }
      return lines;
    },
  };
}