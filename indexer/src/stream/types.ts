import { EventEmitter } from "events";

export interface AccountUpdate {
  slot: number;
  pubkey: string;
  data: Buffer;
}

export interface MemoStream extends EventEmitter {
  connect(fromSlot?: number): Promise<void>;
  shutdown(): Promise<void>;
  readonly lastSlot: number;
}
