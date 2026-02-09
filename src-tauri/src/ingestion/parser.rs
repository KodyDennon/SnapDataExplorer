use std::path::{Path, PathBuf};
use std::fs;
use kuchikiki::traits::*;
use crate::models::{Event, Conversation, Person, Memory};
use crate::error::AppResult;
use chrono::{DateTime, Utc, TimeZone, NaiveDateTime};
use uuid::Uuid;
use serde_json::Value;

pub struct ChatParser;

impl ChatParser {
    pub fn parse_subpage(path: &Path) -> AppResult<(Conversation, Vec<Event>)> {
        log::debug!("parse_subpage: parsing {:?}", path);
        let html = fs::read_to_string(path)?;
        let document = kuchikiki::parse_html().one(html);

        let conversation_id = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .replace("subpage_", "");

        let mut conversation = Conversation {
            id: conversation_id.clone(),
            display_name: None,
            participants: Vec::new(),
            last_event_at: None,
            message_count: 0,
            has_media: false,
        };

        if let Ok(h1) = document.document_node.select_first("h1") {
            let text = h1.text_contents();
            if text.contains("Chat History with ") {
                conversation.display_name = Some(text.replace("Chat History with ", "").trim().to_string());
            } else if text.contains("Group Chat") || text.contains("group") {
                conversation.display_name = Some(text.trim().to_string());
            }
        }

        let mut events = Vec::new();

        if let Ok(right_panel) = document.document_node.select_first(".rightpanel") {
            for message_div in right_panel.as_node().children() {
                if let Some(element) = message_div.as_element() {
                    if element.name.local.as_ref() == "div" {
                        if let Some(event) = Self::parse_message_node(&message_div, &conversation_id) {
                            events.push(event);
                        }
                    }
                }
            }
        }

        let mut participants = Vec::new();
        for event in &events {
            if !participants.contains(&event.sender) {
                participants.push(event.sender.clone());
            }
        }
        conversation.participants = participants;
        conversation.message_count = events.len() as i32;
        conversation.last_event_at = events.last().map(|e| e.timestamp);

        log::debug!("parse_subpage: {:?} -> {} events, display_name={:?}", path.file_name(), events.len(), conversation.display_name);
        Ok((conversation, events))
    }

    fn parse_message_node(node: &kuchikiki::NodeRef, conversation_id: &str) -> Option<Event> {
        let sender = node.select_first("h4").ok()?.text_contents().trim().to_string();

        let event_type = Self::detect_event_type(node);

        let content = node.select_first("p").ok().map(|p| p.text_contents().trim().to_string());

        let timestamp_text = node.select_first("h6").ok()?.text_contents();
        let timestamp = Self::try_parse_timestamp(&timestamp_text)?;

        let mut media_references = Vec::new();
        Self::extract_all_media_references(node, &mut media_references);

        Some(Event {
            id: Uuid::new_v4().to_string(),
            timestamp,
            sender,
            sender_name: None,
            media_references,
            conversation_id: Some(conversation_id.to_string()),
            content,
            event_type,
            metadata: None,
        })
    }

    fn detect_event_type(node: &kuchikiki::NodeRef) -> String {
        if let Ok(spans) = node.select("span") {
            for span in spans {
                let text = span.text_contents();
                let trimmed = text.trim();
                match trimmed {
                    "TEXT" | "MEDIA" | "MISSED_VIDEO_CHAT" | "MISSED_AUDIO_CHAT"
                    | "STATUSPARTICIPANTREMOVED" | "NOTE" | "SNAP" | "STICKER"
                    | "SHARE" | "STATUSPARTICIPANTADDED" | "STATUSCONVERSATIONNAMECHANGED" => {
                        return trimmed.to_string();
                    }
                    _ => {}
                }
            }
        }
        "UNKNOWN".to_string()
    }

    fn extract_all_media_references(node: &kuchikiki::NodeRef, refs: &mut Vec<PathBuf>) {
        if let Ok(imgs) = node.select("img") {
            for img in imgs {
                if let Some(src) = img.attributes.borrow().get("src") {
                    if !src.starts_with("data:") {
                        refs.push(PathBuf::from(src));
                    }
                }
            }
        }
        if let Ok(videos) = node.select("video") {
            for video in videos {
                if let Some(src) = video.attributes.borrow().get("src") {
                    refs.push(PathBuf::from(src));
                }
            }
        }
        if let Ok(sources) = node.select("source") {
            for source in sources {
                if let Some(src) = source.attributes.borrow().get("src") {
                    refs.push(PathBuf::from(src));
                }
            }
        }
        if let Ok(links) = node.select("a") {
            for link in links {
                if let Some(href) = link.attributes.borrow().get("href") {
                    let lower = href.to_lowercase();
                    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png")
                        || lower.ends_with(".mp4") || lower.ends_with(".mov") || lower.ends_with(".webp")
                        || lower.ends_with(".heif") || lower.ends_with(".gif") {
                        refs.push(PathBuf::from(href));
                    }
                }
            }
        }
    }

