import { AppError, asAppError, isRetryableError } from "../errors.js";
import type { BrowserAdapter, BrowserBackend } from "./adapter.js";
import type {
  BrowserActionName,
  BrowserSessionConfig,
  BrowserSessionStatus,
  DownloadedImage,
  GeneratedImageHandle,
  GptCandidate,
} from "../types.js";
import { toIsoTimestamp } from "../utils/time.js";

export class BackendRouter implements BrowserAdapter {
  private readonly usageLog: BrowserAdapter["getUsageLog"] extends () => infer T ? T : never = [];

  public constructor(
    private readonly preferredBackend: BrowserBackend | undefined,
    private readonly fallbackBackend: BrowserBackend | undefined,
    private readonly allowFallback: boolean,
  ) {}

  public getUsageLog() {
    return [...this.usageLog];
  }

  public async openSession(config: BrowserSessionConfig): Promise<void> {
    await this.execute("openSession", (backend) => backend.openSession(config));
  }

  public async getSessionStatus(): Promise<BrowserSessionStatus> {
    return this.execute("getSessionStatus", (backend) => backend.getSessionStatus());
  }

  public async navigateHome(): Promise<void> {
    await this.execute("navigateHome", (backend) => backend.navigateHome());
  }

  public async startNewChat(): Promise<void> {
    await this.execute("startNewChat", (backend) => backend.startNewChat());
  }

  public async searchGpts(query: string): Promise<GptCandidate[]> {
    return this.execute("searchGpts", (backend) => backend.searchGpts(query));
  }

  public async selectGpt(candidate: GptCandidate): Promise<void> {
    await this.execute("selectGpt", (backend) => backend.selectGpt(candidate));
  }

  public async submitPrompt(prompt: string): Promise<void> {
    await this.execute("submitPrompt", (backend) => backend.submitPrompt(prompt));
  }

  public async waitForImages(timeoutMs: number): Promise<GeneratedImageHandle[]> {
    return this.execute("waitForImages", (backend) => backend.waitForImages(timeoutMs));
  }

  public async downloadImage(image: GeneratedImageHandle): Promise<DownloadedImage> {
    return this.execute("downloadImage", (backend) => backend.downloadImage(image));
  }

  private async execute<T>(
    action: BrowserActionName,
    handler: (backend: BrowserBackend) => Promise<T>,
  ): Promise<T> {
    const attemptedBackends: Array<"vibium" | "playwright"> = [];
    const primary = this.preferredBackend ?? this.fallbackBackend;
    const secondary =
      this.preferredBackend && this.fallbackBackend && this.allowFallback
        ? this.fallbackBackend
        : undefined;

    if (!primary) {
      throw new AppError("INVALID_CONFIG", "No browser backend is configured.", {
        details: { action },
      });
    }

    try {
      attemptedBackends.push(primary.backend);
      const result = await handler(primary);
      this.recordUsage(action, primary.backend, attemptedBackends, false);
      return result;
    } catch (error) {
      const primaryError = asAppError(error);
      if (!secondary || !isRetryableError(primaryError)) {
        throw primaryError;
      }

      attemptedBackends.push(secondary.backend);

      try {
        const result = await handler(secondary);
        this.recordUsage(action, secondary.backend, attemptedBackends, true);
        return result;
      } catch (fallbackError) {
        const typedFallbackError = asAppError(fallbackError, "BACKEND_FALLBACK_FAILED");
        throw new AppError(
          "BACKEND_FALLBACK_FAILED",
          `Browser action '${action}' failed on all configured backends.`,
          {
            details: {
              action,
              attemptedBackends,
              primaryError: primaryError.message,
              fallbackError: typedFallbackError.message,
            },
          },
        );
      }
    }
  }

  private recordUsage(
    action: BrowserActionName,
    backend: "vibium" | "playwright",
    attemptedBackends: Array<"vibium" | "playwright">,
    fellBack: boolean,
  ): void {
    this.usageLog.push({
      action,
      backend,
      attemptedBackends,
      fellBack,
      timestamp: toIsoTimestamp(),
    });
  }
}
