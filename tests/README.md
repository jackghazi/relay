# Relay test battery
158 assertions across 10 suites: merge/dedupe, aliases, externalId stability,
timezone normalization, hostile input, storage failure, undo, UI behaviors.
Run: `npm i jsdom` then `bash run-all.sh` (expects ../index.html — adjust the
path constant at the top of each suite if your layout differs).
