import { areVersionsCompatible, type HandshakePayload, type HelloAckMessage } from "../shared/protocol.js";
import { buildHandshakeUrl, readBridgeSettings } from "../shared/settings.js";

const CONTEXT_PUSH_INTERVAL_MS = 10000;
const COMMAND_RETRY_DELAY_MS = 3000;
const GENERATION_POLL_INTERVAL_MS = 2000;
const IMAGE_STABLE_POLLS_REQUIRED = 3;
const IMAGE_FINALIZATION_GRACE_MS = 10000;
const IMAGE_CONTENT_STABLE_POLLS_REQUIRED = 3;
const IMAGE_CONTENT_POLL_INTERVAL_MS = 2000;
const IMAGE_CONTENT_FINALIZATION_GRACE_MS = 10000;
const BRIDGE_PROTOCOL_VERSION = 1;
const PROMPT_SELECTORS = [
  "#prompt-textarea",
  "textarea[placeholder*='Message']",
  "textarea[placeholder*='Ask']",
  "div[contenteditable='true']",
];
const SEND_BUTTON_SELECTORS = [
  "button[data-testid*='send']",
  "button[aria-label*='Send']",
  "button[aria-label*='Create']",
];
const MESSAGE_CONTAINER_SELECTORS = [
  "article",
  "[data-message-author-role]",
  "[data-testid*='conversation-turn']",
  "[data-testid*='message']",
];
const GPT_HEADER_SELECTORS = [
  "header h1",
  "[data-testid*='conversation-title']",
  "main h1",
];

type PageType = "chat" | "gpt" | "login" | "challenge" | "unknown";

interface PageContextPayload {
  tabUrl: string;
  pageType: PageType;
  pageTitle?: string;
  gptName?: string;
  authenticated?: boolean;
  details?: string;
}

interface GenerateImageCommandPayload {
  prompt: string;
  timeoutMs: number;
  startNewChat?: boolean;
}

interface BridgeGeneratedImage {
  fileName?: string;
  mimeType: string;
  base64Data: string;
  sourceUrl?: string;
}

interface ServerCommand {
  type: "command";
  commandId: string;
  action: "validate_session" | "generate_image";
  payload: Record<string, unknown>;
}

interface ResultMessage {
  type: "result";
  commandId: string;
  success: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

type ImageHandle = {
  id: string;
  sourceUrl: string;
  fileName?: string;
  width: number;
  height: number;
  messageOrder: number;
  renderedTop: number;
  renderedLeft: number;
  renderedWidth: number;
  renderedHeight: number;
  domOrder: number;
};

let socket: WebSocket | undefined;

void connect();

async function connect(): Promise<void> {
  const settings = await readBridgeSettings();
  if (!settings.bridgeEnabled) {
    return;
  }

  try {
    const handshake = await fetchHandshake(settings);
    if (!areVersionsCompatible(handshake.expectedExtensionVersion, chrome.runtime.getManifest().version)) {
      throw new Error(
        `Server expects extension ${handshake.expectedExtensionVersion} but installed version is ${chrome.runtime.getManifest().version}.`,
      );
    }

    socket = new WebSocket(handshake.wsUrl);
    socket.addEventListener("open", () => {
      const hello = {
        type: "hello",
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        token: handshake.token,
        payload: {
          ...detectPageContext(),
          extensionVersion: chrome.runtime.getManifest().version,
        },
      };
      socket?.send(JSON.stringify(hello));
    });
    socket.addEventListener("message", (event) => {
      void handleMessage(event.data);
    });
    socket.addEventListener("close", () => {
      window.setTimeout(() => {
        void connect();
      }, COMMAND_RETRY_DELAY_MS);
    });

    window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "context_update",
          payload: detectPageContext(),
        }));
      }
    }, CONTEXT_PUSH_INTERVAL_MS);
  } catch {
    window.setTimeout(() => {
      void connect();
    }, COMMAND_RETRY_DELAY_MS + 2000);
  }
}

async function handleMessage(raw: string): Promise<void> {
  const message = JSON.parse(raw) as ServerCommand | HelloAckMessage;
  if (message.type === "hello_ack") {
    if (!areVersionsCompatible(message.expectedExtensionVersion, chrome.runtime.getManifest().version)) {
      socket?.close(4003, "Extension version mismatch");
    }
    return;
  }

  if (message.type !== "command") {
    return;
  }

  if (message.action === "validate_session") {
    return respond({
      type: "result",
      commandId: message.commandId,
      success: true,
      payload: detectPageContext(),
    });
  }

  if (message.action === "generate_image") {
    try {
      const payload = parseGenerateImagePayload(message.payload);
      const images = await generateImages(payload);
      return respond({
        type: "result",
        commandId: message.commandId,
        success: true,
        payload: { images },
      });
    } catch (error) {
      return respond({
        type: "result",
        commandId: message.commandId,
        success: false,
        error: {
          code: error instanceof BridgeCommandError ? error.code : "AUTOMATION_FAILURE",
          message: error instanceof Error ? error.message : "Unknown extension automation failure.",
        },
      });
    }
  }
}

