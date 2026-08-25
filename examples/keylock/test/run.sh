#!/bin/bash
# Runs every Keylock suite. Exits nonzero if any suite fails.
#
#   bash examples/keylock/test/run.sh          run everything
#   bash examples/keylock/test/run.sh -v       show each suite's full output
cd "$(dirname "$0")" || exit 1

# The suites run extracted copies of the app's functions. Re-extract the whole
# app script first so a stale copy can't report a false pass.
python3 - <<'PY'
import re
s = open('../keylock.html').read()
m = re.search(r'<script>(.*)</script>', s, re.S)
if not m:
    raise SystemExit('could not find the app script in keylock.html')
open('arrange-src.js', 'w').write(m.group(1))
PY
[ $? -ne 0 ] && exit 1

SUITES="dsp structure order arrange bulk tempo"
fails=0
for t in $SUITES; do
  if [ "$1" = "-v" ]; then
    echo; echo "──── $t ────"
    node "$t.test.js"; code=$?
  else
    out=$(node "$t.test.js" 2>&1); code=$?
    pass=$(printf '%s' "$out" | grep -c 'PASS')
    fail=$(printf '%s' "$out" | grep -c 'FAIL')
    printf "  %-11s %-4s %2d assertions" "$t" "$([ $code -eq 0 ] && echo ok || echo FAIL)" "$pass"
    [ "$fail" -gt 0 ] && printf ", %d failing" "$fail"
    printf "\n"
    [ $code -ne 0 ] && printf '%s\n' "$out" | grep 'FAIL' | sed 's/^/      /'
  fi
  [ $code -ne 0 ] && fails=$((fails+1))
done

echo
if [ $fails -eq 0 ]; then
  echo "  all suites passing"
else
  echo "  $fails suite(s) failing"
fi
exit $fails
