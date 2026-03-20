import { asAppError, AppError, getErrorCauseSummary } from "../errors.js";
import type { ToolHandlerDependencies } from "./shared.js";
import { createExtensionCommandRouter } from "./shared.js";

export function buildValidateBrowserSessionHandler(dependencies: ToolHandlerDependencies) {
  return async () => {
    const diagnostic = dependencies.extensionBootstrap.inspect(dependencies.config);

    try {
      await dependencies.extensionBootstrap.ensureConnectedTab(
        dependencies.config,
        dependencies.extensionBridge,
        { timeoutMs: 15000 },
      );

      const router = createExtensionCommandRouter(dependencies);
      const status = await router.validateSelectedSession();

      return dependencies.resultFormatter.formatValidationResult({
        authenticated: status.authenticated,
        activeTab: dependencies.extensionBridge.getSelectedSession(),
        messages: [
          ...diagnostic.messages,
          ...(status.details ? [status.details] : []),
        ],
        checklist: diagnostic.checklist,
      });
    } catch (error) {
      const typedError = asAppError(error);

      if (typedError.code === "INVALID_CONFIG") {
        const causeSummary = getErrorCauseSummary(typedError);
        return dependencies.resultFormatter.formatError(
          new AppError(
            "INVALID_CONFIG",
            causeSummary ? `${typedError.message} Cause: ${causeSummary}` : typedError.message,
            {
              cause: typedError.cause,
              details: {
                diagnostic,
                underlying: typedError.details,
                causeSummary,
              },
            },
          ),
        );
      }

      return dependencies.resultFormatter.formatError(typedError);
    }
  };
}
