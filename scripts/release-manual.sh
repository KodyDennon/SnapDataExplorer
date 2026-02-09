#!/bin/bash

# Check if a version argument is provided
if [ -z "$1" ]; then
  echo "Usage: ./release.sh <version>"
  echo "Example: ./release.sh 0.1.1"
  exit 1
fi

NEW_VERSION=$1

# Update package.json
# Using sed for simplicity, but ideally use jq if available. Assuming standard formatting.
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json

# Update src-tauri/tauri.conf.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

# Update src-tauri/Cargo.toml
sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml

echo "Updated version to $NEW_VERSION in package.json, src-tauri/tauri.conf.json, and src-tauri/Cargo.toml"

# Git operations
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore(release): v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo "------------------------------------------------*******"
echo "Release v$NEW_VERSION staged and tagged."
echo "To trigger the GitHub Action build and release, run:"
echo ""
echo "    git push origin main --tags"
echo ""
echo "------------------------------------------------*******"
