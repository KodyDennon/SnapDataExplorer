import { Conversation, Event, Memory, ExportSet, ExportStats } from "../../types";

export const MOCK_EXPORTS: ExportSet[] = [
  {
    id: "mock-export-123",
    source_paths: ["/Users/demo/Downloads/mydata~123456789"],
    source_type: "Folder",
    extraction_path: "/Users/demo/Library/Application Support/Snap Explorer/exports/mock-export-123",
    creation_date: new Date().toISOString(),
    validation_status: "Valid"
  }
];

export const MOCK_STATS: ExportStats = {
  total_messages: 12450,
  total_conversations: 42,
  total_memories: 156,
  total_media_files: 890,
  missing_media_count: 12,
  top_contacts: [
    ["Sarah J.", 4500],
    ["The Boys 🍻", 3200],
    ["Mom ❤️", 1200],
    ["Gym Group", 850],
    ["Alex D.", 600]
  ],
  start_date: "2018-04-12T10:00:00Z",
  end_date: new Date().toISOString()
};

export const MOCK_CONVERSATIONS: Conversation[] = [
  { id: "c1", display_name: "The Boys 🍻", participants: ["Kody", "Alex", "Steve", "Mike"], last_event_at: new Date().toISOString(), message_count: 3200, has_media: true },
  { id: "c2", display_name: "Sarah J.", participants: ["Kody", "Sarah"], last_event_at: new Date(Date.now() - 3600000).toISOString(), message_count: 4500, has_media: true },
  { id: "c3", display_name: "Mom ❤️", participants: ["Kody", "Mom"], last_event_at: new Date(Date.now() - 86400000).toISOString(), message_count: 1200, has_media: false },
  { id: "c4", display_name: "Gym Group", participants: ["Kody", "Chris", "Emma"], last_event_at: new Date(Date.now() - 172800000).toISOString(), message_count: 850, has_media: true },
  { id: "c5", display_name: "Team Work", participants: ["Kody", "Boss", "Alice"], last_event_at: new Date(Date.now() - 604800000).toISOString(), message_count: 300, has_media: false }
];

export const generateMockMessages = (convoId: string): Event[] => {
  const messages: Event[] = [];
  const convo = MOCK_CONVERSATIONS.find(c => c.id === convoId);
  const participants = convo?.participants || ["Kody", "User"];
  
  for (let i = 0; i < 50; i++) {
    const sender = participants[i % participants.length];
    messages.push({
      id: `m${i}`,
      timestamp: new Date(Date.now() - (50 - i) * 60000).toISOString(),
      sender: sender.toLowerCase(),
      sender_name: sender,
      content: i % 5 === 0 ? null : `This is a sample message ${i} in ${convo?.display_name}`,
      event_type: i % 5 === 0 ? "media" : "text",
      media_references: i % 5 === 0 ? [`https://picsum.photos/seed/${convoId}${i}/800/600`] : [],
      metadata: null
    });
  }
  return messages.reverse();
};

export const MOCK_MEMORIES: Memory[] = Array.from({ length: 40 }).map((_, i) => ({
  id: `mem${i}`,
  timestamp: new Date(Date.now() - i * 86400000).toISOString(),
  media_type: i % 3 === 0 ? "Video" : "Image",
  latitude: 34.0522,
  longitude: -118.2437,
  media_path: `https://picsum.photos/seed/mem${i}/1080/1920`,
  export_id: "mock-export-123",
  download_url: null,
  proxy_url: null,
  download_status: "Downloaded"
}));
