import { describe, it, expect } from "bun:test";
import { PublicKey } from "@solana/web3.js";
import { decodeMemoAccount } from "../../src/decode/memo";
import { buildMemoBuffer } from "../helpers";

describe("decoder", () => {
  const author = new PublicKey("9aBkp5kKJ5iziMqWAPaXvCDDBMJtn1ep2UuPBNQ3WMYC");
  const pubkey = "BxjTHjhEP4BfW9KWFB6uXnhPNeQQjFNMgYuFJnmFrkMK";

  it("decodes a valid memo", () => {
    const data = buildMemoBuffer({
      author,
      text: "test 1",
      timestamp: 1708533600n,
      nonce: 42n,
      bump: 255,
    });

    const result = decodeMemoAccount(pubkey, data);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("test 1");
    expect(result!.author).toBe(author.toBase58());
    expect(result!.timestamp).toBe(1708533600);
    expect(result!.nonce).toBe(42);
    expect(result!.bump).toBe(255);
    expect(result!.pubkey).toBe(pubkey);
  });

  it("null on wrong discriminator", () => {
    const data = buildMemoBuffer({
      author,
      text: "Hello",
      timestamp: 1708533600n,
      nonce: 1n,
      bump: 254,
    });
    data[0] = 0xff;
    data[1] = 0xff;

    const result = decodeMemoAccount(pubkey, data);
    expect(result).toBeNull();
  });

  it("decodes a memo with a large nonce", () => {
    const largeNonce = 188_036_220_335_736n;
    const data = buildMemoBuffer({
      author,
      text: "large nonce",
      timestamp: 1708533600n,
      nonce: largeNonce,
      bump: 200,
    });

    const result = decodeMemoAccount(pubkey, data);
    expect(result).not.toBeNull();
    expect(result!.nonce).toBe(Number(largeNonce));
    expect(result!.text).toBe("large nonce");
  });

  it("null on short data", () => {
    expect(decodeMemoAccount(pubkey, Buffer.alloc(4))).toBeNull();
    expect(decodeMemoAccount(pubkey, Buffer.alloc(0))).toBeNull();
  });
});
