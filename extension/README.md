# ChatGPT Extension Bridge

This Chrome extension connects ChatGPT tabs plus a background control worker to the local MCP server.

## Build

From the repo root:

```bash
npm install
npm run build:extension
```

## Load Unpacked

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select the `extension/` folder

The manifest references files under `extension/dist/`, so build the extension before loading it.

For release prep, also see:

- [Chrome Web Store Submission](../docs/chrome-web-store-submission.md)
- [Privacy Policy Draft](../docs/privacy-policy.md)

## Current MVP Behavior

- connects to the configured localhost handshake endpoint
- keeps a background bridge connection alive from the extension service worker
- registers open ChatGPT tabs with the local bridge
- can open a new `chatgpt.com` tab in the background when the server needs a fallback tab
- exposes a popup with bridge diagnostics and a settings page for bridge host/port
- responds to `validate_session`
- supports `generate_image` by optionally clicking `New chat`, submitting the prompt, waiting for new images, and returning base64 payloads to the MCP server

The extension-backed GPT workflow is intentionally conservative in MVP:

- `generate_image_active_tab(...)` uses the currently selected tab as-is
- `generate_image_new_chat(...)` clicks `New chat` in the selected tab before sending the prompt
- `generate_image_with_gpt(...)` expects the user to already have the correct GPT page open; the MCP server verifies the active tab name before generation
