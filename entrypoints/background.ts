import {
  analyzeRequest,
  buildDedupedSummary,
  buildSummary,
  getRequestDeduplicationKey,
  getUrlPath,
} from '@/lib/analyzer';
import {
  buildSessionDashboardSnapshot,
  createSessionId,
  captureMatchesSession,
  filterEntriesForSession,
  getDomainFromUrl,
  getPathFromUrl,
  requestMatchesSessionDomain,
  type RawCaptureEntry,
  type TrackingSession,
} from '@/lib/session';
import type {
  AnalyzedRequest,
  BackgroundGetSnapshotMessage,
  BackgroundOutboundMessage,
  AnalyticsSummary,
  DuplicateGroup,
  PageMessage,
  RequestCapturedPayload,
  TabAnalyticsState,
} from '@/lib/types';
import { PAGE_MESSAGE_SOURCE } from '@/lib/types';

interface TabBuffer {
  raw: Map<string, RawCaptureEntry>;
  pendingUsedPaths: Map<string, Set<string>>;
  analyzed: AnalyzedRequest[];
}

const tabBuffers = new Map<number, TabBuffer>();
const tabSessions = new Map<number, TrackingSession>();
const panelPorts = new Set<Browser.runtime.Port>();

const DEBUG_PREFIX = '[Overfetch Debug]';

function debugLog(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`${DEBUG_PREFIX} ${message}`, details);
    return;
  }
  console.info(`${DEBUG_PREFIX} ${message}`);
}

function getOrCreateBuffer(tabId: number): TabBuffer {
  let buffer = tabBuffers.get(tabId);
  if (!buffer) {
    buffer = { raw: new Map(), pendingUsedPaths: new Map(), analyzed: [] };
    tabBuffers.set(tabId, buffer);
  }
  return buffer;
}

function getTabPageMeta(tab?: Browser.tabs.Tab): {
  pageUrl: string;
  pagePath: string;
  pageTitle: string;
  favicon?: string;
} {
  const pageUrl = tab?.url ?? '';
  return {
    pageUrl,
    pagePath: getPathFromUrl(pageUrl || 'http://localhost/'),
    pageTitle: tab?.title ?? getPathFromUrl(pageUrl || '/'),
    favicon: tab?.favIconUrl,
  };
}

function rebuildTabStateRaw(tabId: number): TabAnalyticsState {
  const buffer = getOrCreateBuffer(tabId);
  buffer.analyzed = [...buffer.raw.values()].map((entry) => {
    return analyzeRequest(entry.payload, [...entry.usedPaths], 0);
  });
  buffer.analyzed.sort((a, b) => b.timestamp - a.timestamp);
  return {
    tabId,
    requests: buffer.analyzed,
    updatedAt: Date.now(),
  };
}

function hasPanelListener(tabId: number): boolean {
  for (const port of panelPorts) {
    if (port.name === `panel-${tabId}` || port.name === 'panel-any') return true;
  }
  return false;
}

const broadcastTimers = new Map<
  number,
  ReturnType<typeof globalThis.setTimeout>
>();
const broadcastPending = new Set<number>();
const BROADCAST_DEBOUNCE_MS = 250;

function broadcastNow(tabId: number): void {
  if (!hasPanelListener(tabId)) return;
  const state = rebuildTabStateRaw(tabId);
  const summary = buildSummary(state.requests);
  const message: BackgroundOutboundMessage = {
    type: 'state-update',
    tabId,
    state,
    summary,
  };
  for (const port of panelPorts) {
    if (port.name === `panel-${tabId}` || port.name === 'panel-any') {
      port.postMessage(message);
    }
  }
}

function scheduleBroadcast(tabId: number): void {
  if (!hasPanelListener(tabId)) return;
  broadcastPending.add(tabId);
  if (broadcastTimers.has(tabId)) return;

  const timerId = globalThis.setTimeout(() => {
    broadcastTimers.delete(tabId);
    if (!broadcastPending.has(tabId)) return;
    broadcastPending.delete(tabId);
    broadcastNow(tabId);
  }, BROADCAST_DEBOUNCE_MS);

  broadcastTimers.set(tabId, timerId);
}

