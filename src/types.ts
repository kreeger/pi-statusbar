export interface StatusbarConfig {
  divider: string;
  sections: string[];
  /** Absolute path to a custom theme JSON file */
  themePath?: string;
  /** Number of blank lines below the statusbar (0-3). Default: 0. */
  footerSpacing?: number;
}

export interface StatusbarUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
}

export interface StatusbarContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export interface StatusbarModel {
  provider: string;
  id: string;
  name?: string;
}

export interface GitStatusSnapshot {
  branch: string | null;
  added: number;
  modified: number;
  deleted: number;
  untracked: number;
  ahead: number;
  behind: number;
}

export interface StatusbarRenderContext {
  cwd: string;
  model: StatusbarModel | undefined;
  thinkingLevel: string;
  usage: StatusbarUsage;
  contextUsage: StatusbarContextUsage | undefined;
  git: GitStatusSnapshot;
}

/**
 * Lazy accessors for statusbar data. Created once per render pass; each
 * getter evaluates on first call and caches the result. Sections that never
 * call a given getter never pay for its computation (e.g. collectUsage).
 *
 * Prefer these over StatusbarRenderContext when the cost of computing a
 * value should be deferred until a section actually needs it.
 */
export interface SectionAccessors {
  getCwd(): string;
  getModel(): StatusbarModel | undefined;
  getThinkingLevel(): string;
  getUsage(): StatusbarUsage;
  getContextUsage(): StatusbarContextUsage | undefined;
  getGit(): GitStatusSnapshot;
}

export interface StatusbarSection {
  id: string;
  render(ctx: SectionAccessors): string | undefined;
}
