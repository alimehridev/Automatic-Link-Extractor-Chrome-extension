# Automatic Link Extractor — Project Guide

> **Audience:** AI coding assistants (and humans) who are about to modify this project.
> Read this whole file before changing code. It describes what every file does, how data
> flows, the exact storage/messaging contracts, known bugs, and the conventions to follow.

---

## 1. What this project is

A **Chrome extension (Manifest V3)** called **Automatic Link Extractor**. It does two things:

1. **Live DOM link extraction** — a content script watches the DOM of pages the user has
   "enabled" and automatically extracts links from DOM attributes (`href`, `src`,
   `action`, `data-src`, ...). Extracted links are stored per-origin and shown in a
   dashboard.
2. **JavaScript file crawler** — from the dashboard, the user can take the collected
   `.js` file URLs, fetch their source, and regex-extract more links (absolute + relative).

There is **no build step, no bundler, no package.json, no tests, no linter**. It is plain
JavaScript loaded directly by Chrome. Files run in several different contexts
(service worker, content script isolated world, extension page, and a web worker), which
is the single most important thing to keep in mind when editing.

---

## 2. Tech stack / platform

| Item | Value |
|---|---|
| Platform | Google Chrome, Manifest V3 |
| Language | Vanilla JavaScript (ES2020+), no TypeScript |
| UI | Plain HTML + CSS + DOM APIs (no framework) |
| Background | MV3 service worker (`background.js`) |
| Offscreen compute | Web Worker created from a Blob (`worker.js`) |
| Storage | `chrome.storage.local` |
| Build/dev tooling | None (load unpacked) |

---

## 3. Repository layout

```
Automatic Link Extractor - Chrome extension/
├── manifest.json              # Extension manifest (MV3)
├── background.js              # Service worker: badge + action click → open dashboard
├── content.js                 # Injected into every page: DOM watching + link extraction
├── worker.js                  # Web Worker: normalizes/dedupes URLs sent by content.js
├── dashboard.html             # Extension dashboard page (list origins, links, JS crawler modal)
├── README.md                  # User-facing readme
├── PROJECT_DOCUMENTATION.md   # Comprehensive Persian documentation & knowledge base
├── PROJECT.md                 # ← this file
├── todos                      # Empty placeholder file (unused)
└── assets/
    ├── images/                # icon-512.png, radar.png, screenshot1..3.png
    ├── styles/
    │   ├── style.css          # Dashboard + shared styles
    │   └── modal.css          # JS-crawler modal styles
    └── js/
        ├── pattern_matcher.js # Wildcard pattern parser and URL matcher
        ├── addorigin.js       # Origin list add/remove UI + storage init
        ├── dash_checker.js    # Decides main vs origin dashboard view from URL
        ├── dashboard.js       # Origin dashboard: sensitivities + links list + pagination
        ├── sensitivities.js   # Save MutationObserver sensitivity toggles
        ├── modal.js           # JS-file crawler modal (fetch JS, regex-extract links)
        ├── subdomains.js      # eTLD+1 root domain & subdomain extractor modal
        ├── custom_links.js    # Manual link importer modal for adding links to target
        └── helpers.js         # Shared dashboard helpers (copy, remove-all)
```

---

## 4. High-level architecture & data flow

There are **two independent extraction pipelines** that both write into the same
`chrome.storage.local` structure.

### 4.1 Pipeline A — Live DOM extraction (runs on every web page)

```
page load
   │
   ▼
content.js (isolated world, run_at = document_start, matches <all_urls>)
   │  reads chrome.storage "origins" + "sensitivities"
   │  if origin not enabled OR all sensitivities off → send badge "off", stop
   │
   ├─ earlyObserver (created synchronously, before async storage resolves)
   │     observes `document` {childList, subtree}, buffers added element nodes
   │
   ├─ creates Web Worker from worker.js via Blob URL
   │
   ├─ reads links from live DOM (whole document incl. <head>, shadow DOM,
   │     same-origin iframes), plus everything the earlyObserver buffered
   │
   ├─ on mutation (targeted): scans only added subtrees / changed attribute targets
   │
   └─ batches raw candidate values (150 ms debounce) → worker.postMessage({urls, base})
                                                              │
                                                              ▼
                                                     worker.js
                                                       resolve with new URL(v, base)
                                                       skip junk schemes/fragments
                                                       dedupe → postMessage([urls])
                                                              │
                                                              ▼
   content.js worker.onmessage ◄──────────────────────────────┘
     merges into chrome.storage "links"[origin] (+ location.href)
     updates badge (via background.js "setBadge")
     window.postMessage({action:"continue"})   ← currently unused
```

