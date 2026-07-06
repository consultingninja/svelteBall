#!/bin/bash
# Runs the fine-tuned SLM server and the Vite dev server together.
# Ctrl-C stops both. If the SLM isn't trained yet, the dev server still
# starts and the app's algorithm engine keeps working.

cd "$(dirname "$0")/.."

training/serve-slm.sh &
SLM_PID=$!
trap 'kill $SLM_PID 2>/dev/null' EXIT

npx vite dev
