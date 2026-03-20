import { asAppError } from "../errors.js";
import { GenerateImageWithGptInputSchema } from "../types.js";
import type { ToolHandlerDependencies } from "./shared.js";
import {
  assertSelectedTabMatchesRequestedGpt,
  generateImagesFromSelectedTab,
  getLockKey,
  resolveReturnMode,
  resolveTimeoutMs,
} from "./shared.js";

type GenerateImageWithGptArgs = {
  gptName: string;
  prompt: string;
  returnMode?: "paths" | "base64";
  timeoutMs?: number;
};

export function buildGenerateImageWithGptHandler(dependencies: ToolHandlerDependencies) {
  return async (args: GenerateImageWithGptArgs) => {
    try {
      const timeoutMs = resolveTimeoutMs(args.timeoutMs, dependencies.config);
      const returnMode = resolveReturnMode(args.returnMode, dependencies.config);
      const lockKey = getLockKey(dependencies.config);

      return await dependencies.runLock.runExclusive(lockKey, async () => {
        const resolvedGpt = await assertSelectedTabMatchesRequestedGpt(dependencies, args.gptName);
        const result = await generateImagesFromSelectedTab(dependencies, args.prompt, timeoutMs, {
          gptInput: args.gptName,
          resolvedGpt,
        });
        const persisted = await dependencies.imagePersistence.persist(dependencies.config, result);
        return dependencies.resultFormatter.formatGenerationResult(persisted, returnMode);
      });
    } catch (error) {
      return dependencies.resultFormatter.formatError(asAppError(error));
    }
  };
}

export { GenerateImageWithGptInputSchema };
