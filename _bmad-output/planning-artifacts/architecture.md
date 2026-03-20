---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - D:\GitHub\image-generation-mcp-server\_bmad-output\implementation-artifacts\tech-spec-chatgpt-browser-image-generation-mcp-server.md
  - D:\GitHub\image-generation-mcp-server\README.md
workflowType: 'architecture'
project_name: 'image-generation-mcp-server'
user_name: 'Doug'
date: '2026-03-19T13:30:00-03:00'
---

# Architecture Decision Document

## Executive Summary

The current project should move from browser-driver automation toward a hybrid architecture built around a locally installed Chrome extension that operates inside the user's real ChatGPT session, while the MCP server remains the orchestration, persistence, and tool-facing layer.

This architecture is intended to solve the problems seen in the current implementation:

- fragile profile cloning and login reuse
- captcha / anti-bot friction from external automation
- instability around ChromeDriver / Playwright / remote attach strategies
- mismatch between "user opens the target GPT page manually" and the current server-driven browser model

The recommended target architecture is:

1. Keep the Node/TypeScript MCP server as the local control plane.
2. Add a Chrome extension as an in-browser execution agent.
3. Add a localhost bridge in the MCP server that extension clients connect to over WebSocket.
4. Move ChatGPT DOM automation into the extension content script.
5. Keep artifact persistence, metadata, return-mode shaping, and MCP tools in the server.

## Problem and Drivers

### Current Pain

- Browser automation is fighting the browser instead of using the user's real logged-in session.
- The system is trying to simulate user state from outside the browser process.
- ChatGPT's anti-bot behavior is more likely to trigger when automation is launched externally.
- The most reliable user flow is already manual: user opens ChatGPT, logs in, and selects the target GPT.

### Architectural Drivers

- Reliability over cleverness.
- Real-session reuse without storing credentials.
- Minimal anti-bot surface.
- Local-only execution.
- Clear failure modes and auditable artifacts.
- Preserve the MCP server as the stable integration surface.

## Recommended Target Architecture

## System Context

```text
MCP Client
   |
   v
Local MCP Server (Node/TypeScript)
   |
   +--> MCP Tools / Workflows / Persistence / Metadata / Local Bridge
             |
             v
       Localhost WebSocket Bridge
             ^
             |
Chrome Extension
   |
   +--> Background Service Worker
   +--> Content Script running inside chatgpt.com tab
   +--> Optional popup/options UI
             |
             v
Real ChatGPT page in the user's existing Chrome session
```

## Core Components

### 1. MCP Server

The MCP server remains the public tool surface. It owns:

- tool registration
- command orchestration
- active-tab selection state
- timeout and retry policy
- artifact persistence
- metadata generation
- final structured MCP responses
- local WebSocket bridge for extension clients

It should stop trying to directly drive browser DOM elements.

### 2. Extension Bridge Server

Add a local bridge inside the MCP server process, preferably WebSocket-first.

Responsibilities:

- accept connections from installed extension content scripts
- authenticate extension sessions with a shared local token
- track connected ChatGPT tabs
- route MCP commands to the correct tab session
- stream progress / result / error messages back to workflows

Why WebSocket:

- simple full-duplex messaging
- good fit for long-running prompt -> wait -> image-ready flows
- no polling complexity
- natural place for heartbeats, command correlation, and progress events

### 3. Content Script

The content script becomes the actual ChatGPT page operator.

Responsibilities:

- connect to the local bridge when on `https://chatgpt.com/*`
- inspect current page context
- detect authentication state
- determine whether the current page is the general ChatGPT chat or a specific GPT page
- fill the prompt composer
- submit prompts
- wait for image generation
- extract image URLs or fetch image bytes in-page
- return DOM diagnostics and progress events

This is the most important architectural move. The automation now runs in the browser context that already owns the user's session.

### 4. Background Service Worker

Use the background worker for extension lifecycle concerns, not for the main automation flow.

Responsibilities:

- extension startup and health
- optional popup interactions
- optional tab discovery helpers
- optional download fallback via `chrome.downloads`
- forwarding tab metadata to the MCP bridge when needed

The content script should remain the primary execution agent because it stays anchored to the live ChatGPT tab, whereas MV3 service workers are transient.

### 5. Optional Popup / Options UI

Recommended but not required for MVP.

Useful functions:

- display bridge connection state
- show active registered ChatGPT tabs
- allow selecting a "default tab"
- expose the local bridge URL/token status
- show recent command errors

## Key Architectural Decisions

### AD-001: Use the Browser Extension as the Page Automation Agent

Decision:

- Move ChatGPT interaction from Playwright/Vibium into a content script.

Reason:

