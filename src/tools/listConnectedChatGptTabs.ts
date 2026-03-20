import { asAppError } from "../errors.js";
import type { ToolHandlerDependencies } from "./shared.js";
import { createExtensionCommandRouter } from "./shared.js";

export function buildListConnectedChatGptTabsHandler(dependencies: ToolHandlerDependencies) {
  return async () => {
    try {
      const router = createExtensionCommandRouter(dependencies);
      return dependencies.resultFormatter.formatConnectedTabsResult(router.listTabs());
    } catch (error) {
      return dependencies.resultFormatter.formatError(asAppError(error));
    }
  };
}
