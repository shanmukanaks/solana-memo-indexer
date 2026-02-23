import { assert } from "chai";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { SystemProgram, Keypair } from "@solana/web3.js";
import { BN } from "bn.js";

import IDL from "../../../target/idl/memo_store.json";
import { PROGRAM_ID, getMemoPda } from "../../../shared/program";

describe("#close_memo", function () {
  let provider: BankrunProvider;
  let program: Program;
  let nonce = 100;

  before(async function () {
    const context = await startAnchor(".", [], []);
    provider = new BankrunProvider(context);
    program = new Program(IDL as any, PROGRAM_ID, provider);
  });

  it("closes a memo and reclaims rent", async function () {
    nonce++;
    const memoPda = getMemoPda(provider.wallet.publicKey, nonce);

    await program.methods
      .storeMemo({ text: "to be closed", nonce: new BN(nonce) })
      .accounts({
        memo: memoPda,
        author: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const before = await program.account.memo.fetch(memoPda);
    assert.equal((before as any).text, "to be closed");

    await program.methods
      .closeMemo()
      .accounts({
        memo: memoPda,
        author: provider.wallet.publicKey,
      })
      .rpc();

    try {
      await program.account.memo.fetch(memoPda);
      assert.fail("account should be closed");
    } catch (err: any) {
      assert.include(err.message, "Could not find");
    }
  });

  it("rejects close from wrong author", async function () {
    nonce++;
    const memoPda = getMemoPda(provider.wallet.publicKey, nonce);

    await program.methods
      .storeMemo({ text: "not yours", nonce: new BN(nonce) })
      .accounts({
        memo: memoPda,
        author: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const other = Keypair.generate();
    try {
      await program.methods
        .closeMemo()
        .accounts({
          memo: memoPda,
          author: other.publicKey,
        })
        .signers([other])
        .rpc();
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err);
    }
  });
});
