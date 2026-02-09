#!/usr/bin/env bash
set -euo pipefail

VERSION="$1"

# Update Cargo.toml version (first occurrence)
sed -i'' -e "s/^version = \".*\"/version = \"${VERSION}\"/" src-tauri/Cargo.toml

# Update tauri.conf.json version
sed -i'' -e "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" src-tauri/tauri.conf.json

# Regenerate Cargo.lock to match
cd src-tauri && cargo generate-lockfile && cd ..

echo "Updated Cargo.toml, tauri.conf.json, and Cargo.lock to v${VERSION}"
