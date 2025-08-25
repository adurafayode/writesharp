# WriteSharp v1.1.0

Release date: 2025-08-24

## Highlights

- Public-ready refactor of Shopify-internal build.
- Neutralized prompts and removed Shopify-specific hosts/endpoints.
- Consolidated project to repository root for simpler development.

## Changes

- manifest.json
  - Renamed extension to "WriteSharp"; updated description.
  - Minimized `host_permissions` (Gmail, Slack, Zendesk, GitHub).
  - CSP now allows `connect-src https://api.openai.com` and removes Shopify proxy.
- background.js
  - Endpoint set to `https://api.openai.com/v1/chat/completions`.
  - Neutral, public-friendly system prompt.
- popup UI
  - Title and copy updated to general audience.
- README
  - Rewritten for OSS; single canonical README.
- package.json
  - Removed server/test deps and scripts; added basic zip build.
  - Populated `author`, `repository`, `bugs`, `homepage` fields.
- Build
  - Excludes `Archive.zip` and `repomix-output.txt`.
- Repo structure
  - Promoted `WriteSharp/` into repo root; removed legacy duplicates.

## Notes

- Load unpacked from repo root (`chrome://extensions`).
- API key stored via `chrome.storage.sync`; no telemetry.

## Checks

- Built distributable: `dist/writesharp.zip`.
- Lints clean for modified files.