    pub fn try_parse_timestamp(text: &str) -> Option<DateTime<Utc>> {
        let text = text.trim().replace(" UTC", "");
        if let Ok(naive) = NaiveDateTime::parse_from_str(&text, "%Y-%m-%d %H:%M:%S") {
            return Some(Utc.from_utc_datetime(&naive));
        }
        if let Ok(naive) = NaiveDateTime::parse_from_str(&text, "%b %d, %Y %H:%M:%S") {
            return Some(Utc.from_utc_datetime(&naive));
        }
        if let Ok(naive) = NaiveDateTime::parse_from_str(&text, "%m/%d/%Y %H:%M:%S") {
            return Some(Utc.from_utc_datetime(&naive));
        }
        None
    }
}

pub struct PersonParser;

impl PersonParser {
    pub fn parse_friends_json(path: &Path) -> AppResult<Vec<Person>> {
        let content = fs::read_to_string(path)?;
        let json: Value = serde_json::from_str(&content)?;
        let mut people = Vec::new();

        let categories = ["Friends", "Blocked Users", "Deleted Friends", "Hidden Friend Suggestions"];

        for cat in categories {
            if let Some(list) = json.get(cat).and_then(|v| v.as_array()) {
                for entry in list {
                    let username = entry.get("Username").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let display_name = entry.get("Display Name").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(|s| s.to_string());

                    if !username.is_empty() {
                        people.push(Person { username, display_name });
                    }
                }
            }
        }

        Ok(people)
    }
}

pub struct MemoryParser;

impl MemoryParser {
    pub fn parse_memories_json(path: &Path, export_id: &str) -> AppResult<Vec<Memory>> {
        let content = fs::read_to_string(path)?;
        let json: Value = serde_json::from_str(&content)?;
        let mut memories = Vec::new();

        if let Some(saved_media) = json.get("Saved Media").and_then(|v| v.as_array()) {
            for entry in saved_media {
                let date_str = entry.get("Date").and_then(|v| v.as_str()).unwrap_or("");
                let media_type = entry.get("Media Type").and_then(|v| v.as_str()).unwrap_or("Image").to_string();
                let location_str = entry.get("Location").and_then(|v| v.as_str()).unwrap_or("");

                let timestamp = Self::parse_memory_timestamp(date_str);
                let timestamp = match timestamp {
                    Some(ts) => ts,
                    None => continue,
                };

                let (latitude, longitude) = Self::parse_location(location_str);

                memories.push(Memory {
                    id: Uuid::new_v4().to_string(),
                    timestamp,
                    media_type,
                    latitude,
                    longitude,
                    media_path: None,
                    export_id: export_id.to_string(),
                });
            }
        }

        Ok(memories)
    }

    fn parse_memory_timestamp(text: &str) -> Option<DateTime<Utc>> {
        let text = text.trim().replace(" UTC", "");
        if let Ok(naive) = NaiveDateTime::parse_from_str(&text, "%Y-%m-%d %H:%M:%S") {
            return Some(Utc.from_utc_datetime(&naive));
        }
        None
    }

    fn parse_location(text: &str) -> (Option<f64>, Option<f64>) {
        // Format: "Latitude, Longitude: 40.50679, -123.991455"
        if let Some(coords) = text.strip_prefix("Latitude, Longitude: ") {
            let parts: Vec<&str> = coords.split(", ").collect();
            if parts.len() == 2 {
                let lat = parts[0].parse::<f64>().ok();
                let lon = parts[1].parse::<f64>().ok();
                return (lat, lon);
            }
        }
        (None, None)
    }
}

pub struct ChatJsonParser;

