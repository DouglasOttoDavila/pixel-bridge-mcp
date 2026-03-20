import assert from "node:assert/strict";
import { ExtensionSessionRegistry } from "../src/extensionBridge/sessionRegistry.js";

export async function runExtensionSessionRegistryTests(): Promise<void> {
  const registry = new ExtensionSessionRegistry();
  const first = registry.register({} as never, {
    tabUrl: "https://chatgpt.com/",
    pageType: "chat",
    authenticated: true,
  });
  const second = registry.register({} as never, {
    tabUrl: "https://chatgpt.com/g/g-1234",
    pageType: "gpt",
    gptName: "Image GPT",
    authenticated: true,
  });

  assert.equal(registry.list().length, 2);
  assert.equal(registry.getSelected()?.sessionId, first.sessionId);

  const selected = registry.selectByTabKey(second.tabKey);
  assert.equal(selected?.sessionId, second.sessionId);
  assert.equal(registry.getSelected()?.tabKey, second.tabKey);

  registry.remove(second.sessionId);
  assert.equal(registry.list().length, 1);
  assert.equal(registry.getSelected()?.sessionId, first.sessionId);
}
