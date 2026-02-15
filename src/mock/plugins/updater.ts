export const check = async () => null;
export class Update {
  version = "1.0.0";
  date = new Date().toISOString();
  body = "Mock update";
  async downloadAndInstall() {
    console.log("Mock download and install");
  }
}