function parseGenerateImagePayload(payload: Record<string, unknown>): GenerateImageCommandPayload {
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const timeoutMs = typeof payload.timeoutMs === "number" ? payload.timeoutMs : 0;
  const startNewChat = payload.startNewChat === true;

  if (!prompt) {
    throw new BridgeCommandError("PROMPT_SUBMISSION_FAILED", "Prompt text is required.");
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new BridgeCommandError("AUTOMATION_FAILURE", "A positive timeout is required for generation.");
  }

  return {
    prompt,
    timeoutMs,
    startNewChat,
  };
}

async function generateImages(payload: GenerateImageCommandPayload): Promise<BridgeGeneratedImage[]> {
  const context = detectPageContext();
  if (!context.authenticated) {
    throw new BridgeCommandError("UNAUTHENTICATED_SESSION", "The selected ChatGPT tab is not authenticated.");
  }

  if (payload.startNewChat) {
    await startNewChat();
  }

  const previousImageIds = new Set(collectImageHandles().map((image) => image.id));
  await submitPrompt(payload.prompt);
  const newImages = await waitForNewImages(previousImageIds, payload.timeoutMs);
  const contentDeadline = Date.now() + payload.timeoutMs;

  return Promise.all(newImages.map((image) => materializeStableImage(image, contentDeadline)));
}

async function startNewChat(): Promise<void> {
  const clicked = clickFirstElementByMatcher(
    Array.from(document.querySelectorAll("button,a,[role='button'],[role='link']")),
    (element) => {
      const text = normalizeText(element.textContent || "");
      const aria = normalizeText(element.getAttribute("aria-label") || "");
      const testId = normalizeText(element.getAttribute("data-testid") || "");
      return text === "new chat" || aria === "new chat" || testId.includes("new-chat");
    },
  );

  if (!clicked) {
    throw new BridgeCommandError("AUTOMATION_FAILURE", "Unable to locate the ChatGPT new chat control.");
  }

  await sleep(800);
  await waitForComposer(10000);
}

async function submitPrompt(prompt: string): Promise<void> {
  const composer = await waitForComposer(10000);
  const written = writeComposerValue(composer, prompt);
  if (!written) {
    throw new BridgeCommandError("PROMPT_SUBMISSION_FAILED", "Unable to type into the ChatGPT composer.");
  }

  await sleep(100);

  const sendClicked = clickFirstVisibleSelector(SEND_BUTTON_SELECTORS);
  if (!sendClicked) {
    composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    composer.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
  }
}

