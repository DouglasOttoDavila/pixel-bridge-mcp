import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright-core";
import { AppError } from "../errors.js";
import type {
  AppConfig,
  BrowserSessionConfig,
  BrowserSessionStatus,
  DownloadedImage,
  GeneratedImageHandle,
  GptCandidate,
} from "../types.js";
import type { BrowserBackend } from "./adapter.js";
import { looksLikeImageFileName, prepareChromeUserDataDir, resolveProfileLocation } from "./profile.js";
import { sleep, toIsoTimestamp } from "../utils/time.js";

const PROMPT_SELECTORS = [
  "#prompt-textarea",
  "textarea[placeholder*='Message']",
  "div[contenteditable='true']",
];

const SEND_BUTTON_SELECTORS = [
  "button[data-testid*='send']",
  "button[aria-label*='Send']",
];

const SEARCH_INPUT_SELECTORS = [
  "input[type='search']",
  "input[placeholder*='Search']",
  "input[aria-label*='Search']",
];

const BROWSER_LAUNCH_TIMEOUT_MS = 20000;
const PAGE_NAVIGATION_TIMEOUT_MS = 15000;
const IMAGE_STABLE_POLLS_REQUIRED = 3;
const IMAGE_FINALIZATION_GRACE_MS = 10000;
const IMAGE_CONTENT_STABLE_POLLS_REQUIRED = 3;
const IMAGE_CONTENT_POLL_INTERVAL_MS = 2000;
const IMAGE_CONTENT_FINALIZATION_GRACE_MS = 10000;

type ObservedImageHandle = GeneratedImageHandle & {
  width: number;
  height: number;
  messageOrder: number;
  renderedTop: number;
  renderedLeft: number;
  renderedWidth: number;
  renderedHeight: number;
  domOrder: number;
};

export class PlaywrightBrowserBackend implements BrowserBackend {
  public readonly backend = "playwright" as const;
  private context?: BrowserContext;
  private page?: Page;
  private previousImageKeys = new Set<string>();

  public constructor(private readonly config: AppConfig) {}

  public async openSession(sessionConfig: BrowserSessionConfig): Promise<void> {
    const page = await this.ensurePage(true);
    await this.navigateToBaseUrlIfNeeded(page, sessionConfig.baseUrl);
  }

  public async getSessionStatus(): Promise<BrowserSessionStatus> {
    const page = await this.ensurePage();
    await this.navigateToBaseUrlIfNeeded(page, this.config.chatGptBaseUrl);

    return page.evaluate<BrowserSessionStatus, string[]>((selectors) => {
      const loginSelectors = ["a[href*='login']", "button", "a"];
      const isVisible = (element: Element | null | undefined) => Boolean(
        element &&
        ("offsetWidth" in element ? (element as HTMLElement).offsetWidth : 0 ||
          "offsetHeight" in element ? (element as HTMLElement).offsetHeight : 0 ||
          ("getClientRects" in element ? element.getClientRects().length : 0))
      );
      const documentText = (document.body?.innerText || document.documentElement?.innerText || "").toLowerCase();
      const composer = selectors
        .map((selector) => document.querySelector(selector))
        .find((element) => isVisible(element));
      const loginElements = Array.from(document.querySelectorAll(loginSelectors.join(",")));
      const loginVisible = loginElements.some((element) => {
        if (!isVisible(element)) {
          return false;
        }

        const text = (element.textContent || "").toLowerCase();
        return text.includes("log in") || text.includes("sign up");
      });
      const challengeVisible =
        /captcha|verify you are human|checking your browser|cloudflare|press and hold/i.test(documentText) ||
        /challenge|captcha/i.test(location.href);

      return {
        authenticated: Boolean(composer) || (!loginVisible && !challengeVisible && !/auth|login/i.test(location.href)),
        currentUrl: location.href,
        details: challengeVisible
          ? "Captcha or anti-bot challenge is visible."
          : composer
            ? "ChatGPT composer is visible."
            : loginVisible
              ? "Login or signup controls are still visible."
              : "Authentication could not be confirmed from the current DOM.",
      };
    }, PROMPT_SELECTORS);
  }

