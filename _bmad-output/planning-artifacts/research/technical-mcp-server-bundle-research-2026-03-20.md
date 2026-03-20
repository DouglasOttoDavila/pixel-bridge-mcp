---
stepsCompleted:
  - repo-review
  - transport-review
  - distribution-review
inputDocuments:
  - /D:/GitHub/image-generation-mcp-server/README.md
  - /D:/GitHub/image-generation-mcp-server/src/index.ts
  - /D:/GitHub/image-generation-mcp-server/src/server.ts
  - /D:/GitHub/image-generation-mcp-server/extension/src/background.ts
  - /D:/GitHub/image-generation-mcp-server/extension/src/content/chatgpt.ts
workflowType: research
lastStep: 6
research_type: technical
research_topic: MCP server bundling and transport strategy for chatgpt-browser-image-generation-mcp-server
research_goals:
  - Determine whether the current implementation is already a real MCP server
  - Identify what is missing for third-party distribution as a server + Chrome extension bundle
  - Compare stdio, Streamable HTTP, and legacy SSE options
  - Recommend the most practical packaging strategy
user_name: Doug
date: 2026-03-20
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-03-20
**Author:** Doug
**Research Type:** technical

---

## Research Overview

This report evaluates the current repository as an MCP product, separates protocol transport concerns from the local Chrome-extension bridge, and identifies the work required to ship the project as an installable bundle for third parties.

Method:

- reviewed the local implementation and packaging assumptions
- verified current MCP transport guidance from official MCP specification and TypeScript SDK materials
- reviewed current Chrome extension distribution guidance from Chrome for Developers

---

## Current State

The project is already a real MCP server in the protocol sense:

- it instantiates `McpServer`
- it registers MCP tools
- it connects through `StdioServerTransport`

The relevant implementation is:

- `/D:/GitHub/image-generation-mcp-server/src/index.ts`
- `/D:/GitHub/image-generation-mcp-server/src/server.ts`

However, it is not yet a turnkey distributable product. It still assumes:

- a developer-like install flow (`npm install`, build steps, local `.env`)
- a locally built unpacked extension
- a repo-relative working directory for bridge token and artifact storage
- a hardcoded local handshake target (`http://127.0.0.1:47821/handshake`) in the extension

So the current gap is not “make it an MCP server.” The gap is “make it a packaged product.”

---

## Key Architectural Point

There are two distinct protocols in the system:

1. External MCP transport between MCP client and this server
2. Internal localhost bridge between this server and the Chrome extension

Those are orthogonal. Moving the external MCP transport from stdio to Streamable HTTP does not remove the need for:

- the local extension
- the local bridge handshake
- extension distribution
- local install and lifecycle management

This is important because transport changes alone will not make the product installable by ordinary users.

---

## Transport Evaluation

### Option A: stdio only

Best fit for the current product shape.

Pros:

- simplest deployment for local MCP clients
- aligns with the MCP spec recommendation that clients should support stdio when possible
- avoids HTTP auth and exposure complexity
- easiest for tools like Claude Desktop, Cursor, Codex, and other local process-spawned integrations

Cons:

- only works with MCP clients that can spawn a local process
- not suitable as a general remote/shared endpoint

Assessment:

- recommended as the first production transport

### Option B: add Streamable HTTP

Useful as a second transport, not the first milestone.

Pros:

- supports remote or URL-based MCP client integrations
- modern MCP HTTP transport path
- better fit for future hosted offerings

Cons:

- requires HTTP server lifecycle and port management
- introduces origin validation, localhost binding, auth, and session requirements
- still does not solve extension distribution or local browser control

Assessment:

- worthwhile later if you want broader client compatibility
- should be additive, not a replacement for stdio

### Option C: legacy HTTP + SSE

Not the recommended path.

Pros:

- compatibility for old clients only

Cons:

- deprecated by current MCP transport guidance
- adds complexity you probably do not want unless compatibility forces it

Assessment:

- only add if specific target clients require it

---

## Bundle-Readiness Gaps

### 1. Installation and packaging

Missing:

- an installable server package for non-developers
- a single setup flow that installs dependencies/build artifacts automatically
- a stable runtime home outside the repo directory

