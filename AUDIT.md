# Performance & Bug Audit Report

## Critical Issues

### 1. DB pool recreated on every IPC command
**File:** `src-tauri/src/lib.rs` — `db_for_app()`

Every Tauri command calls `db_for_app()` which creates a brand new `DatabaseManager` with a new r2d2 pool (10 connections), runs `CREATE TABLE IF NOT EXISTS` schema check, and runs all migrations — for every single frontend request. Under rapid UI interaction (scrolling, searching), this creates massive connection churn and defeats the purpose of pooling entirely.

**Fix:** Store `DatabaseManager` in Tauri managed state. Initialize once at startup or first use.

### 2. O(n^2) event merge during ingestion
**File:** `src-tauri/src/lib.rs` lines 258-296

The JSON-to-HTML event merge iterates every JSON event and does a linear scan of `all_events` for each. With 11,249+ events on each side, this is O(n*m).

**Fix:** Build a `HashMap<(conversation_id, sender), Vec<&mut Event>>` for O(1) lookups.

### 3. `get_all_media` loads ALL events into memory, ignores SQL pagination
**File:** `src-tauri/src/db.rs` lines 702-783

Despite accepting `limit` and `offset` parameters, fetches everything into RAM, sorts in-memory, then slices. May be dead code (not exposed as Tauri command).

**Fix:** Remove if dead code, or fix to use SQL-level pagination.

## Warnings

### 4. `failedMedia` Set breaks React.memo in ChatView
**File:** `src/components/ChatView.tsx`

`failedMedia` is a `Set<string>` state passed directly to `MessageItem` (which is `React.memo`). Every media failure creates a new Set, causing ALL MessageItem components to re-render.

**Fix:** Use a ref for the Set + counter state, or compute `isMediaFailed` per-item.

### 5. ChatView fetches ALL conversations for one display name
**File:** `src/components/ChatView.tsx` line 360

Loads all 3,209+ conversations (with correlated subqueries each) just to look up a single display name.

**Fix:** Add dedicated `get_conversation_name` command or pass name from parent.

### 6. MemoriesView renders all items without virtualization
**File:** `src/components/MemoriesView.tsx` lines 278-304

Uses plain `.map()` with `AnimatePresence` instead of `VirtuosoGrid`. All DOM nodes created at once.

**Fix:** Use `VirtuosoGrid` like `ChillGallery` does.

### 7. `get_conversations` runs 2 correlated subqueries per row
**File:** `src-tauri/src/db.rs` lines 320-329

Two correlated subqueries per conversation = 6,418 subqueries for 3,209 conversations.

**Fix:** Use GROUP BY with JOIN or cache counts at ingestion time.

### 8. ChillGallery rAF leak
**File:** `src/components/ChillGallery.tsx` lines 74-87

`requestAnimationFrame` loop runs continuously at ~60fps even when `isAutoScrolling` is false.

**Fix:** Only start the animation loop when `isAutoScrolling` is true.

### 9. Search results animation stagger causes 3-second cascade
**File:** `src/components/SearchView.tsx` line 155

100 results x 30ms delay = 3 second sequential animation.

**Fix:** Cap delay: `Math.min(i * 0.03, 0.3)`.

### 10. Sidebar reloads exports on every page navigation
**File:** `src/components/Sidebar.tsx` line 107

`activePage` in useEffect dependency array triggers unnecessary `get_exports` calls.

**Fix:** Remove `activePage` from deps.

## Suggestions

### 11. JSON files read entirely into String
**Files:** `src-tauri/src/ingestion/parser.rs`

`friends.json` and `chat_history.json` use `fs::read_to_string` + `serde_json::from_str`. Double memory usage.

**Fix:** Use `serde_json::from_reader` with `BufReader`.

### 12. Regex compiled on every call
**File:** `src-tauri/src/ingestion/detector.rs` line 97

`Regex::new()` called per invocation of `group_candidates`.

**Fix:** Use `std::sync::LazyLock`.

### 13. Missing partial index for media queries
Aggregate media queries scan full events table.

**Fix:** Add partial index: `CREATE INDEX idx_events_has_media ON events(event_type, timestamp) WHERE media_references IS NOT NULL AND media_references != '[]'`

## Verified Correct
- FTS5 injection prevention (sanitize_fts_query)
- Transaction usage for batch operations
- FTS5 DELETE-before-INSERT pattern
- Pagination input clamping
- DB_MAINTENANCE atomic flag
- Event listener cleanup in App.tsx
- Zip extraction safety (enclosed_name + 500GB limit)
- Path traversal prevention in export_conversation
- No unwrap()/expect() in production code paths (after stability fixes)
- Virtuoso usage for large lists (ConversationList, ChatView)
- Progress events use .ok() pattern
