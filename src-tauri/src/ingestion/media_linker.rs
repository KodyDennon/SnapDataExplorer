use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use crate::models::Event;

pub struct MediaLinker {
    /// Maps media ID (from filename) -> absolute file path
    id_map: HashMap<String, PathBuf>,
}

impl MediaLinker {
    pub fn new(media_dir: &Path) -> Self {
        let mut linker = Self {
            id_map: HashMap::new(),
        };
        linker.add_media_directory(media_dir);
        linker
    }

    pub fn add_media_directory(&mut self, media_dir: &Path) {
        if !media_dir.is_dir() {
            log::warn!("MediaLinker: media directory does not exist");
            log::debug!("Missing media dir: {:?}", media_dir);
            return;
        }

        let mut file_count = 0;
        let mut id_indexed = 0;

        if let Ok(entries) = fs::read_dir(media_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                let file_name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };

                file_count += 1;

                // Extract media ID: filename format is "YYYY-MM-DD_<MEDIA_ID>.<ext>"
                // The ID is everything between the first '_' and the last '.'
                if let Some(underscore_pos) = file_name.find('_') {
                    let after_underscore = &file_name[underscore_pos + 1..];
                    let media_id = if let Some(dot_pos) = after_underscore.rfind('.') {
                        &after_underscore[..dot_pos]
                    } else {
                        after_underscore
                    };

                    if !media_id.is_empty() {
                        let abs_path = fs::canonicalize(&path).unwrap_or_else(|e| {
                            log::warn!("MediaLinker: canonicalize failed for {:?}: {}", path, e);
                            path.clone()
                        });
                        if let Some(existing) = self.id_map.get(media_id) {
                            log::debug!("MediaLinker: ID collision for '{}': {:?} vs {:?}", media_id, existing, abs_path);
                        }
                        self.id_map.insert(media_id.to_string(), abs_path);
                        id_indexed += 1;
                    }
                }
            }
        }

        log::info!("MediaLinker: indexed {} files ({} by ID)", file_count, id_indexed);
        log::debug!("MediaLinker: indexed from {:?}", media_dir);
    }

    pub fn link_media(&mut self, events: &mut [Event]) {
        let mut id_matched = 0;
        let mut no_ids = 0;
        let mut id_not_found = 0;
        let mut already_linked = 0;

        for event in events.iter_mut() {
            if !event.media_references.is_empty() {
                already_linked += 1;
                continue;
            }

            // Only link event types that carry media
            match event.event_type.as_str() {
                "MEDIA" | "NOTE" | "SNAP" | "SNAP_VIDEO" | "STICKER" => {}
                _ => continue,
            }

            // Only link via ID-based matching from event metadata
            let media_ids = Self::extract_media_ids(&event.metadata);

            if media_ids.is_empty() {
                no_ids += 1;
                continue;
            }

            let mut found_any = false;
            for mid in &media_ids {
                if let Some(file_path) = self.id_map.get(mid) {
                    // Verify file still exists
                    if file_path.exists() {
                        event.media_references.push(file_path.clone());
                        found_any = true;
                    } else {
                        log::debug!("MediaLinker: file no longer exists for ID '{}': {:?}", mid, file_path);
                    }
                }
            }

            if found_any {
                id_matched += 1;
            } else {
                id_not_found += 1;
            }
        }

        log::info!("MediaLinker: ID-matched {}, no-ids-in-metadata {}, id-not-found {}, already-linked {}",
            id_matched, no_ids, id_not_found, already_linked);
    }

    /// Extract media_ids array from event metadata JSON string.
    /// Metadata format: {"media_ids": ["id1", "id2"], ...}
    fn extract_media_ids(metadata: &Option<String>) -> Vec<String> {
        let meta_str = match metadata {
            Some(s) => s,
            None => return Vec::new(),
        };

        let parsed: serde_json::Value = match serde_json::from_str(meta_str) {
            Ok(v) => v,
            Err(_) => return Vec::new(),
        };

        match parsed.get("media_ids").and_then(|v| v.as_array()) {
            Some(arr) => arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
            None => Vec::new(),
        }
    }
}
