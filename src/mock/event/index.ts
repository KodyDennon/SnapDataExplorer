export const listen = async (event: string, _handler: (payload: any) => void) => {
  console.log(`[MOCK LISTEN] ${event}`);
  
  if (event === "ingestion-progress") {
    // Simulate progress after a delay if needed
  }
  
  return () => {
    console.log(`[MOCK UNLISTEN] ${event}`);
  };
};
