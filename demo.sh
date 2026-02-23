#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  echo "Missing .env, copy .env.example and add your keys"
  exit 1
fi

echo "starting indexer"
bun run indexer &
INDEXER_PID=$!
trap "kill $INDEXER_PID 2>/dev/null; wait $INDEXER_PID 2>/dev/null" EXIT

for i in $(seq 1 15); do
  curl -sf http://localhost:8080/health >/dev/null 2>&1 && break
  sleep 1
done

if ! curl -sf http://localhost:8080/health >/dev/null 2>&1; then
  echo "indexer failed to start, check .env and redis"
  exit 1
fi

PDAS=()
for i in 1 2 3; do
  OUTPUT=$(bun run cli -- create "test $i" 2>&1)
  echo "$OUTPUT"
  PDA=$(echo "$OUTPUT" | grep "^PDA:" | awk '{print $2}')
  PDAS+=("$PDA")
  echo
done

echo "waiting for indexer"
sleep 5

for PDA in "${PDAS[@]}"; do
  bun run cli -- verify "$PDA" 2>&1
  echo
done

bun run cli -- list
bun run cli -- stats

echo "ctrl+c to stop"
wait $INDEXER_PID
