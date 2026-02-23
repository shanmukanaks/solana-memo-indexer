import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";

export const PROGRAM_ID = new PublicKey(
  "6hEMnbQ2t52uP5h8LieSzVjaH1xrDpY8AWsYj86nTHbq"
);

export function getMemoPda(author: PublicKey, nonce: number | bigint): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("memo"),
      author.toBuffer(),
      new BN(nonce.toString()).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
  return pda;
}
