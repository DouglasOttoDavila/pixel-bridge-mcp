import { PlaywrightBrowserBackend } from "../browser/playwrightBackend.js";
import type { AppConfig } from "../types.js";

export function createPlaywrightClient(config: AppConfig): PlaywrightBrowserBackend {
  return new PlaywrightBrowserBackend(config);
}