### 4.2 Pipeline B — JS file crawler (runs in the dashboard page)

```
dashboard.html
   │  user clicks "Extract links from JS files" (#get_js_links)
   ▼
modal.js
   │  builds JS file list from stored links matching (includes ".js" && startsWith "http")
   │  user selects files, optionally sets include/exclude regexes
   ▼
for each selected file: fetch(file) → text
   │  extract absolute links with absoluteRegex
   │  extract relative links with relativeRegex (quoted string literals only)
   │  strip trailing punctuation
   │  resolve every candidate against the JS file URL (response.url || file)
   │  validate with new URL(), apply include/exclude regexes, dedupe, sort
   ▼
textarea #output
   │  user clicks "Add links"
   ▼
merge into chrome.storage "links"[origin] → location.reload()
```

### 4.3 Standard Chrome extension interactions

- `chrome.action.onClicked` (toolbar icon) → `background.js` opens `dashboard.html`
  with `?origin=<current tab origin>` (if the origin is already enabled) or
  `?origin_add=<origin>` (to add it).
- Content script → background: `{type:"setBadge", text}` to set the toolbar badge.
- Dashboard pages talk directly to `chrome.storage.local` (no message passing needed).

---

## 5. Chrome storage schema (`chrome.storage.local`)

All keys are optional until first written; always read them defensively.

### `origins` — `string[]`
List of enabled origins, e.g. `["https://example.com", "http://localhost:3000"]`.
Initialized/extended in `assets/js/addorigin.js`.

### `sensitivities` — `{ [origin: string]: MutationObserverOptionsAs01 }`
Per-origin MutationObserver configuration. Values are stored as `0`/`1` (see
`sensitivities.js`) but `content.js` coerces them with `Boolean(...)`. When an origin is added in `addorigin.js`, all 6 options now default to `1`.

```jsonc
{
  "https://example.com": {
    "childList": 1,
    "subtree": 1,
    "attributes": 1,
    "attributeOldValue": 1,
    "characterData": 1,
    "characterDataOldValue": 1
  }
}
```

If **all** options for an origin are falsy, `content.js` treats the origin as inactive
for observation (it returns early and does not create a worker).

### `regexes` — `{ [origin: string]: { includes: string[], excludes: string[] } }`
Per-origin include and exclude regexes used by the JS crawler modal. Saved automatically to storage as the user enters or removes regexes.
```jsonc
{
  "https://example.com": {
    "includes": ["YOUR_REGEX"],
    "excludes": ["YOUR_REGEX"]
  }
}
```

### `links` — `{ [origin: string]: string[] }`
Extracted links, deduped per origin. Note the page's own URL (`location.href`) is always
added on each persist.

```jsonc
{
  "https://example.com": [
    "https://example.com/",
    "https://example.com/app.js",
    "https://cdn.example.com/lib.js",
    "https://example.com/api/users"
  ]
}
```

> All stored links are absolute: pipeline A (worker) resolves with the page base, and
> pipeline B (crawler) resolves against the JS file URL. Data written by older versions may
> still contain relative entries.

---

## 6. Messaging / contracts

### 6.1 Content script → Background (`chrome.runtime.sendMessage`)
```js
{ type: "setBadge", text: "12" }   // text can be "off"
```
Handled in `background.js`; sets the per-tab badge text.

### 6.2 Content script ↔ Worker (Web Worker `postMessage`)
Sent *to* `worker.js` (structured-cloneable object — never pass DOM nodes!):
```js
{ urls: string[], base: string }   // base = document.baseURI
```
Returned *from* `worker.js`:
```js
string[]                            // normalized, absolute, deduped links
```

