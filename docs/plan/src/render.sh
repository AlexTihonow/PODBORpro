#!/bin/sh
# Собирает PDF из HTML в docs/plan/src. Нужен Chromium (ставится вместе с Playwright: npx playwright install chromium).
set -e
cd "$(dirname "$0")"
node gantt.mjs
CHROME="${CHROME:-$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell 2>/dev/null | tail -1)}"
for f in 0*.html; do
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="../${f%.html}.pdf" "file://$PWD/$f" 2>/dev/null
done
ls -la ../*.pdf
