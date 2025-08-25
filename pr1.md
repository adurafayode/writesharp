# WriteSharp public readiness PR (pr1)

This document summarizes all recommended edits to adapt the Shopify-internal refined code for a public, open-source release.

## Summary of key changes required

- Manifest: remove internal hosts/endpoints; generalize name/description; adjust CSP; verify resources.
- README: rewrite to public audience; remove Shopify-only processes and assets; add OSS setup and privacy notes.
- Package metadata: drop server scripts and unused deps; ensure license/author/repo fields; pin minimal dev deps or remove tests scaffold if unused.
- Source: replace Shopify proxy endpoint; neutralize Shopify voice in prompts; keep Zendesk copy workflow but generalize wording; gate console logging; consider optional model list.
- Assets: confirm icon licensing; remove internal images/links.

## Detailed recommendations by file

### manifest.json

1. Rename
   - name: "WriteSharp" (drop "for Support").
   - description: "AI-assisted writing clarity enhancer for web text areas."
2. Permissions and hosts
   - Remove Shopify-internal domains: `*.shopify.com`, `*.shopify.io`, `proxy.shopify.ai`.
   - Keep broadly useful hosts only if truly required for content_scripts matching; prefer fewer matches or use `"<all_urls>"` only if necessary for selection/extraction. Suggested set: `gmail.com`, `slack.com`, `zendesk.com`, `github.com` (consider allowing user-configurable injection instead of hardcoding).
   - If only selection + insertion is needed, `activeTab`, `scripting`, and `storage` should suffice. Avoid `host_permissions` unless you dynamically inject.
3. CSP
   - Remove `connect-src` to `https://proxy.shopify.ai`.
   - If calling OpenAI directly from the background, add `connect-src https://api.openai.com` or make endpoint configurable and documented.
4. Web accessible resources
   - Verify `src/zendesk-helper.js` is still required as WAR for injection; keep only necessary files. Confirm paths.
5. Action/icons
   - Paths look correct. Confirm 16/48/128 sizes map to actual files and naming consistency.

### README.md

1. Reframe audience
   - Replace Shopify-specific language and processes. New intro: tool helps anyone improve clarity/tone across common web editors.
2. Installation
   - Provide developer (load unpacked) instructions for public repo; add Chrome Web Store link placeholder if publishing later.
   - Remove Shopify account prerequisite.
3. Configuration
   - API key: instruct users to add their own OpenAI API key; clarify it is stored via `chrome.storage.sync` and only used client-side (or via optional proxy, see Security/Privacy section).
   - Models: list currently available models or make generic with note that options may evolve.
   - Custom prompts: keep; remove references to "Shopify-approved".
4. Contributing
   - Replace Shopify branching/process with standard GitHub flow; include Issues/PRs guidelines; code style kept concise.
5. Platform compatibility
   - Keep Zendesk note, but make generic: copy-to-clipboard for editors with strict policies. Call out Google Docs unsupported as before.
6. Privacy/Security
   - Document what data is processed, where API calls are sent (OpenAI), and storage location for key. Link to license.
7. Screenshots/assets
   - Verify demo image licensing/branding; keep or replace.

### package.json and lockfile

1. Remove server tooling
   - `server.js` is deleted; remove `start`, `dev`, and server deps (`express`, `helmet`, `cors`, `express-rate-limit`, `dotenv`, `node-fetch`) unless you explicitly support a local proxy.
2. Keep minimal dev setup
   - If tests are not present, remove Jest/Mocha config and deps. Otherwise add actual tests. Prefer minimal footprint for an MVCE.
3. Metadata
   - Fill `author`, `repository`, `homepage`, `bugs` fields.
   - Ensure `license` matches `LICENSE` (MIT).
4. Scripts
   - Add `build` (e.g., copy assets/zip) if you plan to distribute; otherwise leave empty.

### src/background.js

1. Endpoint
   - Replace `https://proxy.shopify.ai/v1/chat/completions` with `https://api.openai.com/v1/chat/completions` or read from `chrome.storage`/config so users can set a custom endpoint. Update CSP accordingly.
2. Prompts
   - Remove Shopify voice rules; use neutral system prompt focused on clarity, tone, and preservation of meaning/formatting.
3. Logging
   - Keep `DEBUG` flag and ensure no verbose `console.log` in production defaults.
4. Limits
   - Keep 2000 character limit configurable.

### src/content.js

- No Shopify references; retain selection capture and insertion logic.
- Confirm that insertion helpers avoid privileged operations on restricted editors; fallback behavior is OK.

### src/public/popup/\*

1. UI text
   - Remove "for Support" branding; generic labels.
2. Settings copy
   - Remove Shopify-specific messaging. Keep API key + model selection + custom prompt.
3. Clipboard workflow
   - Keep Zendesk-specific UI toggle but describe it generically.

### src/zendesk-handler.js and src/zendesk-helper.js

- Code is editor-specific, not company-specific. Keep, but ensure comments don’t mention Shopify. Retain copy-to-clipboard messaging.

### icons/

- Confirm icons are original or licensed for public use; keep MIT or embed attribution if required.

## Functional and policy considerations

- API usage: direct calls to OpenAI from extension have privacy implications. Provide a section describing alternatives: user’s own proxy, rate limits, and how keys are stored (sync storage) and used.
- Permissions minimization: consider removing most host matches and rely on user invoking the popup on any page; content script runs only when needed.
- Testing: either add minimal e2e/manual checklist or remove Jest config until tests exist.

## Proposed public defaults

- Name: "WriteSharp"
- Description: "AI-assisted writing clarity enhancer for web text areas."
- Endpoint: OpenAI API by default (configurable), no Shopify proxy.
- CSP: `connect-src 'self' https://api.openai.com` for extension pages.
- Hosts: minimal required for content injection; ideally keep matches small and documented.

## Migration checklist

- Update `manifest.json` per above.
- Update prompts and endpoint in `src/background.js`.
- Update copy and titles in `src/public/popup/*`.
- Rewrite `README.md` for OSS.
- Trim `package.json` deps/scripts; update metadata.
- Verify icons and screenshot asset rights.
- Final smoke test on Gmail, Slack, GitHub, Zendesk.

## Follow-ups (optional)

- Add options page for endpoint configuration and telemetry opt-in (none by default).
- Add build script to produce a signed zip.
- Add minimal telemetry-free metrics (local-only counters) documented in README.
