# Snapchat Data Explorer

## 1. Overview
Snapchat Data Explorer is a **local-first, cross-platform desktop application** designed to ingest, validate, reconstruct, and graphically explore Snapchat **My Data** exports. It is built to handle very large, fragmented exports (30GB–300GB+) and transform Snapchat’s poorly connected HTML export into a coherent, searchable, and trustworthy personal archive.

The application operates entirely offline and processes only data the user has already legally exported from Snapchat.

---

## 2. Problem Statement
Snapchat’s official My Data export is not designed for real-world usability:
- Exports are split into many ~2GB archives with no guidance on completeness
- Media files are detached from meaning, stored with opaque filenames
- HTML pages are fragmented, slow, and poorly linked
- Context (who, when, where, why) is scattered and difficult to reconstruct
- Large exports are risky for non-technical users to unpack and manage

As a result, users cannot easily:
- Verify they downloaded *all* of their data
- Understand whether their archive is complete or corrupted
- Explore years of memories in a meaningful, human-friendly way

---

## 3. Core Concept
Snapchat Data Explorer treats a Snapchat export as a **data reconstruction problem**, not a file-browsing problem.

The application:
- Detects and validates export parts
- Reconstructs relationships encoded in HTML
- Resolves media into its original context
- Presents the result through a fast, graphical explorer

The system is explicitly **HTML-first**, using Snapchat’s exported HTML as the authoritative source of meaning. JSON data, if present, is treated as optional supplemental input.

---

## 4. Design Principles
- **Local-only**: No cloud, no uploads, no accounts
- **Read-only by default**: Original exports are never modified without explicit consent
- **Transparent**: Clear reporting of missing, incomplete, or corrupted data
- **Deterministic**: Same input produces the same reconstructed result
- **Scalable**: Designed for datasets ranging from a few GB to hundreds of GB

---

## 5. Observed Snapchat Export Structure (Requirements Basis)

Based on real Snapchat My Data exports:

### 5.1 Root Layout Invariants
- `index.html` exists at the root and serves only as a landing page
- `/html/` contains the authoritative representations of user data
- `/media/` contains all photo and video assets using non-semantic filenames
- `/json/` may exist but is optional and not guaranteed

### 5.2 HTML Characteristics
- `/html/` contains category-level pages (profile, history, subscriptions, etc.)
- Conversation and relationship data is divided across many files named `subpage_<identifier>.html`
- Each subpage implicitly defines:
  - A person or conversation
  - Associated timestamps
  - References to one or more media assets

### 5.3 Media Characteristics
- Media files are stored in a flat directory structure
- Filenames do not encode human-meaningful information
- Media assets are contextless without HTML references

### 5.4 Requirement Implication
**HTML must be treated as the primary graph of meaning. Media assets are inert until resolved and contextualized through HTML parsing.**

---

## 6. Conceptual Data Model (Reconstruction-Oriented)

This section defines the **conceptual internal data model** used by Snapchat Data Explorer. It is descriptive and requirements-driven, not tied to any specific database or programming language.

### 6.1 Core Entities

**ExportSet**
- Represents one logical Snapchat export (possibly composed of many parts)
- Attributes:
  - Export identifier(s)
  - Detected creation date(s)
  - Source directories / archives
  - Validation status (complete / incomplete / corrupted)

**HtmlDocument**
- Represents a single exported HTML file
- Attributes:
  - File path
  - Category (profile, history, conversation, etc.)
  - Parsed timestamp range (if available)

**Conversation**
- Represents a logical relationship or thread (person, group, or story context)
- Derived from one or more HTML subpages
- Attributes:
  - Display name / identifier
  - Associated participants
  - Associated time range

**Person**
- Represents another Snapchat user referenced in the export
- Attributes:
  - Display name or identifier
  - References to conversations

**MediaAsset**
- Represents a single photo or video file
- Attributes:
  - File path
  - Media type (photo / video)
  - File hash (for deduplication)
  - Existence status (present / missing)

**Event**
- Represents a single moment in time where media and context intersect
- Derived entity reconstructed from HTML
- Attributes:
  - Timestamp
  - Media reference(s)
  - Conversation reference
  - Caption / text (if present)
  - Location (if present)

---

### 6.2 Relationships

- An **ExportSet** contains many HtmlDocuments
- HtmlDocuments reference zero or more MediaAssets
- HtmlDocuments contribute to one or more Conversations
- Conversations involve one or more Persons
- MediaAssets are linked to Events
- Events belong to exactly one ExportSet

