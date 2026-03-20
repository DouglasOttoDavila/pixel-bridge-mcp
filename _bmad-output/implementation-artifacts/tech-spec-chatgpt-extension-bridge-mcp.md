---
title: 'ChatGPT Extension Bridge MCP Migration'
slug: 'chatgpt-extension-bridge-mcp'
created: '2026-03-19T13:30:00-03:00'
status: 'in_progress'
tech_stack:
  - 'Node.js'
  - 'TypeScript'
  - 'Official MCP TypeScript SDK'
  - 'Chrome Extension Manifest V3'
  - 'Localhost WebSocket bridge'
files_to_modify:
  - 'package.json'
  - 'README.md'
  - 'src/index.ts'
  - 'src/server.ts'
  - 'src/config.ts'
  - 'src/types.ts'
  - 'src/errors.ts'
  - 'src/tools/generateImageNewChat.ts'
  - 'src/tools/generateImageWithGpt.ts'
  - 'src/tools/validateBrowserSession.ts'
  - 'src/tools/listMatchingGpts.ts'
  - 'src/tools/shared.ts'
  - 'src/services/sessionBootstrapService.ts'
  - 'src/services/imagePersistence.ts'
  - 'src/services/resultFormatter.ts'
  - 'src/services/runLock.ts'
  - 'src/browser/chatgpt.ts'
  - 'tests/config.test.ts'
  - 'tests/resultFormatter.test.ts'
  - 'tests/validateBrowserSession.test.ts'
  - 'tests/run.ts'
files_to_add:
  - 'src/extensionBridge/server.ts'
  - 'src/extensionBridge/hub.ts'
  - 'src/extensionBridge/protocol.ts'
  - 'src/extensionBridge/sessionRegistry.ts'
  - 'src/extensionBridge/commandRouter.ts'
  - 'src/extensionBridge/token.ts'
  - 'src/extensionBridge/types.ts'
  - 'tests/extensionBridge.test.ts'
  - 'tests/extensionSessionRegistry.test.ts'
  - 'extension/manifest.json'
  - 'extension/package.json'
  - 'extension/tsconfig.json'
  - 'extension/src/background.ts'
  - 'extension/src/content/chatgpt.ts'
  - 'extension/src/shared/protocol.ts'
  - 'extension/src/shared/dom.ts'
  - 'extension/README.md'
files_to_remove:
  - 'src/browser/playwrightBackend.ts'
  - 'src/mcpClients/playwrightClient.ts'
---

# Tech Spec: ChatGPT Extension Bridge MCP Migration

## Goal

Replace direct browser-driver automation with a Chrome-extension-driven execution model that uses the user's real ChatGPT tab while preserving the MCP server as the orchestration and persistence layer.

## Scope

### In Scope

- add a local extension bridge server to the MCP runtime
- add a Manifest V3 Chrome extension
- move ChatGPT page interaction into the extension content script
- keep artifact persistence and MCP tool responses in the Node server
- add active-tab session discovery and selection
- adapt existing MCP tools to the new active-tab architecture

### Out of Scope

- cross-browser support beyond Chrome
- remote/cloud browser support
- automated GPT directory navigation in MVP
- publishing the extension to the Chrome Web Store

## Product-Level Behavior

### User Workflow

1. User starts the MCP server locally.
2. User installs/enables the unpacked extension.
3. User opens ChatGPT or a specific GPT tab manually.
4. Content script connects to the local MCP bridge.
5. User calls MCP tools.
6. MCP server routes commands to the active/selected tab.
7. Extension performs prompt submission and image extraction.
8. MCP server stores artifacts and returns structured results.

## Architecture Changes

### Server Responsibilities

- host MCP tools
- host localhost WebSocket bridge
- keep tab/session registry
- maintain default selected tab
- orchestrate command lifecycle
- persist files and metadata
- format tool results

### Extension Responsibilities

- detect ChatGPT page state
- expose active page metadata
- submit prompts and wait for images
- return image URLs or bytes
- emit progress/error events

## Tool Contract Changes

### Keep Existing Tools

- `validate_browser_session()`
- `generate_image_new_chat(prompt, returnMode?, timeoutMs?)`
- `generate_image_with_gpt(gptName, prompt, returnMode?, timeoutMs?)`

### Add New Tools

- `list_connected_chatgpt_tabs()`
- `select_chatgpt_tab(tabKey)`
- `generate_image_active_tab(prompt, returnMode?, timeoutMs?)`

### Behavioral Change

`generate_image_with_gpt(...)` in MVP should verify that the selected active tab already corresponds to the requested GPT. If not, it should return a structured mismatch error telling the user to open the correct GPT page.

## Bridge Protocol

### Session Registration Payload

```json
{
  "type": "hello",
  "protocolVersion": 1,
  "token": "<local-bridge-token>",
  "payload": {
    "tabUrl": "https://chatgpt.com/g/g-123/my-gpt",
    "pageType": "gpt",
    "pageTitle": "My GPT",
    "gptName": "My GPT",
    "extensionVersion": "0.1.0"
  }
}
```

