#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { loadDotEnv } from "./utils/dotenv.js";
import { loadOrCreateBridgeToken } from "./extensionBridge/token.js";
import { ExtensionBridgeServer } from "./extensionBridge/server.js";
import { resolveRuntimeHome } from "./utils/runtimePaths.js";

async function main(): Promise<void> {
  const cwd = process.cwd();
  const runtimeHome = resolveRuntimeHome(process.env, cwd);
  loadDotEnv([cwd, runtimeHome]);
  const config = loadConfig();
  const bridgeToken = await loadOrCreateBridgeToken(config.paths.runtimeHome);
  const extensionBridge = new ExtensionBridgeServer(config, bridgeToken);
  await extensionBridge.start();
  const server = createServer(config, extensionBridge);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  const close = async () => {
    await extensionBridge.close();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void close();
  });

  process.on("SIGTERM", () => {
    void close();
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure.";
  console.error(`Failed to start MCP server: ${message}`);
  process.exit(1);
});
