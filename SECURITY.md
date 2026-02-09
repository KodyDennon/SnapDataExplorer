# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Snap Data Explorer, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email [contact@mail.kodydennon.com](mailto:contact@mail.kodydennon.com) with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. Alternatively, open a [private security advisory](https://github.com/KodyDennon/SnapDataExplorer/security/advisories/new) on GitHub

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.

## Scope

Since Snap Data Explorer is a local-only desktop application with no network access, the primary security concerns are:

- **Local file access** — Ensuring the app only reads files the user explicitly selects
- **SQLite injection** — Preventing malicious input from corrupting the database (FTS5 queries are sanitized)
- **Path traversal** — Preventing zip extraction from writing outside designated directories
- **Content Security Policy** — Preventing XSS via imported HTML content
- **Asset protocol scope** — Restricting filesystem access to user data directories only

## Known Limitations

- The local SQLite database is **not encrypted**. It is stored in the platform's standard application data directory with OS-level file permissions. Anyone with access to the user's filesystem can read the database.
- Log files are written to the application data directory and may contain file paths at DEBUG log level.
