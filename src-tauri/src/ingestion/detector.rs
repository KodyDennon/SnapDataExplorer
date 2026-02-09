use std::path::Path;
use std::fs;
use crate::models::{ExportSet, ValidationStatus, ExportSourceType};
use crate::error::AppResult;

pub struct ExportDetector;

impl ExportDetector {
    pub fn detect_in_standard_paths() -> AppResult<Vec<ExportSet>> {
        let mut all_exports = Vec::new();
        let mut paths_to_scan = Vec::new();

        if let Some(downloads) = dirs::download_dir() {
            paths_to_scan.push(downloads);
        }
        if let Some(documents) = dirs::document_dir() {
            paths_to_scan.push(documents);
        }
        if let Some(home) = dirs::home_dir() {
            paths_to_scan.push(home.join("Desktop"));
        }

        log::info!("Auto-detecting exports in {} standard paths", paths_to_scan.len());
        log::debug!("Standard paths to scan: {:?}", paths_to_scan);

        for path in &paths_to_scan {
            match Self::detect_in_directory(path) {
                Ok(exports) => {
                    log::info!("Found {} export(s) in scanned path", exports.len());
                    log::debug!("Exports found in: {:?}", path);
                    all_exports.extend(exports);
                }
                Err(e) => {
                    log::warn!("Error scanning standard path: {}", e);
                    log::debug!("Failed path: {:?}", path);
                }
            }
        }

        log::info!("Auto-detect complete: found {} total exports", all_exports.len());
        Ok(all_exports)
    }

    pub fn detect_in_directory(path: &Path) -> AppResult<Vec<ExportSet>> {
        let mut exports = Vec::new();

        // If the path is a file, check if it's a zip
        if path.is_file() {
            if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("zip")) {
                log::info!("detect_in_directory: path is a zip file");
                log::debug!("Zip path: {:?}", path);
                if let Some(status) = Self::validate_zip(path) {
                    exports.push(ExportSet {
                        id: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
                        source_path: path.to_path_buf(),
                        source_type: ExportSourceType::Zip,
                        extraction_path: None,
                        creation_date: fs::metadata(path).ok().and_then(|m| m.created().ok()).map(chrono::DateTime::from),
                        validation_status: status,
                    });
                } else {
                    log::warn!("detect_in_directory: zip file is not a valid Snapchat export");
                }
                return Ok(exports);
            }
            log::warn!("detect_in_directory: path is a file but not a zip");
            return Ok(exports);
        }

        if !path.is_dir() {
            log::warn!("detect_in_directory: path does not exist");
            return Ok(exports);
        }

        log::debug!("detect_in_directory: scanning {:?}", path);

        // Check if the selected path IS ITSELF an export folder
        if let Some(export) = Self::validate_folder(path) {
            log::info!("detect_in_directory: selected path is itself an export");
            exports.push(export);
            return Ok(exports);
        }

        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();

            // Strict Filename Filter: Only look at things that look like Snapchat exports
            if !file_name.starts_with("mydata~") && !file_name.contains("snapchat") {
                continue;
            }

            log::debug!("detect_in_directory: candidate child: {:?}", path);

            if path.is_dir() {
                if let Some(mut export) = Self::validate_folder(&path) {
                    export.source_type = ExportSourceType::Folder;
                    log::info!("detect_in_directory: validated folder export");
                    log::debug!("Validated export folder: {:?}", path);
                    exports.push(export);
                } else {
                    log::debug!("detect_in_directory: folder didn't validate as export: {:?}", path);
                }
            } else if path.extension().is_some_and(|ext| ext == "zip") {
                if let Some(status) = Self::validate_zip(&path) {
                    exports.push(ExportSet {
                        id: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
                        source_path: path.clone(),
                        source_type: ExportSourceType::Zip,
                        extraction_path: None,
                        creation_date: fs::metadata(&path).ok().and_then(|m| m.created().ok()).map(chrono::DateTime::from),
                        validation_status: status,
                    });
                }
            }
        }

        Ok(exports)
    }

    fn validate_zip(path: &Path) -> Option<ValidationStatus> {
        let file = fs::File::open(path).ok()?;
        let mut archive = zip::ZipArchive::new(file).ok()?;
        
        // Look for signature Snapchat files inside the zip
        let has_index = archive.by_name("index.html").is_ok();
        let has_chat = archive.file_names().any(|n| n.contains("html/chat_history"));
        let has_json = archive.by_name("json/account.json").is_ok();

        if has_index && (has_chat || has_json) {
            Some(ValidationStatus::Valid)
        } else if has_index {
            Some(ValidationStatus::Incomplete)
        } else {
            None // Not a snapchat export
        }
    }

    fn validate_folder(path: &Path) -> Option<ExportSet> {
        let index_html = path.join("index.html");
        let html_dir = path.join("html");
        let chat_history = html_dir.join("chat_history");

        // Snapchat exports typically have 'media' or 'chat_media'
        let media_dir = path.join("media");
        let chat_media_dir = path.join("chat_media");

        log::debug!("validate_folder: checking {:?} - index.html={}, html/={}, chat_history/={}, media/={}, chat_media/={}",
            path, index_html.exists(), html_dir.is_dir(), chat_history.is_dir(), media_dir.is_dir(), chat_media_dir.is_dir());

        // Stricter signature check for folders
        if index_html.exists() && (chat_history.is_dir() || html_dir.is_dir()) {
            let status = if media_dir.is_dir() || chat_media_dir.is_dir() {
                ValidationStatus::Valid
            } else {
                ValidationStatus::Incomplete
            };

            return Some(ExportSet {
                id: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
                source_path: path.to_path_buf(),
                source_type: ExportSourceType::Folder,
                extraction_path: None,
                creation_date: fs::metadata(path).ok().and_then(|m| m.created().ok()).map(chrono::DateTime::from),
                validation_status: status,
            });
        }

        None
    }
}