# FAQ

## Does this server use stdio, SSE, or HTTP?

Right now the MCP server is intended to be used over `stdio`.

Internally, the Chrome extension still talks to the local Node process over a localhost bridge, but that is not the external MCP transport.

## Do I need both the npm package and the Chrome extension?

Yes.

The npm package provides the MCP server. The Chrome extension is what lets the server work against your real signed-in `chatgpt.com` browser session.

## Does it work if the ChatGPT tab is not active?

Yes, that is the intended current behavior.

The system can keep using a background ChatGPT tab, and it can also bootstrap a new ChatGPT tab without making it active.

## Does it work if no ChatGPT tab is open?

Yes, for the supported extension-backed flows the server can open a background ChatGPT tab and proceed.

## Why is `generate_image_with_gpt(...)` more limited?

Because the MVP does not yet navigate the GPT directory automatically.

Today, that workflow expects the correct GPT page to already be open, and then it verifies the selected tab before using it.

## Why is GitHub Copilot coding agent on GitHub.com not supported?

Because that agent runs remotely, while this project depends on:

- a local Chrome extension
- a local signed-in ChatGPT browser session
- a local localhost bridge

That architecture only makes sense on the user’s own machine.

## Is Claude Desktop supported?

Not as a polished install target yet.

Claude Code is a practical target today. Claude Desktop would need a proper desktop-extension bundle for this repo.

## Where are the images saved?

By default:

```text
<runtime-home>/artifacts/generated-images/chatgpt/YYYY-MM-DD/
```

The runtime home defaults to an OS app-data location unless `CHATGPT_RUNTIME_HOME` is set.

## Why does the extension popup show version mismatch?

Because the Chrome extension bundle and the npm package version do not match.

Reinstall or reload them as a pair from the same release.

## Why does the prompt appear in ChatGPT but not send?

This usually points to one of these:

- stale extension content script
- stale ChatGPT tab state
- DOM changes in ChatGPT

First retry:

1. reload the unpacked extension
2. refresh the `chatgpt.com` tab
3. retry the tool call

## Why is the saved image blurry or incomplete?

That means the capture path likely triggered before the final render stabilized, or ChatGPT changed how the image is updated in the page.

The current code already waits for final rendered content, but this remains a browser-automation risk area.

## Can I publish this to npm and keep the extension manual-only?

Yes. That is the current documented release strategy.

## Can I publish the extension to the Chrome Web Store later?

Yes. The repo now includes release and store-prep docs for that future step.

## How do I know the install worked?

The shortest real check is:

1. load the packaged extension
2. start the MCP server
3. run `validate_browser_session()`
4. run `generate_image_active_tab(...)`
5. verify the saved image is complete and matches the ChatGPT result
