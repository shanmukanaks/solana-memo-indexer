# solana-memo-indexer

Anchor program that stores memos on devnet, streamed into Redis via Helius Laserstream. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how it works.

Needs Bun and a Helius key with Laserstream access.

## setup

```
bun install
cp .env.example .env
```

## demo

```
./demo.sh
```

Starts the indexer, creates memos on devnet, verifies them against Redis.

## tests

```
bun run test
bun run test:indexer
```

## usage

```
bun run indexer
bun run cli -- create "hello world"
bun run cli -- verify <memo-pda>
bun run cli -- list
bun run cli -- stats
```

Health at localhost:8080/health

Upstash connect with `redis-cli --tls -u $REDIS_URL`
