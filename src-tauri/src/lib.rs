//! Snap Data Explorer — Tauri backend.
//!
//! Provides IPC commands for detecting, importing, querying, and exporting
//! Snapchat "My Data" exports. All data is stored locally in SQLite.

pub mod db;
pub mod downloader;
pub mod error;
pub mod ingestion;
pub mod models;
pub mod storage;

use crate::db::DatabaseManager;
use crate::downloader::MemoryDownloader;
use crate::error::{AppError, AppResult};
use crate::ingestion::detector::ExportDetector;
use crate::ingestion::extractor::ZipExtractor;
use crate::ingestion::media_linker::MediaLinker;
use crate::ingestion::parser::{ChatJsonParser, ChatParser, MemoryParser, PersonParser, SnapHistoryParser};
use crate::models::{
    Conversation, Event, ExportSet, ExportSourceType, ExportStats, IngestionProgress, IngestionResult, Memory,
    MessagePage, PaginatedMedia, SearchResult, ValidationReport,
};
use crate::storage::{DiskSpaceInfo, StorageManager};
use rayon::prelude::*;
use simplelog::{ColorChoice, CombinedLogger, Config, LevelFilter, TermLogger, TerminalMode, WriteLogger};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager};

fn db_path(app_handle: &tauri::AppHandle) -> AppResult<PathBuf> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Generic(format!("Failed to resolve app data directory: {}", e)))?;
    Ok(dir.join("index.db"))
}

fn db_for_app(app_handle: &tauri::AppHandle) -> AppResult<Option<DatabaseManager>> {
    let path = db_path(app_handle)?;
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(DatabaseManager::new(&path)?))
}

#[tauri::command]
async fn detect_exports(path: String) -> AppResult<Vec<ExportSet>> {
    let path = PathBuf::from(&path);
    log::debug!("detect_exports called with path: {:?}", path);
    let result = ExportDetector::detect_in_directory(&path);
    match &result {
        Ok(exports) => log::info!("detect_exports: found {} export(s)", exports.len()),
        Err(e) => log::error!("detect_exports failed: {}", e),
    }
    result
}

#[tauri::command]
async fn auto_detect_exports() -> AppResult<Vec<ExportSet>> {
    log::info!("auto_detect_exports called");
    ExportDetector::detect_in_standard_paths()
}

#[tauri::command]
async fn process_export(export: ExportSet, app_handle: tauri::AppHandle) -> AppResult<()> {
    log::info!("process_export: starting (type: {:?})", export.source_type);
    log::debug!("process_export: source path: {:?}", export.source_path);

    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Generic(format!("Failed to resolve app data directory: {}", e)))?;
    let working_dir = app_data.join("exports");

    if !working_dir.exists() {
        fs::create_dir_all(&working_dir)?;
    }

    // Run everything on a blocking thread to avoid starving the async runtime
    let handle = app_handle.clone();
    let original_export = export.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Extract zip if needed (heavy I/O)
        let working_path = if original_export.source_type == ExportSourceType::Zip {
            ZipExtractor::extract(&original_export.source_path, &working_dir, &original_export.id, &handle)?
        } else {
            original_export.source_path.clone()
        };

        tauri::async_runtime::block_on(reconstruct_from_path(original_export, working_path, handle))
    })
    .await
    .map_err(|e| AppError::Generic(format!("Thread join error: {}", e)))??;

    Ok(())
}

