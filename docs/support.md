# Support

Use this page as the public support URL for the project until a dedicated support site exists.

Project home:

- `https://github.com/DouglasOttoDavila/image-generation-mcp-server`

Issue tracker:

- `https://github.com/DouglasOttoDavila/image-generation-mcp-server/issues`

## Before Filing A Bug

Please include:

- npm package version
- extension version from `extension/manifest.json` or the popup
- Chrome version
- operating system
- whether the extension popup shows `connected`
- whether the popup reports a version mismatch or last error
- the prompt used
- the saved metadata JSON, if an artifact was created

## Common Checks

1. Start the MCP server.
2. Confirm the extension is loaded from the packaged `extension/` directory.
3. Open `https://chatgpt.com` and confirm you are signed in.
4. Open the extension popup and confirm the localhost handshake URL is correct.
5. Retry `validate_browser_session()` before retrying image generation.

## Known Limitations

- The extension depends on the live `chatgpt.com` DOM.
- The extension and npm package must be version-aligned.
- `generate_image_with_gpt(...)` expects the target GPT page to already be open.
- `list_matching_gpts(...)` still uses the legacy browser automation path.
