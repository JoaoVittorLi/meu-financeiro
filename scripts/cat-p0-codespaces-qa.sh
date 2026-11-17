#!/usr/bin/env bash
# CAT-P0 real Node/SQLite gate. Run inside a disposable Codespace with SYNTHETIC fixtures.
# Does not launch CircleCI, installers, cloud uploads, stable profile or Pluggy network sync.
set -uo pipefail
if [[ "${MF_QA_SYNTHETIC:-}" != "1" ]]; then
 echo "REFUSED: set MF_QA_SYNTHETIC=1 in a disposable Codespace; do not use a personal profile." >&2
 exit 64
fi
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SHA="$(git rev-parse HEAD 2>/dev/null)" || exit 65
NODE="$(node --version 2>/dev/null || true)"
NPM="$(npm --version 2>/dev/null || true)"
if [[ "$NODE" != "v22.23.4" || "$NPM" != "10.9.9" ]]; then
 echo "NOT_RUN: require Node v22.23.4/npm 10.9.9; have $NODE/npm $NPM" >&2
 exit 66
fi
LOGDIR="$(mktemp -d "${TMPDIR:-/tmp}/mf-cat-p0-qa.XXXXXXXX")"
printf 'commit=%s\nnode=%s\nnpm=%s\nlogdir=%s\n' "$SHA" "$NODE" "$NPM" "$LOGDIR" | tee "$LOGDIR/environment.txt"
printf '%s\n' 'Gate uses synthetic fixtures only. No Electron personal profiles, CircleCI or release builds.'
FAILS=0
run_gate() {
 local name="$1"; shift
 echo "=== $name BEGIN SHA=$SHA ==="
 "$@" > "$LOGDIR/$name.log" 2>&1
 local code=$?
 printf '%s\texit=%s\tsha=%s\n' "$name" "$code" "$SHA" | tee -a "$LOGDIR/summary.tsv"
 tail -n 12 "$LOGDIR/$name.log"
 if (( code != 0 )); then FAILS=$((FAILS+1)); fi
 return "$code"
}
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
if ! run_gate npm-ci npm ci --no-audit --no-fund; then
 echo "FAIL: npm ci; dependent suites NOT_RUN. Logs: $LOGDIR" >&2
 exit 2
fi
for testfile in tests/d05-auto-categorization.test.cjs \
 tests/cat01-02-evidence-classifier.test.cjs \
 tests/cat03-history-preview.test.cjs \
 tests/cat04-05-automation.test.cjs \
 tests/d05-auto-reconciled.integration.test.cjs; do
 if [[ -f "$testfile" ]]; then
  run_gate "$(basename "$testfile" .cjs)" node --test "$testfile" || true
 else
  printf '%s\tNOT_PRESENT\tsha=%s\n' "$testfile" "$SHA" | tee -a "$LOGDIR/summary.tsv"
 fi
done
run_gate typecheck npm run test:types || true
run_gate sqlite-suite npm run test:db || true
run_gate compile npm run compile || true
run_gate preload node scripts/build-preload.cjs check || true
run_gate asar npm run test:asar || true
run_gate provenance-create npm run provenance:create || true
run_gate provenance-verify npm run provenance:verify || true
echo "QA SUMMARY SHA=$SHA FAILS=$FAILS LOGDIR=$LOGDIR"
if (( FAILS != 0 )); then exit 3; fi
echo "NODE/SQLITE GATES PASSED (Windows Electron QA remains a separate, authorized gate)."
