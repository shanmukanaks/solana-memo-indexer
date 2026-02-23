import { assert } from "chai";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";

import IDL from "../../../target/idl/memo_store.json";
import { PROGRAM_ID, getMemoPda } from "../../../shared/program";

describe("#store_memo", function () {
  let provider: BankrunProvider;
  let program: Program;
  let nonce = 0;

  before(async function () {
    const context = await startAnchor(".", [], []);
    provider = new BankrunProvider(context);
    program = new Program(IDL as any, PROGRAM_ID, provider);
  });

  it("stores a memo with correct fields", async function () {
    const text = "test 1";
    nonce++;
    const memoPda = getMemoPda(provider.wallet.publicKey, nonce);

    await program.methods
      .storeMemo({ text, nonce: new BN(nonce) })
      .accounts({
        memo: memoPda,
        author: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const memo: any = await program.account.memo.fetch(memoPda);
    assert.equal(memo.text, text);
    assert.equal(
      memo.author.toBase58(),
      provider.wallet.publicKey.toBase58()
    );
    assert.equal(memo.nonce.toNumber(), nonce);
    assert.isAbove(memo.timestamp.toNumber(), 0);
  });

  it("rejects empty text", async function () {
    nonce++;
    const memoPda = getMemoPda(provider.wallet.publicKey, nonce);

    try {
      await program.methods
        .storeMemo({ text: "", nonce: new BN(nonce) })
        .accounts({
          memo: memoPda,
          author: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail();
    } catch (_err) {
      assert.isTrue(_err instanceof AnchorError);
      const err = _err as AnchorError;
      assert.strictEqual(err.error.errorCode.code, "TextEmpty");
    }
  });

  it("rejects text over 280 bytes", async function () {
    nonce++;
    const memoPda = getMemoPda(provider.wallet.publicKey, nonce);

    try {
      await program.methods
        .storeMemo({ text: "x".repeat(281), nonce: new BN(nonce) })
        .accounts({
          memo: memoPda,
          author: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail();
    } catch (_err) {
      assert.isTrue(_err instanceof AnchorError);
      const err = _err as AnchorError;
      assert.strictEqual(err.error.errorCode.code, "TextTooLong");
    }
  });

  it("deterministic PDA from author + nonce", async function () {
    const pda1 = getMemoPda(provider.wallet.publicKey, 42);
    const pda2 = getMemoPda(provider.wallet.publicKey, 42);
    assert.equal(pda1.toBase58(), pda2.toBase58());

    const pda3 = getMemoPda(provider.wallet.publicKey, 43);
    assert.notEqual(pda1.toBase58(), pda3.toBase58());
  });
});
