use crate::db::DatabaseManager;
use crate::error::AppResult;
use crate::models::{DownloadStatus, Memory};
use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::fs as tokio_fs;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    pub memory_id: String,
    pub progress: f32,
    pub status: String,
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
}

pub struct MemoryDownloader {
    client: Client,
    app_handle: AppHandle,
    db: Arc<DatabaseManager>,
}

impl MemoryDownloader {
    pub fn new(app_handle: AppHandle, db: Arc<DatabaseManager>) -> Self {
        Self {
            client: Client::new(),
            app_handle,
            db,
        }
    }

    pub async fn download_memory(&self, mut memory: Memory, storage_root: PathBuf) -> AppResult<()> {
        let url = match &memory.download_url {
            Some(url) => url,
            None => {
                log::error!("No download URL for memory {}", memory.id);
                return Ok(());
            }
        };

        // Determine file extension
        let ext = if memory.media_type.to_lowercase() == "video" {
            "mp4"
        } else {
            "jpg"
        };

        // Build subfolder structure: Memories/YYYY/MM/id.ext
        let year = memory.timestamp.format("%Y").to_string();
        let month = memory.timestamp.format("%m").to_string();
        let target_dir = storage_root.join("Memories").join(year).join(month);

        if !target_dir.exists() {
            tokio_fs::create_dir_all(&target_dir).await?;
        }

        let file_name = format!("{}.{}", memory.id, ext);
        let file_path = target_dir.join(file_name);

        log::info!("Downloading memory {} to {:?}", memory.id, file_path);

        // Update status to Downloading
        memory.download_status = DownloadStatus::Downloading;
        self.db.batch_insert_memories(&[memory.clone()])?;

        let response = match self.client.get(url).send().await {
            Ok(res) => res,
            Err(e) => {
                log::error!("Failed to start download for {}: {}", memory.id, e);
                memory.download_status = DownloadStatus::Failed;
                self.db.batch_insert_memories(&[memory])?;
                return Ok(());
            }
        };

        let total_size = response.content_length();
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();

        let mut file = tokio_fs::File::create(&file_path).await?;

        while let Some(item) = stream.next().await {
            let chunk = match item {
                Ok(chunk) => chunk,
                Err(e) => {
                    log::error!("Error while downloading {}: {}", memory.id, e);
                    memory.download_status = DownloadStatus::Failed;
                    self.db.batch_insert_memories(&[memory])?;
                    return Ok(());
                }
            };
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            if let Some(total) = total_size {
                let progress = downloaded as f32 / total as f32;
                self.app_handle
                    .emit(
                        "download-progress",
                        DownloadProgress {
                            memory_id: memory.id.clone(),
                            progress,
                            status: "Downloading".to_string(),
                            bytes_downloaded: downloaded,
                            total_bytes: Some(total),
                        },
                    )
                    .ok();
            }
        }

        file.flush().await?;

        // Update status to Downloaded
        memory.download_status = DownloadStatus::Downloaded;
        memory.media_path = Some(file_path);
        self.db.batch_insert_memories(&[memory.clone()])?;

        self.app_handle
            .emit(
                "download-progress",
                DownloadProgress {
                    memory_id: memory.id.clone(),
                    progress: 1.0,
                    status: "Downloaded".to_string(),
                    bytes_downloaded: downloaded,
                    total_bytes: total_size,
                },
            )
            .ok();

        log::info!("Successfully downloaded memory {}", memory.id);
        Ok(())
    }

    pub async fn download_all_pending(&self) -> AppResult<()> {
        let storage_path = self.db.get_setting("storage_path")?;
        let storage_root = match storage_path {
            Some(p) => PathBuf::from(p),
            None => {
                log::error!("No storage path set for downloads");
                return Ok(());
            }
        };

        let memories = self.db.get_memories(None)?;
        let pending: Vec<Memory> = memories
            .into_iter()
            .filter(|m| m.download_status == DownloadStatus::Pending || m.download_status == DownloadStatus::Failed)
            .collect();

        log::info!("Starting batch download for {} pending memories", pending.len());

        for memory in pending {
            if let Err(e) = self.download_memory(memory, storage_root.clone()).await {
                log::error!("Failed to download memory: {}", e);
            }
        }

        Ok(())
    }
}
