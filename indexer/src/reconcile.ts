import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { GetProgramAccountsV2Fn } from "helius-sdk/rpc/methods/getProgramAccountsV2";
import type { AccountUpdate } from "./stream/types";
import { getIndexerCursor } from "./store/redis";

export interface ReconcileDeps {
  getSlot: () => Promise<number>;
  getProgramAccountsV2: GetProgramAccountsV2Fn;
  redis: Redis;
  enqueue: (update: AccountUpdate) => void;
  logger: Logger;
  programId: string;
}

export async function reconcile(deps: ReconcileDeps): Promise<void> {
  const { getSlot, getProgramAccountsV2, redis, enqueue, logger, programId } =
    deps;

  try {
    const cursor = await getIndexerCursor(redis);
    const changedSinceSlot = cursor.lastReconciledSlot || undefined;
    const slot = await getSlot();

    const result = await getProgramAccountsV2([
      programId,
      { encoding: "base64", limit: 1000, ...(changedSinceSlot && { changedSinceSlot }) },
    ]);

    let queued = 0;

    for (const acct of result.accounts) {
      const pk = acct.pubkey;
      const exists = await redis.exists(`memo:${pk}`);
      if (!exists) {
        const data = Buffer.from(acct.account.data[0], "base64");
        enqueue({ slot, pubkey: pk, data });
        queued++;
      }
    }

    await redis.hset("indexer:cursor", "lastReconciledSlot", slot.toString());

    if (queued > 0) {
      logger.info(
        { queued, total: result.accounts.length, changedSinceSlot },
        "Reconciliation found gaps",
      );
    } else {
      logger.debug(
        { total: result.accounts.length, changedSinceSlot },
        "Reconciliation clean",
      );
    }
  } catch (err) {
    logger.error({ err }, "Reconciliation failed");
  }
}
