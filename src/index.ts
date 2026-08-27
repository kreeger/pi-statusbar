import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadStatusbarConfig } from "./config.js";
import { createStatusbarFooter } from "./footer.js";
import { SectionRegistry } from "./registry.js";
import { AnsiStyler } from "./themes/ansi-styler.js";
import { loadTheme } from "./themes/loader.js";
import { builtinSections } from "./sections/index.js";
import { GitState, gitSection } from "./git/index.js";
import { CodexQuotaState } from "./codex-quota.js";
import { ClaudeQuotaState } from "./claude-quota.js";

export default function (
  pi: ExtensionAPI,
  createCodexQuotaState: () => CodexQuotaState = () => new CodexQuotaState(),
  createClaudeQuotaState: () => ClaudeQuotaState = () => new ClaudeQuotaState(),
) {
  let gitState: GitState | undefined;
  let codexQuotaState: CodexQuotaState | undefined;
  let claudeQuotaState: ClaudeQuotaState | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI || !ctx.ui) return;

    const config = loadStatusbarConfig();
    const theme = loadTheme(config.themePath);
    const styler = new AnsiStyler(theme);
    const registry = new SectionRegistry();

    // Register built-in sections
    registry.registerAll(builtinSections);

    // Register git section + start its polling lifecycle
    const sessionGitState = new GitState(pi, ctx.cwd);
    gitState = sessionGitState;
    registry.register(gitSection);
    sessionGitState.startPolling();
    if (config.sections.includes("codex-quota")) {
      codexQuotaState = createCodexQuotaState();
    }
    if (config.sections.includes("claude-quota")) {
      claudeQuotaState = createClaudeQuotaState();
      claudeQuotaState.startPolling();
    }

    let requestFooterRender = () => {};
    ctx.ui.setFooter((tui) => {
      requestFooterRender = () => tui.requestRender();
      return createStatusbarFooter({
        config,
        cwd: ctx.cwd,
        getModel: () =>
          ctx.model
            ? {
                provider: ctx.model.provider,
                id: ctx.model.id,
                name: ctx.model.name,
              }
            : undefined,
        getThinkingLevel: () => pi.getThinkingLevel(),
        getContextUsage: () => ctx.getContextUsage(),
        getBranchEntries: () => ctx.sessionManager.getBranch(),
        getGitStatus: () => sessionGitState.snapshot,
        getCodexQuota: () => codexQuotaState?.usedPercent,
        getClaudeQuota: () => claudeQuotaState?.usedPercent,
        registry,
        styler,
      });
    });
    codexQuotaState?.startPolling(requestFooterRender);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    ctx.ui?.setFooter(undefined);

    if (gitState) {
      gitState.stopPolling();
      gitState = undefined;
    }
    codexQuotaState?.stopPolling();
    codexQuotaState = undefined;
    claudeQuotaState?.stopPolling();
    claudeQuotaState = undefined;
  });
}
