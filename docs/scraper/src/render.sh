#!/bin/sh
set -e
cd "$(dirname "$0")"
CHROME="${CHROME:-$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell 2>/dev/null | tail -1)}"
"$CHROME" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf=../scraper-usage.pdf "file://$PWD/scraper-usage.html" 2>/dev/null
ls -la ../scraper-usage.pdf
