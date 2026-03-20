# Client Config Snippets

This page provides ready-to-copy MCP server snippets for Windows, macOS, and Linux.

Use it together with [mcp-client-configuration.md](./mcp-client-configuration.md).

## Shared Defaults

Server command:

- global install: `chatgpt-image-mcp`
- local install fallback: `npx chatgpt-image-mcp`

Bridge defaults:

- host: `127.0.0.1`
- port: `47821`

## Windows

### VS Code `.vscode/mcp.json`

```json
{
  "servers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_RUNTIME_HOME": "D:\\ChatGPTImageMcp",
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_RUNTIME_HOME": "D:\\ChatGPTImageMcp",
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Codex `~/.codex/config.toml`

```toml
[mcp_servers.chatgpt-image-mcp]
command = "chatgpt-image-mcp"
args = []

[mcp_servers.chatgpt-image-mcp.env]
CHATGPT_RUNTIME_HOME = "D:\\ChatGPTImageMcp"
CHATGPT_EXTENSION_BRIDGE_HOST = "127.0.0.1"
CHATGPT_EXTENSION_BRIDGE_PORT = "47821"
```

### Claude Code

```bash
claude mcp add-json chatgpt-image-mcp "{\"type\":\"stdio\",\"command\":\"chatgpt-image-mcp\",\"args\":[],\"env\":{\"CHATGPT_RUNTIME_HOME\":\"D:\\\\ChatGPTImageMcp\",\"CHATGPT_EXTENSION_BRIDGE_HOST\":\"127.0.0.1\",\"CHATGPT_EXTENSION_BRIDGE_PORT\":\"47821\"}}" --scope user
```

## macOS

### VS Code `.vscode/mcp.json`

```json
{
  "servers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_RUNTIME_HOME": "/Users/your-user/Library/Application Support/chatgpt-image-mcp",
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_RUNTIME_HOME": "/Users/your-user/Library/Application Support/chatgpt-image-mcp",
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Codex `~/.codex/config.toml`

```toml
[mcp_servers.chatgpt-image-mcp]
command = "chatgpt-image-mcp"
args = []

[mcp_servers.chatgpt-image-mcp.env]
CHATGPT_RUNTIME_HOME = "/Users/your-user/Library/Application Support/chatgpt-image-mcp"
CHATGPT_EXTENSION_BRIDGE_HOST = "127.0.0.1"
CHATGPT_EXTENSION_BRIDGE_PORT = "47821"
```

### Claude Code

```bash
claude mcp add-json chatgpt-image-mcp '{"type":"stdio","command":"chatgpt-image-mcp","args":[],"env":{"CHATGPT_RUNTIME_HOME":"/Users/your-user/Library/Application Support/chatgpt-image-mcp","CHATGPT_EXTENSION_BRIDGE_HOST":"127.0.0.1","CHATGPT_EXTENSION_BRIDGE_PORT":"47821"}}' --scope user
```

## Linux

### VS Code `.vscode/mcp.json`

```json
{
  "servers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_RUNTIME_HOME": "/home/your-user/.local/share/chatgpt-image-mcp",
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "chatgpt-image-mcp": {
      "command": "chatgpt-image-mcp",
      "args": [],
      "env": {
        "CHATGPT_RUNTIME_HOME": "/home/your-user/.local/share/chatgpt-image-mcp",
        "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Codex `~/.codex/config.toml`

```toml
[mcp_servers.chatgpt-image-mcp]
command = "chatgpt-image-mcp"
args = []

[mcp_servers.chatgpt-image-mcp.env]
CHATGPT_RUNTIME_HOME = "/home/your-user/.local/share/chatgpt-image-mcp"
CHATGPT_EXTENSION_BRIDGE_HOST = "127.0.0.1"
CHATGPT_EXTENSION_BRIDGE_PORT = "47821"
```

### Claude Code

```bash
claude mcp add-json chatgpt-image-mcp '{"type":"stdio","command":"chatgpt-image-mcp","args":[],"env":{"CHATGPT_RUNTIME_HOME":"/home/your-user/.local/share/chatgpt-image-mcp","CHATGPT_EXTENSION_BRIDGE_HOST":"127.0.0.1","CHATGPT_EXTENSION_BRIDGE_PORT":"47821"}}' --scope user
```

## Fallback Command Form

If `chatgpt-image-mcp` is not on `PATH`, use:

```json
{
  "command": "npx",
  "args": ["chatgpt-image-mcp"]
}
```

Or in TOML:

```toml
command = "npx"
args = ["chatgpt-image-mcp"]
```