function rebuildTabStateDedupe(tabId: number): {
  state: TabAnalyticsState;
  summary: AnalyticsSummary;
} {
  const buffer = getOrCreateBuffer(tabId);
  const rawEntries = [...buffer.raw.values()];

  const groups = new Map<
    string,
    {
      representative: RequestCapturedPayload;
      usedPathsUnion: Set<string>;
      requestIds: string[];
      totalBytes: number;
    }
  >();

  for (const entry of rawEntries) {
    const payload = entry.payload;
    const key = getRequestDeduplicationKey(
      payload.method,
      payload.url,
      payload.status,
      payload.shape,
    );

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        representative: payload,
        usedPathsUnion: new Set(entry.usedPaths),
        requestIds: [payload.id],
        totalBytes: payload.payloadBytes,
      });
    } else {
      if (payload.timestamp > existing.representative.timestamp) {
        existing.representative = payload;
      }
      for (const p of entry.usedPaths) existing.usedPathsUnion.add(p);
      existing.requestIds.push(payload.id);
      existing.totalBytes += payload.payloadBytes;
    }
  }

  const dedupedRequests: AnalyzedRequest[] = [];
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, group] of groups) {
    const representative = group.representative;
    const duplicateCount = Math.max(0, group.requestIds.length - 1);
    dedupedRequests.push(
      analyzeRequest(representative, [...group.usedPathsUnion], duplicateCount),
    );

    if (group.requestIds.length > 1) {
      duplicateGroups.push({
        key,
        method: representative.method.toUpperCase(),
        path: getUrlPath(representative.url),
        count: group.requestIds.length,
        totalBytes: group.totalBytes,
        requestIds: group.requestIds,
      });
    }
  }

  dedupedRequests.sort((a, b) => b.timestamp - a.timestamp);

  const state: TabAnalyticsState = {
    tabId,
    requests: dedupedRequests,
    updatedAt: Date.now(),
  };

  const summary = buildDedupedSummary({
    dedupedRequests,
    rawRequestCount: rawEntries.length,
    duplicateGroups,
  });

  return { state, summary };
}

function getSessionSnapshot(tabId: number) {
  const session = tabSessions.get(tabId) ?? null;
  const buffer = getOrCreateBuffer(tabId);
  return buildSessionDashboardSnapshot(session, [...buffer.raw.values()]);
}

function clearSessionCapturedData(tabId: number, session: TrackingSession): void {
  const buffer = getOrCreateBuffer(tabId);
  for (const [id, entry] of buffer.raw) {
    if (captureMatchesSession(entry.payload.url, entry.pageUrl, session.domain)) {
      buffer.raw.delete(id);
    }
  }
}

function clearTabRuntimeData(tabId: number): void {
  tabBuffers.delete(tabId);
}

function ensureSession(tabId: number, tab?: Browser.tabs.Tab): TrackingSession | null {
  const existing = tabSessions.get(tabId);
  const domain = tab?.url ? getDomainFromUrl(tab.url) : null;
  if (existing && (!domain || requestMatchesSessionDomain(`https://${domain}/`, existing.domain))) {
    return existing;
  }
  if (!domain) return null;

  if (existing) {
    debugLog('Domain changed; starting fresh runtime session', {
      tabId,
      previousDomain: existing.domain,
      nextDomain: domain,
    });
    clearTabRuntimeData(tabId);
  }

  const meta = getTabPageMeta(tab);
  const session: TrackingSession = {
    id: createSessionId(),
    tabId,
    domain,
    startedAt: new Date().toISOString(),
    favicon: meta.favicon,
    pageTitle: meta.pageTitle,
    pageUrl: meta.pageUrl,
  };

  tabSessions.set(tabId, session);
  return session;
}

async function ensureSessionAsync(tabId: number): Promise<TrackingSession | null> {
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (tab) return ensureSession(tabId, tab);
  return tabSessions.get(tabId) ?? null;
}

