# Installing The CLI

This document is for end users who want to install the MCP server as a local CLI instead of running it from the source repository.

## What Gets Installed

The npm package provides:

- the local MCP server executable: `chatgpt-image-mcp`
- the built Chrome extension runtime under `extension/`
- the runtime README files needed for setup

The package does not need the test suite or raw extension TypeScript source files at runtime.

## Prerequisites

- Node.js `>= 20.18.0`
- Google Chrome
- a ChatGPT account already signed in on `https://chatgpt.com`

## Install Options

### Global install

```bash
npm install -g chatgpt-browser-image-generation-mcp-server
```

Then the MCP server executable is:

```bash
chatgpt-image-mcp
```

### Local install in another project

```bash
npm install chatgpt-browser-image-generation-mcp-server
```

Then the executable can be invoked with:

```bash
npx chatgpt-image-mcp
```

### Install from a local tarball

If you built a local package with `npm pack`:

```bash
npm install -g ./chatgpt-browser-image-generation-mcp-server-0.1.0.tgz
```

## Runtime Home

If `CHATGPT_RUNTIME_HOME` is not set, the server uses an OS app-data location:

- Windows: `%LOCALAPPDATA%\chatgpt-browser-image-generation-mcp-server`
- macOS: `~/Library/Application Support/chatgpt-browser-image-generation-mcp-server`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/chatgpt-browser-image-generation-mcp-server`

This runtime home stores:

- generated image artifacts
- bridge token state
- managed automation profile data used by the legacy browser path

To override it:

```powershell
$env:CHATGPT_RUNTIME_HOME="D:\MyMcpRuntime\chatgpt-image-mcp"
```

## Install The Chrome Extension

Current distribution model: downloadable/manual install. Load the bundled extension as an unpacked Chrome extension:

1. Find the installed package directory.
2. Open `chrome://extensions`
3. Enable Developer Mode
4. Choose `Load unpacked`
5. Select the installed package's `extension/` directory

Useful commands to locate the installed package:

Global npm install:

```bash
npm root -g
```

Then open:

```text
<global-node-modules>/chatgpt-browser-image-generation-mcp-server/extension
```

Local npm install in another project:

```bash
node -p "require.resolve('chatgpt-browser-image-generation-mcp-server/package.json')"
```

Then open the sibling `extension/` directory next to that `package.json` file.

Install from local tarball:

- use the same lookup commands above after installation, or inspect the target project's `node_modules/chatgpt-browser-image-generation-mcp-server/extension`

The extension popup shows:

- connection state
- handshake URL
- installed extension version
- server version
- expected extension version
- last error

## First-Time Setup

1. Start the MCP server once:

```bash
chatgpt-image-mcp
```

2. Open `https://chatgpt.com`
3. Confirm the extension popup reports a successful connection
4. Keep the ChatGPT tab open for image-generation calls

## Environment Variables

Common variables:

- `CHATGPT_RUNTIME_HOME`
- `CHATGPT_EXTENSION_BRIDGE_HOST`
- `CHATGPT_EXTENSION_BRIDGE_PORT`
- `CHATGPT_ARTIFACT_ROOT`
- `CHATGPT_RETURN_MODE`
- `CHATGPT_DEFAULT_TIMEOUT_MS`
- `CHATGPT_MAX_TIMEOUT_MS`

You can place these in `.env` either:

- in the current working directory where the MCP server is launched
- or in the runtime home

If you are installing from the source repository, start from [.env.example](../.env.example).

## Troubleshooting

### Extension shows disconnected

Check:

- the MCP server process is running
- the popup handshake URL matches the server host/port
- Chrome can reach `http://127.0.0.1:47821/handshake` or your configured host/port

### Extension shows version mismatch

The installed extension bundle and the MCP server package do not match. Reinstall or update them as a pair.

### Chrome cannot load the extension directory

Check:

- you selected the installed package's `extension/` folder, not the repo root
- the package was built and includes `extension/dist/*`
- the install came from the published package or tarball, not from a partial copy of the repo

### Prompt appears but does not send

Reload the extension, refresh the ChatGPT tab, and retry. If it reproduces, collect:

- extension popup status
- last error text
- saved metadata JSON if any artifact was created

### Artifact path not where expected

Check `CHATGPT_RUNTIME_HOME` and `CHATGPT_ARTIFACT_ROOT`. By default, artifacts are saved under:

```text
<runtime-home>/artifacts/generated-images/chatgpt/YYYY-MM-DD/
```
