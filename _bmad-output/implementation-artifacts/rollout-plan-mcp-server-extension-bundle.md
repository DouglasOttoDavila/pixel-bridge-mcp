---
title: 'Rollout Plan: MCP Server + Chrome Extension Bundle'
slug: 'mcp-server-extension-bundle-rollout'
created: '2026-03-20T13:20:00-03:00'
status: 'draft'
based_on:
  - 'D:/GitHub/image-generation-mcp-server/_bmad-output/planning-artifacts/research/technical-mcp-server-bundle-research-2026-03-20.md'
  - 'D:/GitHub/image-generation-mcp-server/_bmad-output/planning-artifacts/architecture.md'
  - 'D:/GitHub/image-generation-mcp-server/_bmad-output/implementation-artifacts/tech-spec-chatgpt-extension-bridge-mcp.md'
owner: 'Doug'
---

# Rollout Plan: MCP Server + Chrome Extension Bundle

## Objective

Turn the current local MCP + extension implementation into a distributable product that another user can install and use without cloning the repo or manually piecing together the runtime.

## Current State

What already works:

- the project is already a valid MCP server over `stdio`
- the extension bridge flow works for:
  - `validate_browser_session()`
  - `list_connected_chatgpt_tabs()`
  - `select_chatgpt_tab(tabKey)`
  - `generate_image_active_tab(...)`
  - `generate_image_new_chat(...)`
  - `generate_image_with_gpt(...)` with active-tab verification
- background-tab generation is functioning
- image capture now waits for fully rendered output and avoids duplicate persisted artifacts

What is not productized yet:

- install flow
- extension distribution
- runtime configuration UX
- version compatibility checks between server and extension
- app-data-based runtime storage
- full consistency of the tool surface

## Decision Summary

### Recommended V1

Ship as:

- local `stdio` MCP server
- local localhost bridge
- Chrome extension distributed through Chrome Web Store

Do not make Streamable HTTP the first delivery milestone.

### Recommended V2

Add optional `Streamable HTTP` transport after the local-first bundle is stable.

### Not Recommended For Initial Delivery

- building the first release around legacy HTTP + SSE
- treating hosted/remote MCP deployment as the first product shape
- keeping unpacked-extension install as the primary distribution path

## Product Shape

### End User Experience Target

1. User installs the Chrome extension from Chrome Web Store.
2. User installs the MCP server bundle locally.
3. User runs a setup command once, or opens a small local setup app.
4. Setup verifies:
   - server starts
   - localhost bridge is reachable
   - extension can connect
   - ChatGPT tab is authenticated
5. User adds the MCP server to their MCP client.
6. Image generation works without repo-relative assumptions.

## Rollout Phases

## Phase 1: Local Productization

### Goal

Make the current implementation installable and supportable for non-developers while keeping `stdio` as the only public MCP transport.

### Deliverables

- packaged server distribution
- extension options or popup UI
- stable runtime directories outside repo cwd
- improved setup and troubleshooting docs
- compatibility/version handshake between server and extension

### Workstreams

#### 1. Runtime Packaging

Need:

- compiled production entrypoint
- install story that does not require users to read the source tree
- runtime home under OS app-data

Implementation targets:

- move bridge token storage out of repo cwd
- move optional logs/state into app-data locations
- make artifact root configurable but default-safe
- provide a single launch command for MCP clients

Suggested acceptance:

- a user can install and run the server without cloning the repo
- a user can upgrade without losing bridge state or artifacts unexpectedly

#### 2. Extension UX

Need:

- connection status
- bridge status
- last error visibility
- enable/disable bridge toggle

Implementation targets:

- popup page
- options page
- diagnostics fields:
  - extension version
  - expected bridge URL
  - connection state
  - last handshake failure
  - active registered ChatGPT tab count

Suggested acceptance:

- a user can tell whether failure is in the extension, localhost bridge, or ChatGPT tab

#### 3. Runtime Compatibility

Need:

- explicit compatibility between extension and server releases

Implementation targets:

- add version fields to hello/ack exchange
- add minimum compatible version fields
- return structured mismatch errors when versions diverge

Suggested acceptance:

- outdated extension and server combinations fail clearly with remediation steps

#### 4. Supported Tool Surface

Need:

- one clear statement of what is officially supported in the bundle