impl ChatJsonParser {
    /// Parse json/chat_history.json — the primary source for Media IDs.
    /// Returns Vec<(conversation_id, Vec<Event>)> with media_ids stored in event metadata.
    pub fn parse_chat_history_json(path: &Path) -> AppResult<Vec<(String, Vec<Event>)>> {
        log::debug!("ChatJsonParser: parsing {:?}", path);
        let content = fs::read_to_string(path)?;
        let json: Value = serde_json::from_str(&content)?;
        let mut result = Vec::new();
        let mut total_events = 0;
        let mut media_id_count = 0;

        if let Some(obj) = json.as_object() {
            for (conversation_key, messages) in obj {
                if let Some(msg_list) = messages.as_array() {
                    let mut events = Vec::new();
                    for msg in msg_list {
                        let from = msg.get("From").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let media_type_str = msg.get("Media Type").and_then(|v| v.as_str()).unwrap_or("TEXT");
                        let created = msg.get("Created").and_then(|v| v.as_str()).unwrap_or("");
                        let content_val = msg.get("Content").and_then(|v| v.as_str()).unwrap_or("");
                        let conversation_title = msg.get("Conversation Title").and_then(|v| v.as_str());
                        let is_sender = msg.get("IsSender").and_then(|v| v.as_bool()).unwrap_or(false);
                        let media_ids_raw = msg.get("Media IDs").and_then(|v| v.as_str()).unwrap_or("");

                        let timestamp = match ChatParser::try_parse_timestamp(created) {
                            Some(ts) => ts,
                            None => continue,
                        };

                        // Parse pipe-separated Media IDs
                        let media_ids: Vec<String> = if media_ids_raw.is_empty() {
                            Vec::new()
                        } else {
                            media_ids_raw.split(" | ")
                                .map(|s| s.trim().to_string())
                                .filter(|s| !s.is_empty())
                                .collect()
                        };

                        if !media_ids.is_empty() {
                            media_id_count += media_ids.len();
                        }

                        // Build metadata JSON with media_ids and other fields
                        let mut metadata = serde_json::Map::new();
                        if !media_ids.is_empty() {
                            metadata.insert("media_ids".to_string(), Value::Array(
                                media_ids.iter().map(|id| Value::String(id.clone())).collect()
                            ));
                        }
                        if let Some(title) = conversation_title {
                            metadata.insert("conversation_title".to_string(), Value::String(title.to_string()));
                        }
                        metadata.insert("is_sender".to_string(), Value::Bool(is_sender));

                        let content = if content_val.is_empty() { None } else { Some(content_val.to_string()) };

                        // Map Media Type field to event_type (they already match the convention)
                        let event_type = match media_type_str {
                            "TEXT" | "MEDIA" | "MISSED_VIDEO_CHAT" | "MISSED_AUDIO_CHAT"
                            | "STATUSPARTICIPANTREMOVED" | "NOTE" | "SNAP" | "STICKER"
                            | "SHARE" | "STATUSPARTICIPANTADDED" | "STATUSCONVERSATIONNAMECHANGED" => {
                                media_type_str.to_string()
                            }
                            _ => media_type_str.to_string(),
                        };

                        events.push(Event {
                            id: Uuid::new_v4().to_string(),
                            timestamp,
                            sender: from,
                            sender_name: None,
                            media_references: Vec::new(),
                            conversation_id: Some(conversation_key.clone()),
                            content,
                            event_type,
                            metadata: if metadata.is_empty() { None } else { Some(serde_json::to_string(&metadata).unwrap_or_default()) },
                        });
                    }
                    total_events += events.len();
                    if !events.is_empty() {
                        result.push((conversation_key.clone(), events));
                    }
                }
            }
        }

        log::info!("ChatJsonParser: parsed {} conversations, {} events, {} media IDs total",
            result.len(), total_events, media_id_count);
        Ok(result)
    }
}

/// Parses `json/snap_history.json` — snap send/receive events without Media IDs.
pub struct SnapHistoryParser;

