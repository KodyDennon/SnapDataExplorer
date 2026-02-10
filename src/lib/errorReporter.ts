import { getVersion } from "@tauri-apps/api/app";
import { type, arch } from "@tauri-apps/plugin-os";

export interface CrashReport {
  timestamp: string;
  appVersion: string;
  os: string;
  arch: string;
  errorName: string;
  errorMessage: string;
  stack?: string;
  componentStack?: string;
}

export async function generateCrashReport(error: Error, componentStack?: string): Promise<string> {
  const version = await getVersion();
  const osType = type();
  const osArch = arch();
  
  const report: CrashReport = {
    timestamp: new Date().toISOString(),
    appVersion: version,
    os: osType,
    arch: osArch,
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    componentStack: componentStack,
  };

  return `--- SNAP DATA EXPLORER CRASH REPORT ---
Date: ${report.timestamp}
App Version: ${report.appVersion}
OS: ${report.os} (${report.arch})

Error: ${report.errorName}: ${report.errorMessage}

--- STACK TRACE ---
${report.stack || "No stack trace available"}

--- COMPONENT STACK ---
${report.componentStack || "No component stack available"}

--- END REPORT ---`;
}
