import crypto from "crypto";
import { PublicKey } from "@solana/web3.js";

export function buildMemoBuffer(fields: {
  author: PublicKey;
  text: string;
  timestamp: bigint;
  nonce: bigint;
  bump: number;
}): Buffer {
  const discriminator = crypto
    .createHash("sha256")
    .update("account:Memo")
    .digest()
    .subarray(0, 8);

  // layout: discriminator(8) + author(32) + string(4+len) + i64(8) + u64(8) + u8(1)
  const textBytes = Buffer.from(fields.text, "utf-8");
  const totalLen = 8 + 32 + 4 + textBytes.length + 8 + 8 + 1;
  const buf = Buffer.alloc(totalLen);
  let offset = 0;

  discriminator.copy(buf, offset);
  offset += 8;

  fields.author.toBuffer().copy(buf, offset);
  offset += 32;

  buf.writeUInt32LE(textBytes.length, offset);
  offset += 4;
  textBytes.copy(buf, offset);
  offset += textBytes.length;

  buf.writeBigInt64LE(fields.timestamp, offset);
  offset += 8;

  buf.writeBigUInt64LE(fields.nonce, offset);
  offset += 8;

  buf.writeUInt8(fields.bump, offset);

  return buf;
}
