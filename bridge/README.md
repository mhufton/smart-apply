# Claude CLI bridge

Routes Smart Apply's LLM calls through your **locally logged-in Claude CLI**
(Claude Code) instead of a paid Anthropic API key. Uses your Claude
subscription and defaults to **Opus 4.8**.

## Why this exists

A Chrome extension can't talk to the `claude` CLI directly — the CLI has no
inbound HTTP server. This is a tiny local shim (Node built-ins, zero deps) that
speaks the OpenAI-compatible `/v1/chat/completions` protocol the extension
already uses, and fulfils each request by running `claude -p` under the hood.

## Setup

1. Make sure the CLI works and you're logged in:
   ```sh
   claude --version
   claude -p "say hi"        # should print a reply, no API key needed
   ```
2. Start the bridge (from the repo root) and leave it running:
   ```sh
   npm run bridge
   ```
3. Reload the extension (the manifest changed — needs an unpacked reload), open
   **Settings → AI Provider**, pick **Claude CLI**, leave the API key blank, and
   Save. Endpoint and model are pre-filled (`http://localhost:4141/v1`,
   `claude-opus-4-8`).

## Notes

- **Subscription, not API.** Calls run on your Claude login (`apiKeySource: none`),
  so there's no per-token dollar charge — but they count toward your plan's
  5-hour rate limit. Each call also carries ~17k tokens of Claude Code harness
  overhead (the low-overhead `--bare` mode is disabled because it would force an
  API key). Fine for a CV co-pilot's handful of calls; not for high volume.
- **Want faster/cheaper small calls?** In Settings, set the *Small model* to
  `claude-haiku-4-5` (fit analysis, parsing, chat) and keep *Large* on
  `claude-opus-4-8` for CV + cover-letter generation.
- **No tools.** The bridge denies all CLI tools, so the model only generates
  text — it can't read or write files on your machine.
- **Config via env:** `SMART_APPLY_BRIDGE_PORT` (default 4141),
  `SMART_APPLY_MODEL` (default `claude-opus-4-8`), `CLAUDE_BIN` (path to the CLI).

## Auto-start (launchd)

The bridge is installed as a per-user LaunchAgent so it starts on login and
restarts if it crashes — no terminal to keep open.

- Plist: `~/Library/LaunchAgents/com.smartapply.bridge.plist`
- Logs: `~/Library/Logs/smart-apply-bridge.log` (and `.err.log`)

Manage it:
```sh
# restart (e.g. after editing server.mjs)
launchctl kickstart -k gui/$(id -u)/com.smartapply.bridge

# status
launchctl print gui/$(id -u)/com.smartapply.bridge | grep -E 'state|pid'

# stop + disable until next login
launchctl bootout gui/$(id -u)/com.smartapply.bridge

# (re)install after editing the plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.smartapply.bridge.plist
```

The plist hard-codes absolute paths (`/opt/homebrew/bin/node`,
`CLAUDE_BIN=~/.local/bin/claude`, `HOME`) because launchd does not inherit your
shell environment. If you move the repo or change node/claude install paths,
edit the plist and re-bootstrap.
