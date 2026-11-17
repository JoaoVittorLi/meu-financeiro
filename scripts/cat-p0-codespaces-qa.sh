#!/usr/bin/env bash
# Meu Financeiro CAT-P0 / A01. Synthetic, local-only Codespaces QA.
# NEVER launch paid CircleCI, Electron distribution, Pluggy sync or a release.
set -uo pipefail
if [[ "${MF_QA_SYNTHETIC:-}" != "1" ]]; then
 echo "REFUSED: use MF_QA_SYNTHETIC=1 inside a disposable Codespace (no personal data)." >&2
 exit 64
fi
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 65
SHA="$(git rev-parse HEAD 2>/dev/null)" || exit 65
BRANCH="$(git branch --show-current)"
NODE="$(node --version 2>/dev/null || true)"
NPM="$(npm --version 2>/dev/null || true)"
if [[ "$NODE" != "v22.23.4" || "$NPM" != "10.9.9" ]]; then
 echo "NOT_RUN SHA=$SHA: require Node v22.23.4 and npm 10.9.9; got $NODE/npm $NPM" >&2
 exit 66
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
 echo "REFUSED: uncommitted changes would invalidate SHA attribution." >&2
 exit 67
fi
if [[ "$BRANCH" != "feat/mf1-cat-p0-consolidation-20261117" ]]; then
 echo "REFUSED: checkout PR #105 feature branch first. Found $BRANCH" >&2
 exit 68
fi
if env | grep -Eq '^(PLUGGY_CLIENT_ID|PLUGGY_CLIENT_SECRET|PLUGGY_ACCESS_TOKEN|MF_REAL_PROFILE)='; then
 echo "REFUSED: real Pluggy credentials or personal profile present in environment." >&2
 exit 69
fi
LOGDIR="$(mktemp -d "${TMPDIR:-/tmp}/mf-cat-p0-qa.XXXXXXXX")" || exit 70
mkdir -p "$LOGDIR/private-home" "$LOGDIR/tmp"
export HOME="$LOGDIR/private-home" TMPDIR="$LOGDIR/tmp"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1 MF_QA_SHA="$SHA"
printf 'sha=%s\nbranch=%s\nnode=%s\nnpm=%s\nsynthetic=true\nlogs=%s\n' \
 "$SHA" "$BRANCH" "$NODE" "$NPM" "$LOGDIR" | tee "$LOGDIR/environment.txt"
printf 'gate\texit\tsha\n' > "$LOGDIR/summary.tsv"
FAILS=0
run_gate(){
 local name="$1" code;shift
 printf -v command '%q ' "$@"
 printf 'BEGIN gate=%s sha=%s command=%s\n' "$name" "$SHA" "$command" | tee "$LOGDIR/$name.command.txt"
 "$@" > "$LOGDIR/$name.log" 2>&1
 code=$?
 printf '%s\t%s\t%s\n' "$name" "$code" "$SHA" | tee -a "$LOGDIR/summary.tsv"
 printf 'END gate=%s code=%s\n' "$name" "$code"
 tail -n 15 "$LOGDIR/$name.log"
 if (( code != 0 ));then FAILS=$((FAILS+1));fi
 return "$code"
}
for file in tests/d05-auto-categorization.test.cjs \
 tests/d05-auto-reconciled.integration.test.cjs \
 tests/cat-p0-recurring-stress.test.cjs \
 tests/rc-all-02-3-backup.test.cjs \
 tests/qa84-rc-all-02.integration.test.cjs;do
 if [[ ! -f "$file" ]];then
  echo "FAIL missing required synthetic regression: $file" >&2
  exit 71
 fi
done
# No fallback to a different checkout, installer, or personal source.
if ! run_gate npm-ci npm ci --no-audit --no-fund;then
 echo "FAIL: npm ci; all dependent gates NOT_RUN. Logs: $LOGDIR" >&2
 exit 2
fi
run_gate cat-d05 node --test tests/d05-auto-categorization.test.cjs \
 tests/d05-auto-reconciled.integration.test.cjs || true
run_gate rc-02-3 node --test tests/rc-all-02-3-backup.test.cjs \
 tests/qa84-rc-all-02.integration.test.cjs || true
run_gate typecheck npm run test:types || true
# test:db uses node --test tests/*.test.cjs, including the 20,001+ A01 stress.
# Avoid running the expensive full-volume test twice.
run_gate sqlite-all-and-a01-stress npm run test:db || true
run_gate compile npm run compile || true
run_gate preload node scripts/build-preload.cjs check || true
run_gate asar npm run test:asar || true
run_gate provenance-create npm run provenance:create || true
run_gate provenance-verify npm run provenance:verify || true
printf 'SUMMARY sha=%s failures=%s logs=%s\n' "$SHA" "$FAILS" "$LOGDIR"
if (( FAILS>0 ));then exit 3;fi
echo "PASS: all Node/SQLite gates at $SHA. Electron Windows QA remains separate."
