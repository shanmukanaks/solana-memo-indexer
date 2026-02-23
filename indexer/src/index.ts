import "dotenv/config";
import fastq from "fastq";
import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "./config";
import { createLogger } from "./logger";
import { createRedisClient, storeMemo, getIndexerCursor, setIndexerStartedAt } from "./store/redis";
import { decodeMemoAccount } from "./decode/memo";
import { createStream } from "./stream/factory";
import { HealthTracker } from "./health/tracker";
import { startHealthServer } from "./health/server";
import type { AccountUpdate } from "./stream/types";

const logger = createLogger(config.logLevel);
const decodeLogger = logger.child({ component: "decoder" });
const storeLogger = logger.child({ component: "store" });
const startedAt = Date.now();

const redis = createRedisClient(
  config.redisUrl,
  logger.child({ component: "redis" })
);

const health = new HealthTracker();
health.update("stream", "starting");
health.update("redis", "starting");
health.update("decoder", "healthy");

const queue = fastq.promise(worker, 1);

async function worker(update: AccountUpdate) {
  try {
    const memo = decodeMemoAccount(update.pubkey, update.data, decodeLogger);
    if (!memo) return;

    await storeMemo(redis, memo, update.slot, storeLogger);
    health.update("decoder", "healthy");
  } catch (err) {
    logger.error({ err, pubkey: update.pubkey }, "Pipeline error");
    health.update("decoder", "unhealthy", (err as Error).message);
  }
}

const stream = createStream(config, logger);
let streamErrors = 0;
const MAX_STREAM_ERRORS = 10;

const MAX_QUEUE_SIZE = 10_000;

stream.on("account", (update: AccountUpdate) => {
  streamErrors = 0;
  if (queue.length() >= MAX_QUEUE_SIZE) {
    logger.warn({ queueSize: queue.length(), slot: update.slot }, "Queue full, dropping");
    return;
  }
  queue.push(update);
});

stream.on("error", (err: Error) => {
  streamErrors++;
  health.update("stream", "unhealthy", err.message);

  if (streamErrors >= MAX_STREAM_ERRORS) {
    logger.fatal(
      { errors: streamErrors },
      "Too many stream errors, exiting"
    );
    process.exit(1);
  }
});

const server = startHealthServer(
  config.healthPort,
  health,
  stream,
  startedAt,
  logger.child({ component: "health" }),
  () => queue.length()
);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  server.close();
  await stream.shutdown().catch(() => {});
  await redis.quit().catch(() => {});

  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function backfill() {
  const conn = new Connection(config.rpcEndpoint);
  const programId = new PublicKey(config.programId);
  const slot = await conn.getSlot();

  logger.info({ programId: config.programId }, "Backfilling existing accounts");
  const accounts = await conn.getProgramAccounts(programId);
  logger.info({ count: accounts.length, slot }, "Backfill fetched");

  for (const { pubkey, account } of accounts) {
    queue.push({ slot, pubkey: pubkey.toBase58(), data: account.data as Buffer });
  }

  return slot;
}

async function start() {
  await redis.ping();
  health.update("redis", "healthy");
  logger.info("Redis PING ok");

  const cursor = await getIndexerCursor(redis);
  let fromSlot = cursor.lastSlot || undefined;

  if (fromSlot) {
    logger.info({ fromSlot }, "Resuming from cursor");
  } else {
    fromSlot = await backfill();
  }

  setIndexerStartedAt(redis, startedAt).catch((err) => logger.warn({ err }, "Failed to set startedAt"));

  await stream.connect(fromSlot);
  health.update("stream", "healthy");
  logger.info(
    {
      programId: config.programId,
      healthPort: config.healthPort,
    },
    "Indexer running"
  );
}

start().catch((err) => {
  logger.fatal({ err }, "Startup failed");
  process.exit(1);
});
