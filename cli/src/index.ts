import "dotenv/config";
import crypto from "crypto";
import { readFileSync } from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { BN } from "bn.js";
import Redis from "ioredis";
import { Command } from "commander";
import IDL from "../../target/idl/memo_store.json";
import { PROGRAM_ID, getMemoPda } from "../../shared/program";
import { decodeMemoAccount } from "../../indexer/src/decode/memo";
import {
  getMemo,
  getMemosByAuthor,
  getRecentMemos,
  getIndexerCursor,
  getIndexerStats,
} from "../../indexer/src/store/redis";

function loadKeypair() {
  const keyPath =
    process.env.WALLET_PATH ?? `${process.env.HOME}/.config/solana/id.json`;
  const secret = readFileSync(keyPath, "utf-8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

function getRedis() {
  return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
}

function getConnection() {
  const rpc = process.env.RPC_ENDPOINT;
  if (!rpc) {
    console.error("missing RPC_ENDPOINT");
    process.exit(1);
  }
  return new Connection(rpc, "confirmed");
}

async function createMemo(text: string) {
  const connection = getConnection();
  const keypair = loadKeypair();
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(IDL as any, PROGRAM_ID, provider);

  const nonce = crypto.randomBytes(6).readUIntLE(0, 6);
  const memoPda = getMemoPda(keypair.publicKey, nonce);

  console.log(`Author: ${keypair.publicKey.toBase58()}`);
  console.log(`Nonce: ${nonce}`);
  console.log(`PDA: ${memoPda.toBase58()}`);
  console.log(`Text: "${text}"\n`);

  const txSig = await program.methods
    .storeMemo({ text, nonce: new BN(nonce.toString()) })
    .accounts({
      memo: memoPda,
      author: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`Tx: ${txSig}`);
  console.log(`https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
}

async function verifyMemo(pda: string) {
  const connection = getConnection();
  const redis = getRedis();

  const [accountInfo, redisMemo] = await Promise.all([
    connection.getAccountInfo(new PublicKey(pda)),
    getMemo(redis, pda),
  ]);

  const onChain = accountInfo
    ? decodeMemoAccount(pda, accountInfo.data as Buffer)
    : null;

  console.log("On-chain:");
  if (onChain) {
    console.log(`  text="${onChain.text}"  author=${onChain.author}  timestamp=${onChain.timestamp}`);
  } else {
    console.log(`  (${accountInfo ? "failed to decode" : "not found"})`);
  }

  console.log("\nRedis:");
  if (redisMemo) {
    console.log(`  text="${redisMemo.text}"  author=${redisMemo.author}  timestamp=${redisMemo.timestamp}`);
  } else {
    console.log("  (not found)");
  }

  if (onChain && redisMemo) {
    const match =
      onChain.text === redisMemo.text &&
      onChain.author === redisMemo.author &&
      onChain.timestamp === redisMemo.timestamp;
    console.log(`\n${match ? "MATCH" : "MISMATCH"}`);
  }

  redis.quit();
}

async function listMemos(author?: string) {
  const redis = getRedis();

  const keys = author
    ? await getMemosByAuthor(redis, author)
    : await getRecentMemos(redis);

  if (keys.length === 0) {
    console.log("No memos found");
    redis.quit();
    return;
  }

  for (const pubkey of keys) {
    const memo = await getMemo(redis, pubkey);
    if (!memo) continue;
    const ts = new Date(memo.timestamp * 1000).toISOString();
    console.log(`[${ts}] ${memo.author.slice(0, 8)}.. "${memo.text}"`);
  }

  redis.quit();
}

async function showStats() {
  const redis = getRedis();
  const connection = getConnection();

  const [cursor, stats, currentSlot] = await Promise.all([
    getIndexerCursor(redis),
    getIndexerStats(redis),
    connection.getSlot("confirmed"),
  ]);

  const uptime = stats.startedAt ? Math.floor((Date.now() - stats.startedAt) / 1000) : 0;

  console.log(`Indexed: ${stats.totalIndexed}`);
  console.log(`Last slot: ${cursor.lastSlot || "n/a"}`);
  console.log(`Current slot: ${currentSlot}`);
  console.log(`Lag: ${cursor.lastSlot ? currentSlot - cursor.lastSlot : "n/a"}`);
  console.log(`Uptime: ${uptime}s`);

  redis.quit();
}

const program = new Command()
  .name("memo-cli")
  .description("memo indexer cli");

program
  .command("create")
  .argument("<text>", "memo text")
  .description("Create a memo")
  .action((text: string) => createMemo(text).catch(die));

program
  .command("verify")
  .argument("<pda>", "memo PDA")
  .description("Compare on-chain vs Redis")
  .action((pda: string) => verifyMemo(pda).catch(die));

program
  .command("list")
  .argument("[author]", "author pubkey")
  .description("List memos")
  .action((author?: string) => listMemos(author).catch(die));

program
  .command("stats")
  .description("Indexer stats")
  .action(() => showStats().catch(die));

const die = (e: any) => { console.error(e.message); process.exit(1) };
program.parse();
