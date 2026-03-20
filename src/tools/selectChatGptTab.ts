import { asAppError } from "../errors.js";
import { SelectChatGptTabInputSchema } from "../types.js";
import type { ToolHandlerDependencies } from "./shared.js";
import { createExtensionCommandRouter } from "./shared.js";

type SelectChatGptTabArgs = {
  tabKey: string;
};

export function buildSelectChatGptTabHandler(dependencies: ToolHandlerDependencies) {
  return async (args: SelectChatGptTabArgs) => {
    try {
      const router = createExtensionCommandRouter(dependencies);
      const selected = router.selectTab(args.tabKey);
      return dependencies.resultFormatter.formatSelectedTabResult(selected);
    } catch (error) {
      return dependencies.resultFormatter.formatError(asAppError(error));
    }
  };
}

export { SelectChatGptTabInputSchema };