async fn reconstruct_from_path(
    original_export: ExportSet,
    source_path: PathBuf,
    app_handle: tauri::AppHandle,
) -> AppResult<()> {
    let export_id = original_export.id.clone();
    let db = db_path(&app_handle)?;

    if let Some(parent) = db.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    let database = DatabaseManager::new(&db)?;
    let mut warnings: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    log::info!(
        "reconstruct_from_path: starting for export_id={}, type={:?}",
        export_id,
        original_export.source_type
    );
    log::debug!("reconstruct_from_path: source path: {:?}", source_path);

    let _ = app_handle.emit(
        "ingestion-progress",
        IngestionProgress {
            export_id: export_id.clone(),
            current_step: "Initializing".to_string(),
            progress: 0.05,
            message: "Setting up database...".to_string(),
        },
    );

    // Store original export info (preserves source_path and source_type for reimport)
    database.insert_export(&original_export)?;

    // --- Phase: Friends Resolution ---
    app_handle
        .emit(
            "ingestion-progress",
            IngestionProgress {
                export_id: export_id.clone(),
                current_step: "Resolving Identities".to_string(),
                progress: 0.08,
                message: "Resolving friends and contacts...".to_string(),
            },
        )
        .ok();

    let friends_json = source_path.join("json").join("friends.json");
    if friends_json.exists() {
        match PersonParser::parse_friends_json(&friends_json) {
            Ok(people) => {
                log::info!("Parsed {} people from friends.json", people.len());
                database.insert_people(&people)?;
            }
            Err(e) => {
                log::error!("Failed to parse friends.json: {}", e);
                warnings.push(format!("Could not parse friends list: {}", e));
            }
        }
    } else {
        log::debug!("No friends.json found at {:?}", friends_json);
    }

    // --- Phase: Chat HTML Parsing ---
    let mut all_conversations = Vec::new();
    let mut all_events = Vec::new();
    let mut parse_failures = 0;

    let chat_html_dir = source_path.join("html").join("chat_history");
    if chat_html_dir.is_dir() {
        let entries: Vec<_> = fs::read_dir(&chat_html_dir)?.collect::<Result<Vec<_>, _>>()?;
        let total_files = entries.len();
        log::info!("Found {} files in chat_history directory", total_files);

        let results: Vec<_> = entries
            .par_iter()
            .filter_map(|entry| {
                let path = entry.path();
                if path.is_file()
                    && path.extension().is_some_and(|ext| ext == "html")
                    && path
                        .file_name()
                        .is_some_and(|n| n.to_string_lossy().starts_with("subpage_"))
                {
                    Some((path.clone(), ChatParser::parse_subpage(&path)))
                } else {
                    None
                }
            })
            .collect();

        for (path, res) in results {
            match res {
                Ok((conv, events)) => {
                    all_conversations.push(conv);
                    all_events.extend(events);
                }
                Err(e) => {
                    parse_failures += 1;
                    log::error!("Failed to parse {:?}: {}", path.file_name(), e);
                    warnings.push(format!(
                        "Failed to parse {}: {}",
                        path.file_name().unwrap_or_default().to_string_lossy(),
                        e
                    ));
                }
            }
        }
    } else {
        log::warn!("Chat history directory not found in export");
        log::debug!("Expected chat_history at: {:?}", chat_html_dir);
        warnings.push("No chat_history directory found in export".to_string());
    }

    if parse_failures > 0 {
        log::warn!("{} chat files failed to parse", parse_failures);
    }

    // --- Phase: JSON Chat History (Media IDs source) ---
    app_handle
        .emit(
            "ingestion-progress",
            IngestionProgress {
                export_id: export_id.clone(),
                current_step: "Parsing Chat JSON".to_string(),
                progress: 0.38,
                message: "Extracting media ID mappings from chat history JSON...".to_string(),
            },
        )
        .ok();

    let chat_json = source_path.join("json").join("chat_history.json");
    if chat_json.exists() {
        match ChatJsonParser::parse_chat_history_json(&chat_json) {
            Ok(json_conversations) => {
                let json_event_count: usize = json_conversations.iter().map(|(_, e)| e.len()).sum();
                log::info!(
                    "ChatJsonParser: {} conversations, {} events from JSON",
                    json_conversations.len(),
                    json_event_count
                );

                let mut merged_ids = 0;
                let mut new_events_added = 0;

                for (convo_key, json_events) in json_conversations {
                    for json_event in json_events {
                        // Try to find a matching HTML event: same conversation + same sender + timestamp within 2 seconds
                        let matched = all_events.iter_mut().find(|existing| {
                            existing.conversation_id.as_deref() == Some(&convo_key)
                                && existing.sender == json_event.sender
                                && (existing.timestamp - json_event.timestamp).num_seconds().abs() <= 2
                                && existing.metadata.is_none() // Don't overwrite already-enriched events
                        });

                        if let Some(existing) = matched {
                            // Merge: copy media_ids metadata into the HTML event
                            existing.metadata = json_event.metadata.clone();
                            merged_ids += 1;
                        } else {
                            // No matching HTML event — add the JSON event directly
                            // Ensure the conversation exists
                            let convo_exists = all_conversations.iter().any(|c| c.id == convo_key);
                            if !convo_exists {
                                // Extract conversation title from metadata if available
                                let display_name = json_event.metadata.as_ref().and_then(|m| {
                                    serde_json::from_str::<serde_json::Value>(m)
                                        .ok()
                                        .and_then(|v| v.get("conversation_title")?.as_str().map(|s| s.to_string()))
                                });
                                all_conversations.push(Conversation {
                                    id: convo_key.clone(),
                                    display_name,
                                    participants: Vec::new(),
                                    last_event_at: Some(json_event.timestamp),
                                    message_count: 0,
                                    has_media: false,
                                });
                            }
                            all_events.push(json_event);
                            new_events_added += 1;
                        }
                    }
                }

                log::info!(
                    "JSON merge: {} events enriched with media IDs, {} new events added",
                    merged_ids,
                    new_events_added
                );
            }
            Err(e) => {
                log::error!("Failed to parse chat_history.json: {}", e);
                errors.push(format!("Could not parse chat history JSON: {}", e));
            }
        }
    } else {
        log::debug!("No chat_history.json found at {:?}", chat_json);
    }

    // --- Phase: Snap History (JSON) ---
    app_handle
        .emit(
            "ingestion-progress",
            IngestionProgress {
                export_id: export_id.clone(),
                current_step: "Parsing Snap History".to_string(),
                progress: 0.42,
                message: "Processing snap history metadata...".to_string(),
            },
        )
        .ok();

    let snap_json = source_path.join("json").join("snap_history.json");
    if snap_json.exists() {
        match SnapHistoryParser::parse_snap_history_json(&snap_json) {
            Ok(snap_conversations) => {
                let snap_event_count: usize = snap_conversations.iter().map(|(_, e)| e.len()).sum();
                log::info!(
                    "Parsed {} snap history conversations with {} events",
                    snap_conversations.len(),
                    snap_event_count
                );
                for (convo_key, events) in snap_conversations {
                    let existing = all_conversations.iter().any(|c| c.id == convo_key);
                    if !existing {
                        all_conversations.push(Conversation {
                            id: convo_key.clone(),
                            display_name: None,
                            participants: Vec::new(),
                            last_event_at: events.last().map(|e| e.timestamp),
                            message_count: events.len() as i32,
                            has_media: false,
                        });
                    }
                    all_events.extend(events);
                }
            }
            Err(e) => {
                log::error!("Failed to parse snap_history.json: {}", e);
                errors.push(format!("Could not parse snap history: {}", e));
            }
        }
    } else {
        log::info!("No snap_history.json found");
    }

    // --- Phase: Media Linking ---
    app_handle
        .emit(
            "ingestion-progress",
            IngestionProgress {
                export_id: export_id.clone(),
                current_step: "Linking Media".to_string(),
                progress: 0.50,
                message: "Resolving media file references...".to_string(),
            },
        )
        .ok();

    let chat_media_dir = source_path.join("chat_media");
    let media_dir = source_path.join("media");

    let mut linker = MediaLinker::new(&chat_media_dir);
    if media_dir.is_dir() {
        linker.add_media_directory(&media_dir);
    }

    all_events.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
    linker.link_media(&mut all_events);

    // Build per-conversation stats in O(N) using a HashMap
    let mut conv_stats: HashMap<String, (usize, Option<chrono::DateTime<chrono::Utc>>)> = HashMap::new();
    for event in &all_events {
        if let Some(cid) = &event.conversation_id {
            let entry = conv_stats.entry(cid.clone()).or_insert((0, None));
            entry.0 += 1;
            match entry.1 {
                Some(ref ts) if event.timestamp > *ts => entry.1 = Some(event.timestamp),
                None => entry.1 = Some(event.timestamp),
                _ => {}
            }
        }
    }

    for conv in &mut all_conversations {
        if let Some((count, last_ts)) = conv_stats.get(&conv.id) {
            conv.message_count = (*count).min(i32::MAX as usize) as i32;
            if let Some(ts) = last_ts {
                conv.last_event_at = Some(*ts);
            }
        }
    }

    // --- Phase: Memories Parsing ---
    app_handle
        .emit(
            "ingestion-progress",
            IngestionProgress {
                export_id: export_id.clone(),
                current_step: "Processing Memories".to_string(),
                progress: 0.65,
                message: "Parsing memories history...".to_string(),
            },
        )
        .ok();

    let memories_json = source_path.join("json").join("memories_history.json");
    let mut all_memories = Vec::new();
    if memories_json.exists() {
        match MemoryParser::parse_memories_json(&memories_json, &export_id) {
            Ok(memories) => {
                log::info!("Parsed {} memories", memories.len());
                all_memories = memories;
            }
            Err(e) => {
                log::error!("Failed to parse memories_history.json: {}", e);
                errors.push(format!("Could not parse memories: {}", e));
            }
        }
    } else {
        log::info!("No memories_history.json found");
    }

    // --- Phase: Save to Database ---
    app_handle
        .emit(
            "ingestion-progress",
            IngestionProgress {
                export_id: export_id.clone(),
                current_step: "Saving to Database".to_string(),
                progress: 0.75,
                message: format!(
                    "Indexing {} conversations, {} messages, {} memories...",
                    all_conversations.len(),
                    all_events.len(),
                    all_memories.len()
                ),
            },
        )
        .ok();

    database.batch_insert_conversations(&all_conversations)?;
    database.batch_insert_events(&all_events, &export_id)?;

    if !all_memories.is_empty() {
        database.batch_insert_memories(&all_memories)?;
    }

    log::info!(
        "Ingestion complete: {} conversations, {} events, {} memories, {} warnings, {} errors",
        all_conversations.len(),
        all_events.len(),
        all_memories.len(),
        warnings.len(),
        errors.len()
    );

    // Emit the detailed result
    let result = IngestionResult {
        export_id: export_id.clone(),
        conversations_parsed: all_conversations.len() as i32,
        events_parsed: all_events.len() as i32,
        memories_parsed: all_memories.len() as i32,
        parse_failures,
        warnings: warnings.clone(),
        errors: errors.clone(),
    };
    let _ = app_handle.emit("ingestion-result", &result);

    app_handle
        .emit(
            "ingestion-progress",
            IngestionProgress {
                export_id: export_id.clone(),
                current_step: "Complete".to_string(),
                progress: 1.0,
                message: format!(
                    "Indexed {} conversations, {} messages, {} memories.",
                    all_conversations.len(),
                    all_events.len(),
                    all_memories.len()
                ),
            },
        )
        .ok();

    Ok(())
}