Implementation targets:

- either migrate `list_matching_gpts(...)` to extension-backed behavior
- or remove/de-emphasize it from the product surface until replaced

Suggested acceptance:

- no user-facing tool relies on a half-legacy path unless explicitly marked experimental

#### 5. Documentation and Setup

Need:

- install docs for non-developers
- MCP client configuration examples

Implementation targets:

- README split into:
  - developer setup
  - end-user installation
  - MCP client examples
- troubleshooting section by symptom
- extension installation/update section

Suggested acceptance:

- a new user can complete setup from docs alone

### Phase 1 Exit Criteria

- extension install flow is documented and repeatable
- MCP server runs from packaged output
- no repo-relative required runtime paths remain
- extension/server version mismatches are detectable
- live image generation works after clean installation on a second machine/profile

## Phase 2: Release Discipline

### Goal

Make releases predictable and supportable.

### Deliverables

- release versioning model
- packaging pipeline
- store submission assets/process
- smoke-test checklist

### Workstreams

#### 1. Versioning

- single versioning policy for server + extension
- release notes per bundle version
- compatibility matrix if versions can drift

#### 2. Packaging Pipeline

- automated build for server bundle
- automated extension build
- release artifact generation

#### 3. Store Submission

- Chrome Web Store listing assets
- privacy disclosure
- support contact/process

#### 4. Smoke Tests

- install fresh
- connect extension
- validate session
- generate image
- verify artifact persistence

### Phase 2 Exit Criteria

- one tagged release can produce all deliverables
- release checklist is executable by someone other than the original author

## Phase 3: Optional Streamable HTTP Transport

### Goal

Expand client compatibility without disturbing the local-first product.

### Deliverables

- alternate entrypoint for Streamable HTTP
- localhost-safe HTTP runtime mode
- transport selection docs

### Implementation Notes

- keep `stdio` as the default local integration path
- add HTTP as an additional mode, not a replacement
- bind to localhost by default
- if auth is added, follow MCP HTTP authorization guidance

### Risks

- more moving parts in local setup
- more troubleshooting burden
- transport confusion in docs if presented too early

### Phase 3 Exit Criteria

- both `stdio` and HTTP modes can be run and documented cleanly
- HTTP mode does not degrade the default local install experience

## Phase 4: Product Surface Expansion

### Candidate Additions

- GPT discovery/navigation inside the extension
- richer diagnostics export
- resumable long-running tasks
- better multi-tab and multi-profile support
- user-facing settings for artifact retention and naming

## Work Breakdown by Epic

## Epic 1: Product Runtime Foundations

- move state/config/token/artifact defaults to app-data locations
- formalize config loading for installed use
- define packaged production entrypoint

## Epic 2: Extension Product UX

- add popup/options UI
- add diagnostics and bridge-health display
- add user-friendly reconnect/error messaging

## Epic 3: Compatibility and Supportability

- add release/version handshake
- add structured mismatch handling
- define supported upgrade path

## Epic 4: Tool Surface Consolidation

- finish migration away from legacy browser-only paths
- mark unsupported/experimental features explicitly

## Epic 5: Distribution and Release Operations

- package server
- publish extension
- define smoke tests and release checklist

## Epic 6: Optional HTTP Expansion

- add Streamable HTTP mode
- add localhost-safe serving and docs
- consider auth only if HTTP becomes more than local-only

## Immediate Next Actions

1. Decide the installation target for V1:
   - npm-installed local CLI
   - bundled Node app
   - desktop installer wrapper
2. Add a product runtime path layer:
   - app-data storage
   - bundled config defaults
   - log/state locations
3. Build extension popup/options diagnostics
4. Remove or migrate the remaining legacy tool path
5. Draft end-user installation documentation

## Recommended Immediate Build Order

1. App-data runtime storage
2. Extension popup/options diagnostics
3. Version compatibility handshake
4. Tool-surface cleanup
5. Packaged server install flow
6. Chrome Web Store submission prep
7. Optional Streamable HTTP

## Go/No-Go Recommendation

Go for a V1 local-first bundle now, but scope it narrowly:

- `stdio` only
- Chrome extension required
- localhost bridge retained
- extension-backed flows only

Do not widen scope to remote/server-hosted MCP or legacy SSE in the first release.
