use std::fs;
use std::path::{Path, PathBuf};
use crate::error::{AppResult, AppError};
use zip::ZipArchive;
use tauri::{Emitter, AppHandle};
use crate::models::IngestionProgress;

pub struct ZipExtractor;

impl ZipExtractor {
    pub fn extract(
        zip_paths: &[PathBuf],
        target_dir: &Path,
        export_id: &str,
        app_handle: &AppHandle
    ) -> AppResult<PathBuf> {
        let start_time = std::time::Instant::now();
        log::info!("ZipExtractor: starting extraction of {} part(s)", zip_paths.len());
        
        let extraction_path = target_dir.join(export_id);
        if !extraction_path.exists() {
            fs::create_dir_all(&extraction_path)?;
        }

        let total_parts = zip_paths.len();
        let mut total_extracted_files = 0u64;
        let mut total_bytes: u64 = 0;
        const MAX_TOTAL_SIZE: u64 = 500 * 1024 * 1024 * 1024; // 500GB safety limit

        for (part_idx, zip_path) in zip_paths.iter().enumerate() {
            log::info!("ZipExtractor: extracting part {}/{}: {:?}", part_idx + 1, total_parts, zip_path);

            if !zip_path.exists() {
                log::warn!("ZipExtractor: zip part not found: {:?}", zip_path);
                continue;
            }

            let file = fs::File::open(zip_path)?;
            let mut archive = ZipArchive::new(file).map_err(|e| {
                AppError::Parsing(format!("Invalid zip file {:?}: {}", zip_path, e))
            })?;

            let total_files_in_part = archive.len();
            
            for i in 0..total_files_in_part {
                let mut file = archive.by_index(i).map_err(|e| {
                    AppError::Parsing(format!("Failed to read zip entry {} in {:?}: {}", i, zip_path, e))
                })?;

                total_bytes += file.size();
                if total_bytes > MAX_TOTAL_SIZE {
                    return Err(AppError::Validation(format!(
                        "Total extraction would exceed {}GB size limit.",
                        MAX_TOTAL_SIZE / (1024 * 1024 * 1024)
                    )));
                }

                let outpath = match file.enclosed_name() {
                    Some(path) => extraction_path.join(path),
                    None => continue,
                };

                if file.name().ends_with('/') {
                    fs::create_dir_all(&outpath)?;
                } else {
                    if let Some(p) = outpath.parent() {
                        if !p.exists() {
                            fs::create_dir_all(p)?;
                        }
                    }
                    
                    // "Newest wins": If file exists, we could check timestamps, 
                    // but usually, later parts in multi-part zips are the intended ones
                    // or contain different files entirely.
                    let mut outfile = fs::File::create(&outpath)?;
                    std::io::copy(&mut file, &mut outfile)?;
                    total_extracted_files += 1;
                }

                if i % 100 == 0 || i == total_files_in_part - 1 {
                    let part_progress = i as f32 / total_files_in_part as f32;
                    let total_progress = (part_idx as f32 + part_progress) / total_parts as f32;
                    
                    let _ = app_handle.emit("ingestion-progress", IngestionProgress {
                        export_id: export_id.to_string(),
                        current_step: "Extracting".to_string(),
                        progress: total_progress * 0.10, // Extraction is ~10% of pipeline
                        message: format!(
                            "Extracting part {} of {} (file {} of {})...", 
                            part_idx + 1, total_parts, i + 1, total_files_in_part
                        ),
                    });
                }
            }
        }

        let duration = start_time.elapsed();
        log::info!("ZipExtractor: extraction complete in {:?}. Total files: {}", duration, total_extracted_files);
        Ok(extraction_path)
    }
}