### Command Payload

```json
{
  "type": "command",
  "commandId": "cmd_123",
  "action": "submit_prompt",
  "payload": {
    "prompt": "A cinematic product render of a ceramic mug",
    "timeoutMs": 240000
  }
}
```

### Result Payload

```json
{
  "type": "result",
  "commandId": "cmd_123",
  "success": true,
  "payload": {
    "images": [
      {
        "mimeType": "image/png",
        "sourceUrl": "https://...",
        "base64Data": "..."
      }
    ]
  }
}
```

## Server Module Design

### `src/extensionBridge/protocol.ts`

- shared message types
- schema validation
- protocol version constants

### `src/extensionBridge/sessionRegistry.ts`

- connected tab registry
- default-tab selection
- stale-session eviction

### `src/extensionBridge/hub.ts`

- socket lifecycle
- command dispatch
- response correlation by `commandId`
- heartbeats and disconnect handling

### `src/extensionBridge/commandRouter.ts`

- per-tool command orchestration helpers
- active-tab enforcement
- timeout wrappers

### `src/extensionBridge/server.ts`

- start/stop WebSocket server
- localhost binding
- token enforcement

### `src/extensionBridge/token.ts`

- generate token on startup
- load/save token from ignored local file if persistence is desired

## Extension Module Design

### `extension/manifest.json`

Needs:

- `manifest_version: 3`
- host permissions for `https://chatgpt.com/*`
- permissions:
  - `tabs`
  - `storage`
  - optionally `downloads`
- background service worker entry
- content script for ChatGPT pages

### `extension/src/content/chatgpt.ts`

Owns:

- bridge connection
- page detection
- command handling
- DOM selectors
- prompt submission
- wait-for-image loop
- image extraction/fetch

### `extension/src/background.ts`

Owns:

- extension lifecycle
- optional tab metadata helpers
- optional download fallback
- popup/options message routing

### `extension/src/shared/dom.ts`

Owns:

- selectors
- page-type classification
- GPT metadata extraction
- prompt composer helpers
- image node extraction helpers

### `extension/src/shared/protocol.ts`

- exact mirror of bridge protocol types used by server

## Error Model

Add or adapt structured errors:

- `EXTENSION_NOT_CONNECTED`
- `NO_ACTIVE_CHATGPT_TAB`
- `ACTIVE_TAB_MISMATCH`
- `PAGE_CONTEXT_INVALID`
- `PROMPT_SUBMISSION_FAILED`
- `IMAGE_NOT_FOUND`
- `BRIDGE_TIMEOUT`

These should map cleanly into `resultFormatter.ts`.

## Implementation Tasks

- [x] Task 1: Add extension bridge runtime to MCP server
- [x] Task 2: Add extension project scaffold and manifest
- [x] Task 3: Implement content-script page context detection
- [x] Task 4: Implement bridge session registration and tab selection
- [x] Task 5: Implement `validate_browser_session` over the extension bridge
- [x] Task 6: Implement `generate_image_active_tab`
- [x] Task 7: Adapt `generate_image_new_chat`
- [x] Task 8: Adapt `generate_image_with_gpt` to active-tab verification mode
- [x] Task 9: Add artifact persistence integration for extension-delivered image payloads
- [x] Task 10: Add docs and local setup instructions

## Acceptance Criteria

- [x] AC 1: With the extension installed and a ChatGPT tab open, `validate_browser_session()` returns a connected/authenticated page status without launching a new browser.
- [x] AC 2: With the extension disconnected, MCP tools return a structured connection error.
- [x] AC 3: `generate_image_active_tab(...)` submits a prompt in the selected ChatGPT tab and saves the resulting artifact locally.
- [x] AC 4: `generate_image_with_gpt(gptName, ...)` fails safely when the active tab is not the requested GPT.
- [x] AC 5: Protected image URLs can still be materialized through in-page fetch and persisted by the MCP server.
- [x] AC 6: The server can enumerate and select among multiple connected ChatGPT tabs.

## Testing Plan

### Unit Tests

- protocol parsing and validation
- session registry selection behavior
- command timeout handling
- MCP result formatting for bridge errors

### Integration Tests

- mocked WebSocket extension session
- server workflow execution without a real browser

### Manual Tests

1. Start MCP server.
2. Load unpacked extension.
3. Open ChatGPT and log in.
4. Verify tab registration.
5. Run `validate_browser_session()`.
6. Run `generate_image_active_tab(...)`.
7. Verify saved images and metadata under `artifacts/generated-images/chatgpt/`.

## Migration Recommendation

Implement this in a new branch and treat it as a controlled architectural migration, not a patch on top of the existing browser-driver runtime.

The cleanest rollout is:

1. introduce the bridge and extension first
2. keep current tools but reroute them to the extension model
3. delete the direct browser backend only after the extension path is stable