#[tauri::command]
async fn get_conversations(app_handle: tauri::AppHandle) -> AppResult<Vec<Conversation>> {
    match db_for_app(&app_handle)? {
        Some(db) => db.get_conversations(),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn get_messages(conversation_id: String, app_handle: tauri::AppHandle) -> AppResult<Vec<Event>> {
    match db_for_app(&app_handle)? {
        Some(db) => db.get_messages(&conversation_id),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn get_messages_page(
    conversation_id: String,
    offset: i32,
    limit: i32,
    app_handle: tauri::AppHandle,
) -> AppResult<MessagePage> {
    match db_for_app(&app_handle)? {
        Some(db) => db.get_messages_page(&conversation_id, offset, limit),
        None => Ok(MessagePage {
            messages: Vec::new(),
            total_count: 0,
            has_more: false,
        }),
    }
}

#[tauri::command]
async fn get_export_stats(app_handle: tauri::AppHandle) -> AppResult<Option<ExportStats>> {
    match db_for_app(&app_handle)? {
        Some(db) => Ok(Some(db.get_export_stats()?)),
        None => Ok(None),
    }
}

#[tauri::command]
async fn get_exports(app_handle: tauri::AppHandle) -> AppResult<Vec<ExportSet>> {
    match db_for_app(&app_handle)? {
        Some(db) => db.get_exports(),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn search_messages(
    query: String,
    limit: Option<i32>,
    app_handle: tauri::AppHandle,
) -> AppResult<Vec<SearchResult>> {
    if query.len() > 500 {
        return Err(AppError::Validation(
            "Search query too long (max 500 characters)".into(),
        ));
    }
    match db_for_app(&app_handle)? {
        Some(db) => db.search_messages(&query, limit.unwrap_or(50)),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn get_memories(export_id: Option<String>, app_handle: tauri::AppHandle) -> AppResult<Vec<Memory>> {
    match db_for_app(&app_handle)? {
        Some(db) => db.get_memories(export_id.as_deref()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn get_unified_media_stream(
    limit: Option<i32>,
    offset: Option<i32>,
    app_handle: tauri::AppHandle,
) -> AppResult<PaginatedMedia> {
    match db_for_app(&app_handle)? {
        Some(db) => db.get_unified_media_stream(limit.unwrap_or(100), offset.unwrap_or(0)),
        None => Ok(PaginatedMedia {
            items: Vec::new(),
            total_count: 0,
            has_more: false,
        }),
    }
}

#[tauri::command]
async fn get_message_index_at_date(
    conversation_id: String,
    date: String,
    app_handle: tauri::AppHandle,
) -> AppResult<i32> {
    match db_for_app(&app_handle)? {
        Some(db) => db.get_message_index_at_date(&conversation_id, &date),
        None => Ok(0),
    }
}

#[tauri::command]
async fn get_activity_dates(conversation_id: String, app_handle: tauri::AppHandle) -> AppResult<Vec<String>> {
    match db_for_app(&app_handle)? {
        Some(db) => db.get_activity_dates(&conversation_id),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn export_conversation(
    conversation_id: String,
    format: String,
    output_path: String,
    app_handle: tauri::AppHandle,
) -> AppResult<()> {
    // Validate output path — must be under user-accessible directories
    let output = PathBuf::from(&output_path);
    if let Some(parent) = output.parent() {
        if !parent.exists() {
            return Err(AppError::Validation(format!(
                "Output directory does not exist: {}",
                parent.display()
            )));
        }
    }
    // Reject paths that try to traverse outside via ..
    let canonical_parent = output.parent().and_then(|p| std::fs::canonicalize(p).ok());
    if canonical_parent.is_none() {
        return Err(AppError::Validation("Invalid output path".to_string()));
    }

    let db = db_for_app(&app_handle)?.ok_or_else(|| AppError::Generic("No data imported yet".to_string()))?;
    let messages = db.get_messages(&conversation_id)?;

    let content = match format.as_str() {
        "json" => serde_json::to_string_pretty(&messages).unwrap_or_else(|_| "[]".to_string()),
        _ => {
            let mut output = String::new();
            output.push_str(&format!("Conversation: {}\n", conversation_id));
            output.push_str(&format!("Messages: {}\n", messages.len()));
            output.push_str("---\n\n");
            for msg in &messages {
                let sender = msg.sender_name.as_deref().unwrap_or(&msg.sender);
                let time = msg.timestamp.format("%Y-%m-%d %H:%M:%S");
                output.push_str(&format!(
                    "[{}] {}: {}\n",
                    time,
                    sender,
                    msg.content.as_deref().unwrap_or("")
                ));
            }
            output
        }
    };

    fs::write(&output_path, content)?;
    log::info!("Exported conversation ({} messages)", messages.len());
    log::debug!("Export target: {}", output_path);
    Ok(())
}

#[tauri::command]
async fn get_validation_report(app_handle: tauri::AppHandle) -> AppResult<Option<ValidationReport>> {
    match db_for_app(&app_handle)? {
        Some(db) => Ok(Some(db.get_validation_report()?)),
        None => Ok(None),
    }
}

#[tauri::command]
async fn reset_data(app_handle: tauri::AppHandle) -> AppResult<()> {
    let path = db_path(&app_handle)?;
    if path.exists() {
        fs::remove_file(&path)?;
        log::info!("Database deleted: {:?}", path);
    }
    // Also remove WAL and SHM files if they exist
    let wal = path.with_extension("db-wal");
    let shm = path.with_extension("db-shm");
    if wal.exists() {
        let _ = fs::remove_file(&wal);
    }
    if shm.exists() {
        let _ = fs::remove_file(&shm);
    }
    Ok(())
}

#[tauri::command]
async fn reimport_data(app_handle: tauri::AppHandle) -> AppResult<()> {
    // 1. Read the current export from DB before wiping
    let stored_export = match db_for_app(&app_handle)? {
        Some(db) => {
            let exports = db.get_exports()?;
            exports.into_iter().next()
        }
        None => None,
    };

    let export = match stored_export {
        Some(e) => e,
        None => return Err(AppError::Generic("No existing import to reimport from.".into())),
    };

    // Verify the source path still exists before wiping
    if !export.source_path.exists() {
        return Err(AppError::Generic(format!(
            "Original export path no longer exists: {}. Cannot reimport.",
            export.source_path.display()
        )));
    }

    log::info!("reimport_data: reimporting (type: {:?})", export.source_type);
    log::debug!("reimport_data: source path: {:?}", export.source_path);

    // 2. Wipe the DB
    let path = db_path(&app_handle)?;
    if path.exists() {
        fs::remove_file(&path)?;
    }
    let wal = path.with_extension("db-wal");
    let shm = path.with_extension("db-shm");
    if wal.exists() {
        let _ = fs::remove_file(&wal);
    }
    if shm.exists() {
        let _ = fs::remove_file(&shm);
    }

    // 3. Re-process the same export
    process_export(export, app_handle).await
}

#[tauri::command]
async fn get_log_path(app_handle: tauri::AppHandle) -> AppResult<String> {
    // Prefer app data dir for log path, fall back to cwd
    let path = match app_handle.path().app_data_dir() {
        Ok(dir) => dir.join("snap_explorer.log"),
        Err(_) => std::env::current_dir().unwrap_or_default().join("snap_explorer.log"),
    };
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn set_storage_path(path: String, app_handle: tauri::AppHandle) -> AppResult<()> {
    let path_buf = PathBuf::from(&path);
    StorageManager::validate_path(path_buf.clone()).map_err(|e| AppError::Generic(e.to_string()))?;

    let db = db_for_app(&app_handle)?.ok_or_else(|| AppError::Generic("Database not initialized".into()))?;
    db.set_setting("storage_path", &path)?;
    log::info!("Storage path set to: {}", path);
    Ok(())
}

#[tauri::command]
async fn get_storage_path(app_handle: tauri::AppHandle) -> AppResult<Option<String>> {
    let db = db_for_app(&app_handle)?;
    if let Some(db) = db {
        db.get_setting("storage_path")
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn check_disk_space(path: Option<String>, app_handle: tauri::AppHandle) -> AppResult<DiskSpaceInfo> {
    let path_to_check = if let Some(p) = path {
        PathBuf::from(p)
    } else {
        let db = db_for_app(&app_handle)?.ok_or_else(|| AppError::Generic("Database not initialized".into()))?;
        let stored_path = db.get_setting("storage_path")?;
        match stored_path {
            Some(p) => PathBuf::from(p),
            None => return Err(AppError::Generic("No storage path set".into())),
        }
    };

    StorageManager::get_disk_space(path_to_check).map_err(|e| AppError::Generic(e.to_string()))
}

#[tauri::command]
async fn download_all_memories(app_handle: tauri::AppHandle) -> AppResult<()> {
    let db = db_for_app(&app_handle)?.ok_or_else(|| AppError::Generic("Database not initialized".into()))?;
    let downloader = MemoryDownloader::new(app_handle, Arc::new(db));
    downloader.download_all_pending().await
}

#[tauri::command]
async fn download_memory(memory: Memory, app_handle: tauri::AppHandle) -> AppResult<()> {
    let db = db_for_app(&app_handle)?.ok_or_else(|| AppError::Generic("Database not initialized".into()))?;
    let storage_path = db.get_setting("storage_path")?;
    let storage_root = match storage_path {
        Some(p) => PathBuf::from(p),
        None => return Err(AppError::Generic("No storage path set".into())),
    };

    let downloader = MemoryDownloader::new(app_handle, Arc::new(db));
    downloader.download_memory(memory, storage_root).await
}

#[tauri::command]
async fn show_in_folder(path: String) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| AppError::Generic(e.to_string()))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|e| AppError::Generic(e.to_string()))?;
    }
    #[cfg(target_os = "linux")]
    {
        let path_buf = std::path::PathBuf::from(path);
        if let Some(parent) = path_buf.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| AppError::Generic(e.to_string()))?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging: prefer app data dir, fall back to CWD
    let log_dir = dirs::data_dir()
        .map(|d| d.join("com.kody.snap-data-explorer-app"))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let _ = fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("snap_explorer.log");
    let log_file = std::fs::OpenOptions::new().create(true).append(true).open(&log_path);

    match log_file {
        Ok(file) => {
            let _ = CombinedLogger::init(vec![
                TermLogger::new(
                    LevelFilter::Info,
                    Config::default(),
                    TerminalMode::Stderr,
                    ColorChoice::Auto,
                ),
                WriteLogger::new(LevelFilter::Info, Config::default(), file),
            ]);
        }
        Err(_) => {
            let _ = TermLogger::init(
                LevelFilter::Info,
                Config::default(),
                TerminalMode::Stderr,
                ColorChoice::Auto,
            );
        }
    }

    log::info!("Snap Explorer starting. Log file: {:?}", log_path);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            detect_exports,
            auto_detect_exports,
            process_export,
            get_conversations,
            get_messages,
            get_messages_page,
            get_export_stats,
            get_exports,
            search_messages,
            get_memories,
            get_unified_media_stream,
            get_validation_report,
            get_message_index_at_date,
            get_activity_dates,
            export_conversation,
            reset_data,
            reimport_data,
            get_log_path,
            set_storage_path,
            get_storage_path,
            check_disk_space,
            download_memory,
            download_all_memories,
            show_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