### 6.3 Content script → page (`window.postMessage`)
```js
{ action: "continue", url: location.href }
```
**Currently unused** — nothing in this project listens for it. Kept for compatibility;
safe to remove if you confirm no external consumer.

### 6.4 Worker `self.location.origin` caveat
Inside a Web Worker, `location` is the **blob/worker** location, not the page. That is
why the content script sends `base` (the page `document.baseURI`) and the worker resolves
relative URLs against it. Do not reintroduce `location.origin` inside `worker.js`.

---

## 7. File-by-file reference

### `manifest.json`
- `manifest_version: 3`
- `permissions`: `storage`, `scripting`, `tabs` (`scripting` is currently **unused**).
- `host_permissions`: `<all_urls>`.
- `background.service_worker`: `background.js`.
- `content_scripts`: `assets/js/pattern_matcher.js` followed by `content.js` on `<all_urls>`, **`run_at: "document_start"`**, top
  frame only (`all_frames` is not set).
- `web_accessible_resources`: exposes `worker.js` to `<all_urls>` so the content script
  can `fetch` it and create the worker.

### `assets/js/pattern_matcher.js`
- Core wildcard matching logic supporting:
  - Subdomain wildcards: `https://*.google.com` (matches root domain + all subdomains).
  - Path wildcards: `https://google.com/*`, `https://google.com/search/*`.
  - Protocol & port wildcards: `*://*.google.com/*`, `http://localhost:*`.
- Provides `escapeRegex`, `patternToRegex`, `matchPattern`, and `findMatchingPatterns`.
- Loaded in service worker via `importScripts`, in content script via manifest, and in dashboard page via `<script>`.

### `background.js` (service worker)
- Imports `assets/js/pattern_matcher.js`.
- `chrome.runtime.onMessage` → handles `setBadge`, sets `chrome.action` badge text/color.
- `chrome.action.onClicked` → matches tab URL against `origins` patterns via `findMatchingPatterns`:
  - If matched, focuses existing dashboard tab for that pattern or opens `dashboard.html?origin=<pattern>`.
  - Otherwise, opens `dashboard.html?origin_add=<origin>`.

### `content.js` (content script, isolated world) — **most complex file**
Responsibilities and structure (top to bottom):

- **`LINK_ATTRIBUTES` / `LINK_SELECTOR`** — the list of attributes treated as link
  sources: `href, src, srcset, action, formaction, data-url, data-href, data-src, poster,
  cite, background, profile, manifest, longdesc, data`.
- **`readElementLinks(el, out)`** — reads those attributes off one element into a `Set`
  of *raw* values. Special-cases `srcset` (`"url 1x, url 2x"` → `url`, `url`).
- **`readRootLinks(root, out)`** — recursively reads an element/document, including open
  **shadow roots** (`element.shadowRoot`).
- **`readFrameLinks(doc, out)`** — recurses into **same-origin iframes** via
  `frame.contentDocument` (cross-origin throws → ignored).
- **`readNodeLinks(node, out)`** — used for incremental mutation scans (an added subtree,
  or an element whose attribute changed).
- **Early observer** — `earlyNodes` + `earlyObserver` are created **synchronously at
  `document_start`**, observing `document {childList, subtree}`, so nodes added during
  parsing (and removed before settings load) are still reachable by reference.
- **`drainEarlyNodes()`** — returns buffered nodes (including `takeRecords()`) and
  disconnects the early observer.
- **`readWholeDocument(out)`** — `readRootLinks(documentElement)` + `readFrameLinks`.
- **Main IIFE-ish flow** (top-level `chrome.storage.local.get`):
  1. Read `origins`; if `origin` not included → `drainEarlyNodes()`, badge `"off"`, stop.
  2. Read `sensitivities`; build `config` from defaults + saved values (coerced to boolean).
     If every option is `false` → `drainEarlyNodes()`, stop.
  3. `createWorker("worker.js")` — fetch → Blob → object URL → `new Worker(url)`.
  4. Wire up `pending`/`seen` sets, `scheduleFlush()` (150 ms debounce), `flush()`,
     `queue()`, `persist()` (storage writes chained via a promise to avoid races).
  5. Create the real `MutationObserver` with the user's `config`. On each batch it scans
     **only** added element nodes and attribute-change targets, and also attaches to any
     shadow roots it finds.
  6. `startObserving()` — observes `document.documentElement`; if it does not exist yet,
     waits with a temporary `document` observer until it does.
  7. Initial capture: drain the early observer, scan the whole document, `queue(...)`, then
     `startObserving()`.

