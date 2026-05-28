# Cursor Prompt: Popup Summary, Sticky Problem Header, and Full Dashboard

Build the Overfetch extension flow where the browser action popup shows only a compact, FOMO-driven summary and every deeper action opens a light-mode full-page extension dashboard. Add a single top-level refresh button, keep the main overfetching problem sticky at the top of the dashboard, persist the report through page refreshes, and add a deduped refetch/rebuild flow.

## Product Goal

Users should understand the overfetching problem in under 5 seconds from the popup, then click `See Full Report` or `Find more` to inspect all request, field, duplicate, and optimization details in a dedicated `dashboard.html` extension page.

## Required Behavior

- Keep the popup compact and summary-first.
- Show the highest-signal metrics in the popup: total payload, used by UI, wasted bytes, waste percent, request count, and top waste endpoints.
- Use FOMO copy in the popup CTA, for example: "Your slowest payload leaks are waiting" and "See every unused field, duplicate call, and endpoint ranked by wasted bytes."
- Add a CTA button labeled `See Full Report` and a secondary text action labeled `Find more`.
- Both popup actions must open `browser.runtime.getURL('/dashboard.html?tabId=<active-tab-id>')` in a new browser tab and close the popup.
- Add a full-page light-mode `dashboard.html` entrypoint.
- The dashboard must load the selected tab's current analytics snapshot from the background worker.
- Add exactly one top-level dashboard button labeled `Refresh`.
- Place the `Refresh` button in the top header, aligned to the right.
- `Refresh` must reload/rebuild the dashboard data from the extension background state without clearing captured data.
- The dashboard can still auto-refresh in the background, but there should only be one visible manual refresh control.
- Keep the primary "problem" summary sticky at the top of the dashboard content. This should include the headline problem, wasted bytes, waste percent, request count, and worst endpoint.
- The sticky problem summary must remain visible while users scroll through requests, fields, duplicates, and endpoint detail sections.
- The sticky problem summary must not disappear or reset when `dashboard.html` itself is refreshed.
- Persist the last known dashboard snapshot per inspected tab in `browser.storage.local`, keyed by `tabId`, so a normal dashboard page refresh immediately restores the last report before live data arrives.
- When new live data arrives from the background worker, update the persisted snapshot.
- The dashboard must include overview metrics, request list/search, unused field details, duplicate call details, and selected endpoint drilldown.
- Preserve the existing DevTools panel behavior.
- Add a separate action or internal path for "Refetch/Rebuild" if needed, but do not add a second top-level button unless the UI has a compact menu under `Refresh`.
- The refetch/rebuild behavior should re-run the report from all currently captured network/API events and remove duplicates before summarizing.
- Duplicate removal must be based on a stable key: method + normalized URL/path + status + response body shape or payload hash where available.
- Show duplicate calls as a separate insight, but do not let duplicates inflate the primary totals after dedupe mode is applied.

## Technical Notes

- Use the existing WXT/React/Tailwind setup.
- Reuse existing analyzer utilities and components where practical: `formatBytes`, `buildFieldTree`, `MetricCard`, `PayloadDonut`, `WasteBar`, and `FieldTree`.
- Add a background message such as `dashboard-get-snapshot` that returns `{ state, summary }` for the provided `tabId`.
- Add or extend a background message such as `dashboard-refresh-snapshot` / `dashboard-rebuild-snapshot` that returns a deduped `{ state, summary }` for the provided `tabId`.
- Store raw captured request data in the background worker as the source of truth, and build deduped analyzed requests from that source when refreshing/rebuilding.
- Persist only the dashboard snapshot and summary in `browser.storage.local`; avoid persisting sensitive full response bodies unless the extension already stores them.
- Do not move dashboard-only logic into the DevTools panel bridge because `browser.devtools.inspectedWindow` is unavailable on a normal extension page.
- A normal extension page cannot directly read Chrome DevTools Network panel entries. Prefer the extension's existing instrumentation/background capture as the network source of truth. If true Network panel import is required, it must be implemented inside the DevTools panel using `chrome.devtools.network.getHAR()` and then sent to the background worker.
- If implementing HAR import from the DevTools Network tab, dedupe HAR entries before merging them into the dashboard snapshot.
- Keep all UI light mode, with white surfaces, gray borders, purple primary actions, red waste states, and green used states.

## Acceptance Criteria

- Clicking `See Full Report` from the popup opens the full dashboard for the active tab.
- Clicking `Find more` from the popup opens the same dashboard.
- The popup still loads summary data for the active tab.
- The dashboard renders without DevTools APIs.
- The dashboard shows an empty state when opened without a valid `tabId` or without captured traffic.
- The dashboard has a single visible top-level button named `Refresh`.
- Clicking `Refresh` updates the report without clearing the current problem summary.
- Refreshing the browser tab that hosts `dashboard.html` restores the previous report from `browser.storage.local`.
- The problem summary remains sticky at the top while scrolling.
- Rebuilding/refetching the report removes duplicate requests from primary totals and keeps duplicate insights available separately.
- If Network panel import is attempted, it uses `chrome.devtools.network.getHAR()` from the DevTools context, not from `dashboard.html`.
- `npm run compile` and `npm run build` pass.
