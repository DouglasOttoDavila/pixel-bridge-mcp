# MCP Client Configuration

This document shows generic ways to register the local CLI with an MCP client.

The exact UI and config-file location depend on the client. The stable part is the server command and arguments.

## Recommended Command

Global install:

```json
{
  "command": "chatgpt-image-mcp",
  "args": []
}
```

Local package install:

```json
{
  "command": "npx",
  "args": ["chatgpt-image-mcp"]
}
```

Local tarball or project-scoped install may also be invoked with the fully qualified Node command if your MCP client requires it.

## Example Environment Block

```json
{
  "env": {
    "CHATGPT_RUNTIME_HOME": "D:\\\\ChatGPTImageMcp",
    "CHATGPT_EXTENSION_BRIDGE_HOST": "127.0.0.1",
    "CHATGPT_EXTENSION_BRIDGE_PORT": "47821"
  }
}
```

## Generic JSON Example

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

## After Registration

Once the client can launch the server:

1. Start or reload the extension
2. Open `https://chatgpt.com`
3. Confirm the extension popup reports a live bridge connection
4. Run:
   - `validate_browser_session()`
   - `generate_image_active_tab(...)`

## Notes

- The MCP transport is currently `stdio`
- The Chrome extension still uses the localhost bridge internally
- If the package and extension versions differ, the bridge will reject the connection until both are aligned
