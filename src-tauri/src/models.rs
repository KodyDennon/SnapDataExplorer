//! Data models for Snap Data Explorer.
//!
//! Defines all shared types used across the Tauri IPC boundary,
//! database layer, and ingestion pipeline.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// How an export was originally provided by the user.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ExportSourceType {
    Zip,
    Folder,
}

/// A detected or imported Snapchat data export.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportSet {
    /// Unique identifier (typically the folder/file name).
    pub id: String,
    /// Original paths to the export components (zip files or folders).
    pub source_paths: Vec<PathBuf>,
    /// Whether this was imported from zips or folders.
    pub source_type: ExportSourceType,
    /// Path where a zip was extracted to (if applicable).
    pub extraction_path: Option<PathBuf>,
    /// Filesystem creation date of the export.
    pub creation_date: Option<DateTime<Utc>>,
    /// Validation result from structure detection.
    pub validation_status: ValidationStatus,
}

/// Result of validating a Snapchat export's directory structure.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ValidationStatus {
    /// All expected files and directories are present.
    Valid,
    /// Some expected data is missing (e.g., no media directory).
    Incomplete,
    /// The export appears damaged or unreadable.
    Corrupted,
    /// Validation has not been performed.
    Unknown,
}

/// A chat conversation (1:1 or group).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    /// Human-readable name (e.g., "Chat History with username").
    pub display_name: Option<String>,
    /// List of participant usernames.
    pub participants: Vec<String>,
    /// Timestamp of the most recent event.
    pub last_event_at: Option<DateTime<Utc>>,
    /// Total number of events in this conversation.
    pub message_count: i32,
    /// Whether any events have linked media files.
    pub has_media: bool,
}

/// A single chat event (message, snap, media, status change, etc.).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Event {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    /// Username of the sender.
    pub sender: String,
    /// Resolved display name (from friends.json).
    pub sender_name: Option<String>,
    /// Absolute paths to linked media files.
    pub media_references: Vec<PathBuf>,
    /// ID of the conversation this event belongs to.
    pub conversation_id: Option<String>,
    /// Text content of the message (if any).
    pub content: Option<String>,
    /// Event type: TEXT, MEDIA, SNAP, SNAP_VIDEO, NOTE, STICKER, etc.
    pub event_type: String,
    /// JSON metadata (e.g., `{"media_ids": [...], "is_sender": true}`).
    pub metadata: Option<String>,
}

/// A person from friends.json.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Person {
    pub username: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Downloaded,
    Failed,
}

/// A saved Snapchat memory.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Memory {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    /// "Image" or "Video".
    pub media_type: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub media_path: Option<PathBuf>,
    pub export_id: String,
    pub download_url: Option<String>,
    pub proxy_url: Option<String>,
    pub download_status: DownloadStatus,
}

/// Aggregate statistics for an imported export.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportStats {
    pub total_messages: i32,
    pub total_conversations: i32,
    pub total_memories: i32,
    pub total_media_files: i32,
    pub missing_media_count: i32,
    /// Top contacts by message count: `[(name, count)]`.
    pub top_contacts: Vec<(String, i32)>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

/// Real-time progress updates emitted during ingestion.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IngestionProgress {
    pub export_id: String,
    pub current_step: String,
    /// 0.0 to 1.0.
    pub progress: f32,
    pub message: String,
}

/// Final result of an ingestion pipeline run.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IngestionResult {
    pub export_id: String,
    pub conversations_parsed: i32,
    pub events_parsed: i32,
    pub memories_parsed: i32,
    pub parse_failures: i32,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

/// Data integrity report for a processed export.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ValidationReport {
    pub total_html_files: i32,
    pub parsed_html_files: i32,
    pub total_media_referenced: i32,
    pub media_found: i32,
    pub media_missing: i32,
    pub missing_files: Vec<String>,
    pub warnings: Vec<String>,
}

/// A full-text search result.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub event_id: String,
    pub conversation_id: Option<String>,
    pub conversation_name: Option<String>,
    pub sender: String,
    pub sender_name: Option<String>,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub event_type: String,
}

/// A media file entry for the gallery view.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaEntry {
    pub path: PathBuf,
    /// "Image" or "Video".
    pub media_type: String,
    pub timestamp: Option<DateTime<Utc>>,
    /// Source: "chat", "memory", or "snap".
    pub source: String,
    pub conversation_id: Option<String>,
}

/// A paginated page of messages.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessagePage {
    pub messages: Vec<Event>,
    pub total_count: i32,
    pub has_more: bool,
}

/// A high-performance, lightweight DTO for gallery entries.
/// Minimizes IPC overhead by only sending what the UI needs for grid rendering.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaStreamEntry {
    pub id: String,
    pub path: PathBuf,
    pub media_type: String, // "Image" | "Video"
    pub timestamp: DateTime<Utc>,
    pub source: String, // "local" | "cloud"
}

/// A paginated result for the unified media stream.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginatedMedia {
    pub items: Vec<MediaStreamEntry>,
    pub total_count: i32,
    pub has_more: bool,
}
