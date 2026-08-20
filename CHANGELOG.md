# Changelog

## [0.2.0](https://github.com/kreeger/pi-statusbar/compare/v0.1.1...v0.2.0) (2026-08-20)

### Features

* Claude quota segment ([#3](https://github.com/kreeger/pi-statusbar/issues/3)) ([ee62c8c](https://github.com/kreeger/pi-statusbar/commit/ee62c8cc795a92e4a609415b72cd70d055e5ccda))
* codex quota segment ([#1](https://github.com/kreeger/pi-statusbar/issues/1)) ([687ea84](https://github.com/kreeger/pi-statusbar/commit/687ea840e71bfec0f8ca08cd2ad59c0931732fa4))

### Bug Fixes

* Add GitHub Actions for CI ([f627f6c](https://github.com/kreeger/pi-statusbar/commit/f627f6c75144a70a1b44bf34a334592dd470ac83))

## [0.1.0] — 2026-06-18

### Added

- Initial release of pi-statusbar
- Built-in sections: directory, provider, model, thinking, git, cost,
  context, token-flow, cache
- Catppuccin Mocha theme with custom theme support via JSON files
- Configurable section ordering via `~/.pi/agent/statusbar.json`
- External extension API via `globalThis.__piStatusbarRegistry`
- Powerline-style rendering with configurable dividers
- Git status polling (background subprocess, cached results)
