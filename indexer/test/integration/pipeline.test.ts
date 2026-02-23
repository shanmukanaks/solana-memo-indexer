import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import crypto from "crypto";
import { EventEmitter } from "events";
import RedisMock from "ioredis-mock";
import pino from "pino";
import fastq from "fastq";
import { PublicKey } from "@solana/web3.js";
import { decodeMemoAccount } from "../../src/decode/memo";
import { storeMemo, getMemo } from "../../src/store/redis";
import type { AccountUpdate } from "../../src/stream/types";
import { buildMemoBuffer } from "../helpers";

const logger = pino({ level: "silent" });

describe("pipeline", () => {
  let redis: InstanceType<typeof RedisMock>;
  const author = new PublicKey("9aBkp5kKJ5iziMqWAPaXvCDDBMJtn1ep2UuPBNQ3WMYC");

  beforeEach(() => {
    redis = new RedisMock();
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  it("decode and store from account update", async () => {
    const pubkey = "BxjTHjhEP4BfW9KWFB6uXnhPNeQQjFNMgYuFJnmFrkMK";
    const data = buildMemoBuffer({
      author,
      text: "Pipeline test",
      timestamp: 1708533600n,
      nonce: 50n,
      bump: 253,
    });

    const stream = new EventEmitter();
    const processed: string[] = [];

    const queue = fastq.promise(async (update: AccountUpdate) => {
      const memo = decodeMemoAccount(update.pubkey, update.data);
      if (!memo) return;
      await storeMemo(redis as any, memo, update.slot, logger);
      processed.push(memo.pubkey);
    }, 1);

    stream.on("account", (update: AccountUpdate) => {
      queue.push(update);
    });

    stream.emit("account", { slot: 50, pubkey, data });

    await queue.drained();

    expect(processed).toHaveLength(1);
    const stored = await getMemo(redis as any, pubkey);
    expect(stored).not.toBeNull();
    expect(stored!.text).toBe("Pipeline test");
  });

  it("skips invalid data without crashing", async () => {
    const stream = new EventEmitter();
    const errors: string[] = [];

    const queue = fastq.promise(async (update: AccountUpdate) => {
      const memo = decodeMemoAccount(update.pubkey, update.data);
      if (!memo) {
        errors.push(update.pubkey);
        return;
      }
      await storeMemo(redis as any, memo, update.slot, logger);
    }, 1);

    stream.on("account", (update: AccountUpdate) => {
      queue.push(update);
    });

    stream.emit("account", {
      slot: 1,
      pubkey: "garbage",
      data: Buffer.from("not a memo"),
    });

    const validPubkey = "BxjTHjhEP4BfW9KWFB6uXnhPNeQQjFNMgYuFJnmFrkMK";
    const validData = buildMemoBuffer({
      author,
      text: "After garbage",
      timestamp: 1708533601n,
      nonce: 2n,
      bump: 252,
    });
    stream.emit("account", { slot: 2, pubkey: validPubkey, data: validData });

    await queue.drained();

    expect(errors).toContain("garbage");
    const stored = await getMemo(redis as any, validPubkey);
    expect(stored).not.toBeNull();
    expect(stored!.text).toBe("After garbage");
  });

  it("handles nonces from the real CLI generation path", async () => {
    const pubkey = "BxjTHjhEP4BfW9KWFB6uXnhPNeQQjFNMgYuFJnmFrkMK";
    const nonce = crypto.randomBytes(6).readUIntLE(0, 6);
    const data = buildMemoBuffer({
      author,
      text: "real nonce",
      timestamp: 1708533600n,
      nonce: BigInt(nonce),
      bump: 250,
    });

    const queue = fastq.promise(async (update: AccountUpdate) => {
      const memo = decodeMemoAccount(update.pubkey, update.data);
      if (!memo) return;
      await storeMemo(redis as any, memo, update.slot, logger);
    }, 1);

    queue.push({ slot: 200, pubkey, data });
    await queue.drained();

    const stored = await getMemo(redis as any, pubkey);
    expect(stored).not.toBeNull();
    expect(stored!.nonce).toBe(nonce);
    expect(stored!.text).toBe("real nonce");
  });

  it("deduplicates same PDA at same slot", async () => {
    const pubkey = "BxjTHjhEP4BfW9KWFB6uXnhPNeQQjFNMgYuFJnmFrkMK";
    const data = buildMemoBuffer({
      author,
      text: "Duplicate test",
      timestamp: 1708533600n,
      nonce: 100n,
      bump: 251,
    });

    const queue = fastq.promise(async (update: AccountUpdate) => {
      const memo = decodeMemoAccount(update.pubkey, update.data);
      if (!memo) return;
      await storeMemo(redis as any, memo, update.slot, logger);
    }, 1);

    queue.push({ slot: 100, pubkey, data });
    queue.push({ slot: 100, pubkey, data });
    await queue.drained();

    const stats = await redis.hgetall("indexer:stats");
    expect(stats.totalIndexed).toBe("1");
  });
});
