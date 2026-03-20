import assert from "node:assert/strict";
import { ResultFormatter } from "../src/services/resultFormatter.js";
import type { PersistedRun } from "../src/types.js";

function createPersistedRun(): PersistedRun {
  return {
    metadata: {
      runId: "run-1",
      prompt: "A bright studio portrait",
      status: "succeeded",
      createdAt: "2026-03-18T12:00:00.000Z",
      completedAt: "2026-03-18T12:01:00.000Z",
      artifactDirectory: "D:/artifacts/2026-03-18",
      metadataPath: "D:/artifacts/2026-03-18/run-1.metadata.json",
      backendUsage: [],
      images: [
        {
          index: 0,
          fileName: "image.png",
          filePath: "D:/artifacts/2026-03-18/image.png",
          mimeType: "image/png",
          byteLength: 8,
        },
      ],
    },
    images: [
      {
        index: 0,
        fileName: "image.png",
        filePath: "D:/artifacts/2026-03-18/image.png",
        mimeType: "image/png",
        byteLength: 8,
      },
    ],
    imagePayloads: [
      {
        mimeType: "image/png",
        base64Data: Buffer.from("payload").toString("base64"),
      },
    ],
  };
}

export async function runResultFormatterTests(): Promise<void> {
  const formatter = new ResultFormatter();

  {
    const result = formatter.formatGenerationResult(createPersistedRun(), "paths");
    assert.equal(result.isError, undefined);
    assert.equal(result.content.some((item) => item.type === "image"), false);
  }

  {
    const result = formatter.formatGenerationResult(createPersistedRun(), "base64");
    assert.equal(result.content.some((item) => item.type === "image"), true);
    assert.ok(
      (result.structuredContent as { images: Array<{ embeddedBase64?: string }> }).images[0]?.embeddedBase64,
    );
  }

  {
    const run = createPersistedRun();
    run.imagePayloads = [{ mimeType: "image/png", base64Data: "" }];

    const result = formatter.formatGenerationResult(run, "base64");
    const structured = result.structuredContent as { warnings: string[]; images: Array<{ embeddingError?: string }> };

    assert.equal(structured.warnings.length, 1);
    assert.match(structured.images[0]?.embeddingError ?? "", /Embedding unavailable/);
  }

  {
    const result = formatter.formatConnectedTabsResult([
      {
        sessionId: "session-1",
        tabKey: "tab-1",
        currentUrl: "https://chatgpt.com/",
        pageType: "chat",
        connectedAt: "2026-03-19T12:00:00.000Z",
        lastSeenAt: "2026-03-19T12:00:00.000Z",
        selected: true,
      },
    ]);
    const structured = result.structuredContent as { count: number; tabs: Array<{ tabKey: string }> };
    assert.equal(structured.count, 1);
    assert.equal(structured.tabs[0]?.tabKey, "tab-1");
  }
}
