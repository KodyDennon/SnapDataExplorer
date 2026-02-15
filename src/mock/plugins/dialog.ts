export const ask = async (message: string) => {
  console.log(`Mock ask: ${message}`);
  return true;
};

export const message = async (content: string) => {
  console.log(`Mock message: ${content}`);
};

export const open = async (options: any) => {
  console.log(`Mock open dialog:`, options);
  return "/mock/path/to/export";
};

export const save = async (options: any) => {
  console.log(`Mock save dialog:`, options);
  return "/mock/path/to/save.json";
};
