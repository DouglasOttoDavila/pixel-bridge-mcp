# Chrome Web Store Submission

This document packages the current extension into a release-ready Chrome Web Store submission checklist plus draft listing copy.

Chrome Web Store publication is currently deferred. The active release strategy is manual/downloadable extension distribution. Keep this document ready for the next phase.

Use it together with:

- [Release Checklist](./release-checklist.md)
- [Extension README](../extension/README.md)
- [Privacy Policy Draft](./privacy-policy.md)

## Current Extension Scope

Extension name in the manifest:

- `PixelBridge MCP`

Current purpose:

- Connect a local MCP server to an already-open `chatgpt.com` tab
- Allow the local MCP server to bootstrap a background ChatGPT tab when needed
- Send prompts into the user's ChatGPT session and return generated image payloads to the local server
- Show local bridge diagnostics in the popup and allow host/port configuration in the options page

## Current Permissions And Rationale

From [manifest.json](../extension/manifest.json):

- `storage`
  - Stores bridge settings and diagnostics locally in Chrome extension storage.
- `tabs`
  - Opens or inspects ChatGPT tabs needed for bridge fallback and diagnostics.
- host permission `https://chatgpt.com/*`
  - Required for the content script that drives the user's ChatGPT tab.
- host permissions `http://127.0.0.1/*` and `http://localhost/*`
  - Required for the localhost handshake with the local MCP server.

Before submission, verify these are still the minimum necessary permissions.

## Store Listing Inputs

Prepare these items in the Chrome Web Store Developer Dashboard:

- extension name
- short summary
- full description
- screenshots
- extension icons
- privacy policy URL
- support URL
- category and language fields

Per Chrome Web Store listing policy, the listing must be accurate, current, and complete, and missing screenshots or icon assets can cause rejection.

## Draft Short Description

`Connects a local MCP server to your ChatGPT tab for browser-based image generation workflows.`

## Draft Full Description

`PixelBridge MCP links a local MCP server to your existing ChatGPT browser session so local MCP clients can automate image generation workflows from the tab you already use.`

`The extension can detect and connect ChatGPT tabs, keep a local bridge session alive, open a background ChatGPT tab when the server needs one, and expose local diagnostics for troubleshooting. Generated image payloads are sent back to the local MCP server running on your machine so the server can store artifacts and return tool results to the MCP client.`

`This extension is designed for local developer workflows. It requires the companion local MCP server package and a signed-in ChatGPT session in Chrome.`

## Suggested Support Text

Use a support page or repository page that includes:

- what the extension does
- install steps for the local MCP server
- how to load or update the extension
- troubleshooting for disconnected localhost bridge, version mismatch, and prompt submission failures
- a contact method for bug reports

Starter support text:

`For installation, troubleshooting, and known limitations, see the project README and issue tracker. Include your extension version, npm package version, Chrome version, and whether the local bridge popup shows a connected state.`

## Privacy Disclosure Notes

The privacy policy and Chrome Web Store privacy fields should reflect the current behavior accurately:

- prompts entered into ChatGPT are handled in the user's browser session
- generated image payloads are transmitted to the local MCP server on the same machine
- bridge settings and diagnostics are stored locally in extension storage
- the extension is not intended to transmit analytics or telemetry to a separate vendor backend

Because the product interacts with `chatgpt.com`, be explicit that prompts and generated content are ultimately processed by the user's ChatGPT session and therefore by the ChatGPT service the user is already using.

## Submission Readiness Checklist

1. Confirm the extension version matches the npm package version.
2. Build the extension with `npm run build:extension`.
3. Reload the unpacked extension locally and verify popup diagnostics.
4. Verify a fresh end-to-end image generation run succeeds.
5. Host the privacy policy at a stable public URL.
6. Add a support URL that points to maintained project documentation or issue tracking.
7. Ensure the listing description matches the actual extension behavior and limitations.
8. Capture fresh screenshots of:
   - the popup diagnostics
   - the options page
   - the extension working with a ChatGPT tab

## Known Product Limitations To Disclose

- The extension depends on the live `chatgpt.com` DOM and a signed-in ChatGPT browser session.
- The companion MCP server must be running locally for the extension to be useful.
- The GPT-specific workflow is conservative in MVP and expects the target GPT page to already be open.
