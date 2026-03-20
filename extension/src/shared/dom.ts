import type { PageContextPayload, PageType } from "./protocol.js";

const PROMPT_SELECTORS = [
  "#prompt-textarea",
  "textarea[placeholder*='Message']",
  "textarea[placeholder*='Ask']",
  "div[contenteditable='true']",
];
const GPT_HEADER_SELECTORS = [
  "header h1",
  "[data-testid*='conversation-title']",
  "main h1",
];

export function detectPageContext(): PageContextPayload {
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

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isVisible(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}
