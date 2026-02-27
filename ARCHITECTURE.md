# architecture

CLI -> anchor program (devnet) -> account change -> laserstream (gRPC) -> fastq worker -> decode -> redis

## program

Memo accounts are PDAs seeded with `[b"memo", author, nonce]`. Random nonce so you can have multiple memos per author. Instructions use validate/handle separation with `#[access_control]`. `close_memo` gives rent back, checked with `has_one = author`.

The program emits events via `emit_cpi!` but I index by account state instead. With one account type it's simpler, you get full state on each update without parsing logs. Downside is it breaks on layout changes while events are versioned, so at scale with many account types you'd want event based.

## indexer

Stream abstraction (`MemoStream` interface) so the transport is swappable. Laserstream impl subscribes via gRPC with an owner filter on the program ID, encodes pubkeys with bs58, and emits `AccountUpdate` events.

Why Laserstream over `onProgramAccountChange`: `fromSlot` replay for crash recovery, better throughput over gRPC, and the SDK handles reconnection.

All writes go through a single fastq queue (concurrency 1, capped at 10k). The stream, backfill, and reconciliation all push `AccountUpdate` into the same queue. The worker decodes with `BorshAccountsCoder` and writes to Redis. Decode returns null on bad data, never throws. One bad memo doesn't crash the stream.

The indexer fills gaps at three timescales. On first start (no cursor), a full `getProgramAccounts` backfill snapshots existing accounts before connecting the stream. On subsequent starts, Laserstream's `fromSlot` replays the gap since the last cursor. While running, a reconciliation job fires every 5 minutes using Helius's `getProgramAccountsV2` with `changedSinceSlot`, which returns only accounts modified since the last reconciliation, so O(changed) not O(total). Missing accounts get pushed into the queue. The stream handles the fast path, reconciliation handles correctness.

Idempotency: each memo stores its `indexedAtSlot`. On replay, skip if incoming slot isn't newer. The cursor (`indexer:cursor.lastSlot`) uses `max(current, new)` so out of order slot delivery doesn't regress the resume point.

Redis keys:
- `memo:<pubkey>` - hash with all fields
- `memos:author:<pubkey>` - sorted set by nonce
- `memos:recent` - sorted set by timestamp, capped at 1000
- `indexer:cursor` - lastSlot + updatedAt + lastReconciledSlot for resume
- `indexer:stats` - totalIndexed, startedAt, lastIndexedAt

Writes go through a pipeline so they're batched into one round trip.

The queue is capped at 10k. If the stream delivers faster than the worker can drain, excess updates are dropped. This is safe because reconciliation catches any gaps within 5 minutes. The health endpoint exposes `queueDepth` so you can monitor buildup. A backpressure implementation might pause the gRPC stream at high depth, drain and then resume. The `storeMemo` write is a read then write with an async gap, safe because the queue serializes all writes at concurrency 1. A multi worker setup would need to make the slot check atomic.

Health is a bare `http.createServer`. GET /health returns 200 or 503 based on component status (stream, redis, decoder tracked independently). SIGINT/SIGTERM does graceful shutdown: cancel gRPC, quit redis, close health server.

## cli

Commander with create/verify/list/stats. Verify fetches on-chain and Redis concurrently and diffs them, main way to check the indexer is correct. Nonces are 48 bit random (`crypto.randomBytes(6).readUIntLE(0, 6)`) to stay within JS safe integer range. Full u64 would blow up in `BN.toNumber()` during decode.

## tests

6 program tests (mocha + bankrun): store, empty text, text too long, PDA determinism, close with rent reclaim, close rejected for wrong author.

22 indexer tests (bun:test + ioredis-mock): decoder, redis store, full pipeline integration, and reconciliation.
