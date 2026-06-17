export interface SectionTheme {
  /** ANSI SGR foreground, e.g. "\x1b[38;2;R;G;Bm" or "" for default */
  fg: string;
  /** ANSI SGR background, e.g. "\x1b[48;2;R;G;Bm" or "" for transparent */
  bg: string;
}

export interface ThemeConfig {
  sections: Record<string, SectionTheme>;
  defaultSection?: SectionTheme;
}