**Invariants to preserve:**
- Never pass DOM nodes through `postMessage` (not structured-cloneable) — always send
  primitives/plain objects.
- Keep observing `documentElement` (not `document.body`) so `<head>` is covered.
- Use `document.baseURI` as the base for URL resolution (passed to the worker).
- Keep storage writes serialized in `persist()` (concurrent read-modify-write loses data).

### `worker.js` (Web Worker)
- Receives `{urls, base}`.
- Skips values that are empty, start with `#`, or start with any `SKIPPED_PREFIXES`
  (`data:`, `blob:`, `javascript:`, `about:`, `chrome:`, `chrome-extension:`, `edge:`,
  `vbscript:`).
- Resolves each raw value with `new URL(value, base).href`; skips unparseable values and
  values that resolve into a skipped scheme.
- Returns `[...new Set(links)]`.

### `dashboard.html`
Single-page host for **both** dashboard views. Key elements/IDs:
- Main view: `#originInput`, `#addOriginBtn`, `#originList`, `#data`, `#added_origin`.
- Origin view: `.backBtn`, sensitivity checkboxes `#all`, `#childList`, `#subtree`,
  `#attributes`, `#attributeOldValue`, `#characterData`, `#characterDataOldValue`,
  `#save_sensitivities`, `#origin`, `#links`, `.pagination`, `#copy_all`,
  `#get_js_links`, `#removeAllBtn`.
- JS-crawler modal `#myModal`: `#jsFileList`, `#jsFileCount`, `#selectAllNoneBtn`,
  include/exclude regex containers (`#add-regex-include`, `#add-regex-exclude` are class
  hooks), `#progression`, `#numeric-progression`, `#crawlBtn`, `#current_file`, `#output`,
  `.links-number`, `#copyBtn`, `#addLinksToTargetBtn`, `#closeModalBtn`.
- Scripts loaded, in order: `addorigin.js`, `dashboard.js`, `sensitivities.js`,
  `modal.js`, `helpers.js`, then `dash_checker.js`.

### `assets/js/dash_checker.js`
Parses the URL to decide which view to show: if `origin=` is present → show the origin
dashboard; if `origin_add=` (or neither) → show the add-origin view, pre-filling
`#originInput` for `origin_add=`. Its URL parsing is string-split based (fragile — see
Known issues).

### `assets/js/addorigin.js`
- `remove_origin_from_list(payload)` — removes an origin from `origins` (and reloads).
  Only touches `origins`, **not** `sensitivities`, `regexes`, or `links`.
- Add button: builds a row, writes to `origins`, initializes `sensitivities` (defaults all flags to 1),
  `regexes` (`{includes: [], excludes: []}`), and `links` (`[]`) for the new origin, and immediately
  redirects the window to `?origin=<value>` (commit `4c681b0`).
- On load: renders the origin list (reversed) into `#data`.
- Note: uses `dataDiv` which is declared *after* the add handler with `const`
  (`const dataDiv = document.getElementById("data")`) — works because the handler runs
  later, but be careful if reordering.

### `assets/js/dashboard.js`
- `loadOriginData(origin)`:
  - Loads sensitivities into the checkboxes; sets `#all` if all are checked.
  - Loads links for the origin and renders 5 per page (`.link` rows) with pagination
    `.page-button`s and ellipsis handling.
  - Reactive live search input (`#searchLinksInput`): filters displayed links in real-time on keystroke
    and recalculates pagination over filtered results.
  - In-place dynamic pagination navigation (updates DOM and synchronizes URL params `page` and `q` without
    reloading the page).
- `#all` checkbox toggles all sensitivity checkboxes.
- `.backBtn` navigates to the dashboard root.
- Per-link remove button (`remove_link_from_origin`).

