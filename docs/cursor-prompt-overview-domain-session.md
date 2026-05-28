# Cursor Prompt: Domain Session Overview Page

Update the Overfetch Overview page so it summarizes exactly one tracked domain/session, not the entire app, not all historical data, and not the current page in isolation.

## Product Goal

The Overview page must answer this in under 5 seconds:

> Since you started reading this website, how much API data did this domain return, and how much did the UI actually use?

Primary message example:

> Since tracking started on app.example.com, your APIs returned 2.57 MB, but your UI only used 1.28 MB. You can remove 1.30 MB.

Tracking begins only after the user clicks `Start Reading` in the Chrome extension popup.

Do not count:

- Requests before `Start Reading`
- Other browser tabs
- Other domains
- Previous sessions unless the user explicitly saved or reloaded that saved session

## Current Scope

The Overview page represents:

> API usage for the current tracked domain after the user started reading.

Example session:

- Domain: `app.example.com`
- Started at: `2:34 PM`
- Pages visited after start: `1`
- API calls after start: `6`

## Required Header

Show domain/session context clearly near the page title.

Add a domain pill or compact context group:

- `Domain: app.example.com`
- `Status: Reading active`
- `Started: 2:34 PM`

Add controls:

- `Stop Reading`
- `Refresh`
- `Reset Data`

The page should also show which website/page the analytics came from, including the site logo. Use the tracked page favicon when available. If unavailable, fall back to the domain initial or existing Overfetch icon styling.

## Empty State

Before the user clicks `Start Reading`, do not show fake analytics.

Show:

- Title: `Start reading this website`
- Description: `Click Start Reading in the extension popup to capture API calls and see what data your UI actually uses.`
- Button: `Open Extension Popup`

## Hero Diagnosis Card

Replace any full-app or single-page diagnosis with a domain/session diagnosis.

Title:

> You're overfetching

Subtitle:

> Your UI uses less data than this domain's APIs return.

Main sentence:

> 1.30 MB wasted across 6 API calls since tracking started.

Right side:

- Circular score
- Label: `50% Waste`

This card is domain/session-level, not full-app and not single-page.

## Metric Cards

Render these six cards:

1. `Pages Visited`
   - Value: `1`
   - Helper: `After tracking started`

2. `API Calls`
   - Value: `6`
   - Helper: `From app.example.com`

3. `Total Payload`
   - Value: `2.57 MB`
   - Helper: `Data returned by APIs`

4. `Used by UI`
   - Value: `1.28 MB`
   - Helper: `158 fields rendered`

5. `Wasted`
   - Value: `1.30 MB`
   - Helper: `50% unused`

6. `Efficiency Score`
   - Value: `50 / 100`
   - Helper: `For this domain session`

## Remove Previous-Page Comparison

Remove these concepts from the Overview page:

- `Compared to previous page`
- `This Page vs Previous Page`
- Current page as the main diagnosis

The Overview page may list captured pages, but the primary diagnosis must be the current domain reading session.

## Card 1: Pages Captured After Start

Show pages visited on this domain after the user clicked `Start Reading`.

Columns:

- Page
- URL path
- Time captured
- API calls
- Payload
- Used by UI
- Wasted
- Waste %

Example row:

- `Dashboard`
- `/dashboard`
- `2:34 PM`
- `6 calls`
- `2.57 MB`
- `1.28 MB`
- `1.30 MB`
- `50%`

Add a `View page details` button/action for each row. If only one page exists, show one row.

## Card 2: Domain Session Diagnosis

Add a human-readable diagnosis card.

Title:

> Why this domain session is inefficient

Bullets:

- `Most waste came from /api/lead?`
- `1.29 MB was returned but not used by the UI`
- `The items field is the largest unused field`
- `3 endpoints returned 100% unused data`

CTA:

- Primary: `Generate Fix`
- Secondary: `View raw payload`

## Session Timeline Card

Add a simple timeline showing collection began after `Start Reading`.

Title:

> Reading Timeline

Example:

> Start Reading -> app.example.com/dashboard -> 6 API calls -> 2.57 MB returned -> 50% wasted

Use simple separators or timeline dots. Keep it readable and not dense.

## Bottom Cards

### Top Waste by Endpoint

Rank endpoint waste only for the current tracked domain/session.

Example rows:

- `GET /api/lead?` - `1.29 MB wasted` - `100%`
- `GET /api/user` - `3.2 KB wasted` - `100%`
- `GET response.json()` - `3.2 KB wasted` - `100%`

### Biggest Unused Fields

Rank unused fields only from this tracked domain/session.

Example row:

- `items` - `array` - `1.29 MB`

## Data Model

Update the Zustand dashboard store to track domain sessions explicitly.

```ts
type TrackingSession = {
  id: string
  domain: string
  startedAt: string
  stoppedAt?: string
  status: "idle" | "reading" | "stopped"
}

type CapturedPage = {
  id: string
  sessionId: string
  domain: string
  title: string
  url: string
  path: string
  thumbnail?: string
  favicon?: string
  capturedAt: string
  apiCallCount: number
  totalPayloadBytes: number
  usedBytes: number
  wastedBytes: number
  wastePercentage: number
}

type CapturedEndpoint = {
  id: string
  sessionId: string
  domain: string
  method: string
  url: string
  path: string
  pagePath: string
  status: number
  payloadBytes: number
  usedBytes: number
  wastedBytes: number
  wastePercentage: number
}

type UnusedField = {
  id: string
  sessionId: string
  domain: string
  path: string
  type: "string" | "number" | "object" | "array" | "boolean"
  wastedBytes: number
  endpointPath: string
  pagePath: string
}

type DomainSessionSummary = {
  sessionId: string
  domain: string
  startedAt: string
  status: "idle" | "reading" | "stopped"
  pagesVisited: number
  apiCalls: number
  totalPayloadBytes: number
  usedBytes: number
  wastedBytes: number
  wastePercentage: number
  efficiencyScore: number
}
```

## Tracking Rules

- `Start Reading` creates a new `TrackingSession` for the active tab's current domain.
- Capture only requests whose tab matches the tracked tab and whose domain matches the active session domain.
- Ignore requests that started before `TrackingSession.startedAt`.
- Ignore requests from other tabs.
- Ignore requests from other domains, including third-party APIs unless the product explicitly decides to include them later.
- `Stop Reading` sets `stoppedAt` and `status: "stopped"` and stops adding new events to that session.
- `Reset Data` clears the current unsaved session's pages, endpoints, unused fields, and summary.
- `Refresh` rebuilds the current domain/session summary from already captured session events without adding out-of-scope events.

## UX Copy Rules

Use simple wording:

- `Since tracking started`
- `This domain`
- `Current reading session`
- `Pages captured after start`

Avoid:

- Previous-page comparison
- Full-app wording
- Enterprise analytics language
- Dense tables
- Fake pre-tracking analytics

## Implementation Notes

- Use the existing WXT, React, Tailwind, and Zustand setup.
- Prefer existing dashboard components where practical: metric cards, circular progress, endpoint waste lists, unused field lists, and current formatting helpers.
- Update `entrypoints/dashboard/store.ts`, `entrypoints/dashboard/types.ts`, and `components/dashboard/OverviewPage.tsx` as needed.
- Update popup/background messaging so `Start Reading`, `Stop Reading`, and dashboard refresh operate on a `TrackingSession`.
- Include favicon metadata from the captured page where available. Use the active tab favicon, page metadata, or extension-accessible favicon URL depending on what is already available in the codebase.
- Keep the dashboard light, direct, and scannable.

## Acceptance Criteria

- Overview shows the empty state before `Start Reading`.
- `Start Reading` starts a new session scoped to the active tab and active domain.
- Requests before `Start Reading` are not counted.
- Requests from other tabs are not counted.
- Requests from other domains are not counted.
- Previous sessions are not counted unless explicitly saved/reloaded.
- Header shows domain, reading status, started time, and controls.
- Header or page context shows the analyzed page/domain with a favicon/logo when available.
- Hero card uses domain/session copy and displays wasted bytes, API call count, and waste percent.
- Six metric cards match the required labels and helpers.
- Previous-page comparison UI is removed from the Overview page.
- Pages captured after start are listed with path, capture time, calls, payload, used, wasted, and waste percent.
- Domain Session Diagnosis card renders the required human-readable bullets and CTAs.
- Reading Timeline clearly starts with `Start Reading`.
- Top Waste by Endpoint and Biggest Unused Fields are filtered to the current domain/session.
- `Stop Reading`, `Refresh`, and `Reset Data` update the current session without affecting unrelated tabs/domains.
- `npm run compile` and `npm run build` pass.
