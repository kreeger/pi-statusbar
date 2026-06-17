# Contributing to pi-statusbar

Thanks for your interest in pi-statusbar! This document covers how to
contribute, set up a development environment, and get your changes
reviewed and merged.

## Getting started

1. Fork the [repository](https://github.com/kreeger/pi-statusbar) on
   GitHub.
2. Clone your fork:
   ```bash
   git clone git@github.com:YOUR_USERNAME/pi-statusbar.git
   cd pi-statusbar
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the tests to verify everything works:
   ```bash
   npm test
   ```

## Development workflow

This project uses [Vitest](https://vitest.dev/) for testing. Tests live
alongside source files (`.test.ts`). Run the full suite before pushing:

```bash
npm test
```

### Testing your changes in pi

After making changes, deploy them to your local pi extension directory
and restart your pi session:

```bash
npm run deploy
```

This copies source files (excluding test files) into
`~/.pi/agent/extensions/pi-statusbar/`.

## Submitting changes

1. Create a branch with a descriptive name:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes and commit them. Keep commits focused and
   well-described.
3. Push your branch and open a pull request.

### Pull request guidelines

- **One change per PR.** If you have multiple unrelated changes, split
  them into separate pull requests.
- **Include tests.** New sections or features should include test
  coverage. Bug fixes should add a test that reproduces the issue.
- **Update documentation.** If you add a new built-in section, document
  it in `README.md`. If you change configuration behaviour, update the
  relevant docs.
- **Keep the scope tight.** Avoid reformatting unrelated code or
  changing dependencies that aren't needed for your change.

## Coding conventions

- Written in TypeScript with strict mode enabled.
- Tests use Vitest (import `{ expect, test, describe, vi }` from
  `vitest`).
- The codebase does not use Prettier or ESLint. Match the surrounding
  style when making changes.

## Asking questions

Open a [GitHub Discussion](https://github.com/kreeger/pi-statusbar/discussions)
or an issue if you have questions about the codebase, feature ideas, or
run into trouble getting set up.