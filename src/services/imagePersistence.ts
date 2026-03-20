import { writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../errors.js";
import type { AppConfig, ArtifactImageRecord, ArtifactMetadata, GenerationWorkflowResult, PersistedRun } from "../types.js";
import { ensureDirectory, extensionForMimeType, sanitizeFileSegment, writeJsonFile } from "../utils/fs.js";
import { createRunId, toDatePath, toIsoTimestamp } from "../utils/time.js";
import type { DownloadedImage } from "../types.js";

export class ImagePersistenceService {
  public async persist(config: AppConfig, result: GenerationWorkflowResult): Promise<PersistedRun> {
    const runDate = new Date();
    const runId = createRunId(runDate);
    const artifactDirectory = path.join(config.paths.artifactRoot, toDatePath(runDate));
    const promptSlug = sanitizeFileSegment(result.prompt, "prompt");
    const images: ArtifactImageRecord[] = [];
    const uniqueImages = dedupeExactImages(result.images);

    try {
      await ensureDirectory(artifactDirectory);

      for (const [index, image] of uniqueImages.entries()) {
        const extension = extensionForMimeType(image.mimeType);
        const fileName = `${runId}-${String(index + 1).padStart(2, "0")}-${promptSlug}.${extension}`;
        const filePath = path.join(artifactDirectory, fileName);
        const buffer = Buffer.from(image.base64Data, "base64");
        await writeFile(filePath, buffer);

        images.push({
          index,
          fileName,
          filePath,
          mimeType: image.mimeType,
          byteLength: buffer.byteLength,
        });
      }

      const metadataPath = path.join(artifactDirectory, `${runId}.metadata.json`);
      const metadata: ArtifactMetadata = {
        runId,
        prompt: result.prompt,
        gptInput: result.gptInput,
        resolvedGpt: result.resolvedGpt,
        status: "succeeded",
        createdAt: toIsoTimestamp(runDate),
        completedAt: toIsoTimestamp(),
        artifactDirectory,
        metadataPath,
        backendUsage: result.backendUsage,
        images,
      };

      await writeJsonFile(metadataPath, metadata);

      return {
        metadata,
        images,
        imagePayloads: uniqueImages,
      };
    } catch (error) {
      throw new AppError("PERSISTENCE_FAILED", "Failed to persist generated image artifacts.", {
        cause: error,
        details: {
          artifactDirectory,
          prompt: result.prompt,
        },
      });
    }
  }
}

function dedupeExactImages(images: DownloadedImage[]): DownloadedImage[] {
  const unique = new Map<string, DownloadedImage>();

  for (const image of images) {
    const key = `${image.mimeType}:${image.base64Data}`;
    if (!unique.has(key)) {
      unique.set(key, image);
    }
  }

  return Array.from(unique.values());
}
