use crate::error::AppResult;
use crate::models::{
    Conversation, Event, ExportSet, ExportSourceType, ExportStats, MediaEntry, MediaStreamEntry, Memory, MessagePage,
    PaginatedMedia, Person, SearchResult, ValidationReport, ValidationStatus,
};
use chrono::{DateTime, Utc};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::params;
use std::path::{Path, PathBuf};

pub type Pool = r2d2::Pool<SqliteConnectionManager>;

pub struct DatabaseManager {
    pool: Pool,
}

impl DatabaseManager {
    pub fn new(db_path: &Path) -> AppResult<Self> {
        let manager = SqliteConnectionManager::file(db_path)
            .with_init(|conn| {
                conn.execute_batch(
                    "
                    PRAGMA journal_mode=WAL;
                    PRAGMA synchronous=NORMAL;
                    PRAGMA busy_timeout=5000;
                    PRAGMA foreign_keys=ON;
                    PRAGMA cache_size=-64000; -- 64MB cache
                    PRAGMA temp_store=MEMORY;
                ",
                )
                .map_err(Into::into)
            });

        let pool = r2d2::Pool::builder()
            .max_size(10) // Allow up to 10 concurrent connections
            .build(manager)
            .map_err(|e| crate::error::AppError::Generic(format!("Failed to create pool: {}", e)))?;

        let manager = Self { pool };
        manager.initialize_schema()?;
        manager.run_migrations()?;
        Ok(manager)
    }

    fn conn(&self) -> r2d2::PooledConnection<SqliteConnectionManager> {
        self.pool.get().expect("Database pool exhausted")
    }

