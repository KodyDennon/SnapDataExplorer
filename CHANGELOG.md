# Changelog

All notable changes to Snap Data Explorer will be documented in this file.

## v0.1.0-beta (2026-02-08)

Initial beta release.

### Features

- Chat reconstruction from Snapchat HTML + JSON exports
- Full-text search across all conversations (SQLite FTS5)
- Media gallery with lightbox viewer, keyboard navigation, and filtering
- Media linking via Media IDs from `chat_history.json`
- Snapchat memories viewer with metadata
- Dashboard with analytics, top contacts, and data integrity reports
- Zip file and folder import support
- Conversation export (plain text and JSON)
- Dark mode with light/dark/system theme support
- Jump-to-date navigation in chat view
- Sort and filter conversations (by date, message count, name)
- Copy-to-clipboard for chat messages

### Accessibility

- Keyboard navigation throughout the app (gallery, lightbox, sidebar)
- ARIA labels on all interactive elements
- Focus indicators on all focusable elements
- Screen reader support with `role` and `aria-live` attributes
- React Error Boundary with user-friendly crash recovery

### Responsive Design

- Collapsible sidebar with mobile hamburger menu
- Responsive gallery grid (adapts from 2 to 6 columns)
- Mobile-friendly layout with adaptive breakpoints

### Technical

- Tauri v2 (Rust backend + React 19 / TypeScript frontend)
- SQLite with WAL mode, busy timeout, and FTS5 indexing
- Virtualized lists for 3000+ conversations (react-virtuoso)
- Content Security Policy restricting script/style/media sources
- Asset protocol scope restricted to user data directories
- Log sanitization (user paths only at DEBUG level)
- FTS5 query sanitization to prevent injection
- HashMap-based O(N) conversation stats (replacing O(N*M) loop)
- Comprehensive test suite (23 Rust unit tests)
- CI/CD with GitHub Actions (macOS, Windows, Linux matrix builds)
