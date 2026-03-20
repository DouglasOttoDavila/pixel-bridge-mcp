import type {
  BackendUsageEntry,
  BrowserSessionConfig,
  BrowserSessionStatus,
  DownloadedImage,
  GeneratedImageHandle,
  GptCandidate,
} from "../types.js";

export interface BrowserBackend {
  readonly backend: "vibium" | "playwright";
  openSession(config: BrowserSessionConfig): Promise<void>;
  getSessionStatus(): Promise<BrowserSessionStatus>;
  navigateHome(): Promise<void>;
  startNewChat(): Promise<void>;
  searchGpts(query: string): Promise<GptCandidate[]>;
  selectGpt(candidate: GptCandidate): Promise<void>;
  submitPrompt(prompt: string): Promise<void>;
  waitForImages(timeoutMs: number): Promise<GeneratedImageHandle[]>;
  downloadImage(image: GeneratedImageHandle): Promise<DownloadedImage>;
}

export interface BrowserAdapter {
  getUsageLog(): BackendUsageEntry[];
  openSession(config: BrowserSessionConfig): Promise<void>;
  getSessionStatus(): Promise<BrowserSessionStatus>;
  navigateHome(): Promise<void>;
  startNewChat(): Promise<void>;
  searchGpts(query: string): Promise<GptCandidate[]>;
  selectGpt(candidate: GptCandidate): Promise<void>;
  submitPrompt(prompt: string): Promise<void>;
  waitForImages(timeoutMs: number): Promise<GeneratedImageHandle[]>;
  downloadImage(image: GeneratedImageHandle): Promise<DownloadedImage>;
}
