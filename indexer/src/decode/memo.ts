import { BorshAccountsCoder, Idl } from "@coral-xyz/anchor";
import type { Logger } from "pino";
import IDL from "../../../target/idl/memo_store.json";

export interface DecodedMemo {
  pubkey: string;
  author: string;
  text: string;
  timestamp: number;
  nonce: number;
  bump: number;
}

const MEMO_DISCRIMINATOR = Buffer.from([161, 231, 183, 96, 66, 120, 3, 80]);

const coder = new BorshAccountsCoder(IDL as unknown as Idl);

export function decodeMemoAccount(
  pubkey: string,
  data: Buffer,
  logger?: Logger,
): DecodedMemo | null {
  try {
    if (data.length < 8) return null;
    if (!data.subarray(0, 8).equals(MEMO_DISCRIMINATOR)) return null;

    const decoded = coder.decode("Memo", data);
    return {
      pubkey,
      author: decoded.author.toBase58(),
      text: decoded.text,
      timestamp: decoded.timestamp.toNumber(),
      nonce: decoded.nonce.toNumber(),
      bump: decoded.bump,
    };
  } catch (err) {
    logger?.debug({ err, pubkey }, "Decode failed");
    return null;
  }
}
