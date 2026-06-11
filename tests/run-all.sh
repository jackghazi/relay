#!/bin/bash
# Relay test battery — requires: node 18+, npm i jsdom
# Usage: place index.html next to this folder, then: bash run-all.sh
FAIL=0
for t in test*.js; do node "$t" || FAIL=1; done
[ $FAIL -eq 0 ] && echo "ALL SUITES GREEN" || echo "FAILURES — see above"
exit $FAIL
