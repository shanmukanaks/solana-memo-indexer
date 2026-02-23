import type { Logger } from "pino";
import type { Config } from "../config";
import type { MemoStream } from "./types";
import { LaserstreamMemoStream } from "./laserstream";

export function createStream(config: Config, logger: Logger): MemoStream {
  if (!config.laserstreamEndpoint || !config.laserstreamApiKey) {
    logger.error(
      "Missing laserstream config"
    );
    process.exit(1);
  }
  return new LaserstreamMemoStream(
    config.laserstreamEndpoint,
    config.laserstreamApiKey,
    config.programId,
    logger.child({ component: "laserstream" })
  );
}
