import assert from "node:assert/strict";
import { BackendRouter } from "../src/browser/backendRouter.js";
import { AppError } from "../src/errors.js";
import type { BrowserBackend } from "../src/browser/adapter.js";

function createBackend(
  backend: "vibium" | "playwright",
  options?: {
    failAction?: string;
    retryable?: boolean;
  },
): BrowserBackend {
  const maybeFail = async (action: string) => {
    if (options?.failAction === action) {
      throw new AppError("AUTOMATION_FAILURE", `${backend} failed at ${action}`, {
        retryable: options.retryable,
      });
    }
  };

  return {
    backend,
    async openSession() {
      await maybeFail("openSession");
    },
    async getSessionStatus() {
      await maybeFail("getSessionStatus");
      return { authenticated: true };
    },
    async navigateHome() {
      await maybeFail("navigateHome");
    },
    async startNewChat() {
      await maybeFail("startNewChat");
    },
    async searchGpts() {
      await maybeFail("searchGpts");
      return [{ name: `${backend} GPT` }];
    },
    async selectGpt() {
      await maybeFail("selectGpt");
    },
    async submitPrompt() {
      await maybeFail("submitPrompt");
    },
    async waitForImages() {
      await maybeFail("waitForImages");
      return [{ id: `${backend}-image`, mimeType: "image/png", base64Data: Buffer.from("x").toString("base64") }];
    },
    async downloadImage() {
      await maybeFail("downloadImage");
      return { mimeType: "image/png", base64Data: Buffer.from("x").toString("base64") };
    },
  };
}

export async function runBackendRouterTests(): Promise<void> {
  {
    const router = new BackendRouter(createBackend("vibium"), createBackend("playwright"), true);
    const status = await router.getSessionStatus();

    assert.equal(status.authenticated, true);
    assert.equal(router.getUsageLog()[0]?.backend, "vibium");
  }

  {
    const router = new BackendRouter(
      createBackend("vibium", { failAction: "searchGpts", retryable: true }),
      createBackend("playwright"),
      true,
    );

    const matches = await router.searchGpts("image");
    assert.equal(matches[0]?.name, "playwright GPT");
    assert.equal(router.getUsageLog()[0]?.fellBack, true);
  }

  {
    const router = new BackendRouter(
      createBackend("vibium", { failAction: "searchGpts", retryable: false }),
      createBackend("playwright"),
      true,
    );

    await assert.rejects(() => router.searchGpts("image"), /vibium failed at searchGpts/);
  }

  {
    const router = new BackendRouter(
      createBackend("vibium", { failAction: "downloadImage", retryable: true }),
      createBackend("playwright", { failAction: "downloadImage", retryable: true }),
      true,
    );

    await assert.rejects(
      () => router.downloadImage({ id: "image-1" }),
      /Browser action 'downloadImage' failed on all configured backends./,
    );
  }
}
