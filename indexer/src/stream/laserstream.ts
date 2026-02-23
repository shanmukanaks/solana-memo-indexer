import { EventEmitter } from "events";
import {
  subscribe,
  CommitmentLevel,
  type StreamHandle,
  type SubscribeUpdate,
} from "helius-laserstream";
import bs58 from "bs58";
import type { Logger } from "pino";
import type { MemoStream, AccountUpdate } from "./types";

export class LaserstreamMemoStream
  extends EventEmitter
  implements MemoStream
{
  private handle: StreamHandle | null = null;
  private _lastSlot = 0;

  constructor(
    private endpoint: string,
    private apiKey: string,
    private programId: string,
    private logger: Logger
  ) {
    super();
  }

  get lastSlot(): number {
    return this._lastSlot;
  }

  async connect(fromSlot?: number): Promise<void> {
    this.logger.info(
      { endpoint: this.endpoint, programId: this.programId, fromSlot },
      "Connecting to Laserstream"
    );

    this.handle = await subscribe(
      {
        endpoint: this.endpoint,
        apiKey: this.apiKey,
        replay: true,
      },
      {
        accounts: {
          "memo-program": {
            account: [],
            owner: [this.programId],
            filters: [],
          },
        },
        slots: {},
        transactions: {},
        transactionsStatus: {},
        blocks: {},
        blocksMeta: {},
        entry: {},
        accountsDataSlice: [],
        commitment: CommitmentLevel.CONFIRMED,
        ...(fromSlot !== undefined && { fromSlot }),
      },
      (update: SubscribeUpdate) => {
        this.handleUpdate(update);
      },
      (error: Error) => {
        this.logger.error({ err: error }, "Laserstream error");
        this.emit("error", error);
      }
    );

    this.logger.info("Laserstream connected");
  }

  private handleUpdate(update: SubscribeUpdate): void {
    if (!update.account?.account) return;

    const info = update.account.account;
    const slot = Number(update.account.slot ?? 0);

    if (slot > this._lastSlot) {
      this._lastSlot = slot;
    }

    const pubkey = info.pubkey ? bs58.encode(info.pubkey) : "";
    const data = info.data
      ? Buffer.isBuffer(info.data) ? info.data : Buffer.from(info.data)
      : Buffer.alloc(0);

    if (!pubkey || data.length === 0) return;

    const accountUpdate: AccountUpdate = { slot, pubkey, data };
    this.emit("account", accountUpdate);
  }

  async shutdown(): Promise<void> {
    if (this.handle) {
      this.handle.cancel();
      this.handle = null;
    }
    this.logger.info("Laserstream disconnected");
  }
}
