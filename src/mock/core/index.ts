import { MOCK_CONVERSATIONS, MOCK_EXPORTS, MOCK_MEMORIES, MOCK_STATS, generateMockMessages } from "../data/simulated";
import { mockEmit } from "../event";

export const invoke = async (cmd: string, args?: any): Promise<any> => {
  console.log(`[MOCK INVOKE] ${cmd}`, args);
  
  switch (cmd) {
    case "get_exports":
      return MOCK_EXPORTS;
    case "get_conversations":
      return MOCK_CONVERSATIONS;
    case "search_messages":
      return [
        {
          event_id: "m1",
          conversation_id: "c1",
          conversation_name: "The Boys 🍻",
          sender: "alex",
          sender_name: "Alex",
          timestamp: new Date().toISOString(),
          content: `Matched result for ${args?.query || "pizza"} - Yo, let's get some pizza!`,
          event_type: "text"
        },
        {
          event_id: "m2",
          conversation_id: "c2",
          conversation_name: "Sarah J.",
          sender: "sarah",
          sender_name: "Sarah",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          content: `Another mention of ${args?.query || "pizza"} here.`,
          event_type: "text"
        }
      ];
    case "get_messages":
    case "get_messages_page":
      const msgs = generateMockMessages(args?.conversationId || args?.conversation_id || "c1");
      return {
        messages: msgs,
        total_count: msgs.length,
        has_more: false
      };
    case "get_export_stats":
      return MOCK_STATS;
    case "get_memories":
      return MOCK_MEMORIES;
    case "get_unified_media_stream":
      return {
        items: MOCK_MEMORIES.map(m => ({
          id: m.id,
          path: m.media_path,
          media_type: m.media_type,
          timestamp: m.timestamp,
          source: "local"
        })),
        total_count: MOCK_MEMORIES.length,
        has_more: false
      };
    case "get_conversation_name":
      return MOCK_CONVERSATIONS.find(c => c.id === (args?.conversationId || args?.conversation_id))?.display_name || "Unknown";
    case "auto_detect_exports":
    case "detect_exports":
      return MOCK_EXPORTS;
    case "process_export":
      // Simulate ingestion progress
      setTimeout(() => mockEmit("ingestion-progress", { export_id: "mock", current_step: "Initializing", progress: 0.1, message: "Reading export..." }), 100);
      setTimeout(() => mockEmit("ingestion-progress", { export_id: "mock", current_step: "Parsing Chats", progress: 0.4, message: "Parsing 4,200 messages..." }), 500);
      setTimeout(() => mockEmit("ingestion-progress", { export_id: "mock", current_step: "Linking Media", progress: 0.7, message: "Linking attachments..." }), 1000);
      setTimeout(() => mockEmit("ingestion-progress", { export_id: "mock", current_step: "Complete", progress: 1.0, message: "Import successful" }), 1500);
      return Promise.resolve();
    case "reset_data":
      return Promise.resolve();
    case "get_log_path":
      return "/tmp/mock.log";
    case "get_storage_path":
      return "/tmp/mock_storage";
    case "check_disk_space":
      return { available_bytes: 500 * 1024 * 1024 * 1024, total_bytes: 1024 * 1024 * 1024 * 1024, mount_point: "/" };
    default:
      return null;
  }
};

export const convertFileSrc = (path: string) => {
  return path; // Mocks use external URLs mostly
};
