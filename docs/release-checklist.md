# Release Checklist

This checklist is for producing a release of the local npm CLI plus the matching Chrome extension bundle.

## Goal

Ship a versioned pair:

- npm package: `chatgpt-browser-image-generation-mcp-server`
- downloadable Chrome extension bundle from `extension/`

Both artifacts should be built from the same repo state and version.

## Pre-Release

1. Confirm package version in [package.json](../package.json)
2. Confirm extension version in [manifest.json](../extension/manifest.json)
3. Keep those versions aligned
4. Review the runtime docs:
   - [README.md](../README.md)
   - [installing-the-cli.md](./installing-the-cli.md)
   - [mcp-client-configuration.md](./mcp-client-configuration.md)
   - [support.md](./support.md)
   - [chrome-web-store-submission.md](./chrome-web-store-submission.md)
   - [privacy-policy.md](./privacy-policy.md)

## Build

Run:

```bash
npm run build
npm run build:extension
```

## Test

Run:

```bash
npm test
```

## Package Verification

Run:

```bash
npm pack --dry-run
```

Verify the tarball includes:

- `dist/src/*`
- `extension/dist/*`
- `extension/manifest.json`
- `extension/popup.html`
- `extension/options.html`
- docs shipped through the package `files` list

Verify the tarball does not include:

- `dist/tests/*`
- `tests/*`
- `extension/src/*`
- repo-local scratch files

## Extension Verification

1. Reload the unpacked extension in `chrome://extensions`
2. Open the extension popup
3. Confirm:
   - bridge status is visible
   - handshake URL is correct
   - server version is shown
   - expected extension version is shown
4. Open `https://chatgpt.com`
5. Confirm the popup reports a connected state

## Chrome Web Store Readiness

1. Prepare the listing copy from [chrome-web-store-submission.md](./chrome-web-store-submission.md)
2. Host the final privacy policy from [privacy-policy.md](./privacy-policy.md) at a public URL
3. Add a public support URL
4. Capture fresh screenshots of the popup, options page, and live ChatGPT flow
5. Re-check that permissions and host permissions are still the narrowest necessary

## Current Distribution Decision

For the current release track:

- ship the npm package
- ship the extension as a downloadable/manual unpacked extension
- defer Chrome Web Store submission until the manual distribution path is stable

## End-to-End Verification

Run these checks against the fresh build:

1. `validate_browser_session()`
2. `generate_image_active_tab(...)`
3. `generate_image_new_chat(...)`
4. `generate_image_with_gpt(...)` against a manually opened GPT page

Verify:

- prompt submission works without manual intervention
- one final artifact is saved
- the saved image is fully rendered, not blurry or partial
- metadata JSON is written alongside the image

## npm Publish Readiness

Before publishing:

1. Remove `"private": true` if it is still present
2. Ensure package metadata is complete if needed:
   - repository
   - license
   - keywords
   - author or organization
3. Re-run:

```bash
npm pack --dry-run
```

If ready:

```bash
npm publish
```

## Chrome Extension Release Readiness

Before store submission:

1. Prepare store listing assets
2. Prepare privacy/support text
3. Keep extension version aligned with the npm package version
4. Archive the exact built extension bundle used for that release

## Release Record

For each release, record:

- package version
- extension version
- git commit or tag
- date
- any known limitations

## Recommended Release Gate

Do not release if any of these fail:

- build fails
- tests fail
- tarball includes tests or raw extension source
- extension popup shows version mismatch
- live generation requires manual keypress to submit
- saved artifact is incomplete or blurry
