# Snapchat Data Explorer — Technical Architecture

## Purpose of This Document
This document defines the **technical architecture and system design** for Snapchat Data Explorer. It is intentionally **implementation-aware but not code-level**, serving as a shared reference for:
- You (primary designer)
- AI agents assisting with implementation
- Potential future contributors

The focus is on **robustness, correctness, scalability, and long-term maintainability**, not speed-to-demo.

---

## Architectural Principles

### Local-First, Trust-Critical
- All processing happens on the user’s machine
- No network access required for core functionality
- No data leaves the device
- Deterministic, inspectable behavior

### HTML as Source of Truth
- Snapchat’s exported HTML is treated as authoritative
- JSON exports are optional and supplemental
- Media files are considered inert without metadata linkage

### Scale as a First-Class Constraint
- Must handle exports from a few GB to 300GB+
- Streaming and incremental processing by default
- No assumption that datasets fit in memory

### Strict Separation of Concerns
- UI does not contain business logic
- Parsing, reconstruction, and indexing are independent layers
- Storage is replaceable without affecting domain logic

---

## High-Level System Overview

The application is a **native desktop system** composed of a Rust backend and a web-based UI, connected via a strict IPC boundary.

```
UI (Web)
  │
  ▼
Tauri IPC (typed commands & events)
  │
  ▼
Rust Application Core
  │
  ├─ Export Detection & Validation
  ├─ Parsing & Reconstruction Engine
  ├─ Persistent Index & Metadata Store
  └─ Job & Progress Manager
```

---

## UI Layer

### Role
- Present reconstructed data visually
- Drive user workflows (import, explore, search)
- Display progress, warnings, and errors

### Native-Feeling UI Principles
The UI is explicitly designed to behave as a **lightweight viewport**, not a data container.

Key guarantees:
- The UI never owns large datasets
- Media bytes are never passed over IPC
- Only visible data is rendered at any time

This prevents browser memory exhaustion and ensures long-running stability.

### Technology Direction
- Web-based UI hosted inside Tauri
- Minimal-runtime framework chosen for:
  - Low memory overhead
  - Fine-grained reactivity
  - Excellent virtualization support

The UI layer is replaceable and treated strictly as a client of the backend API.

### Data Access Pattern
- Cursor-based pagination only
- Explicit range requests (time, count)
- Backend-enforced limits

The UI cannot request unbounded datasets.

### Media Rendering Strategy
- UI receives file paths or identifiers only
- Media rendered via OS-native decoding (`file://` access)
- Thumbnails generated and cached by backend
- Lazy loading and virtualization enforced

### UI Responsibilities
- Dataset selection and switching
- Timeline browsing (virtualized)
- Media gallery rendering (virtualized)
- Search and filtering
- User-controlled settings and opt-in actions

### Non-Responsibilities
- No parsing
- No filesystem crawling
- No direct media loading into memory

---

## Tauri IPC Boundary

### Design Goals
- Strong typing
- Explicit commands
- Observable long-running jobs

### IPC Characteristics
- Command-based requests (e.g., detect exports, start indexing)
- Event-based updates (progress, warnings, completion)
- No raw filesystem access from the UI

This boundary enforces architectural discipline and simplifies testing.

---

## Rust Backend Architecture

The backend is the authoritative system and is designed as a **set of modular crates**.

### Backend Responsibilities
- Filesystem interaction
- Export detection and validation
- HTML parsing
- Data reconstruction
- Persistent indexing
- Sidecar metadata generation
- Job lifecycle management

---

## Core Backend Modules (Conceptual)

### Export Detection & Validation
**Purpose:** Identify and verify Snapchat exports.

Responsibilities:
- Scan user-selected directories
- Detect Snapchat export ZIPs or extracted folders
- Group multipart exports
- Validate structural completeness
- Report missing or corrupted components

This layer does *not* parse content.

---

### Parsing Layer (HTML-First)
**Purpose:** Extract raw facts from Snapchat’s exported HTML.

Responsibilities:
- Parse category HTML files
- Extract references to media files
- Extract timestamps, captions, labels, participants
- Remain tolerant of malformed or partial data

Output is **raw observations**, not reconstructed meaning.

---

### Domain & Reconstruction Engine
**Purpose:** Convert fragmented observations into a coherent data graph.

Responsibilities:
- Build domain entities (Snaps, Events, Conversations, Stories)
- Resolve relationships across files
- Detect duplicates and inconsistencies
- Attach metadata to media references
- Emit structured warnings

This is the system’s **semantic core**.

---

### Persistent Index & Storage

**Purpose:** Enable fast, repeatable exploration without reprocessing.

Characteristics:
- Persistent across app restarts
- Migratable schema
- Rebuildable if necessary

Stored concepts:
- Domain entities
- Relationships
- Search indexes
- Processing state

Media files remain on disk; the index stores references only.

---

### Sidecar & Metadata Output Layer

**Purpose:** Optional user-controlled metadata materialization.

Capabilities:
- Write sidecar files (JSON, XMP, etc.)
- Normalize filenames and folder structures (opt-in)
- Preserve originals by default

All write operations require explicit user consent.

---

### Job & Progress Management

**Purpose:** Make long operations safe and understandable.

Responsibilities:
- Background processing
- Progress reporting
- Pause, resume, and cancel
- Safe recovery after interruption

Jobs are resumable where possible.

---

## Multi-Dataset Handling

The system supports **multiple independent datasets**.

Characteristics:
- Each export is indexed separately
- Datasets can coexist
- New exports can be added incrementally
- Re-exports of the same account can be detected and linked

Dataset identity is explicit and user-visible.

---

## Cross-Platform Considerations

Supported platforms:
- macOS
- Windows
- Linux

Design implications:
- Abstracted filesystem handling
- Careful path normalization
- Conservative permission assumptions
- No platform-specific UI logic

---

## Failure & Safety Philosophy

- Never silently fail
- Always report uncertainty
- Partial data is preferable to no data
- Original exports are never modified by default

Corruption or incompleteness is treated as **information**, not a fatal error.

---

## Extensibility Strategy

The architecture is designed to allow:
- New Snapchat export versions
- Alternate parsing strategies
- Future platform support

This is achieved through:
- Clear module boundaries
- Versioned internal representations
- Trait-based parsing interfaces

---

## Summary

This architecture prioritizes:
- Correctness over convenience
- Transparency over magic
- Longevity over trendiness

It is intentionally conservative, modular, and explicit — suitable for a tool users trust with their entire digital history.

