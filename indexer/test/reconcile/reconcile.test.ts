import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import RedisMock from "ioredis-mock";
import pino from "pino";
import { PublicKey } from "@solana/web3.js";
import { reconcile, type ReconcileDeps } from "../../src/reconcile";
import type { AccountUpdate } from "../../src/stream/types";
import type { GpaV2Account, GetProgramAccountsV2Result } from "helius-sdk/types/types";
import { buildMemoBuffer } from "../helpers";

const logger = pino({ level: "silent" });
const author = new PublicKey("9aBkp5kKJ5iziMqWAPaXvCDDBMJtn1ep2UuPBNQ3WMYC");

function makeGpaAccount(pubkey: string, data: Buffer): GpaV2Account {
  return {
    pubkey,
    account: {
      data: [data.toString("base64"), "base64"],
      lamports: 1_000_000,
      owner: "6hEMnbQ2t52uP5h8LieSzVjaH1xrDpY8AWsYj86nTHbq",
      executable: false,
      rentEpoch: 0,
    },
  };
}

function makeResult(accounts: GpaV2Account[]): GetProgramAccountsV2Result {
  return { accounts, paginationKey: null };
}

function makeMemoData(text: string, nonce = 42n): Buffer {
  return buildMemoBuffer({ author, text, timestamp: 1708533600n, nonce, bump: 255 });
}

describe("reconcile", () => {
  let redis: InstanceType<typeof RedisMock>;
  let queued: AccountUpdate[];

  beforeEach(() => {
    redis = new RedisMock();
    queued = [];
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  function makeDeps(overrides: Partial<ReconcileDeps> = {}): ReconcileDeps {
    return {
      getSlot: async () => 5000,
      getProgramAccountsV2: async () => makeResult([]),
      redis: redis as any,
      enqueue: (update) => queued.push(update),
      logger,
      programId: "6hEMnbQ2t52uP5h8LieSzVjaH1xrDpY8AWsYj86nTHbq",
      ...overrides,
    };
  }

  it("first reconciliation omits changedSinceSlot even when lastSlot exists", async () => {
    await redis.hset("indexer:cursor", "lastSlot", "5000");

    let capturedConfig: Record<string, unknown> | undefined;

    await reconcile(
      makeDeps({
        getProgramAccountsV2: async (args) => {
          capturedConfig = args[1] as Record<string, unknown>;
          return makeResult([]);
        },
      }),
    );

    expect(capturedConfig).toBeDefined();
    expect(capturedConfig!.changedSinceSlot).toBeUndefined();
  });

  it("subsequent reconciliation passes lastReconciledSlot as changedSinceSlot", async () => {
    await redis.hset("indexer:cursor", "lastReconciledSlot", "3000");

    let capturedConfig: Record<string, unknown> | undefined;

    await reconcile(
      makeDeps({
        getProgramAccountsV2: async (args) => {
          capturedConfig = args[1] as Record<string, unknown>;
          return makeResult([]);
        },
      }),
    );

    expect(capturedConfig!.changedSinceSlot).toBe(3000);
  });

  it("queues accounts missing from Redis", async () => {
    const data = makeMemoData("Missing memo");

    await reconcile(
      makeDeps({
        getProgramAccountsV2: async () => makeResult([makeGpaAccount("MissingPubkey111", data)]),
      }),
    );

    expect(queued).toHaveLength(1);
    expect(queued[0].pubkey).toBe("MissingPubkey111");
    expect(queued[0].slot).toBe(5000);
  });

  it("skips accounts that already exist in Redis", async () => {
    await redis.hset("memo:ExistingPubkey111", "text", "already here");

    const data = makeMemoData("Already indexed");

    await reconcile(
      makeDeps({
        getProgramAccountsV2: async () => makeResult([makeGpaAccount("ExistingPubkey111", data)]),
      }),
    );

    expect(queued).toHaveLength(0);
  });

  it("updates lastReconciledSlot after run", async () => {
    await reconcile(makeDeps({ getSlot: async () => 7500 }));

    const cursor = await redis.hgetall("indexer:cursor");
    expect(cursor.lastReconciledSlot).toBe("7500");
  });

  it("does not crash on error", async () => {
    await reconcile(
      makeDeps({
        getSlot: async () => {
          throw new Error("RPC down");
        },
      }),
    );

    const cursor = await redis.hgetall("indexer:cursor");
    expect(cursor.lastReconciledSlot).toBeUndefined();
  });
});
