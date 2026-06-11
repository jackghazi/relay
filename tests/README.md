# Relay test battery
173 assertions across 11 suites: merge/dedupe, aliases, externalId stability,
timezone normalization, hostile input, storage failure, undo, UI behaviors.
test11 — handoff minter: cross-surface successor, chain, dual-ID kickoff.
Run: `npm i jsdom` then `bash run-all.sh` (expects ../index.html — adjust the
path constant at the top of each suite if your layout differs).