- lowest friction path to reusing the real authenticated session
- avoids remote-control attach complexity
- reduces anti-bot risk relative to external browser automation

Consequence:

- DOM brittleness still exists, but session reliability improves significantly

### AD-002: Keep MCP Server as Orchestrator, Not Page Driver

Decision:

- Preserve MCP tools, workflow orchestration, result formatting, and persistence in the local server.

Reason:

- extension is poor at artifact management and external integration
- MCP server is already the right boundary for durable outputs and structured errors

### AD-003: Use Localhost WebSocket as the Server <-> Extension Transport

Decision:

- Content scripts connect to `ws://127.0.0.1:<port>` exposed by the local MCP server.

Reason:

- simpler than Native Messaging for this repo
- avoids browser-specific packaging complexity
- supports streaming progress and command correlation

Security consequence:

- must authenticate the extension session with a shared local token and an allowlist of origin/shape checks

### AD-004: Make "Active GPT Tab" the Primary Operational Model

Decision:

- The user manually opens ChatGPT or the target GPT tab.
- The system operates against that active registered tab.

Reason:

- aligns with the user's proposed workflow
- removes brittle GPT library navigation/search from MVP
- avoids depending on ChatGPT's GPT discovery UI

Consequence:

- the existing `generate_image_with_gpt(gptName, ...)` tool should become a verification wrapper, not a GPT navigator

### AD-005: Fetch Protected Image Bytes in Page Context, Persist in MCP Server

Decision:

- The content script should try to fetch the generated image in the page context when the image URL is auth-protected.
- The MCP server remains responsible for writing final files to disk.

Reason:

- auth cookies/session are already available in-page
- extension can access the exact DOM node and page-origin fetch context

### AD-006: Support Two Response Modes

Decision:

- Keep the current artifact-first contract.
- Continue supporting:
  - path-first success responses
  - optional embedded/base64 content when requested

Reason:

- preserves the strongest part of the existing MCP design

## Target Runtime Flows

### Flow A: Validate Browser Session

1. MCP client calls `validate_browser_session`.
2. MCP server checks whether at least one extension tab session is connected.
3. MCP server selects the default tab or the only connected tab.
4. MCP server sends `validate_session` command to that tab.
5. Content script inspects DOM and returns:
   - authenticated
   - current URL
   - page type (`chat`, `gpt`, `login`, `challenge`, `unknown`)
   - GPT metadata if detectable
6. MCP server formats and returns the result.

### Flow B: Generate Image In Active Tab

1. MCP client calls `generate_image_active_tab(prompt, ...)`.
2. MCP server resolves the target extension session.
3. MCP server sends `submit_prompt`.
4. Content script:
   - verifies composer
   - fills prompt
   - submits
   - waits for image nodes
   - collects URLs or bytes
5. MCP server persists files and metadata.
6. MCP server returns artifact paths and optional embedded payload.

### Flow C: Generate Image With GPT Name

Recommended behavior for MVP:

1. MCP client calls `generate_image_with_gpt(gptName, prompt, ...)`.
2. MCP server sends `get_page_context`.
3. Content script returns page title/GPT label/URL metadata.
4. MCP server compares active page GPT label against `gptName`.
5. If match is good enough:
   - continue with prompt submission
6. If not:
   - return `ACTIVE_TAB_MISMATCH` with instructions to open the correct GPT tab

This is intentionally simpler and more robust than trying to navigate the GPT picker from scratch.

## Extension-Bridge Protocol

## Session Registration

When a ChatGPT tab loads:

1. Content script connects to bridge WebSocket.
2. Sends `hello` with:
   - protocol version
   - extension version
   - tab URL
   - page type
   - page title
   - detected GPT name if any
   - local auth token
3. Bridge assigns:
   - `sessionId`
   - `tabKey`

## Envelope Shape

```json
{
  "type": "command",
  "commandId": "cmd_123",
  "action": "submit_prompt",
  "payload": {
    "prompt": "A clean studio product photo of a ceramic mug",
    "timeoutMs": 240000
  }
}
```

```json
{
  "type": "result",
  "commandId": "cmd_123",
  "success": true,
  "payload": {
    "images": [
      {
        "sourceUrl": "https://...",
        "mimeType": "image/png",
        "base64Data": "..."
      }
    ]
  }
}
```

## Recommended Actions

- `ping`
- `get_page_context`
- `validate_session`
- `start_new_chat`
- `submit_prompt`
- `wait_for_images`
- `fetch_image_payload`
- `download_image`
- `cancel_command`

## Page Context Contract

