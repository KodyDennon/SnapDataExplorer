//! Application error types for Snap Data Explorer.
//!
//! All Tauri IPC commands return `AppResult<T>`, which serializes
//! errors as strings for the frontend.

use serde::Serialize;

/// Application-wide error type, covering I/O, database, parsing, and validation failures.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Parsing error: {0}")]
    Parsing(String),
    #[error("{0}")]
    Generic(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = Result<T, AppError>;
