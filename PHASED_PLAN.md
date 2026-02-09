# Phased Development Plan - Snapchat Data Explorer

This document outlines the roadmap for the Snapchat Data Explorer, moving from the current skeletal implementation to a fully functional desktop application.

## Phase 1: Ingestion & Data Integrity ✅
**Goal:** Build a robust backend capable of accurately reconstructing the Snapchat timeline from raw HTML and media files.

- [x] **Complete Chat Parsing:**
    - [x] Extract media references (filenames/timestamps) from Chat HTML.
    - [x] Implement fuzzy matching for media files in `chat_media/` and `media/`.
    - [x] Handle group chats and participants correctly.
- [x] **Memories Ingestion:**
    - [x] Implement parser for `memories_history.json`.
    - [x] Link memory entries to their respective files in `memories/`.
- [x] **Schema Expansion:**
    - [x] Support media metadata (type, location via memories).
    - [x] Support snap history events from `snap_history.json`.
- [x] **Validation Engine:**
    - [x] Report missing media files.
    - [x] Validation report with integrity checks.

## Phase 2: Core Desktop Experience ✅
**Goal:** Transition from a placeholder UI to a functional browsing experience.

- [x] **Export Dashboard:**
    - [x] Implement a proper directory picker using Tauri's dialog plugin.
    - [x] Show progress bars for the "Reconstruct" process.
- [x] **Navigation Shell:**
    - [x] Sidebar for switching between "Dashboard", "Chats", "Search", and "Gallery".
- [x] **Virtualized Feed:**
    - [x] Implement a high-performance virtualized list using `react-virtuoso` to handle 100k+ messages.
    - [x] Message bubble styling with sender names, timestamps, date separators.
- [x] **Media Preview:**
    - [x] Securely serve local media to the Tauri frontend via `convertFileSrc` / asset protocol.
    - [x] Image lightbox and video player in gallery and chat views.

## Phase 3: Search & Discovery ✅
**Goal:** Enable users to find specific moments across years of data.

- [x] **Full-Text Search:**
    - [x] Implement SQLite FTS5 for lightning-fast search across all messages.
    - [x] Search UI with results navigation to conversations.
- [x] **Temporal Navigation:**
    - [x] "Jump to Date" picker in chat view.
    - [x] Date separators between message groups.
- [x] **Unified Gallery:**
    - [x] A "Photos" style grid showing all media from both chats and memories, sorted by date.
    - [x] Filter by photos/videos with VirtuosoGrid virtualization.

## Phase 4: Scale & Optimization ✅
**Goal:** Ensure the app remains responsive with large datasets.

- [x] **Background Worker:**
    - [x] Heavy parsing/indexing runs on `spawn_blocking` thread with IPC progress updates.
- [x] **Resource Management:**
    - [x] Paginated message loading (`MessagePage` with offset/limit).
    - [x] WAL journal mode and indexes for fast DB queries.
    - [x] Lazy loading of media via `loading="lazy"` and virtualized lists.

## Phase 5: Polish & Distribution ✅
**Goal:** Finalize the UX and prepare for use.

- [x] **Theme Support:** Dark/Light/System mode via Tailwind `dark:` class with localStorage persistence.
- [x] **Export/Sharing:** Export specific conversations as plain text or JSON files.
- [x] **Packaging:** Tauri build config with proper metadata for macOS, Windows, and Linux.
