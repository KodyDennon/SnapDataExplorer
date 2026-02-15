import { MOCK_CONVERSATIONS, MOCK_EXPORTS, MOCK_MEMORIES, MOCK_STATS, generateMockMessages } from "../data/simulated";

export const invoke = async (cmd: string, args?: any): Promise<any> => {
  console.log(`[MOCK INVOKE] ${cmd}`, args);
  
  switch (cmd) {
    case "get_exports":
      return MOCK_EXPORTS;
    case "get_conversations":
      return MOCK_CONVERSATIONS;
    case "get_messages":
    case "get_messages_page":
      return generateMockMessages(args?.conversation_id || "c1");
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
      return MOCK_CONVERSATIONS.find(c => c.id === args?.conversation_id)?.display_name || "Unknown";
    case "auto_detect_exports":
    case "detect_exports":
      return MOCK_EXPORTS;
    case "process_export":
      return new Promise((resolve) => setTimeout(resolve, 2000));
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
