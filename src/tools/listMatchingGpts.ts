import { asAppError } from "../errors.js";
import { ListMatchingGptsInputSchema } from "../types.js";
import type { ToolHandlerDependencies } from "./shared.js";
import { prepareWorkflow } from "./shared.js";

type ListMatchingGptsArgs = {
  query: string;
};

export function buildListMatchingGptsHandler(dependencies: ToolHandlerDependencies) {
  return async (args: ListMatchingGptsArgs) => {
    try {
      const workflow = await prepareWorkflow(dependencies);
      const result = await workflow.listMatchingGpts(args.query);
      return dependencies.resultFormatter.formatGptMatchResult(result);
    } catch (error) {
      return dependencies.resultFormatter.formatError(asAppError(error));
    }
  };
}

export { ListMatchingGptsInputSchema };
