#!/bin/sh
# Runs the test suite on a machine that is not the Windows development PC (see
# scripts/test_browser_fallback.cjs). The tools live outside the repository:
#
#   mkdir -p ~/.north-test-tools && cd ~/.north-test-tools
#   npm install playwright @electric-sql/pglite
#   PLAYWRIGHT_BROWSERS_PATH=~/.north-test-tools/pw-browsers npx playwright install chromium
#
# Usage, from anywhere:
#   scripts/run_tests_mac.sh                      the whole suite
#   scripts/run_tests_mac.sh tests/foo.test.mjs   chosen files
#   scripts/run_tests_mac.sh --check scripts/check_chat_authorized_phone.cjs   one check script
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="${NORTH_TEST_TOOLS:-$HOME/.north-test-tools}"
[ -d "$TOOLS/node_modules/playwright" ] || { echo "test tools missing in $TOOLS (see the top of this file)" >&2; exit 2; }
cd "$ROOT"
export NODE_PATH="$TOOLS/node_modules"
export PLAYWRIGHT_BROWSERS_PATH="$TOOLS/pw-browsers"
export NODE_OPTIONS="--require $ROOT/scripts/test_browser_fallback.cjs"
if [ "$1" = "--check" ]; then shift; exec node "$@"; fi
if [ "$#" -eq 0 ]; then set -- tests/*.test.mjs; fi
exec node --test --test-timeout=300000 "$@"