async function waitForNewImages(previousImageIds: Set<string>, timeoutMs: number): Promise<ImageHandle[]> {
  const deadline = Date.now() + timeoutMs;
  let firstObservedAt: number | undefined;
  let lastSignature: string | undefined;
  let stablePollCount = 0;

  while (Date.now() < deadline) {
    const currentImages = collectImageHandles();
    const newImages = selectLatestMessageImages(
      currentImages.filter((image) => !previousImageIds.has(image.id)),
    );
    if (newImages.length > 0) {
      firstObservedAt ??= Date.now();
      const signature = buildImageSignature(newImages);
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

    await sleep(GENERATION_POLL_INTERVAL_MS);
  }

  throw new BridgeCommandError("GENERATION_TIMEOUT", "Timed out waiting for generated images to appear.");
}

function collectImageHandles(): ImageHandle[] {
  const images = Array.from(document.querySelectorAll("main img, article img"));
  const messageContainers = Array.from(document.querySelectorAll(MESSAGE_CONTAINER_SELECTORS.join(",")));
  const messageOrderLookup = new Map<Element, number>();

  messageContainers.forEach((element, index) => {
    messageOrderLookup.set(element, index + 1);
  });

  const candidates: ImageHandle[] = [];

  images.forEach((node, index) => {
    if (!(node instanceof HTMLImageElement) || !isVisible(node)) {
      return;
    }

    const width = node.naturalWidth || node.width;
    const height = node.naturalHeight || node.height;
    const sourceUrl = node.currentSrc || node.src;
    if (!node.complete || !sourceUrl || width < 200 || height < 200) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const messageContainer = findMessageContainer(node);
    const id = `${sourceUrl}::${width}x${height}`;
    candidates.push({
      id,
      sourceUrl,
      fileName: buildImageFileName(sourceUrl),
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

  return dedupeImageCandidatesByVisualSlot(candidates);
}

function buildImageSignature(images: ImageHandle[]): string {
  return images
    .map((image) => `${image.id}::${image.width}x${image.height}`)
    .sort()
    .join("|");
}

function selectLatestMessageImages(images: ImageHandle[]): ImageHandle[] {
  if (images.length === 0) {
    return [];
  }

  const latestMessageOrder = Math.max(...images.map((image) => image.messageOrder));
  return images.filter((image) => image.messageOrder === latestMessageOrder);
}

function dedupeImageCandidatesByVisualSlot(candidates: ImageHandle[]): ImageHandle[] {
  const clusters: ImageHandle[][] = [];

  for (const candidate of candidates) {
    const cluster = clusters.find((group) => group.some((image) => isSameVisualSlot(image, candidate)));
    if (cluster) {
      cluster.push(candidate);
    } else {
      clusters.push([candidate]);
    }
  }

  return clusters
    .map((group) => selectPreferredImageCandidate(group))
    .sort((left, right) => left.domOrder - right.domOrder);
}

function selectPreferredImageCandidate(candidates: ImageHandle[]): ImageHandle {
  const selected = [...candidates].sort((left, right) => {
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
    throw new BridgeCommandError("IMAGE_NOT_FOUND", "No image candidate was available for the selected visual slot.");
  }

  return selected;
}

function isSameVisualSlot(left: ImageHandle, right: ImageHandle): boolean {
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

function findMessageContainer(node: Element): Element | null {
  return node.closest(MESSAGE_CONTAINER_SELECTORS.join(","));
}

function findMatchingImageElement(image: ImageHandle): HTMLImageElement | undefined {
  const candidates = Array.from(document.querySelectorAll("main img, article img"));

  return candidates.find((candidate) => {
    if (!(candidate instanceof HTMLImageElement) || !isVisible(candidate)) {
      return false;
    }

    const width = candidate.naturalWidth || candidate.width;
    const height = candidate.naturalHeight || candidate.height;
    const sourceUrl = candidate.currentSrc || candidate.src;
    if (width !== image.width || height !== image.height || sourceUrl !== image.sourceUrl) {
      return false;
    }

    const rect = candidate.getBoundingClientRect();
    return (
      Math.abs(rect.top - image.renderedTop) < 8 &&
      Math.abs(rect.left - image.renderedLeft) < 8 &&
      Math.abs(rect.width - image.renderedWidth) < 8 &&
      Math.abs(rect.height - image.renderedHeight) < 8
    );
  }) as HTMLImageElement | undefined;
}

function resolveCurrentImageHandle(image: ImageHandle): ImageHandle | undefined {
  const currentImages = collectImageHandles();
  const sameOrNewerMessageImages = currentImages.filter((candidate) => candidate.messageOrder >= image.messageOrder);
  if (sameOrNewerMessageImages.length === 0) {
    return undefined;
  }

  const latestMessageImages = selectLatestMessageImages(sameOrNewerMessageImages);
  const candidates = latestMessageImages.length > 0 ? latestMessageImages : sameOrNewerMessageImages;

  const selected = [...candidates].sort((left, right) => {
    const scoreDelta = scoreImageCandidateMatch(image, right) - scoreImageCandidateMatch(image, left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const naturalAreaDelta = right.width * right.height - left.width * left.height;
    if (naturalAreaDelta !== 0) {
      return naturalAreaDelta;
    }

    return right.domOrder - left.domOrder;
  })[0];

  return selected;
}

function scoreImageCandidateMatch(target: ImageHandle, candidate: ImageHandle): number {
  if (target.messageOrder > 0 && candidate.messageOrder !== target.messageOrder) {
    return Number.NEGATIVE_INFINITY;
  }

  const overlapRatio = computeImageOverlapRatio(target, candidate);
  const targetCenterX = target.renderedLeft + target.renderedWidth / 2;
  const targetCenterY = target.renderedTop + target.renderedHeight / 2;
  const candidateCenterX = candidate.renderedLeft + candidate.renderedWidth / 2;
  const candidateCenterY = candidate.renderedTop + candidate.renderedHeight / 2;
  const centerDistance = Math.hypot(candidateCenterX - targetCenterX, candidateCenterY - targetCenterY);
  const renderedSizeDelta =
    Math.abs(candidate.renderedWidth - target.renderedWidth) +
    Math.abs(candidate.renderedHeight - target.renderedHeight);

  let score = overlapRatio * 10000;
  if (candidate.sourceUrl === target.sourceUrl) {
    score += 1000;
  }

  if (candidate.width === target.width && candidate.height === target.height) {
    score += 300;
  }

  score -= centerDistance;
  score -= renderedSizeDelta;
  score -= Math.abs(candidate.domOrder - target.domOrder) * 25;
  return score;
}

function computeImageOverlapRatio(left: ImageHandle, right: ImageHandle): number {
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

  if (smallestArea <= 0) {
    return 0;
  }

  return overlapArea / smallestArea;
}

async function materializeStableImage(
  image: ImageHandle,
  deadline: number,
): Promise<BridgeGeneratedImage> {
  let trackedImage = image;
  let lastBase64Data: string | undefined;
  let lastMimeType: string | undefined;
  let stablePollCount = 0;
  let firstObservedAt: number | undefined;

  while (Date.now() < deadline) {
    trackedImage = resolveCurrentImageHandle(trackedImage) ?? trackedImage;
    const current = await captureRenderedImageAsBase64(trackedImage);
    firstObservedAt ??= Date.now();

    if (current.base64Data === lastBase64Data && current.mimeType === lastMimeType) {
      stablePollCount += 1;
    } else {
      lastBase64Data = current.base64Data;
      lastMimeType = current.mimeType;
      stablePollCount = 1;
    }

    const graceElapsed = Date.now() - firstObservedAt >= IMAGE_CONTENT_FINALIZATION_GRACE_MS;
    if (stablePollCount >= IMAGE_CONTENT_STABLE_POLLS_REQUIRED && graceElapsed) {
      return {
        fileName: trackedImage.fileName ?? image.fileName,
        mimeType: current.mimeType,
        base64Data: current.base64Data,
        sourceUrl: trackedImage.sourceUrl,
      };
    }

    await sleep(IMAGE_CONTENT_POLL_INTERVAL_MS);
  }

  if (!lastBase64Data || !lastMimeType) {
    throw new BridgeCommandError("IMAGE_NOT_FOUND", "Timed out waiting for generated image bytes to stabilize.");
  }

  return {
    fileName: trackedImage.fileName ?? image.fileName,
    mimeType: lastMimeType,
    base64Data: lastBase64Data,
    sourceUrl: trackedImage.sourceUrl,
  };
}

async function captureRenderedImageAsBase64(
  image: ImageHandle,
): Promise<{ mimeType: string; base64Data: string }> {
  const rendered = captureImageElementAsBase64(image);
  if (rendered) {
    return rendered;
  }

  return fetchImageAsBase64(image.sourceUrl);
}

function captureImageElementAsBase64(
  image: ImageHandle,
): { mimeType: string; base64Data: string } | undefined {
  const element = findMatchingImageElement(image);
  if (!element) {
    return undefined;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
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

async function fetchImageAsBase64(sourceUrl: string): Promise<{ mimeType: string; base64Data: string }> {
  if (sourceUrl.startsWith("data:")) {
    const match = sourceUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match?.[1] || !match[2]) {
      throw new BridgeCommandError("IMAGE_NOT_FOUND", "Malformed data URL returned for generated image.");
    }

    return {
      mimeType: match[1],
      base64Data: match[2],
    };
  }

  const response = await fetch(sourceUrl, { credentials: "include" });
  if (!response.ok) {
    throw new BridgeCommandError(
      "IMAGE_NOT_FOUND",
      `Image fetch failed with status ${response.status}.`,
    );
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

async function waitForComposer(timeoutMs: number): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const composer = findComposer();
    if (composer) {
      return composer;
    }

    await sleep(250);
  }

  throw new BridgeCommandError("PROMPT_SUBMISSION_FAILED", "Unable to locate the ChatGPT composer.");
}

function findComposer(): HTMLElement | undefined {
  for (const selector of PROMPT_SELECTORS) {
    const candidate = document.querySelector(selector);
    if (candidate instanceof HTMLElement && isVisible(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function writeComposerValue(composer: HTMLElement, prompt: string): boolean {
  composer.focus();

  if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
    composer.value = prompt;
    composer.dispatchEvent(new Event("input", { bubbles: true }));
    composer.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (composer.isContentEditable) {
    composer.textContent = "";
    document.getSelection()?.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    document.getSelection()?.addRange(range);

    if (document.execCommand("insertText", false, prompt)) {
      return true;
    }

    composer.textContent = prompt;
    composer.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: prompt,
    }));
    return true;
  }

  return false;
}

function clickFirstVisibleSelector(selectors: string[]): boolean {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement && isVisible(element) && !element.hasAttribute("disabled")) {
      element.click();
      return true;
    }
  }

  return false;
}

function clickFirstElementByMatcher(
  elements: Element[],
  matcher: (element: Element) => boolean,
): boolean {
  for (const element of elements) {
    if (!(element instanceof HTMLElement) || !isVisible(element)) {
      continue;
    }

    if (!matcher(element)) {
      continue;
    }

    element.click();
    return true;
  }

  return false;
}

function respond(message: ResultMessage): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

async function fetchHandshake(
  settings: Awaited<ReturnType<typeof readBridgeSettings>>,
): Promise<HandshakePayload> {
  const response = await fetch(buildHandshakeUrl(settings));
  if (!response.ok) {
    throw new Error(`Handshake failed with status ${response.status}`);
  }

  return response.json() as Promise<HandshakePayload>;
}

function detectPageContext(): PageContextPayload {
  const currentUrl = window.location.href;
  const pageTitle = document.title || undefined;
  const composerVisible = PROMPT_SELECTORS.some((selector) => isVisible(document.querySelector(selector)));
  const loginVisible = Array.from(document.querySelectorAll("a,button")).some((element) => {
    if (!isVisible(element)) {
      return false;
    }

    const content = normalizeText(element.textContent || "");
    return content.includes("log in") || content.includes("sign up");
  });
  const challengeVisible = detectChallengeVisible(currentUrl, composerVisible);
  const gptName = detectGptName(currentUrl);

  return {
    tabUrl: currentUrl,
    pageType: detectPageType(currentUrl, loginVisible, challengeVisible),
    pageTitle,
    gptName,
    authenticated: composerVisible || (!loginVisible && !challengeVisible),
    details: challengeVisible
      ? "Captcha or anti-bot challenge is visible."
      : composerVisible
        ? "ChatGPT composer is visible."
        : loginVisible
          ? "Login or signup controls are still visible."
          : "Authentication could not be confirmed from the current DOM.",
  };
}

function detectPageType(
  currentUrl: string,
  loginVisible: boolean,
  challengeVisible: boolean,
): PageType {
  if (challengeVisible) {
    return "challenge";
  }

  if (loginVisible || /auth|login/i.test(currentUrl)) {
    return "login";
  }

  if (/\/g\/g-/i.test(currentUrl)) {
    return "gpt";
  }

  if (/chatgpt\.com/i.test(currentUrl)) {
    return "chat";
  }

  return "unknown";
}

function detectGptName(currentUrl: string): string | undefined {
  if (!/\/g\/g-/i.test(currentUrl)) {
    return undefined;
  }

  for (const selector of GPT_HEADER_SELECTORS) {
    const candidate = document.querySelector(selector);
    const text = normalizeText(candidate?.textContent || "");
    if (text && !looksGenericChatHeading(text)) {
      return text;
    }
  }

  return undefined;
}

function detectChallengeVisible(currentUrl: string, composerVisible: boolean): boolean {
  if (composerVisible) {
    return false;
  }

  if (/challenge|captcha/i.test(currentUrl)) {
    return true;
  }

  const challengeFrame = document.querySelector(
    "iframe[src*='captcha'], iframe[src*='challenge'], iframe[src*='cloudflare'], iframe[title*='challenge' i]",
  );
  if (isVisible(challengeFrame)) {
    return true;
  }

  const mainText = [
    document.querySelector("main")?.textContent || "",
    document.querySelector("[role='main']")?.textContent || "",
    document.querySelector("[role='dialog']")?.textContent || "",
  ]
    .join(" ")
    .toLowerCase();

  return /verify you are human|checking your browser|cloudflare|press and hold|complete the security check/i.test(mainText);
}

function looksGenericChatHeading(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized === "what's on your mind today?" || normalized === "where should we begin?";
}

function buildImageFileName(sourceUrl: string): string {
  const fromUrl = sourceUrl.match(/\/([^/?#]+\.(png|jpg|jpeg|webp|gif))(?:[?#]|$)/i)?.[1];
  if (fromUrl) {
    return fromUrl;
  }

  return `chatgpt-image-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isVisible(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

class BridgeCommandError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BridgeCommandError";
  }
}
