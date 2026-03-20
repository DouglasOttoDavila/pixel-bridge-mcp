import { AppError } from "../errors.js";
import type { BrowserAdapter } from "./adapter.js";
import type { GenerationWorkflowResult, GptResolutionResult } from "../types.js";
import { GptResolver } from "../services/gptResolver.js";

export class ChatGptWorkflow {
  public constructor(
    private readonly adapter: BrowserAdapter,
    private readonly gptResolver: GptResolver,
  ) {}

  public async listMatchingGpts(query: string): Promise<GptResolutionResult> {
    await this.adapter.navigateHome();
    const candidates = await this.adapter.searchGpts(query);
    return this.gptResolver.resolve(query, candidates);
  }

  public async generateImageInNewChat(
    prompt: string,
    timeoutMs: number,
  ): Promise<GenerationWorkflowResult> {
    await this.adapter.navigateHome();
    await this.adapter.startNewChat();
    return this.generate(prompt, timeoutMs);
  }

  public async generateImageWithGpt(
    gptName: string,
    prompt: string,
    timeoutMs: number,
  ): Promise<GenerationWorkflowResult> {
    await this.adapter.navigateHome();
    const candidates = await this.adapter.searchGpts(gptName);
    const resolution = this.gptResolver.resolve(gptName, candidates);

    if (resolution.status !== "resolved" || !resolution.resolved) {
      throw new AppError("GPT_RESOLUTION_FAILED", "Unable to safely resolve the requested GPT.", {
        details: resolution,
      });
    }

    await this.adapter.selectGpt(resolution.resolved);
    const result = await this.generate(prompt, timeoutMs);

    return {
      ...result,
      gptInput: gptName,
      resolvedGpt: resolution.resolved.name,
    };
  }

  private async generate(prompt: string, timeoutMs: number): Promise<GenerationWorkflowResult> {
    await this.adapter.submitPrompt(prompt);
    const imageHandles = await this.adapter.waitForImages(timeoutMs);

    if (imageHandles.length === 0) {
      throw new AppError("GENERATION_TIMEOUT", "No generated images were returned before the timeout elapsed.", {
        details: { timeoutMs },
      });
    }

    const images = [];
    for (const handle of imageHandles) {
      images.push(await this.adapter.downloadImage(handle));
    }

    return {
      prompt,
      images,
      backendUsage: this.adapter.getUsageLog(),
    };
  }
}
