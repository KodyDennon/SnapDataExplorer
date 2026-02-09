# Snapchat Data Explorer - Project Context

## Overview
Snapchat Data Explorer is a planned **local-first desktop application** designed to ingest, validate, reconstruct, and graphically explore Snapchat "My Data" exports. The goal is to provide a user-friendly interface for browsing historical Snapchat data (memories, chats, etc.) that is otherwise fragmented and difficult to navigate in the raw HTML/JSON export provided by Snapchat.

## Current Status
**Phase:** Inception / Architecture Design
**Codebase:** Not yet initialized. No source code exists in this directory.
**Contents:**
- Requirements and Architecture documentation.
- Sample data exports for testing and analysis.

## Key Documentation
*   **`snapchat_data_explorer_project_requirements_concept (1).md`**: Defines the problem statement, core concepts (Data Reconstruction vs. File Browsing), and user experience requirements. It establishes **"HTML-first"** reconstruction as a key principle, treating the exported HTML as the authoritative source of meaning.
*   **`snapchat_data_explorer_technical_architecture.md`**: Outlines the technical stack and architectural principles.
    *   **Stack:** Rust backend, Web-based UI (via Tauri).
    *   **Principles:** Local-first, trust-critical, scale-aware (handling 300GB+ exports), and strict separation of concerns.
*   **`snapchat_data_explorer_agent_execution_contract.md`**: Sets the rules for AI agents working on this project. It emphasizes **correctness over speed**, production-quality code (no "TODOs"), and strict adherence to the documented constraints.

## Planned Architecture
*   **Frontend:** Web-based UI hosted in Tauri. Responsible for presentation only (virtualized lists, media rendering).
*   **Backend:** Rust. Responsible for file system interaction, parsing, reconstruction, indexing, and job management.
*   **IPC:** Strongly typed commands and events via Tauri IPC.
*   **Data Model:** "Event-centric" model that links media assets to timestamps and conversations derived from HTML.

## Directory Structure
*   **`export_refernces/`**: Contains sample Snapchat "My Data" exports (zip files and extracted directories). These serve as the input data for development and testing.
    *   **`chat_media/`**: Contains media files (images, videos) with non-semantic filenames.
    *   **`html/`**: Contains the HTML files that provide context and structure.
    *   **`json/`**: Contains supplemental JSON data (optional).

## Usage
This directory is currently a workspace for planning and analyzing the requirements before code initialization. Future interactions will involve setting up the Rust/Tauri project structure and implementing the core parsing logic based on the sample data in `export_refernces`.
