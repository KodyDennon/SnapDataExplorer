use std::path::{Path, PathBuf};
use std::fs;
use std::sync::LazyLock;
use crate::models::{ExportSet, ValidationStatus, ExportSourceType};
use crate::error::AppResult;
use std::collections::HashMap;
use regex::Regex;
use chrono::{DateTime, Utc};

static EXPORT_ID_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(mydata~\d+)(?:-\d+)?(?:\.zip)?$").unwrap()
});

pub struct ExportDetector;

fn std_time_to_chrono(time: std::time::SystemTime) -> DateTime<Utc> {
    DateTime::<Utc>::from(time)
}

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

        for path in &paths_to_scan {
            match Self::detect_in_directory(path) {
                Ok(exports) => {
                    all_exports.extend(exports);
                }
                Err(e) => {
                    log::warn!("Error scanning standard path {:?}: {}", path, e);
                }
            }
        }

        // De-duplicate exports found in multiple paths (by ID)
        let mut unique_exports: HashMap<String, ExportSet> = HashMap::new();
        for exp in all_exports {
            unique_exports.entry(exp.id.clone()).or_insert(exp);
        }

        Ok(unique_exports.into_values().collect())
    }

    pub fn detect_in_directory(path: &Path) -> AppResult<Vec<ExportSet>> {
        if path.is_file() {
            // If it's a single zip, wrap it in a group of one
            if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("zip")) {
                if let Some(status) = Self::validate_zip(path) {
                    return Ok(vec![ExportSet {
                        id: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
                        source_paths: vec![path.to_path_buf()],
                        source_type: ExportSourceType::Zip,
                        extraction_path: None,
                        creation_date: fs::metadata(path).ok().and_then(|m| m.created().ok()).map(std_time_to_chrono),
                        validation_status: status,
                    }]);
                }
            }
            return Ok(vec![]);
        }

        if !path.is_dir() {
            return Ok(vec![]);
        }

        // Check if the selected path IS ITSELF a unified export folder
        if let Some(export) = Self::validate_folder(path) {
            return Ok(vec![export]);
        }

        let mut candidates = Vec::new();
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let p = entry.path();
            let name = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();

            // Broad filter: looks like snapchat data
            if name.starts_with("mydata~") || name.contains("snapchat") {
                candidates.push(p);
            }
        }

        Self::group_candidates(candidates)
    }

    /// Intelligent grouping of related files and folders.
    fn group_candidates(paths: Vec<PathBuf>) -> AppResult<Vec<ExportSet>> {
        let mut groups: HashMap<String, Vec<PathBuf>> = HashMap::new();

        for path in paths {
            let name = path.file_name().unwrap_or_default().to_string_lossy();
            if let Some(caps) = EXPORT_ID_RE.captures(&name) {
                let base_id = caps.get(1).map(|m| m.as_str().to_string()).unwrap();
                groups.entry(base_id).or_default().push(path);
            } else {
                // Fallback: group by name without extension for non-standard zips
                let stem = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                groups.entry(stem).or_default().push(path);
            }
        }

        let mut results = Vec::new();
        for (id, mut members) in groups {
            // Sort members to ensure part 1/main file is usually first (lexicographical)
            members.sort();

            let is_zip = members.iter().any(|p| p.extension().is_some_and(|e| e == "zip"));
            let source_type = if is_zip { ExportSourceType::Zip } else { ExportSourceType::Folder };

            // Perform unified validation across all group members
            let status = if is_zip {
                Self::validate_zip_group(&members)
            } else {
                Self::validate_folder_group(&members)
            };

            if status != ValidationStatus::Unknown {
                results.push(ExportSet {
                    id,
                    source_paths: members.clone(),
                    source_type,
                    extraction_path: None,
                    creation_date: members.first().and_then(|p| fs::metadata(p).ok()).and_then(|m| m.created().ok()).map(std_time_to_chrono),
                    validation_status: status,
                });
            }
        }

        Ok(results)
    }

    fn validate_zip(path: &Path) -> Option<ValidationStatus> {
        let file = fs::File::open(path).ok()?;
        let mut archive = zip::ZipArchive::new(file).ok()?;
        
        let has_index = archive.by_name("index.html").is_ok();
        let has_chat = archive.file_names().any(|n| n.contains("html/chat_history"));
        let has_media = archive.file_names().any(|n| n.contains("chat_media/") || n.contains("media/"));

        if has_index && has_chat && has_media {
            Some(ValidationStatus::Valid)
        } else if has_index {
            Some(ValidationStatus::Incomplete)
        } else {
            None
        }
    }

    fn validate_zip_group(paths: &[PathBuf]) -> ValidationStatus {
        let mut has_index = false;
        let mut has_chat = false;
        let mut has_media = false;

        for path in paths {
            if let Ok(file) = fs::File::open(path) {
                if let Ok(mut archive) = zip::ZipArchive::new(file) {
                    if !has_index && archive.by_name("index.html").is_ok() { has_index = true; }
                    if !has_chat && archive.file_names().any(|n| n.contains("html/chat_history")) { has_chat = true; }
                    if !has_media && archive.file_names().any(|n| n.contains("chat_media/") || n.contains("media/")) { has_media = true; }
                }
            }
        }

        if has_index && has_chat && has_media {
            ValidationStatus::Valid
        } else if has_index {
            ValidationStatus::Incomplete
        } else if !paths.is_empty() {
            ValidationStatus::Incomplete // At least we found something
        } else {
            ValidationStatus::Unknown
        }
    }

    fn validate_folder(path: &Path) -> Option<ExportSet> {
        let index_html = path.join("index.html");
        let has_chat = path.join("html/chat_history").is_dir();
        let has_media = path.join("chat_media").is_dir() || path.join("media").is_dir();

        if index_html.exists() {
            let status = if has_chat && has_media {
                ValidationStatus::Valid
            } else {
                ValidationStatus::Incomplete
            };

            return Some(ExportSet {
                id: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
                source_paths: vec![path.to_path_buf()],
                source_type: ExportSourceType::Folder,
                extraction_path: None,
                creation_date: fs::metadata(path).ok().and_then(|m| m.created().ok()).map(std_time_to_chrono),
                validation_status: status,
            });
        }
        None
    }

    fn validate_folder_group(paths: &[PathBuf]) -> ValidationStatus {
        let mut has_index = false;
        let mut has_chat = false;
        let mut has_media = false;

        for path in paths {
            if path.join("index.html").exists() { has_index = true; }
            if path.join("html/chat_history").is_dir() { has_chat = true; }
            if path.join("chat_media").is_dir() || path.join("media").is_dir() { has_media = true; }
            
            // Siblings check: if this path is 'chat_media', look for its 'html' sibling
            if !has_index {
                if let Some(parent) = path.parent() {
                    if parent.join("index.html").exists() { has_index = true; }
                }
            }
        }

        if has_index && has_chat && has_media {
            ValidationStatus::Valid
        } else if has_index {
            ValidationStatus::Incomplete
        } else if !paths.is_empty() {
            ValidationStatus::Incomplete
        } else {
            ValidationStatus::Unknown
        }
    }
}