### `assets/js/sensitivities.js`
- `#save_sensitivities` writes the six MutationObserver flags (as `0`/`1`) into
  `sensitivities[origin]`.
- Keeps `#all` in sync when individual toggles change.

### `assets/js/helpers.js`
- Bearer of shared dashboard helpers: `getQueryParam`, `copyToClipboard`.
- `#removeAllBtn` clears `links[origin]` (then reloads).
- `#copy_all` copies all links (or only search-filtered links if a query is active in `#searchLinksInput`)
  joined by newlines to the clipboard.

### `assets/js/modal.js` (JS crawler)
- `#get_js_links` opens the modal and builds `jsLinksCache`, the JS files to crawl:
  `links.filter(l => l.includes(".js") && l.startsWith("http"))`.
  → Because extracted links are now absolute, relative JS chunks (e.g. `./chunk-1.js`)
  appear here as absolute URLs and can be crawled on a later run.
- `renderJsFileList` renders checkboxes (with truncated labels + `title` attribute) and an
  "open" link; also seeds one example include/exclude regex row (`YOUR_REGEX`).
- `getCheckedLinks` / `updateSelectToggleText` / `#selectAllNoneBtn` manage selection.
- `#crawlBtn`:
  - `fetch(link, { method: "GET", headers: { "Content-Type": "text/plain" } })`
    (the `Content-Type` on a GET is unusual/harmless).
  - Extraction regexes (see "JS crawler extraction" below).
  - `stripTrailingPunctuation(link)` — trims sentence punctuation from absolute matches.
  - `resolveAgainst(baseUrl, value)` — resolves each candidate against the **JS file URL**
    (`response.url || link`, i.e. the post-redirect URL) so relative links become absolute:
    `/x` → file origin, `./x` / `../x` → file directory, `//host` → file scheme.
  - `isValidLink(link)` — validates the resolved URL.
  - Applies user include regexes (`new RegExp(pattern, "i")`) then exclude regexes, dedupes
    and sorts, writes to `#output`, updates progress + per-file status code.
- `#addLinksToTargetBtn` merges `#output` lines into `links[origin]` and reloads.
- `#copyBtn` copies the output textarea.

### `assets/js/subdomains.js` (Origins & Subdomains Extractor)
- Activated by `#extract_subdomains` button below JS crawler in dashboard.
- By default displays all discovered origins/domains across all stored links.
- Includes an optional checkbox (`#only-tld-subdomains`) to filter down strictly to eTLD+1 subdomains of the target domain.
- Includes an optional checkbox (`#include-protocol`) to toggle between clean hostnames and full origins (`https://...`).
- Identifies the target's eTLD+1 root domain (with multi-part suffix support for `.co.uk`, `.ac.ir`, `.com.tr`, etc.).
- Renders results inside `#subdomainModal` with target root domain label, item count, and clipboard copy button.

### `assets/js/custom_links.js` (Manual Links Importer)
- Activated by the `+` button (`#openAddLinksModalBtn`) next to `🔍 Extracted Links` in the dashboard.
- Opens `#addLinksModal` with target origin indicator, editable links textarea, and live link count.
- Trims, filters, and deduplicates custom links with `Set` before merging into `chrome.storage.local.links[origin]`.
- Automatically refreshes the dashboard view upon successful addition.

### `assets/styles/*.css`
- `style.css` — dashboard layout, `.page`/`.link` rows, `.keyword`, toggle switches,
  pagination buttons, `.removeLogBtn`, etc.
- `modal.css` — modal, JS file list, `.crawler-options`/`.regex`/`.custom-regex`,
  `.js-status-code`, progress bar, output textarea.
- UI edits usually require touching both the HTML structure and these stylesheets.

---

## 8. Feature deep dives

### 8.1 Live DOM extraction — which attributes are read
`LINK_ATTRIBUTES` in `content.js`:
`href`, `src`, `srcset`, `action`, `formaction`, `data-url`, `data-href`, `data-src`,
`poster`, `cite`, `background`, `profile`, `manifest`, `longdesc`, `data`.

To add a new attribute, append it to `LINK_ATTRIBUTES` (the CSS selector
`LINK_SELECTOR` is derived from it automatically). `srcset`-style multi-value attributes
need special handling in `readElementLinks`.

