import type { AppConfig, SessionBootstrapDiagnostic } from "../types.js";

export class SessionBootstrapService {
  public inspect(config: AppConfig): SessionBootstrapDiagnostic {
    const messages: string[] = [];
    const checklist = config.browserLaunch.automationProfilePath
      ? [
          "Set CHATGPT_AUTOMATION_PROFILE_PATH to your Chrome user-data root or a specific profile folder.",
          "Set CHATGPT_CHROME_PROFILE_DIRECTORY only when CHATGPT_AUTOMATION_PROFILE_PATH points to the user-data root.",
          "Set CHATGPT_CHROME_EXECUTABLE_PATH if Chrome is not in the default install location.",
          config.browserLaunch.cloneAutomationProfile
            ? "Run validate_browser_session() to launch a cloned automation profile under .mcp-chatgpt-chrome/."
            : "Close all Chrome windows using that profile before running validate_browser_session() with the live profile.",
        ]
      : [
          "Optionally set CHATGPT_AUTOMATION_PROFILE_PATH to reuse an existing logged-in Chrome profile.",
          "If no profile path is set, validate_browser_session() will open a dedicated automation profile under .mcp-chatgpt-chrome/managed/.",
          "Set CHATGPT_CHROME_EXECUTABLE_PATH if Chrome is not in the default install location.",
          "Run validate_browser_session() and sign into ChatGPT in the opened browser window if needed.",
        ];

    messages.push("Configuration looks structurally valid.");
    if (config.browserLaunch.automationProfilePath) {
      messages.push(
        config.browserLaunch.cloneAutomationProfile
          ? "The server will launch Chrome directly from a cloned copy of the configured profile."
          : "The server will launch Chrome directly against the configured live profile path.",
      );
    } else {
      messages.push("The server will launch Chrome directly with a dedicated automation profile.");
    }

    return {
      status: "ready",
      messages,
      checklist,
    };
  }
}
