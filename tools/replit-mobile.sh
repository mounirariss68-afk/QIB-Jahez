#!/usr/bin/env bash
# QIB Mobile (demo), the Expo Go mock-up in apps/mobile. Second workflow on
# Replit: installs the app's own node_modules once, points it at the Jahiz
# API on this Replit, publishes Metro on port 8081 (external port 3000) and
# prints the QR code for Expo Go. Set EXPO_TUNNEL=1 to use Expo's tunnel instead.
set -e
cd "$(dirname "$0")/../apps/mobile"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.installed ]; then
  npm install --include=dev --no-audit --no-fund
  touch node_modules/.installed
fi
DOMAIN="${REPLIT_DEV_DOMAIN:-}"
if [ -n "$DOMAIN" ]; then
  export EXPO_PUBLIC_API_URL="https://$DOMAIN"          # the Jahiz server (port 5000 → external 80)
  export EXPO_PACKAGER_PROXY_URL="https://$DOMAIN:3000" # Metro (port 8081 → external 3000), as Expo Go must reach it
  export REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN"
  echo "QIB Mobile (demo): API $EXPO_PUBLIC_API_URL · bundler $EXPO_PACKAGER_PROXY_URL"
fi
export EXPO_NO_TELEMETRY=1
if [ -n "${EXPO_TUNNEL:-}" ]; then
  exec npx expo start --go --tunnel
fi
exec npx expo start --go --port 8081
