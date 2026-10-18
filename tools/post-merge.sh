#!/usr/bin/env bash
# Reconcile merged code without changing dependencies or demo data.
set -euo pipefail
cd "$(dirname "$0")/.."

# Dependency installation stays with the existing supplied Run scripts.
# Never seed or reset the database as part of a task merge.
npm run build
npm --prefix apps/mobile test --if-present
