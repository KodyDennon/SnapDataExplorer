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

## Code Style

- **Rust**: Follow `rustfmt` defaults. Run `cargo fmt` before committing.
- **TypeScript/React**: Follow Prettier config (`.prettierrc`). Functional components with hooks.
- **Tailwind CSS**: Utility classes only. Dark mode via `dark:` prefix.
- **Indentation**: 2 spaces for TS/JSON, 4 spaces for Rust (see `.editorconfig`).

## Testing & Checks

All of the following must pass before submitting a PR:

```bash
# Rust tests
cargo test

# Rust linting (zero warnings required)
cargo clippy -- -D warnings

# Rust formatting check
cargo fmt --check

# TypeScript type check
npx tsc --noEmit
```

## Pull Request Process

1. Fork the repository and create a feature branch from `main`
2. Make your changes with clear, descriptive commits
3. Ensure all checks pass (see above)
4. Submit a PR with a clear description of the changes and motivation

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