async function resetSession(tabId: number): Promise<TrackingSession | null> {
  const session = tabSessions.get(tabId);
  if (!session) return null;

  clearSessionCapturedData(tabId, session);

  const tab = await browser.tabs.get(tabId).catch(() => null);
  const meta = tab ? getTabPageMeta(tab) : null;
  const restarted: TrackingSession = {
    ...session,
    startedAt: new Date().toISOString(),
    favicon: meta?.favicon ?? session.favicon,
    pageTitle: meta?.pageTitle ?? session.pageTitle,
    pageUrl: meta?.pageUrl ?? session.pageUrl,
  };

  tabSessions.set(tabId, restarted);
  return restarted;
}

function handlePageMessage(
  message: PageMessage,
  tabId: number,
  senderTab?: Browser.tabs.Tab,
): void {
  const session = ensureSession(tabId, senderTab);
  if (!session) return;

  const buffer = getOrCreateBuffer(tabId);
  const meta = getTabPageMeta(senderTab);

  if (message.type === 'request-captured') {
    const payload = message.payload;
    const matchesSession = captureMatchesSession(payload.url, meta.pageUrl, session.domain);
    debugLog('Received request-captured in background', {
      tabId,
      payloadUrl: payload.url,
      pageUrl: meta.pageUrl,
      sessionDomain: session.domain,
      matchesSession,
      payloadBytes: payload.payloadBytes,
    });
    if (!matchesSession) return;

    const pendingUsedPaths =
      buffer.pendingUsedPaths.get(message.payload.id) ?? new Set<string>();
    buffer.pendingUsedPaths.delete(message.payload.id);
    buffer.raw.set(message.payload.id, {
      payload,
      usedPaths: pendingUsedPaths,
      pageUrl: meta.pageUrl,
      pagePath: meta.pagePath,
      pageTitle: meta.pageTitle,
      favicon: meta.favicon ?? session.favicon,
    });

    tabSessions.set(tabId, {
      ...session,
      favicon: meta.favicon ?? session.favicon,
      pageTitle: meta.pageTitle,
      pageUrl: meta.pageUrl,
    });
    debugLog('Stored captured payload in tab buffer', {
      tabId,
      requestId: message.payload.id,
      rawEntryCount: buffer.raw.size,
    });
  } else if (message.type === 'field-accessed') {
    const entry = buffer.raw.get(message.payload.requestId);
    if (entry) {
      entry.usedPaths.add(message.payload.path);
      debugLog('Recorded field access', {
        tabId,
        requestId: message.payload.requestId,
        path: message.payload.path,
      });
    } else {
      const pending =
        buffer.pendingUsedPaths.get(message.payload.requestId) ?? new Set<string>();
      pending.add(message.payload.path);
      buffer.pendingUsedPaths.set(message.payload.requestId, pending);
    }
  } else if (message.type === 'route-changed') {
    tabSessions.set(tabId, {
      ...session,
      pageTitle: message.payload.title || session.pageTitle,
      pageUrl: message.payload.url || session.pageUrl,
    });
    debugLog('Updated session from route change', {
      tabId,
      url: message.payload.url,
      title: message.payload.title,
    });
  }

  scheduleBroadcast(tabId);
}

