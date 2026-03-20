# Clean Install Checklist

Use this checklist to verify the package works on a clean machine or clean user environment.

Goal:

- install the npm package without relying on the source repo
- load the packaged Chrome extension
- register the MCP server in a client
- verify that a real image is generated and saved correctly

## 1. Prepare The Environment

Confirm:

- Node.js `>= 20.18.0`
- Google Chrome is installed
- you can sign in to `https://chatgpt.com`
- no old copy of the extension is still loaded from a different folder

Recommended cleanup before testing:

- remove any older global install of `pixelbridge-mcp`
- close old ChatGPT tabs
- remove old unpacked copies of the extension from `chrome://extensions`

## 2. Install The Package

Pick one install path:

Global install:

```bash
npm install -g pixelbridge-mcp
```

Tarball install:

```bash
npm install -g ./pixelbridge-mcp-0.1.0.tgz
```

Verify:

```bash
pixelbridge-mcp --help
```

If the CLI does not expose a help screen, at least verify the command resolves:

Windows:

```powershell
Get-Command pixelbridge-mcp
```

macOS/Linux:

```bash
which pixelbridge-mcp
```

## 3. Locate The Packaged Extension

Global install:

```bash
npm root -g
```

Then open:

```text
<global-node-modules>/pixelbridge-mcp/extension
```

Alternative lookup:

```bash
node -p "require.resolve('pixelbridge-mcp/package.json')"
```

Then open the sibling `extension/` directory.

## 4. Load The Chrome Extension

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select the packaged `extension/` directory

Verify in the extension details:

- the extension loads successfully
- the popup opens
- no manifest or script-load errors appear

## 5. Start The MCP Server

In a terminal:

```bash
pixelbridge-mcp
```

If you want a custom runtime home, set `PIXELBRIDGE_RUNTIME_HOME` first.

## 6. Connect ChatGPT

1. Open `https://chatgpt.com`
2. Sign in
3. Open the extension popup
4. Confirm:
   - handshake URL is correct
   - connection becomes live
   - extension version and expected version match

## 7. Register The MCP Server In A Client

Use one client from [mcp-client-configuration.md](./mcp-client-configuration.md):

- VS Code
- Cursor
- Windsurf
- JetBrains
- Codex
- Claude Code
- GitHub Copilot CLI

After registration, verify the tool list includes:

- `validate_browser_session`
- `generate_image_active_tab`

## 8. Run The Minimum Smoke Test

Run:

1. `validate_browser_session()`
2. `generate_image_active_tab("A clean product photo of a ceramic mug on a wooden table")`

Verify:

- the prompt is submitted automatically
- no manual Enter key is needed
- one final image artifact is saved
- the saved image is fully rendered and not blurry
- a matching metadata JSON file is saved

## 9. Check The Artifact Location

By default, look under:

```text
<runtime-home>/artifacts/generated-images/chatgpt/YYYY-MM-DD/
```

Confirm:

- one image file exists
- one metadata file exists
- the saved image matches what ChatGPT displayed

## 10. Release Gate

Treat the clean install as failed if any of these happen:

- the CLI command is not discoverable after install
- the extension cannot be loaded from the packaged folder
- the popup never connects to the local bridge
- the prompt appears but is not sent
- the saved artifact is partial, blurry, or duplicated
- the extension version mismatches the npm package version
