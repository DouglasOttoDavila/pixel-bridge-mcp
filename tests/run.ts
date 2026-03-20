import { runBackendRouterTests } from "./backendRouter.test.js";
import { runConfigTests } from "./config.test.js";
import { runExtensionBootstrapServiceTests } from "./extensionBootstrapService.test.js";
import { runExtensionBridgeServerTests } from "./extensionBridgeServer.test.js";
import { runDotEnvTests } from "./dotenv.test.js";
import { runExtensionGenerationHandlerTests } from "./extensionGenerationHandlers.test.js";
import { runExtensionSessionRegistryTests } from "./extensionSessionRegistry.test.js";
import { runGptResolverTests } from "./gptResolver.test.js";
import { runImagePersistenceTests } from "./imagePersistence.test.js";
import { runResultFormatterTests } from "./resultFormatter.test.js";
import { runRunLockTests } from "./runLock.test.js";
import { runValidateBrowserSessionTests } from "./validateBrowserSession.test.js";

const suites: Array<[string, () => Promise<void>]> = [
  ["backendRouter", runBackendRouterTests],
  ["config", runConfigTests],
  ["extensionBootstrapService", runExtensionBootstrapServiceTests],
  ["extensionBridgeServer", runExtensionBridgeServerTests],
  ["dotenv", runDotEnvTests],
  ["extensionGenerationHandlers", runExtensionGenerationHandlerTests],
  ["extensionSessionRegistry", runExtensionSessionRegistryTests],
  ["gptResolver", runGptResolverTests],
  ["imagePersistence", runImagePersistenceTests],
  ["resultFormatter", runResultFormatterTests],
  ["runLock", runRunLockTests],
  ["validateBrowserSession", runValidateBrowserSessionTests],
];

async function main(): Promise<void> {
  for (const [name, runner] of suites) {
    process.stdout.write(`Running ${name}...\n`);
    await runner();
    process.stdout.write(`Passed ${name}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