### 8.2 Observation strategy & the sensitivity flags
- Content script runs at `document_start` and captures parse-time DOM via the early
  observer (so nodes injected and removed during load are still seen).
- After settings load, a `MutationObserver` on `document.documentElement` uses the
  user-configured flags. The flags map 1:1 to `MutationObserver.observe` options.
- Only `childList` (added nodes) and `attributes` (changed targets) are consumed; the
  `characterData*` and `attributeOldValue` flags are passed through for API compatibility
  but their data is not used by the extractor.
- Shadow roots get their own `observe(...)` calls when discovered.

### 8.3 Worker URL normalization
- Worker cannot see the page; it resolves against `base` (= `document.baseURI`).
- Junk-scheme filtering happens both on the raw value and the resolved value.
- Fragment-only values (`#...`) are dropped; relative paths (e.g. `/api/x`) resolve to
  absolute URLs.

### 8.4 JS crawler extraction (regexes)
Current regexes in `modal.js` (validated by tests — these replaced weaker originals):

```js
// Absolute: any listed scheme, or a protocol-relative //host URL.
const absoluteRegex = /(?:(?:https?|ftps?|wss?):)?\/\/[^\s"'`<>\\^|{}\[\]]+/gi;

// Relative: only when it is a whole quoted string literal, so it cannot
// re-match the path part of an absolute URL.
const relativeRegex = /["'`]((?:\.\.?\/|\/(?!\/))[^"'`\s\\]*)["'`]/g;
```

- `absoluteRegex` is global (`g`) and case-insensitive (`i`); results are run through
  `stripTrailingPunctuation`.
- `relativeRegex` captures the URL in **group 1**, so it must be consumed with
  `matchAll` (not `match`), e.g. `[...content.matchAll(relativeRegex)].map(m => m[1])`.
- Every candidate is resolved against the **JS file URL** with
  `resolveAgainst(response.url || link, value)` (so `/x` → file origin, `./x` / `../x` →
  file directory, `//host` → file scheme) before being concatenated, deduped,
  emptied-filtered, filtered by `isValidLink`, then by the user's include/exclude regexes.
- Known trade-off: regex over arbitrary JS is heuristic. For higher fidelity, extract
  string/template literals first and validate each with `new URL(value, fileUrl)`.

---

## 9. Known issues / gotchas (read before "fixing")

These are real defects or sharp edges; some are intentional, some are bugs:

1. **Per-link "x" button in `dashboard.js` (FIXED).** Now calls `remove_link_from_origin(origin, link)` to delete single links safely.
2. **Dashboard zero links crash (FIXED).** Guarded `page_count > 0` before calculating `page_range` and rendering pagination.
3. **`dash_checker.js` URL parsing (FIXED).** Migrated to robust `URLSearchParams` handling for both `origin` and `origin_add`.
4. **Relative-link handling (largely resolved).** Pipeline A (worker) and pipeline B
   (crawler, via `resolveAgainst` against the JS file URL) now store absolute URLs, so the
   dashboard opens them correctly. Remaining caveats: a path-absolute link (`/api/x`) found
   in a **cross-origin/CDN** script resolves to the CDN origin, not the target site; and a
   page's `<base href>` is unknowable when crawling a fetched file. Legacy stored data may
   still contain relative entries.
5. **User include/exclude regexes can throw.** `new RegExp(pattern, "i")` is called on
   free-text from `contenteditable` spans; an invalid pattern throws inside the filter and
   breaks extraction for that file. Wrap in try/catch or pre-validate.
6. **`modal.js` builds HTML with `div.innerHTML` interpolating `link`** into attributes
   (`title="${link}"`, `href="${link}"`). A crafted URL containing quotes could inject
   markup. Prefer `textContent` / `setAttribute`.
7. **`worker.onmessage` posts `window.postMessage({action:"continue"})`** to the page, but
   nothing consumes it. Dead code.
8. **`scripting` permission is declared but unused.**
9. **Origin deletion storage cleanup (FIXED).** `remove_origin_from_list` now removes `sensitivities`, `regexes`, and `links` associated with the pattern.
10. **Blob-worker CSP:** creating a Worker from a `blob:` URL inside a content script can be
    blocked by a page's Content-Security-Policy (`worker-src`) on some sites. If links stop
    appearing on a specific site, check the console for CSP worker errors.
11. **Early observer runs briefly on every page** (even disabled origins) until storage
    resolves and it is disconnected. Small but real startup cost.
12. **`origin` global:** `content.js` relies on the `origin` global (page origin). Fine in
    a content script, but do not copy that pattern into the worker/dashboard.
13. **`todos` is an empty file**; not wired to anything.

---

## 10. Development & testing

1. `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select this
   folder.
2. After editing extension files, click **Reload** on the extension card. For content
   script changes also reload the target tab (or the extension reload does it).
3. Debugging contexts:
   - Page content script: DevTools console of the target page (isolated world).
   - Worker: `chrome://inspect` → inspect the page → Workers, or add temporary logging.
   - Service worker: the "service worker" link on the extension card.
   - Dashboard: DevTools on the `dashboard.html` tab.
4. No automated tests exist. Verify behavior manually; if you add logic that can be unit
   tested (e.g. the crawler regexes), consider testing with `node --check` at minimum for
   syntax, and small Node scripts for pure functions.
5. Syntax check quickly with: `node --check content.js` (works for all JS files here).

---

## 11. Guidelines for AI editors

- **Respect the execution contexts.** `content.js` = content script (isolated world, has
  DOM, no `chrome.` page APIs beyond extension APIs). `worker.js` = Web Worker (no DOM, no
  page `location`). `background.js` = service worker (no DOM). Dashboard scripts = ordinary
  extension page with full DOM + `chrome.storage`.
- **Never pass DOM nodes across `postMessage`.** Only structured-cloneable data.
- **Always send `base` with URLs to the worker** and resolve with `new URL(value, base)`.
- **Keep storage writes serialized** in `content.js`'s `persist()` (the current promise
  chain). Concurrent `get`/`set` on the same key loses data.
