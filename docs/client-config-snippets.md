# Client Config Snippets

This page provides ready-to-copy MCP server snippets for Windows, macOS, and Linux.

Use it together with [mcp-client-configuration.md](./mcp-client-configuration.md).

## Shared Defaults

Server command:

- global install: `pixelbridge-mcp`
- local install fallback: `npx pixelbridge-mcp`

Bridge defaults:

- host: `127.0.0.1`
- port: `47821`

## Windows

### VS Code `.vscode/mcp.json`

```json
{
  "servers": {
    "pixelbridge-mcp": {
      "command": "pixelbridge-mcp",
      "args": [],
      "env": {
        "PIXELBRIDGE_RUNTIME_HOME": "D:\\PixelBridgeMcp",
        "PIXELBRIDGE_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "PIXELBRIDGE_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "pixelbridge-mcp": {
      "command": "pixelbridge-mcp",
      "args": [],
      "env": {
        "PIXELBRIDGE_RUNTIME_HOME": "D:\\PixelBridgeMcp",
        "PIXELBRIDGE_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "PIXELBRIDGE_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Codex `~/.codex/config.toml`

```toml
[mcp_servers.pixelbridge-mcp]
command = "pixelbridge-mcp"
args = []

[mcp_servers.pixelbridge-mcp.env]
PIXELBRIDGE_RUNTIME_HOME = "D:\\PixelBridgeMcp"
PIXELBRIDGE_EXTENSION_BRIDGE_HOST = "127.0.0.1"
PIXELBRIDGE_EXTENSION_BRIDGE_PORT = "47821"
```

### Claude Code

```bash
claude mcp add-json pixelbridge-mcp "{\"type\":\"stdio\",\"command\":\"pixelbridge-mcp\",\"args\":[],\"env\":{\"PIXELBRIDGE_RUNTIME_HOME\":\"D:\\\\PixelBridgeMcp\",\"PIXELBRIDGE_EXTENSION_BRIDGE_HOST\":\"127.0.0.1\",\"PIXELBRIDGE_EXTENSION_BRIDGE_PORT\":\"47821\"}}" --scope user
```

## macOS

### VS Code `.vscode/mcp.json`

```json
{
  "servers": {
    "pixelbridge-mcp": {
      "command": "pixelbridge-mcp",
      "args": [],
      "env": {
        "PIXELBRIDGE_RUNTIME_HOME": "/Users/your-user/Library/Application Support/pixelbridge-mcp",
        "PIXELBRIDGE_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "PIXELBRIDGE_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "pixelbridge-mcp": {
      "command": "pixelbridge-mcp",
      "args": [],
      "env": {
        "PIXELBRIDGE_RUNTIME_HOME": "/Users/your-user/Library/Application Support/pixelbridge-mcp",
        "PIXELBRIDGE_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "PIXELBRIDGE_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Codex `~/.codex/config.toml`

```toml
[mcp_servers.pixelbridge-mcp]
command = "pixelbridge-mcp"
args = []

[mcp_servers.pixelbridge-mcp.env]
PIXELBRIDGE_RUNTIME_HOME = "/Users/your-user/Library/Application Support/pixelbridge-mcp"
PIXELBRIDGE_EXTENSION_BRIDGE_HOST = "127.0.0.1"
PIXELBRIDGE_EXTENSION_BRIDGE_PORT = "47821"
```

### Claude Code

```bash
claude mcp add-json pixelbridge-mcp '{"type":"stdio","command":"pixelbridge-mcp","args":[],"env":{"PIXELBRIDGE_RUNTIME_HOME":"/Users/your-user/Library/Application Support/pixelbridge-mcp","PIXELBRIDGE_EXTENSION_BRIDGE_HOST":"127.0.0.1","PIXELBRIDGE_EXTENSION_BRIDGE_PORT":"47821"}}' --scope user
```

## Linux

### VS Code `.vscode/mcp.json`

```json
{
  "servers": {
    "pixelbridge-mcp": {
      "command": "pixelbridge-mcp",
      "args": [],
      "env": {
        "PIXELBRIDGE_RUNTIME_HOME": "/home/your-user/.local/share/pixelbridge-mcp",
        "PIXELBRIDGE_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "PIXELBRIDGE_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "pixelbridge-mcp": {
      "command": "pixelbridge-mcp",
      "args": [],
      "env": {
        "PIXELBRIDGE_RUNTIME_HOME": "/home/your-user/.local/share/pixelbridge-mcp",
        "PIXELBRIDGE_EXTENSION_BRIDGE_HOST": "127.0.0.1",
        "PIXELBRIDGE_EXTENSION_BRIDGE_PORT": "47821"
      }
    }
  }
}
```

### Codex `~/.codex/config.toml`

```toml
[mcp_servers.pixelbridge-mcp]
command = "pixelbridge-mcp"
args = []

[mcp_servers.pixelbridge-mcp.env]
PIXELBRIDGE_RUNTIME_HOME = "/home/your-user/.local/share/pixelbridge-mcp"
PIXELBRIDGE_EXTENSION_BRIDGE_HOST = "127.0.0.1"
PIXELBRIDGE_EXTENSION_BRIDGE_PORT = "47821"
```

### Claude Code

```bash
claude mcp add-json pixelbridge-mcp '{"type":"stdio","command":"pixelbridge-mcp","args":[],"env":{"PIXELBRIDGE_RUNTIME_HOME":"/home/your-user/.local/share/pixelbridge-mcp","PIXELBRIDGE_EXTENSION_BRIDGE_HOST":"127.0.0.1","PIXELBRIDGE_EXTENSION_BRIDGE_PORT":"47821"}}' --scope user
```

## Fallback Command Form

If `pixelbridge-mcp` is not on `PATH`, use:

```json
{
  "command": "npx",
  "args": ["pixelbridge-mcp"]
}
```

Or in TOML:

```toml
command = "npx"
args = ["pixelbridge-mcp"]
```
