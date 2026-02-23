import http from "http";
import type { Logger } from "pino";
import type { HealthTracker } from "./tracker";
import type { MemoStream } from "../stream/types";

export function startHealthServer(
  port: number,
  tracker: HealthTracker,
  stream: MemoStream,
  startedAt: number,
  logger: Logger,
  getQueueSize?: () => number
): http.Server {
  const server = http.createServer((req, res) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000);

    if (req.url === "/ready") {
      const healthy = tracker.isHealthy();
      res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: healthy ? "ready" : "not ready" }));
      return;
    }

    const healthy = tracker.isHealthy();
    res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: healthy ? "healthy" : "unhealthy",
        uptime,
        lastSlot: stream.lastSlot,
        queueDepth: getQueueSize?.() ?? 0,
        components: tracker.toJSON(),
      })
    );
  });

  server.listen(port, () => {
    logger.info({ port }, "Health server listening");
  });

  return server;
}
