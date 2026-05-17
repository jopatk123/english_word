#!/bin/sh

set -eu

TARGET_DIR="/app/data"

if [ -n "${DB_PATH:-}" ]; then
  TARGET_DIR="$(dirname "$DB_PATH")"
fi

mkdir -p "$TARGET_DIR"
chown -R node:node "$TARGET_DIR"

exec su-exec node "$@"