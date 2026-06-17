import type { StatusbarSection } from "../types.js";

const ICON_GIT_BRANCH = "\ue0a0"; // nf-oct-git_branch
const ICON_ARROW_UP = "\u2191";   // ↑
const ICON_ARROW_DOWN = "\u2193"; // ↓

/**
 * Renders the git branch and compact dirty/ahead/behind information.
 * Example: "main +2 ~1 ?3 ↑1 ↓2"
 */
export const gitSection: StatusbarSection = {
  id: "git",
  render(ctx) {
    const git = ctx.getGit();
    if (!git.branch) return undefined;

    const parts = [`${ICON_GIT_BRANCH} ${git.branch}`];
    if (git.ahead > 0) parts.push(`${ICON_ARROW_UP}${git.ahead}`);
    if (git.behind > 0) parts.push(`${ICON_ARROW_DOWN}${git.behind}`);
    if (git.added > 0) parts.push(`+${git.added}`);
    if (git.modified > 0) parts.push(`~${git.modified}`);
    if (git.deleted > 0) parts.push(`-${git.deleted}`);
    if (git.untracked > 0) parts.push(`?${git.untracked}`);
    return parts.join(" ");
  },
};