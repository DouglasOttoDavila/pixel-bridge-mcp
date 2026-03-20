import { AppError } from "../errors.js";
import type { BrowserAdapter } from "./adapter.js";
import type { AppConfig, BrowserSessionStatus } from "../types.js";
import { SessionBootstrapService } from "../services/sessionBootstrapService.js";

export async function validateBrowserSession(
  adapter: BrowserAdapter,
  config: AppConfig,
  bootstrapService: SessionBootstrapService,
): Promise<BrowserSessionStatus> {
  const diagnostic = bootstrapService.inspect(config);
  if (diagnostic.status !== "ready") {
    throw new AppError("INVALID_CONFIG", diagnostic.messages[0] ?? "Browser session is not configured.", {
      details: diagnostic,
    });
  }

  await adapter.openSession({
    baseUrl: config.chatGptBaseUrl,
  });

  return adapter.getSessionStatus();
}

export async function ensureAuthenticatedBrowserSession(
  adapter: BrowserAdapter,
  config: AppConfig,
  bootstrapService: SessionBootstrapService,
): Promise<BrowserSessionStatus> {
  const status = await validateBrowserSession(adapter, config, bootstrapService);

  if (!status.authenticated) {
    throw new AppError("UNAUTHENTICATED_SESSION", "The configured browser profile is not authenticated in ChatGPT.", {
      details: status,
    });
  }

  return status;
}