Needed:

- ship compiled server artifacts, not TypeScript source as the main installation story
- write runtime state under OS-specific app data directories
- provide a bootstrap installer or CLI setup command

### 2. Extension distribution

Missing:

- a distribution strategy suitable for real users
- store-ready listing assets, privacy disclosure, and review posture

Needed:

- publish through Chrome Web Store as public, unlisted, or private depending rollout stage
- keep unpacked mode only for development

### 3. User configuration and diagnostics

Missing:

- extension UI for connection status
- host/port configurability
- clear reconnect/error UX for ordinary users

Needed:

- extension options page or popup
- bridge status view: connected, disconnected, authenticated, last error
- configurable server URL / host / port or at least a supported default with diagnostics

### 4. Stable runtime contract between server and extension

Missing:

- explicit compatibility/version policy between extension and server
- upgrade-safe migration story

Needed:

- protocol versioning beyond the current in-code constant
- clear mismatch errors when server and extension versions diverge
- release process that versions both artifacts together

### 5. Runtime process management

Missing:

- a product-friendly way to keep the server running when needed

Needed:

- either keep stdio-only and let MCP clients spawn it on demand
- or, if adding HTTP, run it as a local background service with explicit lifecycle management

### 6. Security hardening

Missing:

- formal security posture for bundle distribution

Needed:

- documented trust boundary for local extension ↔ localhost bridge
- stronger localhost bridge hardening
- careful handling of origin checks and auth if HTTP transport is added

### 7. Feature consistency

Missing:

- one fully coherent execution path

Current inconsistency:

- most generation flows now use the extension bridge
- `list_matching_gpts(...)` still uses legacy browser automation

Needed:

- either migrate remaining tooling to the extension path
- or clearly scope it out of the product

---

## Recommended Product Strategy

### Phase 1: Make it a real distributable local MCP product

Target:

- stdio MCP server
- Chrome Web Store extension
- local localhost bridge

Why:

- smallest product with the best chance of being installable and reliable
- aligns with how the implementation already works
- avoids premature HTTP auth/session complexity

Deliverables:

- packaged Node runtime or installer-based server distribution
- one-command or GUI setup
- extension published unlisted first, then public if desired
- options/diagnostics page in extension
- non-repo runtime directories

### Phase 2: Add Streamable HTTP as an optional second transport

Target:

- dual transport: stdio + Streamable HTTP

Why:

- broadens client compatibility without breaking the local-first product

Deliverables:

- transport abstraction at the entrypoint
- HTTP transport mode with localhost binding by default
- origin validation and session handling
- optional auth if you later expose it beyond localhost

### Phase 3: Consider legacy SSE only if customer demand exists

Target:

- compatibility layer, not default architecture

Why:

- current spec and SDK position Streamable HTTP as the forward path

---

## Recommended Next Work Items

1. Productize the runtime layout
   - move token/artifact/config storage out of repo cwd into app-data directories
2. Publishable extension path
   - add extension popup/options page, connection diagnostics, and install docs
3. Installer / bootstrap UX
   - one setup command or installer that prepares server runtime and validates bridge connectivity
4. Finish transport consistency
   - either migrate `list_matching_gpts(...)` to extension flow or remove it from the product surface
5. Versioning and release discipline
   - version the server and extension together with compatibility checks
6. Optional HTTP transport
   - add Streamable HTTP after the local product is solid

---

## Bottom Line

The project is already an MCP server. What it lacks is productization:

- install flow
- extension distribution
- runtime configuration UX
- compatibility/versioning
- security and packaging discipline

Recommendation:

- ship version 1 as a local-first stdio MCP server plus Chrome Web Store extension
- keep the localhost bridge
- add Streamable HTTP later as an optional second transport
- do not prioritize legacy SSE unless client compatibility explicitly requires it

---

## Sources

- MCP Transports specification: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
- MCP Authorization specification: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
- MCP TypeScript SDK README: `/D:/GitHub/image-generation-mcp-server/node_modules/@modelcontextprotocol/sdk/README.md`
- Chrome Web Store distribution guide: https://developer.chrome.com/docs/webstore/cws-dashboard-distribution/
