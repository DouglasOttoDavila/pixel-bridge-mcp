# Privacy Policy Draft

This draft is tailored to the current behavior of the `ChatGPT Extension Bridge` Chrome extension and the companion local MCP server.

Before publishing, replace placeholders with your real legal name, contact address, support URL, and effective date, then host the final policy at a stable public URL.

## Effective Date

`[Insert date]`

## Product Covered

This policy applies to:

- the Chrome extension `ChatGPT Extension Bridge`
- the companion local npm package `chatgpt-browser-image-generation-mcp-server`

## Summary

The extension and local MCP server are designed to connect a user's local MCP client to the user's own `chatgpt.com` browser session for browser-based image generation workflows.

The extension and local MCP server are intended to operate locally on the user's machine. They are not designed to run a separate hosted analytics or telemetry service.

## Information We Handle

Depending on how the product is used, the extension and local MCP server may handle:

- prompts the user sends into ChatGPT
- generated image payloads returned in the user's ChatGPT session
- local bridge configuration such as host and port
- local diagnostic information such as connection status, version mismatch state, and recent bridge errors

## How The Information Is Used

The handled information is used only to provide the product's user-facing functionality:

- connect the extension to the local MCP server
- locate or open a ChatGPT tab
- submit prompts to the user's ChatGPT session
- retrieve generated image data from the page
- save image artifacts and metadata on the user's local machine
- show local diagnostics in the extension popup or options page

## Where Data Goes

The product is designed so that:

- extension settings and diagnostics are stored locally in Chrome extension storage
- generated image artifacts and metadata are stored locally on the user's machine by the companion MCP server
- localhost bridge traffic is sent to the companion MCP server running on the same machine

The product does not intend to send prompts, generated images, or diagnostics to a separate vendor-controlled backend for analytics or resale.

## Third-Party Services

When a user submits a prompt through `chatgpt.com`, that prompt and any generated content are processed within the user's ChatGPT session and therefore by the ChatGPT service the user is actively using.

This product does not replace or override the privacy terms of `chatgpt.com`. Users should review the privacy terms and policies of any third-party service they choose to use, including ChatGPT.

## Sharing

The extension and local MCP server are not intended to sell or share handled data with unrelated third parties.

Data may be disclosed only:

- when required by law
- when necessary to protect the security or integrity of the product
- when the user intentionally exports, moves, or shares files created by the local MCP server

## Retention

Locally stored settings, diagnostics, and generated artifacts remain on the user's machine until the user deletes them or uninstalls the product, subject to normal browser or operating system behavior.

## Security

The product is intended to communicate with the companion local server over localhost and to rely on the browser's signed-in session for `chatgpt.com`.

No software can guarantee perfect security. Users should keep Chrome, the extension, Node.js, and the local machine updated and secure.

## User Choices

Users can:

- disable or uninstall the Chrome extension
- clear extension storage through Chrome
- delete locally stored artifacts and metadata
- stop running the local MCP server
- avoid using the product with third-party services they do not want to interact with

## Changes To This Policy

This policy may be updated when the product's behavior changes. The latest published version should always reflect the current extension and local MCP server behavior.

## Contact

For privacy or support questions, contact:

- Name: `[Insert name]`
- Email: `[Insert support email]`
- Support URL: `[Insert support URL]`
