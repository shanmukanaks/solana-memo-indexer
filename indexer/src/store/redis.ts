import Redis from "ioredis";
import type { Logger } from "pino";
import { DecodedMemo } from "../decode/memo";

const MEMO_KEY = (pk: string) => `memo:${pk}`;
const AUTHOR_KEY = (pk: string) => `memos:author:${pk}`;
const TIMELINE_KEY = "memos:recent";
const CURSOR_KEY = "indexer:cursor";
const STATS_KEY = "indexer:stats";

export function createRedisClient(url: string, logger: Logger): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 12) {
        logger.fatal({ attempts: times }, "Redis retries exhausted");
        process.exit(1);
      }
      const delay = Math.min(1000 * 2 ** (times - 1), 30_000);
      logger.info({ attempt: times, delay }, "Redis reconnecting");
      return delay;
    },
  });

  client.on("connect", () => logger.info("Redis connected"));
  client.on("error", (err) => logger.error({ err }, "Redis error"));

  return client;
}

export async function storeMemo(
  redis: Redis,
  memo: DecodedMemo,
  streamSlot: number,
  logger: Logger
): Promise<void> {
  const key = MEMO_KEY(memo.pubkey);

  const [existingSlot, currentCursor] = await Promise.all([
    redis.hget(key, "indexedAtSlot"),
    redis.hget(CURSOR_KEY, "lastSlot"),
  ]);

  const isNew = !existingSlot;
  if (existingSlot && parseInt(existingSlot, 10) >= streamSlot) {
    logger.debug({ pubkey: memo.pubkey }, "Skipping, already indexed");
    return;
  }

  const authorKey = AUTHOR_KEY(memo.author);
  const pipeline = redis.pipeline();

  pipeline.hset(key, {
    pubkey: memo.pubkey,
    author: memo.author,
    text: memo.text,
    timestamp: memo.timestamp.toString(),
    nonce: memo.nonce.toString(),
    bump: memo.bump.toString(),
    indexedAtSlot: streamSlot.toString(),
  });

  pipeline.zadd(authorKey, memo.nonce, memo.pubkey);
  pipeline.zadd(TIMELINE_KEY, memo.timestamp, memo.pubkey);
  pipeline.zremrangebyrank(TIMELINE_KEY, 0, -1001);

  const cursorSlot = Math.max(streamSlot, parseInt(currentCursor || "0", 10));
  pipeline.hset(CURSOR_KEY, {
    lastSlot: cursorSlot.toString(),
    updatedAt: Date.now().toString(),
  });

  if (isNew) {
    pipeline.hincrby(STATS_KEY, "totalIndexed", 1);
  }
  pipeline.hset(STATS_KEY, "lastIndexedAt", Date.now().toString());

  const results = await pipeline.exec();
  if (results) {
    for (const [err] of results) {
      if (err) throw err;
    }
  }

  logger.info(
    { pubkey: memo.pubkey, author: memo.author, nonce: memo.nonce },
    "Memo stored"
  );
}

export async function getMemo(
  redis: Redis,
  pubkey: string
): Promise<DecodedMemo | null> {
  const raw = await redis.hgetall(MEMO_KEY(pubkey));
  if (!raw.pubkey) return null;
  return {
    pubkey: raw.pubkey,
    author: raw.author,
    text: raw.text,
    timestamp: parseInt(raw.timestamp, 10),
    nonce: parseInt(raw.nonce, 10),
    bump: parseInt(raw.bump, 10),
  };
}

export async function getMemosByAuthor(
  redis: Redis,
  author: string
): Promise<string[]> {
  return redis.zrevrange(AUTHOR_KEY(author), 0, -1);
}

export async function getRecentMemos(
  redis: Redis,
  limit = 20
): Promise<string[]> {
  return redis.zrevrange(TIMELINE_KEY, 0, limit - 1);
}

export async function getIndexerCursor(
  redis: Redis
): Promise<{ lastSlot: number; updatedAt: number; lastReconciledSlot: number }> {
  const raw = await redis.hgetall(CURSOR_KEY);
  return {
    lastSlot: parseInt(raw.lastSlot ?? "0", 10),
    updatedAt: parseInt(raw.updatedAt ?? "0", 10),
    lastReconciledSlot: parseInt(raw.lastReconciledSlot ?? "0", 10),
  };
}

export async function setIndexerStartedAt(
  redis: Redis,
  startedAt: number
): Promise<void> {
  await redis.hset(STATS_KEY, "startedAt", startedAt.toString());
}

export async function getIndexerStats(
  redis: Redis
): Promise<{ totalIndexed: number; startedAt: number; lastIndexedAt: number }> {
  const raw = await redis.hgetall(STATS_KEY);
  return {
    totalIndexed: parseInt(raw.totalIndexed ?? "0", 10),
    startedAt: parseInt(raw.startedAt ?? "0", 10),
    lastIndexedAt: parseInt(raw.lastIndexedAt ?? "0", 10),
  };
}