  public async navigateHome(): Promise<void> {
    const page = await this.ensurePage();
    await this.navigateToBaseUrlIfNeeded(page, this.config.chatGptBaseUrl, true);
  }

  public async startNewChat(): Promise<void> {
    const page = await this.ensurePage();
    const clicked = await page.evaluate(() => {
      const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
      const candidates = Array.from(document.querySelectorAll("button,a,[role='button'],[role='link']"));
      const match = candidates.find((element) => {
        const text = normalize(element.textContent || "");
        const aria = normalize(element.getAttribute("aria-label") || "");
        const testId = normalize(element.getAttribute("data-testid") || "");
        return text === "new chat" || aria === "new chat" || testId.includes("new-chat");
      });
      match?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return Boolean(match);
    });

    if (!clicked) {
      throw new AppError("AUTOMATION_FAILURE", "Unable to locate the ChatGPT new chat control.", {
        retryable: true,
      });
    }

    await page.waitForTimeout(800);
  }

  public async searchGpts(query: string): Promise<GptCandidate[]> {
    const page = await this.ensurePage();
    let candidates = await this.collectVisibleGptCandidates(query);
    if (candidates.length > 0) {
      return candidates;
    }

    await page.goto(new URL("/gpts", this.config.chatGptBaseUrl).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => undefined);
    await this.setSearchQuery(query);
    await page.waitForTimeout(1200);

    candidates = await this.collectVisibleGptCandidates(query);
    return candidates;
  }

