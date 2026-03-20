---
title: 'ChatGPT Browser Image Generation MCP Server'
slug: 'chatgpt-browser-image-generation-mcp-server'
created: '2026-03-18T20:16:24.2245800-03:00'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Node.js'
  - 'TypeScript'
  - 'Official MCP TypeScript SDK'
  - 'Vibium MCP browser automation'
  - 'Vitest or equivalent TS unit test runner'
files_to_modify:
  - 'package.json'
  - 'tsconfig.json'
  - '.gitignore'
  - 'README.md'
  - 'src/index.ts'
  - 'src/server.ts'
  - 'src/config.ts'
  - 'src/types.ts'
  - 'src/errors.ts'
  - 'src/mcpClients/vibiumClient.ts'
  - 'src/tools/generateImageNewChat.ts'
  - 'src/tools/generateImageWithGpt.ts'
  - 'src/tools/validateBrowserSession.ts'
  - 'src/tools/listMatchingGpts.ts'
  - 'src/browser/adapter.ts'
  - 'src/browser/backendRouter.ts'
  - 'src/browser/session.ts'
  - 'src/browser/chatgpt.ts'
  - 'src/services/gptResolver.ts'
  - 'src/services/sessionBootstrapService.ts'
  - 'src/services/imagePersistence.ts'
  - 'src/services/resultFormatter.ts'
  - 'src/services/runLock.ts'
  - 'src/utils/retry.ts'
  - 'src/utils/time.ts'
  - 'src/utils/fs.ts'
  - 'tests/config.test.ts'
  - 'tests/gptResolver.test.ts'
  - 'tests/imagePersistence.test.ts'
  - 'tests/resultFormatter.test.ts'
  - 'tests/backendRouter.test.ts'
  - 'tests/runLock.test.ts'
code_patterns:
  - 'Confirmed clean slate: greenfield TypeScript project with src/ and tests/ roots'
  - 'Thin MCP tool handlers delegating to application services'
  - 'Vibium MCP client behind a semantic browser adapter boundary'
  - 'Backend router remains as a semantic execution boundary and usage logger'
  - 'Dedicated Chrome automation profile bootstrap and reuse'
  - 'Single-profile concurrency lock for browser session safety'
  - 'Artifact-first output with metadata sidecars'
  - 'Pure utility modules for fuzzy matching, retries, config parsing, and persistence'
test_patterns:
  - 'Unit tests for pure services and utilities only'
  - 'Mocked browser backend tests instead of live ChatGPT automation in CI'
---

# Tech-Spec: ChatGPT Browser Image Generation MCP Server

**Created:** 2026-03-18T20:16:24.2245800-03:00

## Overview

### Problem Statement

This repository needs a Node/TypeScript MCP server that can automate image generation through the ChatGPT web UI. The server must reuse a locally authenticated Chrome session without storing raw credentials, navigate to `chatgpt.com`, support both fresh-chat prompting and selecting an existing GPT by human-readable name, wait for image generation to complete, save generated images and metadata locally, and return both saved-path and image-content style results to the MCP caller.

### Solution

Build a greenfield TypeScript MCP server with a Vibium MCP browser orchestration layer. The server will launch a local Vibium-managed browser session over stdio, include user-facing bootstrap instructions for one-time ChatGPT login in that browser, perform resilient ChatGPT UI navigation with retries and fuzzy matching for GPT names, and save outputs under a professional artifact structure with metadata sidecars.

### Scope

**In Scope:**
- Create a local Node/TypeScript MCP server in this repo
- Add MCP tools for new image-chat generation and existing-GPT image generation
- Open `chatgpt.com` in an authenticated persistent browser session
- Guide the user on how to bootstrap the Vibium-managed browser session needed by the server
- Search the GPT list by human-readable name with typo tolerance and best-match behavior
- Wait for image generation completion, locate the resulting image, and save it locally
- Return both local artifact references and image payload information when feasible
- Save image metadata including prompt, GPT target, timestamps, run status, and file paths
- Add retries, timeouts, structured error handling, and README setup guidance

**Out of Scope:**
- Direct OpenAI Images API integration
- Storing raw ChatGPT credentials in source code or config
- Production-grade multi-user session brokering
- Hard guarantees against future ChatGPT UI changes or anti-automation changes
- Full browser/session recording infrastructure beyond what is needed for this MCP server

## Context for Development

### Codebase Patterns