```json
{
  "authenticated": true,
  "currentUrl": "https://chatgpt.com/g/g-1234-my-gpt",
  "pageType": "gpt",
  "gpt": {
    "name": "My GPT",
    "slug": "my-gpt"
  },
  "details": "ChatGPT composer is visible."
}
```

## Security Model

## Local Token

The MCP server should generate a local bridge token on startup and persist it in a local ignored file or memory-backed startup output.

The extension needs this token through one of:

- options page entry
- first-run popup
- local config fetch from `http://127.0.0.1:<port>/handshake`

## Required Controls

- only bind bridge to `127.0.0.1`
- reject unauthenticated sockets
- require protocol version
- expire idle sessions
- correlate commands to a single tab session
- never expose raw credentials

## Future Hardening

- extension ID allowlist
- rotating session token
- signed handshake challenge

## Project Structure Changes

## New Runtime Areas

### MCP Server

- `src/extensionBridge/server.ts`
- `src/extensionBridge/hub.ts`
- `src/extensionBridge/protocol.ts`
- `src/extensionBridge/sessionRegistry.ts`
- `src/extensionBridge/token.ts`
- `src/extensionBridge/commandRouter.ts`

### Extension

- `extension/manifest.json`
- `extension/package.json`
- `extension/tsconfig.json`
- `extension/src/background.ts`
- `extension/src/content/chatgpt.ts`
- `extension/src/shared/protocol.ts`
- `extension/src/shared/dom.ts`
- `extension/src/popup/*` optional
- `extension/src/options/*` optional

## Existing Server Areas to Keep

- `src/server.ts`
- `src/tools/*`
- `src/services/imagePersistence.ts`
- `src/services/resultFormatter.ts`
- `src/services/runLock.ts`
- `src/services/gptResolver.ts` reduced role
- `src/browser/chatgpt.ts` logic can be partially migrated/reused

## Existing Areas to Remove or Replace

- direct browser-control backends in `src/browser/playwrightBackend.ts`
- extension-unaware bootstrap assumptions in `src/services/sessionBootstrapService.ts`
- active profile launch logic as the primary runtime path

## Backward Compatibility Strategy

### Keep

- `validate_browser_session()`
- `generate_image_new_chat(...)`
- `generate_image_with_gpt(...)`

### Add

- `list_connected_chatgpt_tabs()`
- `select_chatgpt_tab(tabKey)`
- `generate_image_active_tab(...)`

### Change Semantics

- `generate_image_with_gpt(...)` should verify against the active tab in MVP
- `list_matching_gpts(...)` should become optional/deferred unless the extension later adds GPT directory scraping

## Migration Phases

### Phase 1: Extension Bridge Foundation

- build localhost bridge in MCP server
- create extension shell
- register ChatGPT tabs
- implement `validate_browser_session`
- implement `list_connected_chatgpt_tabs`

### Phase 2: Active Tab Image Generation

- implement prompt submission in content script
- implement image wait/extract flow
- return URLs/base64 to MCP server
- persist artifacts

### Phase 3: GPT-Aware Flows

- detect active GPT metadata
- adapt `generate_image_with_gpt` to validate current tab vs requested GPT
- improve ambiguity/mismatch errors

### Phase 4: Optional UX Improvements

- popup UI
- default-tab selection
- reconnect diagnostics
- screenshot/debug dump tooling

## Testing Strategy

## Unit Tests

Server:

- bridge protocol parsing
- command routing
- session selection
- timeout handling
- artifact persistence
- structured error mapping

Extension:

- DOM helper tests
- page-context extraction tests
- prompt submission selector tests
- image-node extraction tests

## Integration Tests

- mocked WebSocket client simulating extension session
- end-to-end server workflow without real Chrome

## Manual Tests

- install extension unpacked
- open ChatGPT and sign in
- verify session detection
- verify active tab selection
- submit prompt
- receive saved artifact
- verify GPT mismatch handling

## Risks and Mitigations

### Risk: DOM Changes

Mitigation:

- centralize selectors in the extension
- add DOM diagnostics response types
- keep page-context and submit/wait logic isolated

### Risk: MV3 Worker Sleep

Mitigation:

- keep the content script as the primary automation agent
- use background worker only for extension lifecycle and optional utilities

### Risk: Localhost Security

Mitigation:

- localhost-only bind
- shared token
- protocol version checks
- session expiry

### Risk: Large Image Payloads

Mitigation:

- artifact-first contract
- allow URL-first fallback
- add chunked base64 transfer only if needed

## Recommended Final Decision

Proceed with an extension-driven MCP architecture and treat the already-open ChatGPT tab as the source of truth.

This is the simplest architecture that aligns with the real user workflow and avoids the failure modes already observed in profile cloning, remote attach, and anti-bot-triggering browser automation.
