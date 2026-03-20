import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AppError, getErrorCauseSummary } from "../errors.js";
import type {
  ErrorResponsePayload,
  ExtensionTabSession,
  GenerationResponsePayload,
  PersistedRun,
  ReturnMode,
} from "../types.js";

export class ResultFormatter {
  public formatGenerationResult(run: PersistedRun, returnMode: ReturnMode): CallToolResult {
    const warnings: string[] = [];
    const images = run.images.map((image, index) => {
      const payload = run.imagePayloads[index];

      if (returnMode === "base64" && !payload?.base64Data) {
        warnings.push(`Unable to embed base64 payload for ${image.fileName}.`);
      }

      return {
        index: image.index,
        fileName: image.fileName,
        filePath: image.filePath,
        mimeType: image.mimeType,
        embeddedBase64: returnMode === "base64" ? payload?.base64Data : undefined,
        embeddingError:
          returnMode === "base64" && !payload?.base64Data
            ? `Embedding unavailable for ${image.fileName}.`
            : undefined,
      };
    });

    const payload: GenerationResponsePayload = {
      success: true,
      prompt: run.metadata.prompt,
      gptInput: run.metadata.gptInput,
      resolvedGpt: run.metadata.resolvedGpt,
      returnMode,
      artifactDirectory: run.metadata.artifactDirectory,
      metadataPath: run.metadata.metadataPath,
      backendUsage: run.metadata.backendUsage,
      images,
      warnings,
    };

    const content: CallToolResult["content"] = [
      {
        type: "text",
        text: `Saved ${run.images.length} image artifact(s) to ${run.metadata.artifactDirectory}.`,
      },
    ];

    if (returnMode === "base64") {
      for (const image of images) {
        if (image.embeddedBase64) {
          content.push({
            type: "image",
            data: image.embeddedBase64,
            mimeType: image.mimeType,
          });
        }
      }
    }

    return {
      content,
      structuredContent: payload as unknown as Record<string, unknown>,
    };
  }

  public formatValidationResult(input: {
    authenticated: boolean;
    profilePath?: string;
    activeTab?: ExtensionTabSession;
    messages: string[];
    checklist: string[];
  }): CallToolResult {
    return {
      content: [
        {
          type: "text",
          text: input.authenticated
            ? "Browser session appears authenticated."
            : "Browser session is reachable but not authenticated.",
        },
      ],
      structuredContent: {
        success: input.authenticated,
        authenticated: input.authenticated,
        profilePath: input.profilePath,
        activeTab: input.activeTab,
        messages: input.messages,
        checklist: input.checklist,
      } as Record<string, unknown>,
    };
  }

  public formatConnectedTabsResult(tabs: ExtensionTabSession[]): CallToolResult {
    return {
      content: [
        {
          type: "text",
          text: `Found ${tabs.length} connected ChatGPT tab(s).`,
        },
      ],
      structuredContent: {
        success: true,
        count: tabs.length,
        tabs,
      } as Record<string, unknown>,
    };
  }

  public formatSelectedTabResult(tab: ExtensionTabSession): CallToolResult {
    return {
      content: [
        {
          type: "text",
          text: `Selected ChatGPT tab '${tab.tabKey}'.`,
        },
      ],
      structuredContent: {
        success: true,
        tab,
      } as Record<string, unknown>,
    };
  }

  public formatGptMatchResult(result: {
    query: string;
    status: "resolved" | "ambiguous" | "not_found";
    matches: Array<{ id?: string; name: string; description?: string; normalizedName: string; score: number }>;
  }): CallToolResult {
    return {
      content: [
        {
          type: "text",
          text: `Found ${result.matches.length} GPT candidate(s) for '${result.query}'.`,
        },
      ],
      structuredContent: {
        success: result.status !== "not_found",
        query: result.query,
        status: result.status,
        matches: result.matches,
      } as Record<string, unknown>,
    };
  }

  public formatError(error: AppError): CallToolResult {
    const causeSummary = getErrorCauseSummary(error);
    const payload: ErrorResponsePayload = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        causeSummary,
        details: error.details,
      },
    };

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `${error.code}: ${error.message}`,
        },
      ],
      structuredContent: payload as unknown as Record<string, unknown>,
    };
  }
}
