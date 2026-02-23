# architecture

CLI -> anchor program (devnet) -> account change -> laserstream (gRPC) -> fastq worker -> decode -> redis

## program

Memo accounts are PDAs seeded with `[b"memo", author, nonce]`. Random nonce so you can have multiple memos per author. Instructions use validate/handle separation with `#[access_control]`. `close_memo` gives rent back, checked with `has_one = author`.

The program emits events via `emit_cpi!` but I index by account state instead. With one account type it's simpler, you get full state on each update without parsing logs. Downside is it breaks on layout changes while events are versioned, so at scale with many account types you'd want event based.

## indexer

Stream abstraction (`MemoStream` interface) so the transport is swappable. Laserstream impl subscribes via gRPC with an owner filter on the program ID, encodes pubkeys with bs58, and emits `AccountUpdate` events.

Why Laserstream over `onProgramAccountChange`: `fromSlot` replay for crash recovery, better throughput over gRPC, and the SDK handles reconnection.

Updates go into a fastq queue (concurrency 1, capped at 10k). If the indexer falls behind it drops updates, they come back on the next Laserstream reconnect anyway. The worker decodes with `BorshAccountsCoder` and writes to Redis. Decode returns null on bad data, never throws. One bad memo doesn't crash the stream.

On first start (no cursor), the indexer does a `getProgramAccounts` backfill to snapshot all existing accounts before connecting the stream. This way it never misses memos that were created while the indexer was down. On subsequent starts, `fromSlot` replay handles the gap.

Idempotency: each memo stores its `indexedAtSlot`. On replay, skip if incoming slot isn't newer. The cursor (`indexer:cursor.lastSlot`) uses `max(current, new)` so out of order slot delivery doesn't regress the resume point.

Redis keys:
- `memo:<pubkey>` - hash with all fields
- `memos:author:<pubkey>` - sorted set by nonce
- `memos:recent` - sorted set by timestamp, capped at 1000
- `indexer:cursor` - lastSlot + updatedAt for resume
- `indexer:stats` - totalIndexed, startedAt, lastIndexedAt

Writes go through a pipeline so they're batched into one round trip.

Health is a bare `http.createServer`. GET /health returns 200 or 503 based on component status (stream, redis, decoder tracked independently). SIGINT/SIGTERM does graceful shutdown: cancel gRPC, quit redis, close health server.

## cli

Commander with create/verify/list/stats. Verify fetches on-chain and Redis concurrently and diffs them, main way to check the indexer is correct. Nonces are 48 bit random (`crypto.randomBytes(6).readUIntLE(0, 6)`) to stay within JS safe integer range. Full u64 would blow up in `BN.toNumber()` during decode.

## tests

6 program tests (mocha + bankrun): store, empty text, text too long, PDA determinism, close with rent reclaim, close rejected for wrong author.

16 indexer tests (bun:test + ioredis-mock): decoder, redis store, and full pipeline integration. The large nonce and cursor regression tests are there because both were real bugs.
