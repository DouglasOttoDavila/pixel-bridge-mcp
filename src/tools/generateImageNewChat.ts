import { asAppError } from "../errors.js";
import { GenerateImageNewChatInputSchema } from "../types.js";
import type { ToolHandlerDependencies } from "./shared.js";
import {
  generateImagesFromSelectedTab,
  getLockKey,
  resolveReturnMode,
  resolveTimeoutMs,
} from "./shared.js";

type GenerateImageNewChatArgs = {
  prompt: string;
  returnMode?: "paths" | "base64";
  timeoutMs?: number;
};

export function buildGenerateImageNewChatHandler(dependencies: ToolHandlerDependencies) {
  return async (args: GenerateImageNewChatArgs) => {
    try {
      const timeoutMs = resolveTimeoutMs(args.timeoutMs, dependencies.config);
      const returnMode = resolveReturnMode(args.returnMode, dependencies.config);
      const lockKey = getLockKey(dependencies.config);

      return await dependencies.runLock.runExclusive(lockKey, async () => {
        const result = await generateImagesFromSelectedTab(dependencies, args.prompt, timeoutMs, {
          startNewChat: true,
        });
        const persisted = await dependencies.imagePersistence.persist(dependencies.config, result);
        return dependencies.resultFormatter.formatGenerationResult(persisted, returnMode);
      });
    } catch (error) {
      return dependencies.resultFormatter.formatError(asAppError(error));
    }
  };
}

export { GenerateImageNewChatInputSchema };
