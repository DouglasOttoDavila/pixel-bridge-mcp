import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPlaywrightClient } from "./mcpClients/playwrightClient.js";
import { BackendRouter } from "./browser/backendRouter.js";
import type { AppConfig } from "./types.js";
import { GenerateImageNewChatInputSchema } from "./tools/generateImageNewChat.js";
import { GenerateImageActiveTabInputSchema } from "./tools/generateImageActiveTab.js";
import { GenerateImageWithGptInputSchema } from "./tools/generateImageWithGpt.js";
import { ListMatchingGptsInputSchema } from "./tools/listMatchingGpts.js";
import { SelectChatGptTabInputSchema } from "./types.js";
import { buildGenerateImageNewChatHandler } from "./tools/generateImageNewChat.js";
import { buildGenerateImageActiveTabHandler } from "./tools/generateImageActiveTab.js";
import { buildGenerateImageWithGptHandler } from "./tools/generateImageWithGpt.js";
import { buildListMatchingGptsHandler } from "./tools/listMatchingGpts.js";
import { buildValidateBrowserSessionHandler } from "./tools/validateBrowserSession.js";
import { buildListConnectedChatGptTabsHandler } from "./tools/listConnectedChatGptTabs.js";
import { buildSelectChatGptTabHandler } from "./tools/selectChatGptTab.js";
import { GptResolver } from "./services/gptResolver.js";
import { ImagePersistenceService } from "./services/imagePersistence.js";
import { ResultFormatter } from "./services/resultFormatter.js";
import { RunLockService } from "./services/runLock.js";
import { SessionBootstrapService } from "./services/sessionBootstrapService.js";
import { ExtensionBootstrapService } from "./services/extensionBootstrapService.js";
import { ExtensionBridgeServer } from "./extensionBridge/server.js";

export function createServer(config: AppConfig, extensionBridge: ExtensionBridgeServer): McpServer {
  const runLock = new RunLockService();
  const sessionBootstrap = new SessionBootstrapService();
  const extensionBootstrap = new ExtensionBootstrapService();
  const gptResolver = new GptResolver();
  const imagePersistence = new ImagePersistenceService();
  const resultFormatter = new ResultFormatter();

  const createRouter = () =>
    new BackendRouter(
      createPlaywrightClient(config),
      undefined,
      false,
    );

  const dependencies = {
    config,
    runLock,
    sessionBootstrap,
    extensionBootstrap,
    gptResolver,
    imagePersistence,
    resultFormatter,
    createRouter,
    extensionBridge,
  };

  const server = new McpServer({
    name: "pixelbridge-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "generate_image_active_tab",
    {
      description: "Generate images in the currently selected connected ChatGPT tab and persist the artifacts locally.",
      inputSchema: GenerateImageActiveTabInputSchema,
    },
    buildGenerateImageActiveTabHandler(dependencies),
  );

  server.registerTool(
    "generate_image_new_chat",
    {
      description: "Start a fresh chat in the selected connected ChatGPT tab, generate images, and persist the artifacts locally.",
      inputSchema: GenerateImageNewChatInputSchema,
    },
    buildGenerateImageNewChatHandler(dependencies),
  );

  server.registerTool(
    "generate_image_with_gpt",
    {
      description: "Verify the selected connected ChatGPT tab matches the requested GPT, generate images, and persist the artifacts locally.",
      inputSchema: GenerateImageWithGptInputSchema,
    },
    buildGenerateImageWithGptHandler(dependencies),
  );

  server.registerTool(
    "validate_browser_session",
    {
      description: "Validate the connected ChatGPT extension tab and report whether ChatGPT appears authenticated.",
    },
    buildValidateBrowserSessionHandler(dependencies),
  );

  server.registerTool(
    "list_connected_chatgpt_tabs",
    {
      description: "List ChatGPT tabs currently connected through the local extension bridge.",
    },
    buildListConnectedChatGptTabsHandler(dependencies),
  );

  server.registerTool(
    "select_chatgpt_tab",
    {
      description: "Select the connected ChatGPT tab that subsequent extension-backed tools should target.",
      inputSchema: SelectChatGptTabInputSchema,
    },
    buildSelectChatGptTabHandler(dependencies),
  );

  server.registerTool(
    "list_matching_gpts",
    {
      description: "List ranked GPT matches for a query without generating an image.",
      inputSchema: ListMatchingGptsInputSchema,
    },
    buildListMatchingGptsHandler(dependencies),
  );

  return server;
}
