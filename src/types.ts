export interface ExportSet {
  id: string;
  source_path: string;
  source_type: "Zip" | "Folder";
  extraction_path: string | null;
  creation_date: string | null;
  validation_status: "Valid" | "Incomplete" | "Corrupted" | "Unknown";
}

export interface IngestionProgress {
  export_id: string;
  current_step: string;
  progress: number;
  message: string;
}

export interface Conversation {
  id: string;
  display_name: string | null;
  participants: string[];
  last_event_at: string | null;
  message_count: number;
  has_media: boolean;
}

export interface Event {
  id: string;
  timestamp: string;
  sender: string;
  sender_name: string | null;
  content: string | null;
  event_type: string;
  media_references: string[];
  metadata: string | null;
}

export interface Memory {
  id: string;
  timestamp: string;
  media_type: string;
  latitude: number | null;
  longitude: number | null;
  media_path: string | null;
  export_id: string;
}

export interface ExportStats {
  total_messages: number;
  total_conversations: number;
  total_memories: number;
  total_media_files: number;
  missing_media_count: number;
  top_contacts: [string, number][];
  start_date: string | null;
  end_date: string | null;
}

export interface SearchResult {
  event_id: string;
  conversation_id: string | null;
  conversation_name: string | null;
  sender: string;
  sender_name: string | null;
  content: string;
  timestamp: string;
  event_type: string;
}

export interface MediaEntry {
  path: string;
  media_type: string;
  timestamp: string | null;
  source: string;
  conversation_id: string | null;
}

export interface IngestionResult {
  export_id: string;
  conversations_parsed: number;
  events_parsed: number;
  memories_parsed: number;
  parse_failures: number;
  warnings: string[];
  errors: string[];
}

export interface ValidationReport {
  total_html_files: number;
  parsed_html_files: number;
  total_media_referenced: number;
  media_found: number;
  media_missing: number;
  missing_files: string[];
  warnings: string[];
}

export interface MessagePage {
  messages: Event[];
  total_count: number;
  has_more: boolean;
}
