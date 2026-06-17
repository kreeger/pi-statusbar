import { homedir } from "node:os";
import { sep } from "node:path";
import { formatCost, formatCount } from "../format.js";
import type { StatusbarSection } from "../types.js";

// ---- helpers ----

function abbreviatePath(path: string): string {
  const home = homedir();
  const displayPath =
    path === home ? "~" : path.replace(`${home}${sep}`, `~${sep}`);
  const isHomeRelative = displayPath.startsWith(`~${sep}`);
  const isAbsolute = displayPath.startsWith(sep);
  const prefix = isHomeRelative ? "~" : isAbsolute ? "" : undefined;
  const body = isHomeRelative
    ? displayPath.slice(2)
    : displayPath.replace(/^\/+/, "");
  const parts = body.split(sep).filter(Boolean);

  if (parts.length === 0) return prefix ?? displayPath;

  const abbreviated = parts.map((part, index) =>
    index === parts.length - 1 ? part : part[0],
  );
  return `${prefix ?? ""}${sep}${abbreviated.join(sep)}`;
}

function formatContextWindow(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
  }
  return `${Math.round(value / 1000)}K`;
}

// ---- icons ----

const ICON_DIR = "\uf07c"; // nf-fa-folder_open
const ICON_MODEL = "\uf121"; // nf-fa-code
const ICON_PROV = "\uf0ac"; // nf-fa-globe
const ICON_THINK = "\uf013"; // nf-fa-cog
const ICON_CONTEXT = "\uf2db"; // nf-fa-microchip
const ICON_COST = "\uf0d6"; // nf-fa-money
const ICON_CACHE = "\uf1da"; // nf-fa-history
const ICON_TOKENS = "\uf0a9"; // nf-fa-arrow-right

// ---- sections ----

const directorySection: StatusbarSection = {
  id: "directory",
  render(ctx) {
    return `${ICON_DIR}  ${abbreviatePath(ctx.getCwd())}`;
  },
};

const providerSection: StatusbarSection = {
  id: "provider",
  render(ctx) {
    const model = ctx.getModel();
    if (!model) return undefined;
    return `${ICON_PROV}  ${model.provider}`;
  },
};

const modelSection: StatusbarSection = {
  id: "model",
  render(ctx) {
    const model = ctx.getModel();
    if (!model) return undefined;
    return `${ICON_MODEL}  ${model.id.replace(/^[a-zA-Z]+\//, "")}`;
  },
};

const thinkingSection: StatusbarSection = {
  id: "thinking",
  render(ctx) {
    return `${ICON_THINK}  ${ctx.getThinkingLevel()}`;
  },
};

const contextSection: StatusbarSection = {
  id: "context",
  render(ctx) {
    const contextUsage = ctx.getContextUsage();
    const percent =
      contextUsage?.percent === null || contextUsage?.percent === undefined
        ? "-"
        : Math.round(contextUsage.percent).toString();
    const contextWindow = contextUsage
      ? formatContextWindow(contextUsage.contextWindow)
      : "-";

    return `${ICON_CONTEXT}  ${percent}%/${contextWindow}`;
  },
};

const cacheSection: StatusbarSection = {
  id: "cache",
  render(ctx) {
    const usage = ctx.getUsage();
    const read = `\u21a9${formatCount(usage.cacheRead)}`;
    const write = `\u21e5${formatCount(usage.cacheWrite)}`;
    return `${ICON_CACHE}  ${read} ${write}`;
  },
};

const costSection: StatusbarSection = {
  id: "cost",
  render(ctx) {
    return `${ICON_COST}  ${formatCost(ctx.getUsage().cost)}`;
  },
};

const tokenFlowSection: StatusbarSection = {
  id: "token-flow",
  render(ctx) {
    const usage = ctx.getUsage();
    const input = `\u2191${formatCount(usage.input)}`;
    const output = `\u2193${formatCount(usage.output)}`;
    return `${ICON_TOKENS}  ${input} ${output}`;
  },
};

export const builtinSections: StatusbarSection[] = [
  directorySection,
  providerSection,
  modelSection,
  thinkingSection,
  cacheSection,
  contextSection,
  costSection,
  tokenFlowSection,
];