import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(currentDirectory, "../../../.env"), quiet: true });

const config = loadConfig();
const app = buildApp({ config, logger: { level: process.env.LOG_LEVEL ?? "info" } });

async function start(): Promise<void> {
  await app.listen({ host: config.api.host, port: config.api.port });
}

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "Shutting down");
  await app.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

start().catch((error: unknown) => {
  app.log.error(error);
  process.exitCode = 1;
});
