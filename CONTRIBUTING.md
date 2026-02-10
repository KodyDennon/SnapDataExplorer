# Contributing to Snap Data Explorer

Thank you for your interest in contributing!

## Development Setup

1. Install prerequisites:
   - [Node.js](https://nodejs.org/) 20+
   - [Rust](https://rustup.rs/) stable toolchain
   - Platform-specific Tauri dependencies ([guide](https://v2.tauri.app/start/prerequisites/))

2. Clone and install:
   ```bash
   git clone https://github.com/KodyDennon/SnapDataExplorer.git
   cd SnapDataExplorer
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and automated releases via [semantic-release](https://semantic-release.gitbook.io/). Your commit messages determine the next version number automatically:

| Prefix | Example | Version Bump |
|--------|---------|--------------|
| `fix:` | `fix: prevent crash on empty export` | Patch (0.2.0 -> 0.2.1) |
| `feat:` | `feat: add date range filter` | Minor (0.2.0 -> 0.3.0) |
| `feat!:` | `feat!: redesign import flow` | Major (0.2.0 -> 1.0.0) |
| `chore:` | `chore: update dependencies` | No release |
| `docs:` | `docs: update README` | No release |

You can also trigger a major bump with a `BREAKING CHANGE:` footer in the commit body.

## Code Style

- **Rust**: Follow `rustfmt` defaults. Run `cargo fmt` before committing.
- **TypeScript/React**: Follow Prettier config (`.prettierrc`). Functional components with hooks.
- **Tailwind CSS**: Utility classes only. Dark mode via `dark:` prefix.
- **Indentation**: 2 spaces for TS/JSON, 4 spaces for Rust (see `.editorconfig`).

## Testing & Checks

All of the following must pass before submitting a PR:

```bash
# Frontend tests
npm test

# TypeScript type check
npx tsc --noEmit

# Rust tests
cd src-tauri && cargo test

# Rust linting (zero warnings required)
cd src-tauri && cargo clippy -- -D warnings

# Rust formatting check
cd src-tauri && cargo fmt --check
```

## Pull Request Process

1. Fork the repository and create a feature branch from `main`
2. Make your changes using conventional commit messages (see above)
3. Ensure all checks pass (see above)
4. Submit a PR with a clear description of the changes and motivation

## Release Process

Releases are fully automated. When commits are merged to `main`:

1. **semantic-release** analyzes commit messages and determines the version bump
2. All version files are updated automatically (`package.json`, `Cargo.toml`, `tauri.conf.json`)
3. `CHANGELOG.md` is generated from commit messages
4. A git tag is created and pushed
5. GitHub Actions builds platform binaries (macOS ARM/Intel, Windows, Linux)
6. A GitHub Release is published with binaries attached

No manual version bumping is needed. Just write good commit messages.

## Architecture

| Path | Description |
|------|-------------|
| `src-tauri/src/lib.rs` | Tauri IPC command handlers and ingestion pipeline |
| `src-tauri/src/db.rs` | SQLite database layer with FTS5 full-text search |
| `src-tauri/src/models.rs` | Shared data types (events, conversations, exports) |
| `src-tauri/src/error.rs` | Error types and `AppResult` alias |
| `src-tauri/src/ingestion/` | Parsers (HTML, JSON), media linker, export detector, zip extractor |
| `src/App.tsx` | Main React app with responsive layout and routing |
| `src/components/` | UI components (ChatView, GalleryView, SearchView, Dashboard, etc.) |
| `src/hooks/` | Custom React hooks (useTheme, useToast) |
| `src/types.ts` | TypeScript type definitions |

## Reporting Issues

- Use [GitHub Issues](https://github.com/KodyDennon/SnapDataExplorer/issues) for bug reports and feature requests
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)
