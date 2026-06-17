# Changelog

## [0.1.0] — 2025-XX-XX

### Added

- Initial release of pi-statusbar
- Built-in sections: directory, provider, model, thinking, git, cost,
  context, token-flow, cache
- Catppuccin Mocha theme with custom theme support via JSON files
- Configurable section ordering via `~/.pi/agent/statusbar.json`
- External extension API via `globalThis.__piStatusbarRegistry`
- Powerline-style rendering with configurable dividers
- Git status polling (background subprocess, cached results)