  public async selectGpt(candidate: GptCandidate): Promise<void> {
    const page = await this.ensurePage();
    const clicked = await page.evaluate(({ name, id }) => {
      const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
      const targetName = normalize(name);
      const hrefHint = id || "";
      const elements = Array.from(document.querySelectorAll("a,button,[role='link'],[role='option']"));
      const match = elements.find((element) => {
        const text = normalize(element.textContent || "");
        const href = element instanceof HTMLAnchorElement ? element.href : "";
        return text === targetName || (hrefHint ? href.includes(hrefHint) : false);
      });
      match?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return Boolean(match);
    }, { name: candidate.name, id: candidate.id ?? "" });

    if (!clicked) {
      throw new AppError("AUTOMATION_FAILURE", `Unable to click GPT '${candidate.name}'.`, {
        retryable: true,
      });
    }

    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => undefined);
  }

  public async submitPrompt(prompt: string): Promise<void> {
    const page = await this.ensurePage();
    this.previousImageKeys = new Set((await this.collectImageHandles()).map((image) => this.imageKey(image)));

    const typed = await this.typeIntoFirstSelector(PROMPT_SELECTORS, prompt);
    if (!typed) {
      throw new AppError("AUTOMATION_FAILURE", "Unable to locate the ChatGPT composer.", {
        retryable: true,
      });
    }

    const sendClicked = await this.clickFirstSelector(SEND_BUTTON_SELECTORS);
    if (!sendClicked) {
      await page.keyboard.press("Enter");
    }
  }

  public async waitForImages(timeoutMs: number): Promise<GeneratedImageHandle[]> {
    const deadline = Date.now() + timeoutMs;
    let firstObservedAt: number | undefined;
    let lastSignature: string | undefined;
    let stablePollCount = 0;

    while (Date.now() < deadline) {
      const currentImages = await this.collectImageHandles();
      const newImages = this.selectLatestMessageImages(
        currentImages.filter((image) => !this.previousImageKeys.has(this.imageKey(image))),
      );
      if (newImages.length > 0) {
        firstObservedAt ??= Date.now();
        const signature = this.buildImageSignature(newImages);
        if (signature === lastSignature) {
          stablePollCount += 1;
        } else {
          lastSignature = signature;
          stablePollCount = 1;
        }

        const graceElapsed = Date.now() - firstObservedAt >= IMAGE_FINALIZATION_GRACE_MS;
        if (stablePollCount >= IMAGE_STABLE_POLLS_REQUIRED && graceElapsed) {
          return newImages;
        }
      }

      await sleep(2000);
    }

    throw new AppError("GENERATION_TIMEOUT", "Timed out waiting for generated images to appear in ChatGPT.", {
      details: { timeoutMs },
    });
  }

  public async downloadImage(image: GeneratedImageHandle): Promise<DownloadedImage> {
    if (image.base64Data && image.mimeType) {
      return {
        fileName: image.fileName,
        mimeType: image.mimeType,
        base64Data: image.base64Data,
      };
    }

    const sourceUrl = image.sourceUrl;
    if (!sourceUrl) {
      throw new AppError("AUTOMATION_FAILURE", "Generated image did not include a downloadable source URL.", {
        details: image,
      });
    }

    const page = await this.ensurePage();
    const downloaded = await page.evaluate(async ({
      image,
      url,
      stablePollsRequired,
      pollIntervalMs,
      graceMs,
    }) => {
      type BrowserImageHandle = {
        sourceUrl?: string;
        width?: number;
        height?: number;
        messageOrder?: number;
        renderedTop?: number;
        renderedLeft?: number;
        renderedWidth?: number;
        renderedHeight?: number;
        domOrder?: number;
      };

      function computeImageOverlapRatio(left: BrowserImageHandle, right: BrowserImageHandle): number {
        const leftWidth = left.renderedWidth ?? 0;
        const leftHeight = left.renderedHeight ?? 0;
        const rightWidth = right.renderedWidth ?? 0;
        const rightHeight = right.renderedHeight ?? 0;
        const horizontalOverlap = Math.max(
          0,
          Math.min((left.renderedLeft ?? 0) + leftWidth, (right.renderedLeft ?? 0) + rightWidth) -
            Math.max(left.renderedLeft ?? 0, right.renderedLeft ?? 0),
        );
        const verticalOverlap = Math.max(
          0,
          Math.min((left.renderedTop ?? 0) + leftHeight, (right.renderedTop ?? 0) + rightHeight) -
            Math.max(left.renderedTop ?? 0, right.renderedTop ?? 0),
        );
        const overlapArea = horizontalOverlap * verticalOverlap;
        const smallestArea = Math.min(leftWidth * leftHeight, rightWidth * rightHeight);

        if (smallestArea <= 0) {
          return 0;
        }

        return overlapArea / smallestArea;
      }

      function scoreImageCandidateMatch(target: BrowserImageHandle, candidate: BrowserImageHandle): number {
        if ((target.messageOrder ?? 0) > 0 && candidate.messageOrder !== target.messageOrder) {
          return Number.NEGATIVE_INFINITY;
        }

        const overlapRatio = computeImageOverlapRatio(target, candidate);
        const targetCenterX = (target.renderedLeft ?? 0) + (target.renderedWidth ?? 0) / 2;
        const targetCenterY = (target.renderedTop ?? 0) + (target.renderedHeight ?? 0) / 2;
        const candidateCenterX = (candidate.renderedLeft ?? 0) + (candidate.renderedWidth ?? 0) / 2;
        const candidateCenterY = (candidate.renderedTop ?? 0) + (candidate.renderedHeight ?? 0) / 2;
        const centerDistance = Math.hypot(candidateCenterX - targetCenterX, candidateCenterY - targetCenterY);
        const renderedSizeDelta =
          Math.abs((candidate.renderedWidth ?? 0) - (target.renderedWidth ?? 0)) +
          Math.abs((candidate.renderedHeight ?? 0) - (target.renderedHeight ?? 0));

        let score = overlapRatio * 10000;
        if (candidate.sourceUrl === target.sourceUrl) {
          score += 1000;
        }

        if (candidate.width === target.width && candidate.height === target.height) {
          score += 300;
        }

        score -= centerDistance;
        score -= renderedSizeDelta;
        score -= Math.abs((candidate.domOrder ?? 0) - (target.domOrder ?? 0)) * 25;
        return score;
      }

      function selectLatestMessageImages(handles: BrowserImageHandle[]): BrowserImageHandle[] {
        if (handles.length === 0) {
          return [];
        }

        const latestMessageOrder = Math.max(...handles.map((handle) => handle.messageOrder ?? 0));
        return handles.filter((handle) => (handle.messageOrder ?? 0) === latestMessageOrder);
      }

      function isSameVisualSlot(left: BrowserImageHandle, right: BrowserImageHandle): boolean {
        if ((left.messageOrder ?? 0) !== (right.messageOrder ?? 0)) {
          return false;
        }

        return computeImageOverlapRatio(left, right) >= 0.6;
      }

      function selectPreferredImageCandidate(handles: BrowserImageHandle[]): BrowserImageHandle {
        const selected = [...handles].sort((left, right) => {
          const naturalAreaDelta = (right.width ?? 0) * (right.height ?? 0) - (left.width ?? 0) * (left.height ?? 0);
          if (naturalAreaDelta !== 0) {
            return naturalAreaDelta;
          }

          const renderedAreaDelta =
            (right.renderedWidth ?? 0) * (right.renderedHeight ?? 0) -
            (left.renderedWidth ?? 0) * (left.renderedHeight ?? 0);
          if (renderedAreaDelta !== 0) {
            return renderedAreaDelta;
          }

          return (right.domOrder ?? 0) - (left.domOrder ?? 0);
        })[0];

        if (!selected) {
          throw new Error("No image candidate was available for the selected visual slot.");
        }

        return selected;
      }

      function collectImageHandles(): BrowserImageHandle[] {
        const images = Array.from(document.querySelectorAll("main img, article img"));
        const messageContainers = Array.from(document.querySelectorAll([
          "article",
          "[data-message-author-role]",
          "[data-testid*='conversation-turn']",
          "[data-testid*='message']",
        ].join(",")));
        const messageOrderLookup = new Map<Element, number>();
        messageContainers.forEach((element, index) => {
          messageOrderLookup.set(element, index + 1);
        });

        const results: BrowserImageHandle[] = [];

        images.forEach((candidate, index) => {
          if (!(candidate instanceof HTMLImageElement)) {
            return;
          }

          const visible = Boolean(candidate.offsetWidth || candidate.offsetHeight || candidate.getClientRects().length);
          if (!visible) {
            return;
          }

          const width = candidate.naturalWidth || candidate.width;
          const height = candidate.naturalHeight || candidate.height;
          const sourceUrl = candidate.currentSrc || candidate.src;
          if (!candidate.complete || !sourceUrl || width < 200 || height < 200) {
            return;
          }

          const rect = candidate.getBoundingClientRect();
          const messageContainer = candidate.closest([
            "article",
            "[data-message-author-role]",
            "[data-testid*='conversation-turn']",
            "[data-testid*='message']",
          ].join(","));

          results.push({
            sourceUrl,
            width,
            height,
            messageOrder: messageContainer ? (messageOrderLookup.get(messageContainer) ?? 0) : 0,
            renderedTop: rect.top,
            renderedLeft: rect.left,
            renderedWidth: rect.width,
            renderedHeight: rect.height,
            domOrder: index,
          });
        });

        const clusters: BrowserImageHandle[][] = [];
        for (const candidate of results) {
          const cluster = clusters.find((group) => group.some((handle) => isSameVisualSlot(handle, candidate)));
          if (cluster) {
            cluster.push(candidate);
          } else {
            clusters.push([candidate]);
          }
        }

        return clusters
          .map((group) => selectPreferredImageCandidate(group))
          .sort((left, right) => (left.domOrder ?? 0) - (right.domOrder ?? 0));
      }

      function resolveCurrentImageHandle(target: BrowserImageHandle): BrowserImageHandle | undefined {
        const currentHandles = collectImageHandles();
        const sameOrNewerMessageHandles = currentHandles.filter((candidate) =>
          (candidate.messageOrder ?? 0) >= (target.messageOrder ?? 0)
        );
        if (sameOrNewerMessageHandles.length === 0) {
          return undefined;
        }

        const latestMessageHandles = selectLatestMessageImages(sameOrNewerMessageHandles);
        const candidates = latestMessageHandles.length > 0 ? latestMessageHandles : sameOrNewerMessageHandles;

        return [...candidates].sort((left, right) => {
          const scoreDelta = scoreImageCandidateMatch(target, right) - scoreImageCandidateMatch(target, left);
          if (scoreDelta !== 0) {
            return scoreDelta;
          }

          const naturalAreaDelta = (right.width ?? 0) * (right.height ?? 0) - (left.width ?? 0) * (left.height ?? 0);
          if (naturalAreaDelta !== 0) {
            return naturalAreaDelta;
          }

          return (right.domOrder ?? 0) - (left.domOrder ?? 0);
        })[0];
      }

      function captureImageElementAsBase64(handle: {
        sourceUrl?: string;
        width?: number;
        height?: number;
        renderedTop?: number;
        renderedLeft?: number;
        renderedWidth?: number;
        renderedHeight?: number;
      }): { mimeType: string; base64Data: string } | undefined {
        const candidates = Array.from(document.querySelectorAll("main img, article img"));
        const element = candidates.find((candidate) => {
          if (!(candidate instanceof HTMLImageElement)) {
            return false;
          }

          const styleVisible = Boolean(
            candidate.offsetWidth || candidate.offsetHeight || candidate.getClientRects().length,
          );
          if (!styleVisible) {
            return false;
          }

          const width = candidate.naturalWidth || candidate.width;
          const height = candidate.naturalHeight || candidate.height;
          const sourceUrl = candidate.currentSrc || candidate.src;
          if (width !== handle.width || height !== handle.height || sourceUrl !== handle.sourceUrl) {
            return false;
          }

          const rect = candidate.getBoundingClientRect();
          return (
            Math.abs(rect.top - (handle.renderedTop ?? 0)) < 8 &&
            Math.abs(rect.left - (handle.renderedLeft ?? 0)) < 8 &&
            Math.abs(rect.width - (handle.renderedWidth ?? 0)) < 8 &&
            Math.abs(rect.height - (handle.renderedHeight ?? 0)) < 8
          );
        });

        if (!(element instanceof HTMLImageElement)) {
          return undefined;
        }

        try {
          const canvas = document.createElement("canvas");
          canvas.width = handle.width ?? (element.naturalWidth || element.width);
          canvas.height = handle.height ?? (element.naturalHeight || element.height);
          const context = canvas.getContext("2d");
          if (!context) {
            return undefined;
          }

          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/png");
          const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!match?.[1] || !match[2]) {
            return undefined;
          }

          return {
            mimeType: match[1],
            base64Data: match[2],
          };
        } catch {
          return undefined;
        }
      }

      async function fetchImageAsBase64(targetUrl: string): Promise<{ mimeType: string; base64Data: string }> {
        if (targetUrl.startsWith("data:")) {
          const match = targetUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!match) {
            throw new Error("Malformed data URL returned for generated image.");
          }

          return {
            mimeType: match[1] || "image/png",
            base64Data: match[2] || "",
          };
        }

        const response = await fetch(targetUrl, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Image fetch failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (const byte of bytes) {
          binary += String.fromCharCode(byte);
        }

        return {
          mimeType: blob.type || response.headers.get("content-type") || "image/png",
          base64Data: btoa(binary),
        };
      }

      const deadline = Date.now() + graceMs + pollIntervalMs * stablePollsRequired * 2;
      let lastBase64Data: string | undefined;
      let lastMimeType: string | undefined;
      let stablePollCount = 0;
      let firstObservedAt: number | undefined;
      let trackedHandle: BrowserImageHandle = image;

      while (Date.now() < deadline) {
        trackedHandle = resolveCurrentImageHandle(trackedHandle) ?? trackedHandle;
        const currentSourceUrl = trackedHandle.sourceUrl || url;
        const current = captureImageElementAsBase64(trackedHandle) ?? await fetchImageAsBase64(currentSourceUrl);
        firstObservedAt ??= Date.now();

        if (current.base64Data === lastBase64Data && current.mimeType === lastMimeType) {
          stablePollCount += 1;
        } else {
          lastBase64Data = current.base64Data;
          lastMimeType = current.mimeType;
          stablePollCount = 1;
        }

        const graceElapsed = Date.now() - firstObservedAt >= graceMs;
        if (stablePollCount >= stablePollsRequired && graceElapsed) {
          return current;
        }

        await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
      }

      if (!lastBase64Data || !lastMimeType) {
        throw new Error("Timed out waiting for generated image bytes to stabilize.");
      }

      return {
        mimeType: lastMimeType,
        base64Data: lastBase64Data,
      };
    }, {
      image,
      url: sourceUrl,
      stablePollsRequired: IMAGE_CONTENT_STABLE_POLLS_REQUIRED,
      pollIntervalMs: IMAGE_CONTENT_POLL_INTERVAL_MS,
      graceMs: IMAGE_CONTENT_FINALIZATION_GRACE_MS,
    });

    return {
      fileName: image.fileName,
      mimeType: downloaded.mimeType,
      base64Data: downloaded.base64Data,
    };
  }

  private async ensurePage(preferFreshPage = false): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    const launchTarget = await this.resolveLaunchTarget();
    const executablePath = resolveChromeExecutablePath(this.config.browserLaunch.chromeExecutablePath);

    try {
      this.context = await chromium.launchPersistentContext(launchTarget.userDataDir, {
        executablePath,
        headless: this.config.browser.headless,
        timeout: BROWSER_LAUNCH_TIMEOUT_MS,
        viewport: null,
        args: [
          "--no-first-run",
          "--no-default-browser-check",
          ...(launchTarget.profileDirectory ? [`--profile-directory=${launchTarget.profileDirectory}`] : []),
        ],
        ignoreDefaultArgs: ["--enable-automation"],
      });
    } catch (error) {
      throw new AppError("INVALID_CONFIG", "Unable to launch Chrome through Playwright.", {
        cause: error,
        details: {
          executablePath,
          userDataDir: launchTarget.userDataDir,
          profileDirectory: launchTarget.profileDirectory,
        },
      });
    }

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    this.page = this.context.pages().at(-1) ?? await this.context.newPage();
    this.context.on("page", (page) => {
      this.page = page;
    });

    if (preferFreshPage && isBlankPage(this.page)) {
      this.page = await this.context.newPage();
    }

    process.once("exit", () => {
      void this.context?.close();
    });

    return this.page;
  }

  private async navigateToBaseUrlIfNeeded(page: Page, baseUrl: string, force = false): Promise<void> {
    await page.bringToFront().catch(() => undefined);

    if (!force && !shouldNavigateToBaseUrl(page.url(), baseUrl)) {
      await page.waitForLoadState("domcontentloaded", { timeout: PAGE_NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return;
    }

    await page.goto(baseUrl, {
      timeout: PAGE_NAVIGATION_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("domcontentloaded", { timeout: PAGE_NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
  }

  private async resolveLaunchTarget(): Promise<{ userDataDir: string; profileDirectory?: string }> {
    if (this.config.browserLaunch.automationProfilePath) {
      if (!this.config.browserLaunch.cloneAutomationProfile) {
        return resolveProfileLocation(
          this.config.browserLaunch.automationProfilePath,
          this.config.browserLaunch.chromeProfileDirectory,
        );
      }

      return prepareChromeUserDataDir(
        this.config.browserLaunch.automationProfilePath,
        this.config.browserLaunch.chromeProfileDirectory,
        this.config.paths.cwd,
      );
    }

    const userDataDir = path.join(this.config.paths.runtimeHome, ".mcp-chatgpt-chrome", "managed");
    await mkdir(userDataDir, { recursive: true });
    return { userDataDir };
  }

  private async setSearchQuery(query: string): Promise<void> {
    const page = await this.ensurePage();
    for (const selector of SEARCH_INPUT_SELECTORS) {
      const locator = page.locator(selector).first();
      if (!await locator.isVisible().catch(() => false)) {
        continue;
      }

      await locator.fill(query);
      return;
    }

    throw new AppError("AUTOMATION_FAILURE", "Unable to locate the GPT search input.", {
      retryable: true,
    });
  }

  private async collectVisibleGptCandidates(query: string): Promise<GptCandidate[]> {
    const page = await this.ensurePage();
    return page.evaluate<GptCandidate[], string>((rawQuery) => {
      const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
      const normalizedQuery = normalize(rawQuery);
      const results = new Map<string, GptCandidate>();
      const isVisible = (element: Element | null | undefined) => Boolean(
        element &&
        ("offsetWidth" in element ? (element as HTMLElement).offsetWidth : 0 ||
          "offsetHeight" in element ? (element as HTMLElement).offsetHeight : 0 ||
          ("getClientRects" in element ? element.getClientRects().length : 0))
      );

      const elements = Array.from(document.querySelectorAll("a,button,[role='option'],[role='link']"));
      for (const element of elements) {
        if (!isVisible(element)) {
          continue;
        }

        const name = (element.textContent || "").replace(/\s+/g, " ").trim();
        if (!name || name.length < 3 || name.length > 80) {
          continue;
        }

        const href = element instanceof HTMLAnchorElement ? element.href : undefined;
        const inSidebar = Boolean(element.closest("aside,nav,[data-testid*='sidebar']"));
        const nameNormalized = normalize(name);
        const relevant = inSidebar || Boolean(href?.includes("/g/")) || nameNormalized.includes(normalizedQuery);
        if (!relevant) {
          continue;
        }

        const key = href || nameNormalized;
        if (!results.has(key)) {
          results.set(key, { id: href, name });
        }
      }

      return Array.from(results.values());
    }, query);
  }

  private async collectImageHandles(): Promise<ObservedImageHandle[]> {
    const page = await this.ensurePage();
    const handles = await page.evaluate<ObservedImageHandle[]>(() => {
      const images = Array.from(document.querySelectorAll("main img, article img"));
      const messageContainers = Array.from(document.querySelectorAll([
        "article",
        "[data-message-author-role]",
        "[data-testid*='conversation-turn']",
        "[data-testid*='message']",
      ].join(",")));
      const messageOrderLookup = new Map<Element, number>();
      messageContainers.forEach((element, index) => {
        messageOrderLookup.set(element, index + 1);
      });

      const results: ObservedImageHandle[] = [];

      images.forEach((image, index) => {
        const node = image as HTMLImageElement;
        const width = node.naturalWidth || node.width;
        const height = node.naturalHeight || node.height;
        const src = node.currentSrc || node.src;
        if (!node.complete || !src || width < 200 || height < 200) {
          return;
        }

        const rect = node.getBoundingClientRect();
        const messageContainer = node.closest([
          "article",
          "[data-message-author-role]",
          "[data-testid*='conversation-turn']",
          "[data-testid*='message']",
        ].join(","));
        const mimeType = src.startsWith("data:")
          ? (src.match(/^data:([^;]+);/) || [])[1]
          : undefined;
        const base64Data = src.startsWith("data:")
          ? src.split(",")[1]
          : undefined;

        results.push({
          id: src,
          sourceUrl: src,
          mimeType,
          base64Data,
          width,
          height,
          messageOrder: messageContainer ? (messageOrderLookup.get(messageContainer) ?? 0) : 0,
          renderedTop: rect.top,
          renderedLeft: rect.left,
          renderedWidth: rect.width,
          renderedHeight: rect.height,
          domOrder: index,
        });
      });

      return results;
    });

    return this.dedupeImageCandidatesByVisualSlot(handles).map((handle) => ({
      ...handle,
      fileName: handle.fileName ?? looksLikeImageFileName(handle.sourceUrl ?? "") ?? this.buildImageFileName(),
    }));
  }

  private async typeIntoFirstSelector(selectors: string[], text: string): Promise<boolean> {
    const page = await this.ensurePage();
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (!await locator.isVisible().catch(() => false)) {
        continue;
      }

      await locator.click();
      await page.keyboard.press("Control+A").catch(() => undefined);

      const usedFill = await this.tryFillEditable(locator, text);
      if (!usedFill) {
        await page.keyboard.type(text);
      }
      return true;
    }

    return false;
  }

  private async clickFirstSelector(selectors: string[]): Promise<boolean> {
    const page = await this.ensurePage();
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (!await locator.isVisible().catch(() => false)) {
        continue;
      }

      await locator.click();
      return true;
    }

    return false;
  }

  private async tryFillEditable(locator: Locator, text: string): Promise<boolean> {
    return locator.evaluate((element, value) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      return false;
    }, text).catch(() => false);
  }

  private imageKey(image: GeneratedImageHandle): string {
    return image.id ?? image.sourceUrl ?? `${image.fileName}-${image.mimeType}`;
  }

  private buildImageSignature(images: ObservedImageHandle[]): string {
    return images
      .map((image) => `${this.imageKey(image)}::${image.width}x${image.height}`)
      .sort()
      .join("|");
  }

  private selectLatestMessageImages(images: ObservedImageHandle[]): ObservedImageHandle[] {
    if (images.length === 0) {
      return [];
    }

    const latestMessageOrder = Math.max(...images.map((image) => image.messageOrder));
    return images.filter((image) => image.messageOrder === latestMessageOrder);
  }

  private dedupeImageCandidatesByVisualSlot(images: ObservedImageHandle[]): ObservedImageHandle[] {
    const clusters: ObservedImageHandle[][] = [];

    for (const image of images) {
      const cluster = clusters.find((group) => group.some((candidate) => this.isSameVisualSlot(candidate, image)));
      if (cluster) {
        cluster.push(image);
      } else {
        clusters.push([image]);
      }
    }

    return clusters
      .map((group) => this.selectPreferredImageCandidate(group))
      .sort((left, right) => left.domOrder - right.domOrder);
  }

  private selectPreferredImageCandidate(images: ObservedImageHandle[]): ObservedImageHandle {
    const selected = [...images].sort((left, right) => {
      const naturalAreaDelta = right.width * right.height - left.width * left.height;
      if (naturalAreaDelta !== 0) {
        return naturalAreaDelta;
      }

      const renderedAreaDelta =
        right.renderedWidth * right.renderedHeight - left.renderedWidth * left.renderedHeight;
      if (renderedAreaDelta !== 0) {
        return renderedAreaDelta;
      }

      return right.domOrder - left.domOrder;
    })[0];

    if (!selected) {
      throw new AppError("IMAGE_NOT_FOUND", "No image candidate was available for the selected visual slot.");
    }

    return selected;
  }

  private isSameVisualSlot(left: ObservedImageHandle, right: ObservedImageHandle): boolean {
    if (left.messageOrder !== right.messageOrder) {
      return false;
    }

    const horizontalOverlap = Math.max(
      0,
      Math.min(left.renderedLeft + left.renderedWidth, right.renderedLeft + right.renderedWidth) -
        Math.max(left.renderedLeft, right.renderedLeft),
    );
    const verticalOverlap = Math.max(
      0,
      Math.min(left.renderedTop + left.renderedHeight, right.renderedTop + right.renderedHeight) -
        Math.max(left.renderedTop, right.renderedTop),
    );
    const overlapArea = horizontalOverlap * verticalOverlap;
    const smallestArea = Math.min(
      left.renderedWidth * left.renderedHeight,
      right.renderedWidth * right.renderedHeight,
    );

    return smallestArea > 0 && overlapArea / smallestArea >= 0.6;
  }

  private buildImageFileName(): string {
    return `chatgpt-image-${toIsoTimestamp().replace(/[:.]/g, "-")}.png`;
  }
}

export function shouldNavigateToBaseUrl(currentUrl: string | undefined, baseUrl: string): boolean {
  if (!currentUrl || currentUrl === "about:blank") {
    return true;
  }

  try {
    const current = new URL(currentUrl);
    const target = new URL(baseUrl);
    return current.origin !== target.origin;
  } catch {
    return true;
  }
}

function isBlankPage(page: Page | undefined): boolean {
  return !page || page.isClosed() || page.url() === "about:blank";
}

function resolveChromeExecutablePath(explicitPath: string | undefined): string | undefined {
  if (explicitPath) {
    return explicitPath;
  }

  for (const candidate of [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["ProgramFiles(x86)"] &&
      path.join(process.env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  ]) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}
