#!/bin/bash

# Snap Data Explorer - Easy Setup for macOS

echo "=================================================="
echo "   Snap Data Explorer - Easy Setup (macOS)   "
echo "=================================================="
echo ""
echo "This script will help you set up and build Snap Data Explorer from source."
echo "It will check for required tools (Node.js, Rust) and install them if needed."
echo ""
read -p "Press ENTER to continue or Ctrl+C to cancel..."

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# 0. Check for Xcode CLI Tools
if ! xcode-select -p &>/dev/null; then
  echo "⚠️  Xcode Command Line Tools are missing."
  echo "   These are required for compiling Rust dependencies."
  echo "   Installing now..."
  xcode-select --install
  echo ""
  echo "   Please follow the pop-up prompt to install the tools, then run this script again."
  exit 1
fi

# 1. Check for Homebrew
if ! command_exists brew; then
  echo "❌ Homebrew is not installed."
  echo "   Homebrew is a package manager for macOS required to install dependencies."
  echo "   Please install it by running the following command in a new terminal window:"
  echo ""
  echo '   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  echo ""
  echo "   After installing Homebrew, run this script again."
  exit 1
else
  echo "✅ Homebrew is installed."
fi

# 2. Check for Node.js
if ! command_exists node; then
  echo "⚠️  Node.js is missing. Installing via Homebrew..."
  brew install node
else
  echo "✅ Node.js is installed ($(node -v))."
fi

# 3. Check for Rust
if ! command_exists cargo; then
  echo "⚠️  Rust is missing. Installing via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
else
  echo "✅ Rust is installed ($(cargo --version))."
fi

# 4. Install Dependencies
echo ""
echo "📦 Installing project dependencies..."
npm install

# 5. Build the App
echo ""
echo "🛠️  Building Snap Data Explorer..."
echo "   This may take a few minutes."
npm run tauri build

# 6. Success Message & Run
if [ $? -eq 0 ]; then
  echo ""
  echo "=================================================="
  echo "✅ Build Successful!"
  echo "=================================================="
  echo ""
  echo "The app has been built successfully."
  echo ""
  echo "To run the specific build (if you didn't install to Applications):"
  echo "open src-tauri/target/release/bundle/macos/Snap\ Data\ Explorer.app"
  echo ""
  read -p "Do you want to run the app now? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "src-tauri/target/release/bundle/macos/Snap Data Explorer.app"
  fi
else
  echo ""
  echo "❌ Build failed. Please check the error messages above."
fi