    fn initialize_schema(&self) -> AppResult<()> {
        self.conn().execute_batch(
            "
            CREATE TABLE IF NOT EXISTS exports (
                id TEXT PRIMARY KEY,
                source_path TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'Folder',
                creation_date TEXT,
                validation_status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS people (
                username TEXT PRIMARY KEY,
                display_name TEXT
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                display_name TEXT,
                participants TEXT,
                last_event_at TEXT
            );

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                sender TEXT,
                export_id TEXT NOT NULL,
                conversation_id TEXT,
                content TEXT,
                event_type TEXT NOT NULL,
                media_references TEXT,
                metadata TEXT,
                FOREIGN KEY(export_id) REFERENCES exports(id),
                FOREIGN KEY(conversation_id) REFERENCES conversations(id)
            );

            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                media_type TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                media_path TEXT,
                download_url TEXT,
                proxy_url TEXT,
                download_status TEXT NOT NULL DEFAULT 'Pending',
                export_id TEXT NOT NULL,
                FOREIGN KEY(export_id) REFERENCES exports(id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            -- High-performance Indices
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_export_id ON events(export_id);
            CREATE INDEX IF NOT EXISTS idx_events_convo_id_timestamp ON events(conversation_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(event_type, timestamp);
            CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
            CREATE INDEX IF NOT EXISTS idx_memories_export_id ON memories(export_id);

            CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
                content,
                event_id UNINDEXED,
                conversation_id UNINDEXED,
                sender UNINDEXED,
                tokenize='unicode61'
            );
        ",
        )?;
        Ok(())
    }

    /// Run schema migrations for existing databases
    fn run_migrations(&self) -> AppResult<()> {
        let conn = self.conn();
        // Add source_type column if it doesn't exist (for pre-existing DBs)
        let has_source_type: bool = conn
            .prepare("SELECT COUNT(*) FROM pragma_table_info('exports') WHERE name = 'source_type'")?
            .query_row([], |row| row.get::<_, i32>(0))
            .unwrap_or(0)
            > 0;

        if !has_source_type {
            log::info!("Migration: adding source_type column to exports table");
            conn.execute_batch("ALTER TABLE exports ADD COLUMN source_type TEXT NOT NULL DEFAULT 'Folder';")?;
        }

        // Add memory download columns
        let has_download_status: bool = conn
            .prepare("SELECT COUNT(*) FROM pragma_table_info('memories') WHERE name = 'download_status'")?
            .query_row([], |row| row.get::<_, i32>(0))
            .unwrap_or(0)
            > 0;

        if !has_download_status {
            log::info!("Migration: adding download columns to memories table");
            conn.execute_batch(
                "
                ALTER TABLE memories ADD COLUMN download_url TEXT;
                ALTER TABLE memories ADD COLUMN proxy_url TEXT;
                ALTER TABLE memories ADD COLUMN download_status TEXT NOT NULL DEFAULT 'Pending';
            ",
            )?;
        }

        Ok(())
    }

    pub fn insert_people(&self, people: &[Person]) -> AppResult<()> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare("INSERT OR REPLACE INTO people (username, display_name) VALUES (?1, ?2)")?;
            for person in people {
                stmt.execute(params![person.username, person.display_name])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn insert_export(&self, export: &ExportSet) -> AppResult<()> {
        let status_str = match &export.validation_status {
            ValidationStatus::Valid => "Valid",
            ValidationStatus::Incomplete => "Incomplete",
            ValidationStatus::Corrupted => "Corrupted",
            ValidationStatus::Unknown => "Unknown",
        };
        let source_type_str = match &export.source_type {
            ExportSourceType::Zip => "Zip",
            ExportSourceType::Folder => "Folder",
        };
        self.conn().execute(
            "INSERT OR REPLACE INTO exports (id, source_path, source_type, creation_date, validation_status) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                export.id,
                export.source_path.to_string_lossy(),
                source_type_str,
                export.creation_date.map(|d| d.to_rfc3339()),
                status_str
            ],
        )?;
        Ok(())
    }

    pub fn batch_insert_conversations(&self, conversations: &[Conversation]) -> AppResult<()> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO conversations (id, display_name, participants, last_event_at) VALUES (?1, ?2, ?3, ?4)"
            )?;
            for convo in conversations {
                stmt.execute(params![
                    convo.id,
                    convo.display_name,
                    serde_json::to_string(&convo.participants).unwrap_or_else(|_| "[]".to_string()),
                    convo.last_event_at.map(|d| d.to_rfc3339())
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn batch_insert_events(&self, events: &[Event], export_id: &str) -> AppResult<()> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut event_stmt = tx.prepare(
                "INSERT OR REPLACE INTO events (id, timestamp, sender, export_id, conversation_id, content, event_type, media_references, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
            )?;
            // FTS5 doesn't support REPLACE — delete any existing entry first, then insert
            let mut fts_delete_stmt = tx.prepare("DELETE FROM events_fts WHERE event_id = ?1")?;
            let mut fts_stmt = tx.prepare(
                "INSERT INTO events_fts (content, event_id, conversation_id, sender) VALUES (?1, ?2, ?3, ?4)",
            )?;
            for event in events {
                event_stmt.execute(params![
                    event.id,
                    event.timestamp.to_rfc3339(),
                    event.sender,
                    export_id,
                    event.conversation_id,
                    event.content,
                    event.event_type,
                    serde_json::to_string(&event.media_references).unwrap_or_else(|e| {
                        log::warn!("Failed to serialize media_references for event {}: {}", event.id, e);
                        "[]".to_string()
                    }),
                    event.metadata
                ])?;
                if let Some(ref content) = event.content {
                    if !content.trim().is_empty() {
                        let _ = fts_delete_stmt.execute(params![event.id]);
                        fts_stmt.execute(params![content, event.id, event.conversation_id, event.sender])?;
                    }
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn batch_insert_memories(&self, memories: &[Memory]) -> AppResult<()> {
        let mut conn = self.conn();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO memories (id, timestamp, media_type, latitude, longitude, media_path, download_url, proxy_url, download_status, export_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
            )?;
            for memory in memories {
                let status_str = match memory.download_status {
                    crate::models::DownloadStatus::Pending => "Pending",
                    crate::models::DownloadStatus::Downloading => "Downloading",
                    crate::models::DownloadStatus::Downloaded => "Downloaded",
                    crate::models::DownloadStatus::Failed => "Failed",
                };
                stmt.execute(params![
                    memory.id,
                    memory.timestamp.to_rfc3339(),
                    memory.media_type,
                    memory.latitude,
                    memory.longitude,
                    memory.media_path.as_ref().map(|p| p.to_string_lossy().to_string()),
                    memory.download_url,
                    memory.proxy_url,
                    status_str,
                    memory.export_id
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_conversations(&self) -> AppResult<Vec<Conversation>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT c.id, c.display_name, c.participants, c.last_event_at,
             (SELECT COUNT(*) FROM events WHERE conversation_id = c.id) as msg_count,
             p.display_name as resolved_name,
             (SELECT COUNT(*) FROM events WHERE conversation_id = c.id AND media_references != '[]' AND media_references IS NOT NULL) as media_count
             FROM conversations c
             LEFT JOIN people p ON c.id = p.username
             ORDER BY c.last_event_at DESC"
        )?;

        let conversation_iter = stmt.query_map([], |row| {
            let participants_json: String = row.get(2)?;
            let participants: Vec<String> = serde_json::from_str(&participants_json).unwrap_or_default();
            let last_event_at_str: Option<String> = row.get(3)?;
            let last_event_at = last_event_at_str.and_then(|s| {
                chrono::DateTime::parse_from_rfc3339(&s)
                    .ok()
                    .map(|dt| dt.with_timezone(&chrono::Utc))
            });

            let resolved_name: Option<String> = row.get(5).ok();
            let display_name = resolved_name.or_else(|| row.get::<_, Option<String>>(1).ok().flatten());
            let media_count: i32 = row.get(6)?;

            Ok(Conversation {
                id: row.get(0)?,
                display_name,
                participants,
                last_event_at,
                message_count: row.get(4)?,
                has_media: media_count > 0,
            })
        })?;

        let mut conversations = Vec::new();
        for conversation in conversation_iter {
            conversations.push(conversation?);
        }

        Ok(conversations)
    }

    pub fn get_export_stats(&self) -> AppResult<ExportStats> {
        let conn = self.conn();
        let total_messages: i32 = conn.query_row("SELECT COUNT(*) FROM events", [], |r| r.get(0))?;
        let total_conversations: i32 = conn.query_row("SELECT COUNT(*) FROM conversations", [], |r| r.get(0))?;
        let total_memories: i32 = conn
            .query_row("SELECT COUNT(*) FROM memories", [], |r| r.get(0))
            .unwrap_or(0);

        let total_media_files: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM events WHERE media_references != '[]' AND media_references IS NOT NULL",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let missing_media_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM events WHERE event_type IN ('MEDIA', 'SNAP', 'SNAP_VIDEO', 'NOTE', 'STICKER') AND (media_references = '[]' OR media_references IS NULL)",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let mut stmt = conn.prepare(
            "SELECT COALESCE(p.display_name, e.sender), COUNT(*) as cnt
             FROM events e
             LEFT JOIN people p ON e.sender = p.username
             GROUP BY e.sender
             ORDER BY cnt DESC
             LIMIT 5",
        )?;

        let top_contacts = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<std::result::Result<Vec<_>, rusqlite::Error>>()?;

        let start_date_str: Option<String> = conn
            .query_row("SELECT MIN(timestamp) FROM events", [], |r| r.get(0))
            .ok();
        let end_date_str: Option<String> = conn
            .query_row("SELECT MAX(timestamp) FROM events", [], |r| r.get(0))
            .ok();

        let start_date =
            start_date_str.and_then(|s| DateTime::parse_from_rfc3339(&s).ok().map(|dt| dt.with_timezone(&Utc)));
        let end_date =
            end_date_str.and_then(|s| DateTime::parse_from_rfc3339(&s).ok().map(|dt| dt.with_timezone(&Utc)));

        Ok(ExportStats {
            total_messages,
            total_conversations,
            total_memories,
            total_media_files,
            missing_media_count,
            top_contacts,
            start_date,
            end_date,
        })
    }

    pub fn get_exports(&self) -> AppResult<Vec<ExportSet>> {
        let conn = self.conn();
        let mut stmt =
            conn.prepare("SELECT id, source_path, source_type, creation_date, validation_status FROM exports")?;

        let export_iter = stmt.query_map([], |row| {
            let source_path_str: String = row.get(1)?;
            let source_type_str: String = row.get::<_, String>(2).unwrap_or_else(|_| "Folder".to_string());
            let creation_date_str: Option<String> = row.get(3)?;
            let validation_status_str: String = row.get(4)?;

            let source_type = match source_type_str.as_str() {
                "Zip" => ExportSourceType::Zip,
                _ => ExportSourceType::Folder,
            };

            let validation_status = match validation_status_str.as_str() {
                "Valid" => ValidationStatus::Valid,
                "Incomplete" => ValidationStatus::Incomplete,
                "Corrupted" => ValidationStatus::Corrupted,
                _ => ValidationStatus::Unknown,
            };

            Ok(ExportSet {
                id: row.get(0)?,
                source_path: PathBuf::from(source_path_str),
                source_type,
                extraction_path: None,
                creation_date: creation_date_str
                    .and_then(|s| DateTime::parse_from_rfc3339(&s).ok().map(|dt| dt.with_timezone(&Utc))),
                validation_status,
            })
        })?;

        let mut exports = Vec::new();
        for export in export_iter {
            exports.push(export?);
        }

        Ok(exports)
    }

    pub fn get_messages(&self, conversation_id: &str) -> AppResult<Vec<Event>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT e.id, e.timestamp, e.sender, e.conversation_id, e.content, e.event_type, e.media_references, e.metadata, p.display_name
             FROM events e
             LEFT JOIN people p ON e.sender = p.username
             WHERE e.conversation_id = ?1
             ORDER BY e.timestamp ASC"
        )?;

        let event_iter = stmt.query_map([conversation_id], |row| {
            let timestamp_str: String = row.get(1)?;
            let timestamp = chrono::DateTime::parse_from_rfc3339(&timestamp_str)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|e| {
                    log::warn!("Bad timestamp in DB: '{}': {}", timestamp_str, e);
                    chrono::DateTime::<chrono::Utc>::MIN_UTC
                });

            let media_refs_json: String = row.get(6)?;
            let media_references: Vec<std::path::PathBuf> = serde_json::from_str(&media_refs_json).unwrap_or_default();

            Ok(Event {
                id: row.get(0)?,
                timestamp,
                sender: row.get(2)?,
                sender_name: row.get(8).ok(),
                conversation_id: row.get(3)?,
                content: row.get(4)?,
                event_type: row.get(5)?,
                media_references,
                metadata: row.get(7)?,
            })
        })?;

        let mut events = Vec::new();
        for event in event_iter {
            events.push(event?);
        }

        Ok(events)
    }

    pub fn get_messages_page(&self, conversation_id: &str, offset: i32, limit: i32) -> AppResult<MessagePage> {
        let offset = offset.max(0);
        let limit = limit.clamp(1, 2000);

        let conn = self.conn();
        let total_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM events WHERE conversation_id = ?1",
            [conversation_id],
            |r| r.get(0),
        )?;

        let mut stmt = conn.prepare(
            "SELECT e.id, e.timestamp, e.sender, e.conversation_id, e.content, e.event_type, e.media_references, e.metadata, p.display_name
             FROM events e
             LEFT JOIN people p ON e.sender = p.username
             WHERE e.conversation_id = ?1
             ORDER BY e.timestamp ASC
             LIMIT ?2 OFFSET ?3"
        )?;

        let event_iter = stmt.query_map(params![conversation_id, limit, offset], |row| {
            let timestamp_str: String = row.get(1)?;
            let timestamp = chrono::DateTime::parse_from_rfc3339(&timestamp_str)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|e| {
                    log::warn!("Bad timestamp in DB: '{}': {}", timestamp_str, e);
                    chrono::DateTime::<chrono::Utc>::MIN_UTC
                });

            let media_refs_json: String = row.get(6)?;
            let media_references: Vec<std::path::PathBuf> = serde_json::from_str(&media_refs_json).unwrap_or_default();

            Ok(Event {
                id: row.get(0)?,
                timestamp,
                sender: row.get(2)?,
                sender_name: row.get(8).ok(),
                conversation_id: row.get(3)?,
                content: row.get(4)?,
                event_type: row.get(5)?,
                media_references,
                metadata: row.get(7)?,
            })
        })?;

        let mut messages = Vec::new();
        for event in event_iter {
            messages.push(event?);
        }

        let has_more = (offset + limit) < total_count;

        Ok(MessagePage {
            messages,
            total_count,
            has_more,
        })
    }

    /// Sanitize a user query for FTS5 MATCH. Wraps each word in double quotes
    /// to prevent FTS5 syntax injection (*, OR, AND, NEAR, etc.).
    fn sanitize_fts_query(query: &str) -> String {
        let words: Vec<String> = query
            .split_whitespace()
            .filter(|w| !w.is_empty())
            .map(|w| {
                // Escape any double quotes within the word, then wrap in quotes
                let escaped = w.replace('"', "\"\"");
                format!("\"{}\"", escaped)
            })
            .collect();
        words.join(" ")
    }

    pub fn search_messages(&self, query: &str, limit: i32) -> AppResult<Vec<SearchResult>> {
        let sanitized = Self::sanitize_fts_query(query);
        if sanitized.is_empty() {
            return Ok(Vec::new());
        }

        let limit = limit.clamp(1, 500);

        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT f.event_id, f.conversation_id, f.sender, f.content, e.timestamp, e.event_type,
                    c.display_name as convo_name, p.display_name as sender_name
             FROM events_fts f
             JOIN events e ON e.id = f.event_id
             LEFT JOIN conversations c ON f.conversation_id = c.id
             LEFT JOIN people p ON f.sender = p.username
             WHERE events_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )?;

        let results = stmt
            .query_map(params![sanitized, limit], |row| {
                let timestamp_str: String = row.get(4)?;
                let timestamp = chrono::DateTime::parse_from_rfc3339(&timestamp_str)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|e| {
                        log::warn!("Bad timestamp in DB: '{}': {}", timestamp_str, e);
                        chrono::DateTime::<chrono::Utc>::MIN_UTC
                    });

                Ok(SearchResult {
                    event_id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    conversation_name: row.get(6)?,
                    sender: row.get(2)?,
                    sender_name: row.get(7)?,
                    content: row.get(3)?,
                    timestamp,
                    event_type: row.get(5)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, rusqlite::Error>>()?;

        Ok(results)
    }

    pub fn get_memories(&self, export_id: Option<&str>) -> AppResult<Vec<Memory>> {
        let query = if export_id.is_some() {
            "SELECT id, timestamp, media_type, latitude, longitude, media_path, download_url, proxy_url, download_status, export_id
             FROM memories WHERE export_id = ?1 ORDER BY timestamp DESC"
        } else {
            "SELECT id, timestamp, media_type, latitude, longitude, media_path, download_url, proxy_url, download_status, export_id
             FROM memories ORDER BY timestamp DESC"
        };

        let conn = self.conn();
        let mut stmt = conn.prepare(query)?;

        let rows = if let Some(eid) = export_id {
            stmt.query_map([eid], Self::map_memory_row)?
        } else {
            stmt.query_map([], Self::map_memory_row)?
        };

        let mut memories = Vec::new();
        for row in rows {
            memories.push(row?);
        }
        Ok(memories)
    }

    fn map_memory_row(row: &rusqlite::Row) -> rusqlite::Result<Memory> {
        let timestamp_str: String = row.get(1)?;
        let timestamp = chrono::DateTime::parse_from_rfc3339(&timestamp_str)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|e| {
                log::warn!("Bad timestamp in DB: '{}': {}", timestamp_str, e);
                chrono::DateTime::<chrono::Utc>::MIN_UTC
            });
        let media_path_str: Option<String> = row.get(5)?;
        let status_str: String = row.get(8)?;
        let download_status = match status_str.as_str() {
            "Downloading" => crate::models::DownloadStatus::Downloading,
            "Downloaded" => crate::models::DownloadStatus::Downloaded,
            "Failed" => crate::models::DownloadStatus::Failed,
            _ => crate::models::DownloadStatus::Pending,
        };

        Ok(Memory {
            id: row.get(0)?,
            timestamp,
            media_type: row.get(2)?,
            latitude: row.get(3)?,
            longitude: row.get(4)?,
            media_path: media_path_str.map(PathBuf::from),
            export_id: row.get(9)?,
            download_url: row.get(6)?,
            proxy_url: row.get(7)?,
            download_status,
        })
    }

    pub fn get_setting(&self, key: &str) -> AppResult<Option<String>> {
        let conn = self.conn();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let result = stmt.query_row([key], |row| row.get(0)).ok();
        Ok(result)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> AppResult<()> {
        self.conn().execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_all_media(&self, limit: i32, offset: i32) -> AppResult<Vec<MediaEntry>> {
        let limit = limit.clamp(1, 1000);
        let offset = offset.max(0);

        // Use a single SQL query with pagination. We over-fetch events slightly since
        // one event can have multiple media_references, but this is far better than
        // loading the entire table into memory.
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT media_references, event_type, timestamp, conversation_id FROM events
             WHERE media_references != '[]' AND media_references IS NOT NULL
             ORDER BY timestamp DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let mut entries = Vec::new();

        let rows = stmt.query_map(params![limit + offset, 0], |row| {
            let media_refs_json: String = row.get(0)?;
            let timestamp_str: String = row.get(2)?;
            let conversation_id: Option<String> = row.get(3)?;
            Ok((media_refs_json, timestamp_str, conversation_id))
        })?;

        for row in rows {
            let (refs_json, ts_str, convo_id) = row?;
            let refs: Vec<PathBuf> = serde_json::from_str(&refs_json).unwrap_or_default();
            let timestamp = chrono::DateTime::parse_from_rfc3339(&ts_str)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc));

            for path in refs {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                let media_type = if ["jpg", "jpeg", "png", "heif", "webp", "gif"].contains(&ext.as_str()) {
                    "Image".to_string()
                } else {
                    "Video".to_string()
                };
                entries.push(MediaEntry {
                    path,
                    media_type,
                    timestamp,
                    source: "chat".to_string(),
                    conversation_id: convo_id.clone(),
                });
            }
        }

        // Also include memories media (typically small count)
        let mut mem_stmt = conn.prepare(
            "SELECT media_path, media_type, timestamp FROM memories
             WHERE media_path IS NOT NULL
             ORDER BY timestamp DESC",
        )?;
        let mem_rows = mem_stmt.query_map([], |row| {
            let media_path_str: String = row.get(0)?;
            let media_type: String = row.get(1)?;
            let timestamp_str: String = row.get(2)?;
            Ok((media_path_str, media_type, timestamp_str))
        })?;

        for row in mem_rows {
            let (path_str, media_type, ts_str) = row?;
            let timestamp = chrono::DateTime::parse_from_rfc3339(&ts_str)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc));
            entries.push(MediaEntry {
                path: PathBuf::from(path_str),
                media_type,
                timestamp,
                source: "memory".to_string(),
                conversation_id: None,
            });
        }

        // Sort all entries together, then apply unified pagination
        entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        let start = (offset as usize).min(entries.len());
        let end = (start + limit as usize).min(entries.len());
        Ok(entries[start..end].to_vec())
    }

    pub fn get_unified_media_stream(&self, limit: i32, offset: i32) -> AppResult<PaginatedMedia> {
        let limit = limit.clamp(1, 1000);
        let offset = offset.max(0);
        let conn = self.conn();

        // 1. Get total count for pagination info
        let total_count: i32 = conn.query_row(
            r#"SELECT (
                SELECT COUNT(*) FROM events 
                WHERE media_references IS NOT NULL AND media_references != '[]' 
                AND event_type IN ('MEDIA', 'SNAP', 'SNAP_VIDEO', 'NOTE', 'STICKER')
            ) + (
                SELECT COUNT(*) FROM memories WHERE media_path IS NOT NULL
            )"#,
            [],
            |r| r.get(0),
        )?;

        // 2. Optimized UNION query
        let mut stmt = conn.prepare(
            r#"SELECT id, json_extract(media_references, '$[0]') as path, event_type as media_type, timestamp, 'local' as source
             FROM events
             WHERE media_references IS NOT NULL AND media_references != '[]'
             AND event_type IN ('MEDIA', 'SNAP', 'SNAP_VIDEO', 'NOTE', 'STICKER')
             UNION ALL
             SELECT id, media_path as path, media_type, timestamp, 'cloud' as source
             FROM memories
             WHERE media_path IS NOT NULL
             ORDER BY timestamp DESC
             LIMIT ?1 OFFSET ?2"#
        )?;

        let entries = stmt
            .query_map(params![limit, offset], |row| {
                let timestamp_str: String = row.get(3)?;
                let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());

                let media_type_raw: String = row.get(2)?;
                let media_type = if media_type_raw.contains("VIDEO") || media_type_raw == "Video" {
                    "Video".to_string()
                } else {
                    "Image".to_string()
                };

                Ok(MediaStreamEntry {
                    id: row.get(0)?,
                    path: PathBuf::from(row.get::<_, String>(1)?),
                    media_type,
                    timestamp,
                    source: row.get(4)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, rusqlite::Error>>()?;

        Ok(PaginatedMedia {
            items: entries,
            total_count,
            has_more: (offset + limit) < total_count,
        })
    }

    pub fn get_message_index_at_date(&self, conversation_id: &str, date: &str) -> AppResult<i32> {
        // date is expected as "YYYY-MM-DD"
        let target = format!("{}T00:00:00+00:00", date);
        let index: i32 = self.conn().query_row(
            r#"SELECT COUNT(*) FROM events
             WHERE conversation_id = ?1 AND timestamp < ?2"#,
            params![conversation_id, target],
            |r| r.get(0),
        )?;
        Ok(index)
    }

    pub fn get_activity_dates(&self, conversation_id: &str) -> AppResult<Vec<String>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            r#"SELECT DISTINCT substr(timestamp, 1, 10) as dt FROM events
             WHERE conversation_id = ?1
             ORDER BY dt ASC"#,
        )?;
        let dates = stmt
            .query_map([conversation_id], |row| row.get(0))?
            .collect::<std::result::Result<Vec<String>, _>>()?;
        Ok(dates)
    }

    /// Generate a data integrity report for the dashboard.
    pub fn get_validation_report(&self) -> AppResult<ValidationReport> {
        let conn = self.conn();
        let total_media_referenced: i32 =
            conn.query_row("SELECT COUNT(*) FROM events WHERE event_type = 'MEDIA'", [], |r| {
                r.get(0)
            })?;
        let media_found: i32 = conn.query_row(
            r#"SELECT COUNT(*) FROM events WHERE event_type = 'MEDIA' AND media_references != '[]' AND media_references IS NOT NULL"#,
            [], |r| r.get(0)
        )?;
        let media_missing = total_media_referenced - media_found;

        let total_html_files: i32 = conn.query_row("SELECT COUNT(*) FROM conversations", [], |r| r.get(0))?;

        let mut warnings = Vec::new();
        if media_missing > 0 {
            warnings.push(format!("{} media events have no linked file", media_missing));
        }

        let empty_convos: i32 = conn.query_row(
            "SELECT COUNT(*) FROM conversations c WHERE NOT EXISTS (SELECT 1 FROM events WHERE conversation_id = c.id)",
            [], |r| r.get(0)
        ).unwrap_or(0);
        if empty_convos > 0 {
            warnings.push(format!("{} conversations have no messages", empty_convos));
        }

        Ok(ValidationReport {
            total_html_files,
            parsed_html_files: total_html_files,
            total_media_referenced,
            media_found,
            media_missing,
            missing_files: Vec::new(),
            warnings,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    fn test_db() -> DatabaseManager {
        let tmp = NamedTempFile::new().unwrap();
        DatabaseManager::new(tmp.path()).unwrap()
    }

    #[test]
    fn test_sanitize_fts_query_simple() {
        assert_eq!(
            DatabaseManager::sanitize_fts_query("hello world"),
            "\"hello\" \"world\""
        );
    }

    #[test]
    fn test_sanitize_fts_query_empty() {
        assert_eq!(DatabaseManager::sanitize_fts_query(""), "");
        assert_eq!(DatabaseManager::sanitize_fts_query("   "), "");
    }

    #[test]
    fn test_sanitize_fts_query_special_chars() {
        // FTS5 operators should be quoted
        assert_eq!(
            DatabaseManager::sanitize_fts_query("hello OR world"),
            "\"hello\" \"OR\" \"world\""
        );
        assert_eq!(DatabaseManager::sanitize_fts_query("test*"), "\"test*\"");
    }

    #[test]
    fn test_sanitize_fts_query_quotes() {
        // Double quotes within words are escaped
        assert_eq!(
            DatabaseManager::sanitize_fts_query("say \"hi\""),
            "\"say\" \"\"\"hi\"\"\""
        );
    }

    #[test]
    fn test_sanitize_fts_query_unicode() {
        assert_eq!(DatabaseManager::sanitize_fts_query("caf\u{00e9}"), "\"caf\u{00e9}\"");
    }

    #[test]
    fn test_insert_and_get_exports() {
        let db = test_db();
        let export = ExportSet {
            id: "test-export".to_string(),
            source_path: PathBuf::from("/tmp/test"),
            source_type: ExportSourceType::Folder,
            extraction_path: None,
            creation_date: None,
            validation_status: ValidationStatus::Valid,
        };
        db.insert_export(&export).unwrap();
        let exports = db.get_exports().unwrap();
        assert_eq!(exports.len(), 1);
        assert_eq!(exports[0].id, "test-export");
        assert_eq!(exports[0].source_type, ExportSourceType::Folder);
        assert_eq!(exports[0].validation_status, ValidationStatus::Valid);
    }

    #[test]
    fn test_insert_and_get_exports_zip() {
        let db = test_db();
        let export = ExportSet {
            id: "zip-export".to_string(),
            source_path: PathBuf::from("/tmp/test.zip"),
            source_type: ExportSourceType::Zip,
            extraction_path: None,
            creation_date: Some(chrono::Utc::now()),
            validation_status: ValidationStatus::Incomplete,
        };
        db.insert_export(&export).unwrap();
        let exports = db.get_exports().unwrap();
        assert_eq!(exports[0].source_type, ExportSourceType::Zip);
        assert_eq!(exports[0].validation_status, ValidationStatus::Incomplete);
    }

    #[test]
    fn test_batch_insert_and_get_conversations() {
        let db = test_db();
        let convos = vec![Conversation {
            id: "conv1".to_string(),
            display_name: Some("Alice".to_string()),
            participants: vec!["alice".to_string(), "bob".to_string()],
            last_event_at: Some(chrono::Utc::now()),
            message_count: 5,
            has_media: false,
        }];
        db.insert_export(&ExportSet {
            id: "e1".to_string(),
            source_path: PathBuf::from("/tmp"),
            source_type: ExportSourceType::Folder,
            extraction_path: None,
            creation_date: None,
            validation_status: ValidationStatus::Valid,
        })
        .unwrap();
        db.batch_insert_conversations(&convos).unwrap();

        let result = db.get_conversations().unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "conv1");
    }

    #[test]
    fn test_batch_insert_events_and_search() {
        let db = test_db();
        db.insert_export(&ExportSet {
            id: "e1".to_string(),
            source_path: PathBuf::from("/tmp"),
            source_type: ExportSourceType::Folder,
            extraction_path: None,
            creation_date: None,
            validation_status: ValidationStatus::Valid,
        })
        .unwrap();
        db.batch_insert_conversations(&[Conversation {
            id: "conv1".to_string(),
            display_name: None,
            participants: vec![],
            last_event_at: None,
            message_count: 0,
            has_media: false,
        }])
        .unwrap();

        let events = vec![Event {
            id: "evt1".to_string(),
            timestamp: chrono::Utc::now(),
            sender: "alice".to_string(),
            sender_name: None,
            media_references: vec![],
            conversation_id: Some("conv1".to_string()),
            content: Some("hello world test message".to_string()),
            event_type: "TEXT".to_string(),
            metadata: None,
        }];
        db.batch_insert_events(&events, "e1").unwrap();

        // Search should find the message
        let results = db.search_messages("hello", 50).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].event_id, "evt1");
    }

    #[test]
    fn test_search_empty_query() {
        let db = test_db();
        let results = db.search_messages("", 50).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_get_messages_page_clamping() {
        let db = test_db();
        db.insert_export(&ExportSet {
            id: "e1".to_string(),
            source_path: PathBuf::from("/tmp"),
            source_type: ExportSourceType::Folder,
            extraction_path: None,
            creation_date: None,
            validation_status: ValidationStatus::Valid,
        })
        .unwrap();
        db.batch_insert_conversations(&[Conversation {
            id: "conv1".to_string(),
            display_name: None,
            participants: vec![],
            last_event_at: None,
            message_count: 0,
            has_media: false,
        }])
        .unwrap();

        // Even with negative offset/limit, should not crash
        let page = db.get_messages_page("conv1", -5, -10).unwrap();
        assert_eq!(page.total_count, 0);
        assert!(!page.has_more);
    }

    #[test]
    fn test_run_migrations_idempotent() {
        let db = test_db();
        // Running migrations again should not fail
        db.run_migrations().unwrap();
        db.run_migrations().unwrap();
    }

    #[test]
    fn test_export_stats_empty_db() {
        let db = test_db();
        db.insert_export(&ExportSet {
            id: "e1".to_string(),
            source_path: PathBuf::from("/tmp"),
            source_type: ExportSourceType::Folder,
            extraction_path: None,
            creation_date: None,
            validation_status: ValidationStatus::Valid,
        })
        .unwrap();
        let stats = db.get_export_stats().unwrap();
        assert_eq!(stats.total_messages, 0);
        assert_eq!(stats.total_conversations, 0);
    }

    #[test]
    fn test_insert_people_and_resolve() {
        let db = test_db();
        db.insert_export(&ExportSet {
            id: "e1".to_string(),
            source_path: PathBuf::from("/tmp"),
            source_type: ExportSourceType::Folder,
            extraction_path: None,
            creation_date: None,
            validation_status: ValidationStatus::Valid,
        })
        .unwrap();
        let people = vec![Person {
            username: "alice".to_string(),
            display_name: Some("Alice Smith".to_string()),
        }];
        db.insert_people(&people).unwrap();

        // Person name should resolve in conversations list
        db.batch_insert_conversations(&[Conversation {
            id: "alice".to_string(),
            display_name: None,
            participants: vec![],
            last_event_at: None,
            message_count: 0,
            has_media: false,
        }])
        .unwrap();
        let convos = db.get_conversations().unwrap();
        assert_eq!(convos[0].display_name.as_deref(), Some("Alice Smith"));
    }

    #[test]
    fn test_validation_report() {
        let db = test_db();
        db.insert_export(&ExportSet {
            id: "e1".to_string(),
            source_path: PathBuf::from("/tmp"),
            source_type: ExportSourceType::Folder,
            extraction_path: None,
            creation_date: None,
            validation_status: ValidationStatus::Valid,
        })
        .unwrap();
        let report = db.get_validation_report().unwrap();
        assert_eq!(report.total_html_files, 0);
        assert_eq!(report.media_missing, 0);
    }
}
