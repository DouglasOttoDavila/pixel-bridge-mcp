# Installing The CLI

This document is for end users who want to install the MCP server as a local CLI instead of running it from the source repository.

Related docs:

- [MCP Client Configuration](./mcp-client-configuration.md)
- [Client Config Snippets](./client-config-snippets.md)
- [Clean Install Checklist](./clean-install-checklist.md)
- [FAQ](./faq.md)

## What Gets Installed

The npm package provides:

- the local MCP server executable: `pixelbridge-mcp`
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
npm install -g pixelbridge-mcp
```

Then the MCP server executable is:

```bash
pixelbridge-mcp
```

### Local install in another project

```bash
npm install pixelbridge-mcp
```

Then the executable can be invoked with:

```bash
npx pixelbridge-mcp
```

### Install from a local tarball

If you built a local package with `npm pack`:

```bash
npm install -g ./pixelbridge-mcp-0.1.0.tgz
```

## Runtime Home

If `PIXELBRIDGE_RUNTIME_HOME` is not set, the server uses an OS app-data location:

- Windows: `%LOCALAPPDATA%\pixelbridge-mcp`
- macOS: `~/Library/Application Support/pixelbridge-mcp`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/pixelbridge-mcp`

This runtime home stores:

- generated image artifacts
- bridge token state
- managed automation profile data used by the legacy browser path

To override it:

```powershell
$env:PIXELBRIDGE_RUNTIME_HOME="D:\MyMcpRuntime\pixelbridge-mcp"
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
<global-node-modules>/pixelbridge-mcp/extension
```

Local npm install in another project:

```bash
node -p "require.resolve('pixelbridge-mcp/package.json')"
```

Then open the sibling `extension/` directory next to that `package.json` file.

Install from local tarball:

- use the same lookup commands above after installation, or inspect the target project's `node_modules/pixelbridge-mcp/extension`

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
pixelbridge-mcp
```

2. Open `https://chatgpt.com`
3. Confirm the extension popup reports a successful connection
4. Keep the ChatGPT tab open for image-generation calls

## Environment Variables

Common variables:

- `PIXELBRIDGE_RUNTIME_HOME`
- `PIXELBRIDGE_EXTENSION_BRIDGE_HOST`
- `PIXELBRIDGE_EXTENSION_BRIDGE_PORT`
- `PIXELBRIDGE_ARTIFACT_ROOT`
- `PIXELBRIDGE_RETURN_MODE`
- `PIXELBRIDGE_DEFAULT_TIMEOUT_MS`
- `PIXELBRIDGE_MAX_TIMEOUT_MS`

Legacy `CHATGPT_*` environment variables are still supported for existing setups.

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

Check `PIXELBRIDGE_RUNTIME_HOME` and `PIXELBRIDGE_ARTIFACT_ROOT`. By default, artifacts are saved under:

```text
<runtime-home>/artifacts/generated-images/chatgpt/YYYY-MM-DD/
```