export default defineBackground(() => {
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const session = ensureSession(tabId, tab);
    if (!session) return;
    if (changeInfo.status !== 'complete' && !changeInfo.url && !changeInfo.title) return;

    const domain = tab.url ? getDomainFromUrl(tab.url) : null;
    if (!domain || !requestMatchesSessionDomain(`https://${domain}/`, session.domain)) {
      return;
    }

    const meta = getTabPageMeta(tab);
    tabSessions.set(tabId, {
      ...session,
      favicon: meta.favicon ?? session.favicon,
      pageTitle: meta.pageTitle,
      pageUrl: meta.pageUrl,
    });
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id;

    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'clear-all-data'
    ) {
      tabBuffers.clear();
      tabSessions.clear();
      broadcastPending.clear();
      for (const timerId of broadcastTimers.values()) {
        clearTimeout(timerId);
      }
      broadcastTimers.clear();

      for (const port of panelPorts) {
        const panelTabId = port.name.startsWith('panel-')
          ? Number(port.name.slice('panel-'.length))
          : null;
        if (!panelTabId || !Number.isFinite(panelTabId)) continue;

        port.postMessage({
          type: 'state-update',
          tabId: panelTabId,
          state: {
            tabId: panelTabId,
            requests: [],
            updatedAt: Date.now(),
          },
          summary: buildSummary([]),
        } satisfies BackgroundOutboundMessage);
      }

      sendResponse({ ok: true });
      return true;
    }

    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      'tabId' in message &&
      typeof message.tabId === 'number'
    ) {
      const requestedTabId = message.tabId;

      if (message.type === 'get-reading-session' || message.type === 'dashboard-get-session-snapshot') {
        void ensureSessionAsync(requestedTabId).then(() => {
          debugLog('Popup/dashboard requested reading session', { tabId: requestedTabId });
          sendResponse(getSessionSnapshot(requestedTabId));
        });
        return true;
      }

      if (message.type === 'reset-session' || message.type === 'dashboard-reset-session') {
        void resetSession(requestedTabId).then((session) => {
          sendResponse({ session, snapshot: getSessionSnapshot(requestedTabId) });
        });
        return true;
      }

      if (message.type === 'popup-get-summary') {
        void ensureSessionAsync(requestedTabId).then(() => {
          const snapshot = getSessionSnapshot(requestedTabId);
          debugLog('Popup requested summary', {
            tabId: requestedTabId,
            hasSession: Boolean(snapshot.session),
            hasSummary: Boolean(snapshot.summary),
            rawEntries: getOrCreateBuffer(requestedTabId).raw.size,
          });
          if (snapshot.summary && snapshot.analytics) {
            sendResponse({ summary: snapshot.analytics, session: snapshot.session });
            return;
          }
          const state = rebuildTabStateRaw(requestedTabId);
          const summary = buildSummary(state.requests);
          sendResponse({ summary, session: snapshot.session });
        });
        return true;
      }

      if (
        message.type === 'dashboard-get-snapshot' ||
        message.type === 'dashboard-refresh-snapshot' ||
        message.type === 'dashboard-rebuild-snapshot'
      ) {
        void ensureSessionAsync(requestedTabId).then(() => {
          const sessionSnapshot = getSessionSnapshot(requestedTabId);
          if (sessionSnapshot.session && sessionSnapshot.summary) {
            const filteredEntries = filterEntriesForSession(
              [...getOrCreateBuffer(requestedTabId).raw.values()],
              sessionSnapshot.session,
            );
            const deduped = filteredEntries.map((e) =>
              analyzeRequest(e.payload, [...e.usedPaths], 0),
            );
            sendResponse({
              session: sessionSnapshot,
              state: {
                tabId: requestedTabId,
                requests: deduped,
                updatedAt: Date.now(),
              },
              summary: sessionSnapshot.analytics,
            });
            return;
          }
          const { state, summary } = rebuildTabStateDedupe(requestedTabId);
          sendResponse({ state, summary, session: sessionSnapshot });
        });
        return true;
      }
    }

    if (!tabId) return false;

    const msg = message as PageMessage & { source?: string };
    if (msg?.source !== PAGE_MESSAGE_SOURCE) return false;

    if (msg.type === 'request-captured' || msg.type === 'field-accessed') {
      handlePageMessage(msg, tabId, sender.tab);
    }
    return false;
  });

  browser.runtime.onConnect.addListener((port) => {
    if (!port.name.startsWith('panel-')) return;
    panelPorts.add(port);

    port.onMessage.addListener((msg: BackgroundGetSnapshotMessage) => {
      if (msg.type !== 'get-snapshot') return;
      const tabId = msg.tabId;
      const state = rebuildTabStateRaw(tabId);
      const summary = buildSummary(state.requests);
      port.postMessage({
        type: 'snapshot',
        tabId,
        state,
        summary,
      } satisfies BackgroundOutboundMessage);
    });

    port.onDisconnect.addListener(() => {
      panelPorts.delete(port);
    });
  });
});
