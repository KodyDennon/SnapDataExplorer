import { describe, it, expect, vi } from "vitest";
import { generateCrashReport } from "./errorReporter";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(() => Promise.resolve("1.0.0")),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  type: vi.fn(() => "macos"),
  arch: vi.fn(() => "arm64"),
}));

describe("errorReporter", () => {
  it("generates a formatted crash report", async () => {
    const error = new Error("Custom error message");
    error.stack = "Error: Custom error message\n    at test line";
    
    const report = await generateCrashReport(error, "component stack info");
    
    expect(report).toContain("SNAP DATA EXPLORER CRASH REPORT");
    expect(report).toContain("App Version: 1.0.0");
    expect(report).toContain("OS: macos (arm64)");
    expect(report).toContain("Error: Error: Custom error message");
    expect(report).toContain("test line");
    expect(report).toContain("component stack info");
  });

  it("handles missing stack traces gracefully", async () => {
    const error = new Error("No stack");
    delete error.stack;
    
    const report = await generateCrashReport(error);
    expect(report).toContain("No stack trace available");
  });
});