- Confirmed clean slate: the repo contains BMAD scaffolding only and no application code, package manifest, or project docs to extend.
- Introduce a conventional TypeScript layout with `src/` for runtime code, `tests/` for unit tests, and `artifacts/generated-images/chatgpt/` for persisted outputs.
- Keep MCP entrypoints thin: each MCP tool should parse input, invoke a service-layer workflow, and shape the response without embedding browser logic.
- Put all browser operations behind semantic workflow methods, while the actual browser actions are executed through a Vibium MCP-backed browser adapter.
- Keep backend routing as an internal execution boundary and usage logger rather than as an external MCP-to-MCP dependency.
- Treat session bootstrap as a dedicated subsystem: validate the Vibium launch configuration, guide users toward the one-time manual ChatGPT login in the Vibium-managed browser, and surface actionable diagnostics.
- Guard browser execution with a run lock so concurrent requests do not overlap against the same managed browser session.
- Because ChatGPT selectors and flows are unstable, use resilient lookup helpers, retries with bounded backoff, fuzzy GPT matching, and explicit operational logs/errors.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad/bmm/config.yaml` | BMAD module config showing output locations and project defaults |
| `.agents/skills/bmad-quick-spec/workflow.md` | Workflow standard that this spec must satisfy |
| `.agents/skills/bmad-quick-spec/steps/step-01-understand.md` | Step 1 requirements for this quick spec |
| `.agents/skills/bmad-quick-spec/steps/step-02-investigate.md` | Step 2 investigation requirements for anchoring the implementation |
| `.agents/skills/bmad-party-mode/workflow.md` | Party mode workflow used to pressure-test the current spec |
| `_bmad-output/implementation-artifacts/tech-spec-wip.md` | Working quick spec that will drive implementation |

### Technical Decisions

- Primary runtime: Node.js + TypeScript.
- Primary auth/session strategy: use a user-provided dedicated Chrome automation profile path on Windows, documented clearly for local setup and separated from the user's main daily profile.
- Secondary session strategy: support storage-state/session export guidance only if profile reuse proves insufficient or too brittle.
- Browser control preference: launch and drive Vibium's MCP server over stdio from this repo.
- GPT discovery: accept a human-readable GPT name from the caller and resolve it using normalization plus fuzzy scoring against visible GPT menu/search results.
- Output contract: saved file locations and metadata are guaranteed on success; binary-or-base64 image payloads are best-effort and controlled by a caller-facing return mode.
- Artifact structure: default to `artifacts/generated-images/chatgpt/<YYYY-MM-DD>/` with per-run metadata JSON next to image files.
- Operational model: local-only automation against the ChatGPT consumer UI, with explicit README warnings about fragility and maintenance risk.
- Target directories to create:
  - `src/` for server, tools, browser adapters, and services
  - `tests/` for unit tests
  - `artifacts/generated-images/chatgpt/` for runtime outputs
- Planned file anchors:
  - `src/index.ts` bootstraps the MCP server process
  - `src/server.ts` registers MCP tools and shared dependencies
  - `src/mcpClients/playwrightClient.ts` owns local backend construction for the Playwright runtime
  - `src/browser/*` owns backend routing, session use, and ChatGPT navigation concerns
  - `src/services/*` owns fuzzy GPT resolution, session bootstrap, run locking, artifact persistence, and response shaping
  - `src/tools/*` exposes user-facing MCP tool handlers and diagnostics
  - `tests/*.test.ts` covers config, fuzzy matching, persistence, backend routing, response formatting, and lock behavior
- Tool contract anchors:
  - `generate_image_new_chat(prompt, returnMode?, timeoutMs?)`
  - `generate_image_with_gpt(gptName, prompt, returnMode?, timeoutMs?)`
  - `validate_browser_session()`
  - optional `list_matching_gpts(query)`

## Implementation Plan

### Tasks

- [x] Task 1: Scaffold the TypeScript MCP server project and baseline tooling
  - File: `package.json`
  - Action: Define project metadata, runtime scripts, build scripts, test scripts, and dependency placeholders for MCP SDK, TypeScript, test runner, and browser-backend client support.
  - Notes: Keep package scripts minimal and local-first; include `build`, `dev`, `start`, and `test`.
  - File: `tsconfig.json`
  - Action: Add a strict TypeScript configuration targeting modern Node.js with separate source and build directories.
  - Notes: Favor predictable compilation over bundling complexity.
  - File: `.gitignore`
  - Action: Ignore build output, logs, temporary state, local env files, and generated artifacts while preserving directory structure where useful.
  - Notes: Ensure `artifacts/generated-images/chatgpt/` contents are ignored by default.

- [x] Task 2: Create the MCP server bootstrap and tool-registration surface
  - File: `src/index.ts`
  - Action: Implement the process entrypoint that constructs config, initializes shared services, and starts the MCP server.
  - Notes: Keep startup failure messages actionable for missing profile/config inputs.
  - File: `src/server.ts`
  - Action: Register MCP tools for image generation, session validation, and optional GPT matching diagnostics.
  - Notes: Tool handlers should only coordinate services and shape responses.
  - File: `src/types.ts`
  - Action: Define shared request/response types, return-mode enums, backend identifiers, artifact metadata types, and tool input schemas.
  - Notes: Keep types explicit so tool contracts are stable and testable.

- [x] Task 3: Implement configuration parsing, validation, and structured error types
  - File: `src/config.ts`
  - Action: Parse runtime configuration for Chrome profile path, artifact root, timeout values, retry settings, backend preferences, and optional session-state inputs.
  - Notes: Validate required local settings early and return user-readable remediation guidance.
  - File: `src/errors.ts`
  - Action: Define structured domain errors for invalid config, unauthenticated session, GPT resolution failure, backend fallback failure, generation timeout, and persistence failure.
  - Notes: Errors must preserve enough metadata for MCP responses and logs.
  - File: `tests/config.test.ts`
  - Action: Add unit tests covering valid config parsing, invalid/missing profile path handling, default timeout selection, and artifact path defaults.
  - Notes: No live filesystem or browser dependency beyond controlled temp fixtures.

- [x] Task 4: Add browser backend construction and routing for local Playwright execution
  - File: `src/mcpClients/playwrightClient.ts`
  - Action: Implement the browser backend factory used to construct the in-process Playwright runtime.
  - Notes: Keep the exported contract aligned with the semantic browser adapter.
  - File: `src/browser/adapter.ts`
  - Action: Define the browser action contract required by ChatGPT workflows, including open session, navigate, search GPTs, submit prompt, wait for images, and download assets.
  - Notes: This is the abstraction boundary between ChatGPT logic and backend-specific clients.
  - File: `src/browser/backendRouter.ts`
  - Action: Route semantic browser actions through the configured backend boundary and preserve backend usage metadata.
  - Notes: The current implementation ships with a local Playwright backend.
  - File: `tests/backendRouter.test.ts`
  - Action: Add unit tests for preferred-backend success, fallback activation semantics, hard-failure propagation, and backend usage recording.
  - Notes: Mock browser backends; do not open a real browser.

- [x] Task 5: Implement session bootstrap, validation, and single-profile locking
  - File: `src/browser/session.ts`
  - Action: Build session-open and session-health helpers around the configured dedicated Chrome automation profile and optional storage-state support.
  - Notes: Do not target the user’s primary daily Chrome profile as the documented default.
  - File: `src/services/sessionBootstrapService.ts`
  - Action: Generate actionable setup diagnostics and validation messages explaining how to create, locate, and configure a dedicated automation profile.
  - Notes: This service should power both README guidance and the validation tool response.
  - File: `src/services/runLock.ts`
  - Action: Add process-local locking to prevent concurrent use of the same persistent browser profile during image-generation runs.
  - Notes: Return structured lock errors rather than hanging indefinitely.
  - File: `src/tools/validateBrowserSession.ts`
  - Action: Expose an MCP tool that validates config, tests whether the configured browser session appears authenticated, and reports setup issues clearly.
  - Notes: This tool should be safe to run before any generation attempt.
  - File: `tests/runLock.test.ts`
  - Action: Add unit tests for lock acquisition, duplicate-run rejection, and release behavior after success or failure.
  - Notes: Keep implementation deterministic and race-safe.

- [x] Task 6: Implement ChatGPT workflow primitives and GPT resolution logic
  - File: `src/browser/chatgpt.ts`
  - Action: Implement high-level ChatGPT web flows: navigate home, start new chat, open GPT picker, search GPTs, select GPT, submit prompt, wait for generation completion, and discover downloadable image nodes.
  - Notes: Use semantic waits, retry wrappers, and clear action-level logs because UI selectors are fragile.
  - File: `src/services/gptResolver.ts`
  - Action: Normalize GPT names, score fuzzy matches, decide best-match vs ambiguity, and return ranked candidates.
  - Notes: Favor typo tolerance but never silently choose between near-equal candidates without returning ambiguity.
  - File: `src/tools/listMatchingGpts.ts`
  - Action: Expose an optional MCP diagnostic tool that returns ranked GPT candidates for a query without triggering image generation.
  - Notes: This is primarily for troubleshooting and prompt refinement.
  - File: `tests/gptResolver.test.ts`
  - Action: Add unit tests for exact match, minor typo match, normalization behavior, ambiguous-match output, and not-found behavior.
  - Notes: Use representative GPT label fixtures.

- [x] Task 7: Implement artifact persistence and result-shaping services
  - File: `src/services/imagePersistence.ts`
  - Action: Save generated image files and metadata JSON under `artifacts/generated-images/chatgpt/<YYYY-MM-DD>/` using deterministic per-run identifiers.
  - Notes: Metadata should include prompt, GPT input, resolved GPT, backend usage, timestamps, output paths, and run status.
  - File: `src/services/resultFormatter.ts`
  - Action: Build MCP response payloads that always include artifact paths and metadata, plus optional binary/base64 content when `returnMode` requests it and extraction succeeds.
  - Notes: File persistence is the guaranteed success contract; payload embedding is best-effort.
  - File: `src/utils/fs.ts`
  - Action: Add filesystem helpers for directory creation, safe file naming, JSON writes, and artifact path generation.
  - Notes: Sanitize prompt-derived names to avoid illegal path characters.
  - File: `src/utils/time.ts`
  - Action: Add timestamp and date-path helpers used by metadata and artifact layout.
  - Notes: Keep output deterministic and easy to inspect.
  - File: `tests/imagePersistence.test.ts`
  - Action: Add unit tests for directory creation, file naming, metadata content, and repeated-run isolation.
  - Notes: Use temp directories only.
  - File: `tests/resultFormatter.test.ts`
  - Action: Add unit tests for path-only responses, binary/base64 best-effort responses, and partial-success cases where persistence succeeds but payload embedding does not.
  - Notes: Assert stable field names for MCP consumers.

- [x] Task 8: Implement image-generation MCP tools on top of the workflow services
  - File: `src/tools/generateImageNewChat.ts`
  - Action: Implement the tool handler for `generate_image_new_chat(prompt, returnMode?, timeoutMs?)` using run locking, session validation, ChatGPT navigation, image generation, persistence, and response shaping.
  - Notes: Tool flow should fail fast on invalid session/config before opening a long generation loop.
  - File: `src/tools/generateImageWithGpt.ts`
  - Action: Implement the tool handler for `generate_image_with_gpt(gptName, prompt, returnMode?, timeoutMs?)` using fuzzy GPT resolution and the same downstream generation/persistence flow.
  - Notes: Return ranked candidate hints when the GPT match is ambiguous or missing.
  - File: `src/utils/retry.ts`
  - Action: Add bounded retry and backoff helpers for fragile browser steps such as menu open, GPT search, prompt submission, and image discovery.
  - Notes: Retries must stop on non-retryable domain errors.

- [x] Task 9: Document user setup, session bootstrap, usage, and limitations
  - File: `README.md`
  - Action: Write setup and usage documentation covering project install, dedicated Chrome profile creation, one-time manual ChatGPT login, profile-path discovery on Windows, environment configuration, session validation, image-generation tool examples, artifact layout, and troubleshooting.
  - Notes: Include an explicit warning that ChatGPT consumer UI automation is brittle and may require selector maintenance when the site changes.

- [x] Task 10: Add final verification guidance and local manual test workflow
  - File: `README.md`
  - Action: Add a manual verification checklist for `validate_browser_session`, `generate_image_new_chat`, `generate_image_with_gpt`, backend fallback behavior, and artifact inspection.
  - Notes: Include expected outcomes and failure triage steps.
  - File: `package.json`
  - Action: Ensure documented scripts align with the final verification workflow and unit tests.
  - Notes: Keep the local developer loop short.

### Acceptance Criteria

- [ ] AC 1: Given the user has not configured the server yet, when they read the README, then they can create a dedicated Chrome automation profile, log into ChatGPT once manually, find the correct profile path, configure the server locally, and run a session validation command without ever storing raw credentials in code.
- [ ] AC 2: Given the configured Chrome automation profile path is missing or invalid, when `validate_browser_session()` or an image-generation tool is invoked, then the server returns a structured configuration error with remediation guidance instead of attempting browser automation.
- [ ] AC 3: Given the configured profile opens ChatGPT without an authenticated session, when `validate_browser_session()` is invoked, then the server reports that the session is unauthenticated and tells the user to complete the one-time manual login/bootstrap flow.
- [ ] AC 4: Given `generate_image_new_chat` is called with a valid prompt and a valid authenticated session, when the tool runs, then the server starts a new ChatGPT conversation, submits the prompt, waits for image generation to finish, saves the resulting image and metadata locally, and returns the artifact paths plus metadata in the MCP response.
- [ ] AC 5: Given `generate_image_new_chat` is called with `returnMode` requesting embedded image content, when image download and encoding succeed, then the MCP response includes both the persisted artifact information and the requested image payload representation.
- [ ] AC 6: Given `generate_image_with_gpt` is called with a GPT name containing minor typos, when the GPT search flow runs, then the server resolves the intended GPT through normalization and fuzzy matching and continues the generation flow successfully.
- [ ] AC 7: Given `generate_image_with_gpt` is called with a GPT name that matches multiple close candidates, when fuzzy resolution cannot choose safely, then the server returns a structured ambiguity response containing ranked candidate names and does not silently pick one.
- [ ] AC 8: Given a browser action fails during local Playwright-driven automation, when the failure is classified and surfaced by the server, then the tool returns a structured automation failure containing the failed action and any partial context useful for debugging.
- [ ] AC 9: Given the browser execution layer records backend usage for a run, when artifacts and responses are persisted, then the recorded backend information remains auditable in logs and run metadata.
- [ ] AC 10: Given image generation does not complete before the effective timeout, when the timeout threshold is reached, then the tool stops waiting and returns a structured timeout error containing the attempted flow, timeout value, and any partial artifact state.
- [ ] AC 11: Given a generated image appears in the ChatGPT UI but local persistence fails, when the save step runs, then the tool returns a structured persistence failure rather than reporting a false success.
- [ ] AC 12: Given a caller triggers two generation requests against the same persistent profile concurrently, when the second run attempts to start while the first still holds the lock, then the server rejects or serializes the second run according to the documented lock behavior and returns an explicit concurrency message.
- [ ] AC 13: Given a run succeeds, when artifact persistence completes, then files are stored under `artifacts/generated-images/chatgpt/<YYYY-MM-DD>/` with adjacent metadata including prompt, GPT input, resolved GPT name if any, backend usage, timestamps, run status, and saved file paths.
- [ ] AC 14: Given the optional `list_matching_gpts(query)` diagnostic tool is called, when GPT candidates are discoverable from the ChatGPT UI, then the tool returns ranked matches without submitting a generation prompt.

## Additional Context

### Dependencies

- Node.js runtime and TypeScript toolchain
- Official MCP TypeScript SDK for implementing the local server and tool contracts
- Playwright for launching and driving a persistent local browser session
- A test runner such as Vitest for TypeScript unit tests
- A fuzzy matching library or a lightweight in-house scorer for GPT name normalization and ranking
- Filesystem and path utilities for artifact creation, metadata persistence, and safe file naming
- Local ChatGPT access through a manually bootstrapped authenticated browser profile
- A dedicated Chrome automation profile path provided by the user at runtime
- Optional storage-state/session export support only if the profile-based approach is insufficient

### Testing Strategy

- Unit-test config parsing, error mapping, artifact path construction, metadata serialization, GPT normalization, fuzzy ranking, backend routing, and run-lock behavior.
- Use mocked browser backend adapters in tool-handler tests so success, timeout, ambiguity, unauthenticated-session, and persistence-failure paths can be exercised without live ChatGPT dependency.
- Add manual verification steps in the README for:
  - creating and configuring the dedicated Chrome automation profile
  - running `validate_browser_session()`
  - running `generate_image_new_chat(...)`
  - running `generate_image_with_gpt(...)`
  - verifying saved artifacts and metadata
  - verifying explicit browser-launch remediation when the configured browser path is unavailable
- Do not require CI to open a real browser or hit `chatgpt.com`; keep live ChatGPT verification local and manual because the consumer UI is brittle and environment-dependent.

### Notes

- Highest-risk area: ChatGPT consumer UI changes can break selectors, labels, GPT menu flows, or download affordances without warning.
- The implementation must explicitly tell users how to discover and provide the Chrome profile/session inputs required for local authenticated browsing.
- Prefer a dedicated automation profile over the user’s main browser profile to reduce lock conflicts and profile-corruption risk.
- The spec assumes Windows as the primary user environment for profile-path examples, but implementation should avoid hard-coding Windows-only behavior where unnecessary.
- Saved artifacts are the source of truth for successful output; embedded binary/base64 payloads are convenience features and should remain best-effort.
- If future reliability requirements increase, the likely long-term direction is to replace consumer-UI automation with an official API-backed image-generation path rather than deepen UI coupling.

## Review Notes

- Adversarial review completed
- Findings: 4 total, 4 fixed, 0 skipped
- Resolution approach: auto-fix
