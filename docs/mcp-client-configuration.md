# MCP Client Configuration

This document shows how to configure the local CLI in common MCP clients.

Related docs:

- [Client Config Snippets](./client-config-snippets.md)
- [Installing The CLI](./installing-the-cli.md)
- [Clean Install Checklist](./clean-install-checklist.md)
- [FAQ](./faq.md)

Checked against official client documentation on `2026-03-20`.

Important:

- this server currently exposes `stdio`, not HTTP/SSE
- the Chrome extension still talks to the local bridge internally
- you must install both:
  - the npm package / CLI
  - the Chrome extension from the packaged `extension/` directory

## Shared Assumptions

The examples below assume one of these install paths:

Global npm install:

```text
command: chatgpt-image-mcp
```

Project-local install:

```text
command: npx
args: ["chatgpt-image-mcp"]
```

Optional environment block:

```json
{
  "CHATGPT_RUNTIME_HOME": "D:\\ChatGPTImageMcp",
  "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
  "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
}
```

## VS Code And GitHub Copilot In VS Code

Current official VS Code MCP docs use `mcp.json` with a top-level `servers` object.

Workspace config:

1. Create `.vscode/mcp.json`
2. Add:

```json
{
  "servers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

User/global config:

1. Run `MCP: Open User Configuration`
2. Add the same `servers` entry there

After saving:

1. Start the server from the `mcp.json` editor or via `MCP: List Servers`
2. Open Chat / Agent mode
3. Confirm the server tools appear

Notes:

- VS Code also supports `MCP: Add Server` and the `code --add-mcp ...` command-line flow
- GitHub Copilot inside VS Code uses the same VS Code MCP integration path
- if your org manages Copilot policies, MCP access might be disabled centrally

## Cursor

Cursor documents MCP configuration via `mcp.json`.

Project-local config:

1. Create `.cursor/mcp.json`
2. Add:

```json
{
  "mcpServers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

Global config:

- create `~/.cursor/mcp.json`
- use the same `mcpServers` block

Cursor notes:

- Cursor supports local `stdio`, `SSE`, and Streamable HTTP MCP transports
- for this project, use local `stdio`
- Cursor exposes MCP logs in the Output panel under `MCP Logs`

## Windsurf

Windsurf documents MCP configuration through `mcp_config.json`.

The path differs by product/version in current docs:

- `~/.codeium/windsurf/mcp_config.json`
- or `~/.codeium/mcp_config.json`

Use whichever path your installed Windsurf version exposes in the MCP settings UI.

Example:

```json
{
  "mcpServers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

Windsurf notes:

- Windsurf supports `stdio`, Streamable HTTP, and `SSE`
- for this repo, use `stdio`
- after editing the file, refresh/reload MCPs from Windsurf settings if required

## JetBrains IDEs

JetBrains AI Assistant supports MCP server connections directly in the IDE UI.

Recommended path:

1. Open `Settings | Tools | AI Assistant | Model Context Protocol (MCP)`
2. Click `Add`
3. Paste JSON configuration:

```json
{
  "mcpServers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

4. Choose whether the server is:
   - global
   - project-only
5. Apply the settings and enable the server

JetBrains notes:

- JetBrains AI Assistant supports `stdio`, Streamable HTTP, and legacy `SSE`
- current docs say the IDE UI is the primary setup path
- JetBrains products also expose some MCP import/auto-configuration flows, but for this local package the manual JSON block above is the clearest path

## OpenAI Codex CLI

OpenAI Codex supports MCP servers in `~/.codex/config.toml` or project-local `.codex/config.toml`.

Add this block:

```toml
[mcp_servers.chatgpt-image-mcp]
command = "chatgpt-image-mcp"
args = []

[mcp_servers.chatgpt-image-mcp.env]
CHATGPT_EXTENSION_BRIDGE_HOST = "127.0.0.1"
CHATGPT_EXTENSION_BRIDGE_PORT = "47821"
```

Then restart Codex.

Alternative: Codex also exposes `codex mcp` management commands. If you prefer the CLI flow, use the official `codex mcp add` command family instead of editing TOML manually.

## OpenAI Codex In VS Code / Codex App

OpenAI’s current docs say the CLI, IDE, and Codex app share the same configuration layers.

That means the same `~/.codex/config.toml` setup above should make this MCP server available across:

- Codex CLI
- Codex IDE surfaces
- Codex app

Inference:

- I am inferring `Codex for VS Code` uses the same MCP config because OpenAI documents shared configuration across the CLI, IDE, and app surfaces

## Claude Code

Claude Code has first-class MCP support and documents `claude mcp add`, `claude mcp add-json`, and scoped config.

Recommended command:

```bash
claude mcp add-json chatgpt-image-mcp "{\"type\":\"stdio\",\"command\":\"chatgpt-image-mcp\",\"args\":[],\"env\":{\"CHATGPT_EXTENSION_BRIDGE_HOST\":\"127.0.0.1\",\"CHATGPT_EXTENSION_BRIDGE_PORT\":\"47821\"}}" --scope user
```

Then verify:

```bash
claude mcp get chatgpt-image-mcp
claude mcp list
```

Why `--scope user`:

- this server is usually a personal machine-level utility, not a repo-shared project dependency

## Claude Desktop

Claude Desktop is not a first-class install target for this repo yet.

Current Anthropic guidance emphasizes desktop extensions (`.mcpb`) for local MCP servers in Claude Desktop. This repo currently ships:

- an npm CLI
- a Chrome extension

It does not yet ship a Claude Desktop desktop-extension bundle.

So the honest current status is:

- Claude Code: supported and documentable now
- Claude Desktop: not a polished install target for this repo yet

If you want Claude Desktop to be a real supported client, the next packaging step is:

1. create an MCPB/desktop-extension wrapper for the local stdio server
2. package the dependencies in the format Claude Desktop expects
3. add a dedicated Claude Desktop install guide

## GitHub Copilot CLI

GitHub Copilot CLI supports adding MCP servers interactively and stores them in `~/.copilot/mcp-config.json` by default.

Recommended path:

1. Start Copilot CLI
2. Run `/mcp add`
3. Enter the local stdio server command:

```text
chatgpt-image-mcp
```

If the command is not globally installed, use:

```text
npx chatgpt-image-mcp
```

Then save the MCP entry and restart the session if needed.

## GitHub Copilot Coding Agent On GitHub.com

This is not a supported target for this repo.

Reason:

- Copilot coding agent runs remotely on GitHub infrastructure
- this MCP server depends on a local Chrome extension plus a local signed-in `chatgpt.com` browser session
- a remote agent cannot use your local browser and local extension bridge

So:

- Copilot in local VS Code: yes
- Copilot CLI on your machine: yes
- Copilot coding agent on GitHub.com: no, not for this local-package architecture

## Other MCP Clients

Most other MCP clients fall into one of these config shapes.

Shape A:

```json
{
  "mcpServers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

Shape B:

```json
{
  "servers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

If a client supports local MCP servers over `stdio`, one of those two shapes is usually enough to adapt.

## After Registration

Once the client can launch the server:

1. Start or reload the Chrome extension
2. Open `https://chatgpt.com`
3. Confirm the extension popup reports a live bridge connection
4. Run:
   - `validate_browser_session()`
   - `generate_image_active_tab(...)`

## Troubleshooting

### The client launches the server but no tools appear

Check:

- the client really supports local `stdio` MCP servers
- the server command resolves in that client’s environment
- the client is using the correct config shape for that product

### The MCP server appears but image generation fails

Check:

- the Chrome extension is loaded
- the extension and npm package versions match
- the ChatGPT tab is signed in and connected

### Codex or Claude Code cannot find the command

Switch to the project-local form:

```text
command: npx
args: ["chatgpt-image-mcp"]
```

## Sources

Official references used for this guide:

- GitHub Copilot Chat MCP docs for VS Code and other IDEs: https://docs.github.com/en/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp
- GitHub Copilot CLI MCP docs: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
- GitHub Copilot coding agent MCP docs: https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp
- Cursor MCP docs: https://docs.cursor.com/context/model-context-protocol
- Windsurf MCP docs: https://docs.windsurf.com/windsurf/cascade/mcp
- JetBrains AI Assistant MCP docs: https://www.jetbrains.com/help/ai-assistant/mcp.html
- OpenAI Codex config reference: https://developers.openai.com/codex/config-reference/
- OpenAI Codex CLI features: https://developers.openai.com/codex/cli/features/#model-context-protocol-mcp
- Anthropic Claude Code MCP docs: https://docs.anthropic.com/en/docs/claude-code/mcp
- Anthropic Claude Desktop local MCP docs: https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop
