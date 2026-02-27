import { z } from "zod";
import { PROGRAM_ID } from "../../shared/program";

const schema = z.object({
  rpcEndpoint: z.url(),
  laserstreamEndpoint: z.url(),
  laserstreamApiKey: z.string().min(1),
  redisUrl: z.string().default("redis://localhost:6379"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  healthPort: z.coerce.number().default(8080),
  programId: z
    .string()
    .default(PROGRAM_ID.toBase58()),
});

export type Config = z.infer<typeof schema>;

function loadConfig(): Config {
  const result = schema.safeParse({
    rpcEndpoint: process.env.RPC_ENDPOINT,
    laserstreamEndpoint: process.env.LASERSTREAM_ENDPOINT || undefined,
    laserstreamApiKey: process.env.LASERSTREAM_API_KEY || undefined,
    redisUrl: process.env.REDIS_URL,
    logLevel: process.env.LOG_LEVEL,
    healthPort: process.env.HEALTH_PORT,
    programId: process.env.PROGRAM_ID,
  });

  if (!result.success) {
    console.error("Bad config:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
