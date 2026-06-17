import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadStatusbarConfig } from "./config.js";
import { createStatusbarFooter } from "./footer.js";
import { SectionRegistry } from "./registry.js";
import { AnsiStyler } from "./themes/ansi-styler.js";
import { loadTheme } from "./themes/loader.js";
import { builtinSections } from "./sections/index.js";
import { GitState, gitSection } from "./git/index.js";

export default function (pi: ExtensionAPI) {
  let gitState: GitState | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI || !ctx.ui) return;

    const config = loadStatusbarConfig();
    const theme = loadTheme(config.themePath);
    const styler = new AnsiStyler(theme);
    const registry = new SectionRegistry();

    // Register built-in sections
    registry.registerAll(builtinSections);

    // Register git section + start its polling lifecycle
    gitState = new GitState(pi, ctx.cwd);
    registry.register(gitSection);
    gitState.startPolling();

    ctx.ui.setFooter(() =>
      createStatusbarFooter({
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
        getGitStatus: () => gitState!.snapshot,
        registry,
        styler,
      }),
    );
  });

  pi.on("session_shutdown", () => {
    if (gitState) {
      gitState.stopPolling();
      gitState = undefined;
    }
  });
}