impl SnapHistoryParser {
    pub fn parse_snap_history_json(path: &Path) -> AppResult<Vec<(String, Vec<Event>)>> {
        let content = fs::read_to_string(path)?;
        let json: Value = serde_json::from_str(&content)?;
        let mut result = Vec::new();

        if let Some(obj) = json.as_object() {
            for (conversation_key, snaps) in obj {
                if let Some(snap_list) = snaps.as_array() {
                    let mut events = Vec::new();
                    for snap in snap_list {
                        let from = snap.get("From").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let media_type = snap.get("Media Type").and_then(|v| v.as_str()).unwrap_or("IMAGE");
                        let created = snap.get("Created").and_then(|v| v.as_str()).unwrap_or("");
                        let conversation_title = snap.get("Conversation Title").and_then(|v| v.as_str());
                        let is_sender = snap.get("IsSender").and_then(|v| v.as_bool()).unwrap_or(false);

                        let timestamp = ChatParser::try_parse_timestamp(&created.replace(" UTC", ""));
                        let timestamp = match timestamp {
                            Some(ts) => ts,
                            None => continue,
                        };

                        let event_type = if media_type == "VIDEO" { "SNAP_VIDEO" } else { "SNAP" };
                        let content = if is_sender {
                            Some(format!("Sent a {} snap", media_type.to_lowercase()))
                        } else {
                            Some(format!("Received a {} snap", media_type.to_lowercase()))
                        };

                        let mut metadata = serde_json::Map::new();
                        if let Some(title) = conversation_title {
                            metadata.insert("conversation_title".to_string(), Value::String(title.to_string()));
                        }
                        metadata.insert("is_sender".to_string(), Value::Bool(is_sender));

                        events.push(Event {
                            id: Uuid::new_v4().to_string(),
                            timestamp,
                            sender: from,
                            sender_name: None,
                            media_references: Vec::new(),
                            conversation_id: Some(conversation_key.clone()),
                            content,
                            event_type: event_type.to_string(),
                            metadata: Some(serde_json::to_string(&metadata).unwrap_or_default()),
                        });
                    }
                    if !events.is_empty() {
                        result.push((conversation_key.clone(), events));
                    }
                }
            }
        }

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_try_parse_timestamp_format1() {
        let ts = ChatParser::try_parse_timestamp("2023-01-15 14:30:00");
        assert!(ts.is_some());
        assert_eq!(ts.unwrap().format("%Y-%m-%d").to_string(), "2023-01-15");
    }

    #[test]
    fn test_try_parse_timestamp_format2() {
        let ts = ChatParser::try_parse_timestamp("Jan 15, 2023 14:30:00");
        assert!(ts.is_some());
    }

    #[test]
    fn test_try_parse_timestamp_format3() {
        let ts = ChatParser::try_parse_timestamp("01/15/2023 14:30:00");
        assert!(ts.is_some());
    }

    #[test]
    fn test_try_parse_timestamp_utc_suffix() {
        let ts = ChatParser::try_parse_timestamp("2023-01-15 14:30:00 UTC");
        assert!(ts.is_some());
    }

    #[test]
    fn test_try_parse_timestamp_invalid() {
        assert!(ChatParser::try_parse_timestamp("not a date").is_none());
        assert!(ChatParser::try_parse_timestamp("").is_none());
    }

    #[test]
    fn test_parse_friends_json() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, r#"{{
            "Friends": [
                {{"Username": "alice", "Display Name": "Alice S"}},
                {{"Username": "bob", "Display Name": ""}}
            ],
            "Blocked Users": []
        }}"#).unwrap();

        let people = PersonParser::parse_friends_json(tmp.path()).unwrap();
        assert_eq!(people.len(), 2);
        assert_eq!(people[0].username, "alice");
        assert_eq!(people[0].display_name.as_deref(), Some("Alice S"));
        assert!(people[1].display_name.is_none());
    }

    #[test]
    fn test_parse_memories_json() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, r#"{{
            "Saved Media": [
                {{
                    "Date": "2023-06-15 10:30:00 UTC",
                    "Media Type": "Image",
                    "Location": "Latitude, Longitude: 40.50679, -123.991455"
                }},
                {{
                    "Date": "invalid-date",
                    "Media Type": "Video",
                    "Location": ""
                }}
            ]
        }}"#).unwrap();

        let memories = MemoryParser::parse_memories_json(tmp.path(), "test-export").unwrap();
        assert_eq!(memories.len(), 1);
        assert_eq!(memories[0].media_type, "Image");
        assert!(memories[0].latitude.is_some());
        assert!((memories[0].latitude.unwrap() - 40.50679).abs() < 0.001);
    }

    #[test]
    fn test_parse_chat_history_json() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, r#"{{
            "alice - conv1": [
                {{
                    "From": "alice",
                    "Media Type": "TEXT",
                    "Created": "2023-06-15 10:30:00 UTC",
                    "Content": "Hello!",
                    "IsSender": true,
                    "Media IDs": ""
                }},
                {{
                    "From": "bob",
                    "Media Type": "MEDIA",
                    "Created": "2023-06-15 10:31:00 UTC",
                    "Content": "",
                    "IsSender": false,
                    "Media IDs": "abc123 | def456"
                }}
            ]
        }}"#).unwrap();

        let result = ChatJsonParser::parse_chat_history_json(tmp.path()).unwrap();
        assert_eq!(result.len(), 1);
        let (convo_key, events) = &result[0];
        assert_eq!(convo_key, "alice - conv1");
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].event_type, "TEXT");
        assert_eq!(events[1].event_type, "MEDIA");
        let meta: serde_json::Value = serde_json::from_str(events[1].metadata.as_ref().unwrap()).unwrap();
        let ids = meta["media_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 2);
        assert_eq!(ids[0].as_str().unwrap(), "abc123");
    }
}
