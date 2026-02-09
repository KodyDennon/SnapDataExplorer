#!/bin/bash

# Snap Data Explorer - macOS Gatekeeper Fix

echo "=================================================="
echo "   Snap Data Explorer - Gatekeeper Fix   "
echo "=================================================="
echo ""
echo "If you are seeing 'App is damaged and can't be opened', this script will fix it."
echo "This requires administrator privileges (sudo)."
echo ""

APP_PATH="/Applications/Snap Data Explorer.app"

if [ ! -d "$APP_PATH" ]; then
  echo "❌ App not found in /Applications."
  echo "   Please move 'Snap Data Explorer.app' to your Applications folder first."
  exit 1
fi

echo "🔧 Patching Gatekeeper quarantine attribute..."
sudo xattr -cr "$APP_PATH"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Success! You should now be able to open the app."
else
  echo ""
  echo "❌ Failed to patch. Please check permissions."
fi