- **Read storage defensively:** `result["links"] || {}`, `result["origins"] || []`,
  `result["sensitivities"] || {}`. Not all keys exist on a fresh install.
- **Add new link attributes** via `LINK_ATTRIBUTES`; keep the derived selector pattern.
- **Keep the two extraction pipelines separate conceptually.** Pipeline A (DOM) does not
  regex HTML; it walks the live DOM. Pipeline B (crawler) regexes fetched JS text.
- **Style conventions (observed in repo):**
  - `content.js` and `worker.js` use **2-space** indentation and `const`/`let`.
  - Dashboard scripts (`assets/js/*`) use a mix of **4-space** and 2-space and occasional
    missing semicolons — match the surrounding file, don't reformat wholesale.
  - Functions are mostly named `verbNoun`; storage keys are lower-case plural nouns.
- **When you change a regex that uses capture groups**, update its consumer (`match` vs
  `matchAll`) accordingly.
- **Prefer `textContent`/`setAttribute` over `innerHTML`** when inserting dynamic values.
- **Do not rename storage keys or the message `type` strings** without updating every
  reader: `origins`, `sensitivities`, `links`, and `"setBadge"`.
- **There is no build.** Files are shipped as-is; keep them browser-compatible (no
  TypeScript, no bare imports, no Node APIs).

---

## 12. Suggested improvements / roadmap (non-binding)

- Fix the per-link remove button and add a real "remove single link" helper.
- Guard `loadOriginData` against empty link arrays; simplify the pagination computation.
- Replace `dash_checker.js` string splitting with `URLSearchParams`.
- Validate/fuzz the include/exclude regexes in the modal (they currently `new RegExp()`
  raw user text and can throw).
- Replace `innerHTML` interpolation in `renderJsFileList` with safe DOM APIs.
- Remove the unused `window.postMessage({action:"continue"})` and the `scripting`
  permission if truly unused.
- Optionally capture resource-timing entries (`performance.getEntriesByType("resource")`) to
  also catch scripts injected and removed before `document_start` capture, and attach
  observers to same-origin iframe documents for live iframe content.
