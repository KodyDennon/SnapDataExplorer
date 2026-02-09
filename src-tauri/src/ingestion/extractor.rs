use std::fs;
use std::path::{Path, PathBuf};
use crate::error::{AppResult, AppError};
use zip::ZipArchive;
use tauri::{Emitter, AppHandle};
use crate::models::IngestionProgress;

pub struct ZipExtractor;

impl ZipExtractor {
    pub fn extract(
        zip_path: &Path,
        target_dir: &Path,
        export_id: &str,
        app_handle: &AppHandle
    ) -> AppResult<PathBuf> {
        log::info!("ZipExtractor: starting extraction");
        log::debug!("ZipExtractor: {:?} -> {:?}", zip_path, target_dir);

        if !zip_path.exists() {
            return Err(AppError::Generic(format!("Zip file not found: {}", zip_path.display())));
        }

        let file = fs::File::open(zip_path)?;
        let mut archive = ZipArchive::new(file).map_err(|e| {
            log::error!("ZipExtractor: failed to open zip: {}", e);
            AppError::Parsing(format!("Invalid zip file: {}", e))
        })?;

        let extraction_path = target_dir.join(export_id);
        if !extraction_path.exists() {
            fs::create_dir_all(&extraction_path)?;
        }

        let total_files = archive.len();
        log::info!("ZipExtractor: archive contains {} entries", total_files);

        if total_files == 0 {
            return Err(AppError::Validation("Zip archive is empty".to_string()));
        }

        const MAX_EXTRACTED_SIZE: u64 = 5 * 1024 * 1024 * 1024; // 5GB limit
        let mut extracted_count = 0u64;
        let mut total_bytes: u64 = 0;

        for i in 0..total_files {
            let mut file = archive.by_index(i).map_err(|e| {
                AppError::Parsing(format!("Failed to read zip entry {}: {}", i, e))
            })?;

            total_bytes += file.size();
            if total_bytes > MAX_EXTRACTED_SIZE {
                return Err(AppError::Validation(format!(
                    "Zip extraction would exceed {}GB size limit. Archive may be too large or corrupted.",
                    MAX_EXTRACTED_SIZE / (1024 * 1024 * 1024)
                )));
            }

            let outpath = match file.enclosed_name() {
                Some(path) => extraction_path.join(path),
                None => {
                    log::warn!("ZipExtractor: skipping entry with unsafe path at index {}", i);
                    continue;
                }
            };

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)?;
                    }
                }
                let mut outfile = fs::File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
                extracted_count += 1;
            }

            if i % 100 == 0 || i == total_files - 1 {
                let progress = i as f32 / total_files as f32;
                let _ = app_handle.emit("ingestion-progress", IngestionProgress {
                    export_id: export_id.to_string(),
                    current_step: "Extracting".to_string(),
                    progress: progress * 0.10, // Extraction is ~10% of total pipeline
                    message: format!("Extracting file {} of {}...", i + 1, total_files),
                });
            }
        }

        log::info!("ZipExtractor: extracted {} files", extracted_count);
        log::debug!("ZipExtractor: extraction path: {:?}", extraction_path);
        Ok(extraction_path)
    }
}
