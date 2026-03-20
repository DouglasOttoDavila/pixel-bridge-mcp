# ChatGPT Browser Image Generation MCP Server

Local TypeScript MCP server that orchestrates ChatGPT image generation from the user's real browser tab through a Chrome extension bridge, persists artifacts under `artifacts/generated-images/chatgpt/`, and returns MCP-friendly structured results.

License: `MIT`. See [LICENSE](./LICENSE).

For productization, the intended install target is now a local npm-installed CLI. The executable name is `chatgpt-image-mcp`.

End-user installation docs:
- [Installing The CLI](./docs/installing-the-cli.md)
- [MCP Client Configuration](./docs/mcp-client-configuration.md)
- [Client Config Snippets](./docs/client-config-snippets.md)
- [Clean Install Checklist](./docs/clean-install-checklist.md)
- [FAQ](./docs/faq.md)
- [Release Checklist](./docs/release-checklist.md)
- [GitHub Release Checklist](./docs/github-release-checklist.md)
- [Support](./docs/support.md)
- [Chrome Web Store Submission](./docs/chrome-web-store-submission.md)
- [Privacy Policy Draft](./docs/privacy-policy.md)

The MCP client guide includes concrete setup examples for:

- VS Code / GitHub Copilot in VS Code
- Cursor
- Windsurf
- JetBrains IDEs
- OpenAI Codex CLI
- OpenAI Codex IDE/app surfaces
- Claude Code
- generic `stdio` MCP clients

Additional user-facing docs now cover:

- clean-machine installation verification
- Windows/macOS/Linux config snippets
- common failure modes and answers

## Public Links

Current public project/support URL:

- Project home: `https://github.com/DouglasOttoDavila/image-generation-mcp-server`
- Issue tracker: `https://github.com/DouglasOttoDavila/image-generation-mcp-server/issues`
- Support page: `https://github.com/DouglasOttoDavila/image-generation-mcp-server/blob/main/docs/support.md`

Current public privacy-policy draft URL:

- `https://github.com/DouglasOttoDavila/image-generation-mcp-server/blob/main/docs/privacy-policy.md`

If you later publish GitHub Pages for this repo, replace the privacy-policy URL above with the final Pages URL and reuse the same link in the Chrome Web Store listing.

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

This section is the developer/source-repo setup path. If you are installing the packaged CLI, use [Installing The CLI](./docs/installing-the-cli.md) instead.

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

A safe starter file is included at [.env.example](./.env.example).

Optional variables:

- `CHATGPT_RUNTIME_HOME`
- `CHATGPT_EXTENSION_BRIDGE_PORT`
- `CHATGPT_EXTENSION_BRIDGE_HOST`
- `CHATGPT_ARTIFACT_ROOT`
- `CHATGPT_RETURN_MODE` with `paths` or `base64`
- `CHATGPT_DEFAULT_TIMEOUT_MS`
- `CHATGPT_MAX_TIMEOUT_MS`
- `CHATGPT_RETRY_ATTEMPTS`
- `CHATGPT_RETRY_BASE_DELAY_MS`

## Runtime Home

When `CHATGPT_RUNTIME_HOME` is not set, the server now defaults to an OS app-data directory instead of the repo folder:

- Windows: `%LOCALAPPDATA%\\chatgpt-browser-image-generation-mcp-server`
- macOS: `~/Library/Application Support/chatgpt-browser-image-generation-mcp-server`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/chatgpt-browser-image-generation-mcp-server`

Default artifact output is created under:

```text
<runtime-home>/artifacts/generated-images/chatgpt/
```

The local bridge token and managed browser profile data also live under the runtime home.

## Packaging Notes

The npm package is intended to ship runtime artifacts only:

- `dist/src/*`
- extension runtime files under `extension/dist/`
- `extension/manifest.json`
- `extension/popup.html`
- `extension/options.html`
- runtime README files

It should not ship compiled tests or raw extension TypeScript source files.

Current extension distribution model:

- downloadable/manual install first
- load the bundled `extension/` directory as an unpacked extension
- Chrome Web Store submission is documented but not the default distribution path yet

## Extension Bridge

Build the extension:

```bash
npm run build:extension
```

Then load `extension/` as an unpacked extension in Chrome. The extension uses the local handshake endpoint:

```text
http://127.0.0.1:47821/handshake
```

See [extension/README.md](./extension/README.md) for the current MVP behavior.

## First Login

Open `https://chatgpt.com` in your normal Chrome profile, log in once, and keep the unpacked extension enabled for that tab. The server does not need to launch or own the browser profile anymore for extension-backed tools.

## Running

```bash
npm run build
npm run start
```

For an installed CLI, run:

```bash
chatgpt-image-mcp
```

For generic MCP client wiring examples, see [MCP Client Configuration](./docs/mcp-client-configuration.md).

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
<runtime-home>/artifacts/generated-images/chatgpt/YYYY-MM-DD/
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
