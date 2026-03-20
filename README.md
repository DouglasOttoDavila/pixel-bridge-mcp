# ChatGPT Browser Image Generation MCP Server

Local TypeScript MCP server that orchestrates ChatGPT image generation from the user's real browser tab through a Chrome extension bridge, persists artifacts under `artifacts/generated-images/chatgpt/`, and returns MCP-friendly structured results.

## What It Does

- Exposes MCP tools for active-tab image generation, fresh-chat image generation, existing-GPT image generation, browser-session validation, and tab diagnostics.
- Hosts a localhost extension bridge so a ChatGPT content script can register already-open tabs.
- Persists generated images plus metadata sidecars under `artifacts/generated-images/chatgpt/<YYYY-MM-DD>/`.

## Important Limitation

This server depends on the Chrome extension being loaded into a real logged-in `chatgpt.com` tab plus ChatGPT's live DOM remaining compatible with the current selectors. That means end-to-end behavior is environment-dependent and should be treated as browser automation, not as a stable API integration.

Current migration state:

- `validate_browser_session()`, `list_connected_chatgpt_tabs()`, `select_chatgpt_tab()`, `generate_image_active_tab(...)`, `generate_image_new_chat(...)`, and `generate_image_with_gpt(...)` now use the extension bridge.
- `generate_image_with_gpt(...)` does not navigate the GPT directory in MVP. It verifies that the selected tab is already on the requested GPT page.
- `list_matching_gpts(...)` still uses the legacy browser automation path.

## Setup

1. Install dependencies:
```bash
npm install
```
2. Set environment variables:

```powershell
$env:CHATGPT_EXTENSION_BRIDGE_HOST="127.0.0.1"
$env:CHATGPT_EXTENSION_BRIDGE_PORT="47821"
```

You can also place the same values in a local `.env` file. The server auto-loads `.env` on startup and accepts either standard dotenv lines or PowerShell-style `$env:` lines.

Optional variables:

- `CHATGPT_EXTENSION_BRIDGE_PORT`
- `CHATGPT_EXTENSION_BRIDGE_HOST`
- `CHATGPT_ARTIFACT_ROOT`
- `CHATGPT_RETURN_MODE` with `paths` or `base64`
- `CHATGPT_DEFAULT_TIMEOUT_MS`
- `CHATGPT_MAX_TIMEOUT_MS`
- `CHATGPT_RETRY_ATTEMPTS`
- `CHATGPT_RETRY_BASE_DELAY_MS`

## Extension Bridge

Build the extension:

```bash
npm run build:extension
```

Then load `extension/` as an unpacked extension in Chrome. The extension uses the local handshake endpoint:

```text
http://127.0.0.1:47821/handshake
```

See [extension/README.md](/D:/GitHub/image-generation-mcp-server/extension/README.md) for the current MVP behavior.

## First Login

Open `https://chatgpt.com` in your normal Chrome profile, log in once, and keep the unpacked extension enabled for that tab. The server does not need to launch or own the browser profile anymore for extension-backed tools.

## Running

```bash
npm run build
npm run start
```

For local development:

```bash
npm run dev
```

## MCP Tools

- `validate_browser_session()`
- `list_connected_chatgpt_tabs()`
- `select_chatgpt_tab(tabKey)`
- `generate_image_active_tab(prompt, returnMode?, timeoutMs?)`
- `generate_image_new_chat(prompt, returnMode?, timeoutMs?)`
- `generate_image_with_gpt(gptName, prompt, returnMode?, timeoutMs?)`
- `list_matching_gpts(query)`

## Artifact Layout

Successful runs save files under:

```text
artifacts/generated-images/chatgpt/YYYY-MM-DD/
```

Each run writes:

- one or more image files
- one `<run-id>.metadata.json` file with prompt, GPT input, resolved GPT, timestamps, backend usage, and saved paths

## Manual Verification

1. Load the unpacked extension and open `https://chatgpt.com`.
2. Run `list_connected_chatgpt_tabs()` and confirm at least one ChatGPT tab is registered.
3. If multiple ChatGPT tabs are connected through the extension, use `select_chatgpt_tab(tabKey)`.
4. Run `validate_browser_session()` and confirm it reports `authenticated: true`.
5. Run `generate_image_active_tab("A clean studio product photo of a ceramic mug")`.
6. Confirm an image file and metadata JSON appear under `artifacts/generated-images/chatgpt/<today>/`.
7. Run `generate_image_new_chat("A clean studio product photo of a ceramic mug")` and confirm it starts a fresh chat before generating.
8. Open a specific GPT manually, then run `generate_image_with_gpt("Your GPT Name", "A cinematic concept sketch")`.
9. Run `list_matching_gpts("Dall e")` only if you still want the legacy GPT directory lookup path.

## Testing

```bash
npm test
```

The automated tests cover config parsing, dotenv loading, fuzzy GPT matching, artifact persistence, response formatting, backend routing, run locking, and validation error propagation. Live ChatGPT automation remains manual because the consumer UI is brittle and environment-dependent.
