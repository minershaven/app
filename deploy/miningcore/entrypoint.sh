#!/bin/sh
set -eu

python3 /app/render_config.py
exec /app/Miningcore -c /app/config.json