This relationship graph allows reconstruction even when parts of the export are missing.

---

### 6.3 Invariants & Constraints

- MediaAssets have no standalone meaning without Events
- Conversations may exist without media (metadata-only)
- Events must be derivable from HTML to be considered valid
- Missing MediaAssets do not invalidate Events but must be flagged

---

### 6.4 Why an Event-Centric Model

The Event entity is the primary unit for exploration because it:
- Anchors media to time
- Preserves conversational context
- Allows chronological reconstruction
- Supports partial data without breaking the model

This model supports timeline views, conversation views, and search without relying on filesystem structure.

---

## 7. MVP Feature Requirements


## 7. User Experience Requirements
- Clear first-run explanation of what the app does and does not do
- Explicit consent before any non-read-only operation
- Visible progress and status indicators for long-running tasks
- Clear, human-readable error and warning messages
- No silent failures or hidden assumptions

---

## 8. Non-Goals & Explicit Exclusions
- No Snapchat account authentication
- No scraping, automation, or ToS circumvention
- No dependency on Snapchat APIs
- No forced cloud sync or sharing features
- No assumption that JSON exports are present or complete

---

## 9. Target Users
- Long-time Snapchat users with large historical archives
- Users exporting data due to storage limits or account issues
- Privacy-conscious individuals who want full control of their data
- Non-technical users frustrated by Snapchat’s default export viewer

---

## 10. Conceptual Positioning
Snapchat Data Explorer is best described as:
- A **personal data reconstruction tool**
- A **Snapchat export integrity checker**
- A **forensic-grade personal archive browser**

It is not a downloader, scraper, or replacement for Snapchat.

---

## 11. Conceptual Data Model (Non-Implementational)

This section defines the **conceptual data model** used by Snapchat Data Explorer. It is intentionally technology-agnostic and exists to describe *what* the system understands, not *how* it is stored or implemented.

### 11.1 Core Entities

**ExportSet**
- Represents one logical Snapchat My Data export
- May be composed of multiple ZIP files or folders
- Has a completeness and integrity status

**HTMLDocument**
- Represents a single exported HTML file
- Classified by type (index, category page, subpage)
- Acts as a source of relationships and references

**Conversation**
- Represents a relationship context (person-to-person or group)
- Derived from one or more HTML subpages
- Owns a collection of events and media references

**Person**
- Represents another Snapchat user referenced in the export
- Identified by display name or identifier present in HTML
- May participate in multiple conversations

**MediaAsset**
- Represents a photo or video file in the `/media/` directory
- Identified by filename and resolved path
- Has no inherent meaning without associated events

**Event**
- Represents a time-based occurrence (snap sent/received, memory, story entry)
- Derived from HTML content
- Links media assets to conversations, people, and timestamps

**Timestamp**
- Represents a point in time associated with an event
- May include varying precision depending on export data

**Location (Optional)**
- Represents a geographic reference if present in HTML
- May be incomplete or absent for many events

---

### 11.2 Relationships

- An **ExportSet** contains many **HTMLDocuments** and **MediaAssets**
- An **HTMLDocument** defines zero or more **Conversations** and **Events**
- A **Conversation** links one or more **People**
- A **Conversation** contains many **Events**
- An **Event** references zero or more **MediaAssets**
- An **Event** occurs at a **Timestamp**
- An **Event** may optionally reference a **Location**

Relationships are reconstructed from HTML references rather than inferred from filesystem structure.

---

### 11.3 Invariants
- Media assets never create meaning on their own
- HTML documents are the authoritative source of relationships
- Events are the smallest unit of meaningful context
- Missing media does not invalidate events, but must be reported
- The same media asset may appear in multiple contexts

---

### 11.4 Model Intent
This data model is designed to:
- Survive partial or corrupted exports
- Support multiple visualization strategies (timeline, conversation, map)
- Scale to very large datasets without requiring eager loading
- Remain stable even if Snapchat changes superficial export formatting

---

## 12. Open Questions (For Future Brainstorming)
- Cross-platform desktop architecture tradeoffs
- Internal storage/indexing strategy alignment with data model
- Portable archive output vs live workspace model
- Extensibility for future Snapchat export changes

---

## 12. Status
This document defines **concept, requirements, and scope only**.
No implementation decisions are finalized at this stage.

