import { mkdtemp, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { ImagePersistenceService } from "../src/services/imagePersistence.js";
import type { AppConfig } from "../src/types.js";

function createConfig(root: string): AppConfig {
  return {
    chatGptBaseUrl: "https://chatgpt.com",
    returnMode: "paths",
    paths: {
      cwd: root,
      artifactRoot: path.join(root, "artifacts"),
    },
    retry: { attempts: 3, baseDelayMs: 50 },
    timeouts: { defaultTimeoutMs: 1000, maxTimeoutMs: 5000 },
    browser: {
      headless: true,
    },
    browserLaunch: {
      cloneAutomationProfile: true,
    },
    extensionBridge: {
      host: "127.0.0.1",
      port: 47821,
    },
  };
}


export async function runImagePersistenceTests(): Promise<void> {
  const tempDirs: string[] = [];
  const createTempDir = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "chatgpt-browser-mcp-persist-"));
    tempDirs.push(dir);
    return dir;
  };

  try {
    {
      const root = await createTempDir();
      const service = new ImagePersistenceService();
      const persisted = await service.persist(createConfig(root), {
        prompt: "Render a watercolor skyline",
        images: [
          {
            mimeType: "image/png",
            base64Data: Buffer.from("image-one").toString("base64"),
          },
        ],
        backendUsage: [],
      });

      assert.equal(persisted.images.length, 1);
      assert.equal(persisted.metadata.prompt, "Render a watercolor skyline");
      assert.equal(persisted.metadata.metadataPath.endsWith(".metadata.json"), true);
    }

    {
      const root = await createTempDir();
      const service = new ImagePersistenceService();
      const config = createConfig(root);

      const first = await service.persist(config, {
        prompt: "First prompt",
        images: [{ mimeType: "image/png", base64Data: Buffer.from("one").toString("base64") }],
        backendUsage: [],
      });
      const second = await service.persist(config, {
        prompt: "Second prompt",
        images: [{ mimeType: "image/png", base64Data: Buffer.from("two").toString("base64") }],
        backendUsage: [],
      });

      assert.notEqual(first.metadata.runId, second.metadata.runId);
      assert.notEqual(first.images[0]?.filePath, second.images[0]?.filePath);
    }

    {
      const root = await createTempDir();
      const service = new ImagePersistenceService();
      const duplicateImage = {
        mimeType: "image/png",
        base64Data: Buffer.from("same-image").toString("base64"),
      };

      const persisted = await service.persist(createConfig(root), {
        prompt: "Duplicate image prompt",
        images: [duplicateImage, duplicateImage],
        backendUsage: [],
      });

      assert.equal(persisted.images.length, 1);
      assert.equal(persisted.imagePayloads.length, 1);
      assert.equal(persisted.metadata.images.length, 1);
    }
  } finally {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
