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

        self.scan_recursive(media_dir, &mut file_count, &mut id_indexed);

        log::info!("MediaLinker: indexed {} files ({} by ID) recursively", file_count, id_indexed);
        log::debug!("MediaLinker: indexed from {:?}", media_dir);
    }

    fn scan_recursive(&mut self, dir: &Path, file_count: &mut usize, id_indexed: &mut usize) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    self.scan_recursive(&path, file_count, id_indexed);
                    continue;
                }
                if !path.is_file() {
                    continue;
                }

                let file_name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };

                *file_count += 1;

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
                        self.id_map.insert(media_id.to_string(), abs_path);
                        *id_indexed += 1;
                    }
                }
            }
        }
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

    #[cfg(test)]
    pub(crate) fn get_id_map(&self) -> &HashMap<String, PathBuf> {
        &self.id_map
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use std::fs::File;
    use std::io::Write;

    fn make_event(event_type: &str, metadata: Option<String>, media_refs: Vec<PathBuf>) -> Event {
        Event {
            id: "test-id".to_string(),
            timestamp: Utc::now(),
            sender: "test-user".to_string(),
            sender_name: None,
            media_references: media_refs,
            conversation_id: Some("conv-1".to_string()),
            content: None,
            event_type: event_type.to_string(),
            metadata,
        }
    }

    #[test]
    fn test_extract_media_ids_with_ids() {
        let meta = Some(r#"{"media_ids": ["abc", "def"]}"#.to_string());
        let ids = MediaLinker::extract_media_ids(&meta);
        assert_eq!(ids, vec!["abc", "def"]);
    }

    #[test]
    fn test_extract_media_ids_none() {
        let ids = MediaLinker::extract_media_ids(&None);
        assert!(ids.is_empty());
    }

    #[test]
    fn test_extract_media_ids_invalid_json() {
        let meta = Some("not valid json".to_string());
        let ids = MediaLinker::extract_media_ids(&meta);
        assert!(ids.is_empty());

        let meta2 = Some("{}".to_string());
        let ids2 = MediaLinker::extract_media_ids(&meta2);
        assert!(ids2.is_empty());
    }

    #[test]
    fn test_extract_media_ids_no_array() {
        let meta = Some(r#"{"media_ids": "not-an-array"}"#.to_string());
        let ids = MediaLinker::extract_media_ids(&meta);
        assert!(ids.is_empty());
    }

    #[test]
    fn test_id_extraction_from_filenames() {
        let dir = tempfile::tempdir().unwrap();
        File::create(dir.path().join("2023-01-01_TESTID123.jpg")).unwrap();
        File::create(dir.path().join("2023-06-15_ID-WITH-DASHES.png")).unwrap();
        File::create(dir.path().join("nounderscorefile.jpg")).unwrap();

        let linker = MediaLinker::new(dir.path());
        let map = linker.get_id_map();

        assert!(map.contains_key("TESTID123"));
        assert!(map.contains_key("ID-WITH-DASHES"));
        // "nounderscorefile.jpg" has no underscore, so no ID extracted
        assert!(!map.contains_key("nounderscorefile"));
        assert_eq!(map.len(), 2);
    }

    #[test]
    fn test_link_media_by_id() {
        let dir = tempfile::tempdir().unwrap();
        let media_file = dir.path().join("2023-01-01_ABC123.jpg");
        File::create(&media_file).unwrap().write_all(b"fake").unwrap();

        let mut linker = MediaLinker::new(dir.path());
        let meta = r#"{"media_ids": ["ABC123"]}"#.to_string();
        let mut events = vec![make_event("MEDIA", Some(meta), vec![])];

        linker.link_media(&mut events);
        assert_eq!(events[0].media_references.len(), 1);
        assert!(events[0].media_references[0].exists());
    }

    #[test]
    fn test_link_skips_non_media_events() {
        let dir = tempfile::tempdir().unwrap();
        let media_file = dir.path().join("2023-01-01_ABC123.jpg");
        File::create(&media_file).unwrap().write_all(b"fake").unwrap();

        let mut linker = MediaLinker::new(dir.path());
        let meta = r#"{"media_ids": ["ABC123"]}"#.to_string();
        let mut events = vec![make_event("TEXT", Some(meta), vec![])];

        linker.link_media(&mut events);
        assert!(events[0].media_references.is_empty());
    }
}
