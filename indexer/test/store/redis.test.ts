import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import RedisMock from "ioredis-mock";
import pino from "pino";
import { storeMemo, getMemo, getMemosByAuthor, getRecentMemos } from "../../src/store/redis";
import type { DecodedMemo } from "../../src/decode/memo";

const logger = pino({ level: "silent" });

function makeMemo(overrides: Partial<DecodedMemo> = {}): DecodedMemo {
  return {
    pubkey: "BxjTHjhEP4BfW9KWFB6uXnhPNeQQjFNMgYuFJnmFrkMK",
    author: "9aBkp5kKJ5iziMqWAPaXvCDDBMJtn1ep2UuPBNQ3WMYC",
    text: "test 1",
    timestamp: 1708533600,
    nonce: 42,
    bump: 255,
    ...overrides,
  };
}

describe("redis", () => {
  let redis: InstanceType<typeof RedisMock>;

  beforeEach(() => {
    redis = new RedisMock();
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  it("stores memo hash and sorted sets", async () => {
    const memo = makeMemo();
    await storeMemo(redis as any, memo, 100, logger);

    const stored = await getMemo(redis as any, memo.pubkey);
    expect(stored).not.toBeNull();
    expect(stored!.text).toBe("test 1");
    expect(stored!.author).toBe(memo.author);
    expect(stored!.timestamp).toBe(1708533600);

    const authorMemos = await getMemosByAuthor(redis as any, memo.author);
    expect(authorMemos).toContain(memo.pubkey);

    const recent = await getRecentMemos(redis as any);
    expect(recent).toContain(memo.pubkey);
  });

  it("skips write when slot <= existing slot", async () => {
    const memo = makeMemo();
    await storeMemo(redis as any, memo, 100, logger);

    const updated = makeMemo({ text: "Updated text" });
    await storeMemo(redis as any, updated, 100, logger);

    const stored = await getMemo(redis as any, memo.pubkey);
    expect(stored).not.toBeNull();
    expect(stored!.text).toBe("test 1");

    await storeMemo(redis as any, makeMemo({ text: "Old slot" }), 50, logger);
    const stored2 = await getMemo(redis as any, memo.pubkey);
    expect(stored2!.text).toBe("test 1");
  });

  it("overwrites on higher slot", async () => {
    const memo = makeMemo();
    await storeMemo(redis as any, memo, 100, logger);

    const updated = makeMemo({ text: "Updated at higher slot" });
    await storeMemo(redis as any, updated, 200, logger);

    const stored = await getMemo(redis as any, memo.pubkey);
    expect(stored).not.toBeNull();
    expect(stored!.text).toBe("Updated at higher slot");
  });

  it("updates cursor", async () => {
    const memo = makeMemo();
    await storeMemo(redis as any, memo, 100, logger);

    const cursor = await redis.hgetall("indexer:cursor");
    expect(cursor.lastSlot).toBe("100");
    expect(parseInt(cursor.updatedAt, 10)).toBeGreaterThan(0);
  });

  it("increments stats", async () => {
    const memo = makeMemo();
    await storeMemo(redis as any, memo, 100, logger);

    const stats = await redis.hgetall("indexer:stats");
    expect(stats.totalIndexed).toBe("1");
    expect(parseInt(stats.lastIndexedAt, 10)).toBeGreaterThan(0);
  });

  it("multiple authors stored separately", async () => {
    const memo1 = makeMemo({
      pubkey: "AAA111",
      author: "Author1",
      text: "First",
      nonce: 10,
      timestamp: 1000,
    });
    const memo2 = makeMemo({
      pubkey: "BBB222",
      author: "Author2",
      text: "Second",
      nonce: 20,
      timestamp: 2000,
    });

    await storeMemo(redis as any, memo1, 10, logger);
    await storeMemo(redis as any, memo2, 20, logger);

    const recent = await getRecentMemos(redis as any);
    expect(recent).toHaveLength(2);

    const author1Memos = await getMemosByAuthor(redis as any, "Author1");
    expect(author1Memos).toHaveLength(1);
    expect(author1Memos).toContain("AAA111");

    const author2Memos = await getMemosByAuthor(redis as any, "Author2");
    expect(author2Memos).toHaveLength(1);
    expect(author2Memos).toContain("BBB222");
  });

  it("null for nonexistent memo", async () => {
    const result = await getMemo(redis as any, "nonexistent");
    expect(result).toBeNull();
  });

  it("cursor never regresses on out of order slots", async () => {
    const memo1 = makeMemo({ pubkey: "AAA", nonce: 1, timestamp: 1000 });
    const memo2 = makeMemo({ pubkey: "BBB", nonce: 2, timestamp: 2000 });

    await storeMemo(redis as any, memo1, 200, logger);
    let cursor = await redis.hgetall("indexer:cursor");
    expect(cursor.lastSlot).toBe("200");

    await storeMemo(redis as any, memo2, 150, logger);
    cursor = await redis.hgetall("indexer:cursor");
    expect(cursor.lastSlot).toBe("200");
  });
});
