type Handler = (payload: any) => void;
const handlers: Record<string, Handler[]> = {};

export const listen = async (event: string, handler: Handler) => {
  console.log(`[MOCK LISTEN] ${event}`);
  if (!handlers[event]) handlers[event] = [];
  handlers[event].push(handler);
  
  return () => {
    console.log(`[MOCK UNLISTEN] ${event}`);
    handlers[event] = handlers[event].filter(h => h !== handler);
  };
};

// Internal mock helper to emit events
export const mockEmit = (event: string, payload: any) => {
  console.log(`[MOCK EMIT] ${event}`, payload);
  if (handlers[event]) {
    handlers[event].forEach(h => h({ payload }));
  }
};
