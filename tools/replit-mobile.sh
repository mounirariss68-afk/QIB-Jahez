#!/usr/bin/env bash
# QIB Mobile (demo), the Expo Go mock-up in apps/mobile. Second workflow on
# Replit: installs the app's own node_modules once, points it at the Jahiz
# API on this Replit, and connects Metro through Expo's installed HTTPS
# tunnel library, without installing packages or changing the app.
set -e
cd "$(dirname "$0")/../apps/mobile"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.installed ]; then
  npm install --include=dev --no-audit --no-fund
  touch node_modules/.installed
fi
DOMAIN="${REPLIT_DEV_DOMAIN:-}"
if [ -n "$DOMAIN" ]; then
  export EXPO_PUBLIC_API_URL="https://$DOMAIN"          # the Jahiz server (port 5000 → external 80)
  export REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN"
  echo "QIB Mobile (demo): API $EXPO_PUBLIC_API_URL"
fi
export EXPO_NO_TELEMETRY=1
exec node ../../tools/expo-connection.mjs