- Consider dropping the Blob-worker approach in favor of a normal message-channel/module
  worker strategy if CSP blocking becomes a problem on real sites.
- Add a small test harness for the crawler regexes and URL normalization.

---

## 13. Glossary

- **Origin** — here, a page origin string like `https://example.com` (the key for all
  storage maps). Not to be confused with the `origin` JS global.
- **Sensitivity** — the per-origin MutationObserver option flags controlling how the DOM
  is watched.
- **Pipeline A** — live DOM extraction (`content.js` + `worker.js`).
- **Pipeline B** — JS file crawler (`modal.js`).
- **Early observer** — the synchronous MutationObserver created at `document_start` to
  catch parse-time nodes.
- **Raw value vs resolved link** — raw values are attribute strings (possibly relative);
  resolved links are absolute URLs produced by the worker/crawler.

---

## 14. Recent significant changes (context for why the code looks like it does)

- `content.js` was rewritten to read the **live DOM** (whole document incl. `<head>`,
  shadow DOM, same-origin iframes) instead of regexing `document.body.innerHTML`. The old
  approach missed `<head>` scripts and passed a non-cloneable DOM node to the worker.
- The content script now runs at `document_start` with an early observer, and observes
  `documentElement` (not `document.body`).
- URL resolution moved to `document.baseURI` (passed to the worker) because a worker's
  `location` is the blob origin, not the page.
- `modal.js` crawler regexes were replaced with the current, better-tested pair, plus
  `stripTrailingPunctuation` and `isValidLink` validation.
- The crawler now resolves every extracted link to an absolute URL against the JS file URL
  (`response.url || link`) via `resolveAgainst`, so relative links are stored usable.
- **`sensitivities` default to 1:** New origins added via `addorigin.js` now default all 6
  sensitivity flags to `1` (commit `93f321e`).
- **Persistent regexes in storage:** The include/exclude patterns in the JS crawler modal are now
  persisted to `chrome.storage.local.regexes[origin]` on every keyup/removal (`f3dd905`).
- **URL decode option in crawler:** Added `#decode-urls` checkbox in the modal which applies
  `decodeURIComponent` to extracted URLs when checked (`c59309d`).
- **Redirect on origin creation:** `addorigin.js` now immediately redirects to the newly added
  origin's dashboard tab (`4c681b0`).
- **Wildcard Pattern Support:** Added `assets/js/pattern_matcher.js` supporting subdomain wildcards
  (`https://*.google.com` matching root + all subdomains), path wildcards (`https://google.com/*`,
  `https://google.com/search/*`), and protocol wildcards.
- **Content & Background Pattern Matching:** `content.js` and `background.js` now match against
  active patterns dynamically; multiple matching patterns are all updated when persisting links.
- **Dashboard Stability Fixes:** Fixed zero-links pagination crash, single-link removal handler,
  storage cleanup on origin removal, and URL parameter parsing with `URLSearchParams`.
- **Origins & Subdomains Extractor:** Added `#extract_subdomains` button, `#subdomainModal`, and
  `assets/js/subdomains.js`. Displays all discovered origins by default, with an optional `#only-tld-subdomains`
  checkbox for root domain eTLD+1 subdomains, protocol toggle, and clipboard copy.
- **In-Memory Regex Filtering in Subdomains Modal:** Added Include and Exclude regex filters to
  `#subdomainModal` replicating the JS crawler UI (`.custom-regex` pills with `contenteditable` and remove button),
  applying live regex matching to displayed origins/subdomains without persisting to storage.
- **Subdomains Modal UI Refinement:** Cleaned up the modal footer, removing redundant buttons and standardizing on the top copy button and live reactive filtering.
- **Manual Links Importer:** Added a `+` button next to `🔍 Extracted Links` in `dashboard.html` and modal `#addLinksModal` handled by `assets/js/custom_links.js`, allowing users to paste and append custom links into the target's link storage with automatic deduplication.
- **Search with Pagination & Filtered Copy:** Added a live search input (`#searchLinksInput`) below the extracted links header with real-time substring filtering, dynamic in-place pagination, seamless URL synchronization (`page` and `q`), and updated `#copy_all` to strictly copy search-filtered results when an active search query is present.
