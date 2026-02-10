# Snap Data Explorer

![CI](https://github.com/KodyDennon/SnapDataExplorer/actions/workflows/ci.yml/badge.svg)
![Release](https://img.shields.io/github/v/release/KodyDennon/SnapDataExplorer)
![License](https://img.shields.io/badge/license-Source--Available-blue)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Downloads](https://img.shields.io/github/downloads/KodyDennon/SnapDataExplorer/total)

A privacy-first desktop app that reconstructs and explores your Snapchat data exports. Browse chat history, search messages, view media galleries, and analyze your archive — all 100% local.

> **Note:** Not affiliated with Snap Inc. This is an independent open-source project.

## Quick Start

1. **Download** — grab the [latest release](https://github.com/KodyDennon/SnapDataExplorer/releases/latest) for your OS
2. **Get your data** — [request your Snapchat export](https://kodydennon.github.io/SnapDataExplorer/getting-started.html) (includes media/attachments)
3. **Import** — open the app, select your zip or folder, done

## Features

- **Chat Reconstruction** — Rebuilds complete chat threads from Snapchat HTML + JSON exports
- **Full-Text Search** — Instantly search across all conversations with SQLite FTS5
- **Media Gallery** — Browse all linked photos and videos with lightbox viewer and keyboard navigation
- **Media Linking** — Automatically matches media files to chat events via Media IDs
- **Memories** — View your saved Snapchat memories with metadata
- **Dashboard Analytics** — Message counts, top contacts, date ranges, and data integrity reports
- **Zip & Folder Import** — Import directly from a `.zip` download or an unzipped folder
- **Conversation Export** — Export individual chats as plain text or JSON
- **Dark Mode** — Full light/dark/system theme support
- **Responsive Layout** — Collapsible sidebar, mobile-friendly design
- **Accessible** — Keyboard navigation, ARIA labels, focus indicators, screen reader support
- **Privacy First** — Zero network access. No telemetry. Your data never leaves your machine.

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/KodyDennon/SnapDataExplorer/releases/latest) page:

| Platform | Format |
|----------|--------|
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.msi` installer |
| Linux | `.deb` / `.AppImage` |

### macOS: "App is damaged" fix

Apple blocks apps that aren't notarized. If you see this warning, run:

```bash
xattr -cr /Applications/"Snap Data Explorer.app"
```

### Build from Source

**Prerequisites:**
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable
- Platform-specific deps (see [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/))

```bash
git clone https://github.com/KodyDennon/SnapDataExplorer.git
cd SnapDataExplorer
npm install
npm run tauri dev
```

To build a production binary:

```bash
npm run tauri build
```

## How to Get Your Snapchat Data

1. Go to [accounts.snapchat.com](https://accounts.snapchat.com) and sign in
2. Navigate to **My Data** and submit a download request
3. When ready, download the `.zip` file from the email link
4. Open Snap Data Explorer and either:
   - Select the `.zip` file directly, or
   - Unzip it and select the folder

**Tip:** When requesting your data, make sure "Include Media / Attachments" is enabled to get photos and videos linked to your messages.

For a detailed walkthrough, see the [Getting Started guide](https://kodydennon.github.io/SnapDataExplorer/getting-started.html).

## Privacy

Snap Data Explorer is designed with privacy as a core principle:

- **100% Local** — All data processing happens on your machine
- **No Network Access** — The app makes zero network requests
- **No Telemetry** — No analytics, tracking, or data collection of any kind
- **No Cloud** — Your data is stored in a local SQLite database
- **Open Source** — Inspect every line of code yourself

Your processed data is stored locally at:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/com.kody.snap-data-explorer-app/` |
| Windows | `%APPDATA%/com.kody.snap-data-explorer-app/` |
| Linux | `~/.local/share/com.kody.snap-data-explorer-app/` |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, react-virtuoso |
| Backend | Rust, Tauri v2, SQLite (FTS5), kuchikiki HTML parser |
| Build | Vite, Cargo, GitHub Actions CI/CD, semantic-release |

## License

Source-available. Free for individuals, students, researchers, and most organizations. Government, law enforcement, military, and surveillance entities require a paid commercial license. See [LICENSE](LICENSE) and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for details.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Security

For reporting security vulnerabilities, see [SECURITY.md](SECURITY.md). Please do **not** open public issues for security reports.

## Support

For questions, bugs, or feature requests:
- Open an issue on [GitHub Issues](https://github.com/KodyDennon/SnapDataExplorer/issues)
- Email: [kodydennon@gmail.com](mailto:kodydennon@gmail.com)
- Website: [kodydennon.github.io/SnapDataExplorer](https://kodydennon.github.io/SnapDataExplorer/)

## Contributors

[![Contributors](https://contrib.rocks/image?repo=KodyDennon/SnapDataExplorer)](https://github.com/KodyDennon/SnapDataExplorer/graphs/contributors)
