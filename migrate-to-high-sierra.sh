#!/bin/bash

# Migration script to downgrade to Electron 26 for macOS High Sierra compatibility
# Usage: ./migrate-to-high-sierra.sh

set -e  # Exit on error

echo "=========================================="
echo "Metropolis Video App"
echo "High Sierra Compatibility Migration"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Backup your current package.json"
echo "  2. Replace it with High Sierra compatible version"
echo "  3. Clean existing installations"
echo "  4. Install Electron 26.6.10 and dependencies"
echo "  5. Rebuild native modules"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "[1/5] Backing up current package.json..."
cp package.json package.json.backup-electron-28
echo "✓ Backup saved to: package.json.backup-electron-28"

echo ""
echo "[2/5] Installing High Sierra compatible package.json..."
cp package.json.high-sierra package.json
echo "✓ package.json updated (Electron 26.6.10)"

echo ""
echo "[3/5] Cleaning existing installation..."
rm -rf node_modules package-lock.json dist
echo "✓ Cleaned node_modules, package-lock.json, and dist/"

echo ""
echo "[4/5] Installing dependencies (this may take a few minutes)..."
npm install
echo "✓ Dependencies installed"

echo ""
echo "[5/5] Rebuilding native modules for Electron 26..."
npx electron-rebuild
echo "✓ Native modules rebuilt"

echo ""
echo "=========================================="
echo "✅ Migration Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Test the app: npm start"
echo "  2. Verify MIDI functionality works"
echo "  3. Build for macOS: npm run build:mac"
echo "  4. Test .dmg on Mac Pro (High Sierra)"
echo ""
echo "To revert to Electron 28:"
echo "  cp package.json.backup-electron-28 package.json"
echo "  rm -rf node_modules package-lock.json"
echo "  npm install"
echo ""
echo "Configuration details:"
echo "  Electron: 26.6.10 (was 28.1.0)"
echo "  Node.js: 16.15.0 (bundled, was 18.18.2)"
echo "  Chromium: 116.x (was 120.x)"
echo "  macOS minimum: 10.13.0 (High Sierra)"
echo ""
