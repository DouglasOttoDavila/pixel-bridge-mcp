# GitHub Release Checklist

This checklist is for creating a GitHub release that distributes:

- the npm package version tag
- a downloadable/manual extension bundle
- release notes that point users to the correct install docs

Use this together with [release-checklist.md](./release-checklist.md).

## Before Tagging

1. Confirm the package version in [package.json](../package.json).
2. Confirm the extension version in [manifest.json](../extension/manifest.json).
3. Ensure the release commit has passed build, test, and manual end-to-end checks.
4. Confirm `npm pack --dry-run` looks correct locally.

## Build Release Assets

1. Run:

```bash
npm run build
npm run build:extension
```

2. Create the npm tarball:

```bash
npm pack
```

3. Archive the extension directory that end users should load:

Suggested contents:

- `extension/dist/`
- `extension/manifest.json`
- `extension/popup.html`
- `extension/options.html`
- `extension/README.md`

Suggested archive name:

```text
chatgpt-extension-bridge-<version>.zip
```

## Tag And Release

1. Create a git tag such as:

```text
v0.1.0
```

2. Push the tag.
3. Create a GitHub release from that tag.
4. Attach:
   - the npm tarball from `npm pack`
   - the extension zip archive
5. In the release notes, link:
   - [Installing The CLI](./installing-the-cli.md)
   - [MCP Client Configuration](./mcp-client-configuration.md)
   - [Support](./support.md)
   - [Privacy Policy Draft](./privacy-policy.md)

## Release Notes Minimum Content

Include:

- version
- major changes
- known limitations
- install/update instructions
- extension/manual install note
- any migration or version-pairing warning

## Do Not Release If

- the package and extension versions do not match
- the extension popup shows version mismatch
- the latest live image-generation run needs manual intervention
- the latest saved image artifact is partial, blurry, or duplicated
